import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { OpenAPIObject } from '@nestjs/swagger';
import {
  completeMaintenanceReminderSchema,
  createMaintenanceReminderSchema,
  createServiceRecordSchema,
  createVehicleSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
  updateMaintenanceReminderSchema,
  updateServiceRecordSchema,
  updateVehicleSchema,
  type Env,
} from '@autogenius/validation';
import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { ENV } from '../src/config/config.module';
import { isSwaggerEnabled } from '../src/docs/openapi';
import { VehiclesController } from '../src/vehicles/vehicles.controller';
import { VehiclesService } from '../src/vehicles/vehicles.service';
import {
  MaintenanceRemindersController,
} from '../src/service-history/maintenance-reminders.controller';
import { MaintenanceSummaryController } from '../src/service-history/maintenance-summary.controller';
import { ServiceRecordsController } from '../src/service-history/service-records.controller';
import { ServiceHistoryService } from '../src/service-history/service-history.service';
import {
  createVehicleExample,
  updateVehicleExample,
} from '../src/docs/dto/vehicle.dto';
import {
  completeMaintenanceReminderExample,
  createMaintenanceReminderExample,
  createServiceRecordExample,
  updateMaintenanceReminderExample,
  updateServiceRecordExample,
} from '../src/docs/dto/service-history.dto';
import {
  loginInputExample,
  refreshTokenExample,
  registerInputExample,
} from '../src/docs/dto/auth.dto';

/**
 * Guards the two ways documentation rots: examples that no longer satisfy the
 * live Zod schemas, and internal columns leaking into a public schema.
 */
describe('OpenAPI document contract', () => {
  let document: OpenAPIObject;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      // The controllers keep their guards here so the scanned metadata matches
      // what the real AppModule serves; the services behind them are stubs.
      imports: [ThrottlerModule.forRoot([{ name: 'auth', ttl: 60_000, limit: 5 }])],
      controllers: [
        AppController,
        AuthController,
        VehiclesController,
        ServiceRecordsController,
        MaintenanceRemindersController,
        MaintenanceSummaryController,
      ],
      providers: [
        AppService,
        { provide: AuthService, useValue: {} },
        { provide: VehiclesService, useValue: {} },
        { provide: ServiceHistoryService, useValue: {} },
        { provide: ENV, useValue: {} },
      ],
    }).compile();

    const app: INestApplication = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');

    const config = new DocumentBuilder()
      .setTitle('AutoGenius API')
      .setDescription('AutoGenius REST API documentation')
      .setVersion('1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearer')
      .build();
    document = SwaggerModule.createDocument(app, config);
  });

  it('documents every implemented route, and nothing else', () => {
    const operations = Object.entries(document.paths)
      .flatMap(([path, item]) =>
        Object.keys(item as Record<string, unknown>).map((method) => `${method.toUpperCase()} ${path}`),
      )
      .sort();

    expect(operations).toEqual([
      'DELETE /api/v1/vehicles/{id}',
      'DELETE /api/v1/vehicles/{vehicleId}/maintenance-reminders/{reminderId}',
      'DELETE /api/v1/vehicles/{vehicleId}/service-records/{recordId}',
      'GET /api/v1/auth/me',
      'GET /api/v1/health',
      'GET /api/v1/vehicles',
      'GET /api/v1/vehicles/{id}',
      'GET /api/v1/vehicles/{vehicleId}/maintenance-reminders',
      'GET /api/v1/vehicles/{vehicleId}/maintenance-reminders/{reminderId}',
      'GET /api/v1/vehicles/{vehicleId}/maintenance-summary',
      'GET /api/v1/vehicles/{vehicleId}/service-records',
      'GET /api/v1/vehicles/{vehicleId}/service-records/{recordId}',
      'PATCH /api/v1/vehicles/{id}',
      'PATCH /api/v1/vehicles/{id}/default',
      'PATCH /api/v1/vehicles/{vehicleId}/maintenance-reminders/{reminderId}',
      'PATCH /api/v1/vehicles/{vehicleId}/maintenance-reminders/{reminderId}/complete',
      'PATCH /api/v1/vehicles/{vehicleId}/maintenance-reminders/{reminderId}/dismiss',
      'PATCH /api/v1/vehicles/{vehicleId}/maintenance-reminders/{reminderId}/reopen',
      'PATCH /api/v1/vehicles/{vehicleId}/service-records/{recordId}',
      'POST /api/v1/auth/login',
      'POST /api/v1/auth/logout',
      'POST /api/v1/auth/refresh',
      'POST /api/v1/auth/register',
      'POST /api/v1/vehicles',
      'POST /api/v1/vehicles/{vehicleId}/maintenance-reminders',
      'POST /api/v1/vehicles/{vehicleId}/service-records',
    ]);
  });

  it('marks only the auth endpoints and health as public', () => {
    const publicOps = ['POST /api/v1/auth/register', 'POST /api/v1/auth/login', 'POST /api/v1/auth/refresh', 'POST /api/v1/auth/logout', 'GET /api/v1/health'];
    for (const [path, item] of Object.entries(document.paths)) {
      for (const [method, operation] of Object.entries(item as Record<string, { security?: unknown }>)) {
        const key = `${method.toUpperCase()} ${path}`;
        if (publicOps.includes(key)) {
          expect(operation.security).toBeUndefined();
        } else {
          expect(operation.security).toEqual([{ bearer: [] }]);
        }
      }
    }
  });

  it('declares the bearer security scheme the Authorize button uses', () => {
    expect(document.components?.securitySchemes).toMatchObject({
      bearer: { type: 'http', scheme: 'bearer' },
    });
  });

  /** Rebuilds a request body from the per-property examples the UI renders. */
  function exampleObjectFrom(schemaName: string): Record<string, unknown> {
    const schema = document.components?.schemas?.[schemaName] as {
      properties?: Record<string, { example?: unknown }>;
    };
    const collected: Record<string, unknown> = {};
    for (const [field, property] of Object.entries(schema.properties ?? {})) {
      if ('example' in property && property.example !== undefined) {
        collected[field] = property.example;
      }
    }
    return collected;
  }

  it('validates the documented register example against the live schema', () => {
    const fromDocument = exampleObjectFrom('RegisterInputDto');
    expect(fromDocument).toEqual(registerInputExample);
    expect(registerSchema.parse(fromDocument)).toMatchObject({
      email: 'jitendra@example.com',
      // The example is typed with separators; the API stores the canonical form.
      phone: '+919876543210',
    });
  });

  it('validates the documented login and refresh examples', () => {
    const login = exampleObjectFrom('LoginInputDto');
    expect(login).toEqual(loginInputExample);
    expect(loginSchema.parse(login)).toEqual(login);

    const refresh = exampleObjectFrom('RefreshInputDto');
    expect(refresh).toEqual(refreshTokenExample);
    expect(refreshSchema.parse(refresh)).toEqual(refresh);
  });

  it('validates the documented vehicle examples', () => {
    const create = exampleObjectFrom('CreateVehicleInputDto');
    expect(create).toEqual(createVehicleExample);
    expect(createVehicleSchema.parse(create)).toMatchObject({
      registrationNumber: 'MH 12 AB 1234',
      fuelType: 'PETROL',
    });

    const update = exampleObjectFrom('UpdateVehicleInputDto');
    expect(update).toEqual(updateVehicleExample);
    expect(updateVehicleSchema.parse(update)).toEqual(update);
  });

  it('validates the documented service-record examples', () => {
    const create = exampleObjectFrom('CreateServiceRecordInputDto');
    expect(create).toEqual(createServiceRecordExample);
    const parsed = createServiceRecordSchema.parse(create);
    expect(parsed).toMatchObject({
      serviceDate: '2026-10-21',
      serviceType: 'GENERAL_SERVICE',
      // Costs arrive as money and leave with at most two decimals.
      labourCost: 900,
      partsCost: 3650,
    });
    expect(parsed.partsReplaced).toHaveLength(2);

    const update = exampleObjectFrom('UpdateServiceRecordInputDto');
    expect(update).toEqual(updateServiceRecordExample);
    expect(updateServiceRecordSchema.parse(update)).toEqual(update);
  });

  it('validates the documented reminder examples', () => {
    const create = exampleObjectFrom('CreateMaintenanceReminderInputDto');
    expect(create).toEqual(createMaintenanceReminderExample);
    expect(createMaintenanceReminderSchema.parse(create)).toMatchObject({
      title: 'Oil change',
      intervalMonths: 12,
      intervalKm: 10000,
    });

    const update = exampleObjectFrom('UpdateMaintenanceReminderInputDto');
    expect(update).toEqual(updateMaintenanceReminderExample);
    expect(updateMaintenanceReminderSchema.parse(update)).toEqual(update);

    const complete = exampleObjectFrom('CompleteMaintenanceReminderInputDto');
    expect(complete).toEqual(completeMaintenanceReminderExample);
    expect(completeMaintenanceReminderSchema.parse(complete)).toEqual(complete);
  });

  it('requires only the fields the service-history schemas require', () => {
    const required = (name: string) =>
      (document.components?.schemas?.[name] as { required?: string[] }).required ?? [];

    expect(required('CreateServiceRecordInputDto').sort()).toEqual([
      'serviceDate',
      'serviceType',
    ]);
    expect(required('UpdateServiceRecordInputDto')).toEqual([]);
    expect(required('CreateMaintenanceReminderInputDto')).toEqual(['title']);
    expect(required('UpdateMaintenanceReminderInputDto')).toEqual([]);
    expect(required('CompleteMaintenanceReminderInputDto').sort()).toEqual([
      'completionDate',
      'completionOdometerKm',
    ]);
    expect(required('ReplacedPartInputDto')).toEqual(['name']);
    expect(required('ReplacedPartDto').sort()).toEqual(['cost', 'name', 'quantity']);
  });

  it('keeps client-supplied totals out of the request schema', () => {
    const create = document.components?.schemas?.['CreateServiceRecordInputDto'] as {
      properties?: Record<string, unknown>;
    };
    expect(create.properties).not.toHaveProperty('totalCost');
    expect(create.properties).not.toHaveProperty('userId');
    expect(create.properties).not.toHaveProperty('vehicleId');
  });

  it('does not leak ownership columns into history responses', () => {
    for (const name of ['ServiceRecordDto', 'MaintenanceReminderDto']) {
      const schema = document.components?.schemas?.[name] as {
        properties?: Record<string, unknown>;
      };
      expect(schema.properties).not.toHaveProperty('userId');
    }
    // The summary is a read model, so it exposes neither id columns it did not
    // need nor any stored roll-up.
    const summary = document.components?.schemas?.['MaintenanceSummaryDto'] as {
      properties?: Record<string, unknown>;
    };
    expect(Object.keys(summary.properties ?? {}).sort()).toEqual([
      'activeReminders',
      'lastServiceDate',
      'lastServiceOdometer',
      'overdueReminders',
      'totalExpenditure',
      'totalServiceRecords',
      'upcomingReminders',
      'vehicleId',
    ]);
  });

  it('documents the list filters as query parameters', () => {
    const parametersOf = (path: string, method: 'get') =>
      (document.paths[path]?.[method] as { parameters?: { name: string; in: string }[] })
        .parameters ?? [];

    expect(
      parametersOf('/api/v1/vehicles/{vehicleId}/service-records', 'get')
        .filter((parameter) => parameter.in === 'query')
        .map((parameter) => parameter.name)
        .sort(),
    ).toEqual(['from', 'page', 'pageSize', 'serviceType', 'to']);

    expect(
      parametersOf('/api/v1/vehicles/{vehicleId}/maintenance-reminders', 'get')
        .filter((parameter) => parameter.in === 'query')
        .map((parameter) => parameter.name)
        .sort(),
    ).toEqual(['due', 'page', 'pageSize', 'status']);
  });

  it('requires only the fields the Zod schemas require', () => {
    const required = (name: string) =>
      (document.components?.schemas?.[name] as { required?: string[] }).required ?? [];

    expect(required('RegisterInputDto').sort()).toEqual(['email', 'name', 'password']);
    expect(required('LoginInputDto').sort()).toEqual(['email', 'password']);
    expect(required('RefreshInputDto')).toEqual(['refreshToken']);
    expect(required('CreateVehicleInputDto').sort()).toEqual([
      'fuelType',
      'make',
      'manufacturingYear',
      'model',
      'transmission',
    ]);
  });

  it('never exposes credential material', () => {
    const json = JSON.stringify(document);
    for (const banned of [
      'passwordHash',
      'refreshTokenHash',
      'tokenHash',
      'JWT_ACCESS_SECRET',
      'JWT_REFRESH_SECRET',
      'DATABASE_URL',
    ]) {
      expect(json).not.toContain(banned);
    }
    // Passwords appear only as inputs, never on a response schema.
    const responses = document.paths['/api/v1/auth/register']?.post?.responses as Record<
      string,
      { content?: Record<string, { schema?: { $ref?: string } }> }
    >;
    const ref = responses['201']?.content?.['application/json']?.schema?.$ref ?? '';
    expect(ref).toContain('AuthResponseDto');
    expect(document.components?.schemas?.['AuthResponseDto']).not.toHaveProperty('properties.password');
    expect(document.components?.schemas?.['PublicUserDto']).not.toHaveProperty('properties.password');
  });

  describe('isSwaggerEnabled', () => {
    const env = (nodeEnv: string, swagger?: 'true' | 'false') =>
      ({ NODE_ENV: nodeEnv, SWAGGER_ENABLED: swagger }) as Env;

    it('serves the docs in development and test', () => {
      expect(isSwaggerEnabled(env('development'))).toBe(true);
      expect(isSwaggerEnabled(env('test'))).toBe(true);
    });

    it('hides them in production unless explicitly turned on', () => {
      expect(isSwaggerEnabled(env('production'))).toBe(false);
      expect(isSwaggerEnabled(env('production', 'true'))).toBe(true);
    });

    it('lets an explicit value override the default either way', () => {
      expect(isSwaggerEnabled(env('development', 'false'))).toBe(false);
    });
  });
});
