import 'reflect-metadata';
import { loadRootEnvFile } from './utils/load-root-env';

// Real PostgreSQL only — the vehicles module relies on partial unique indexes,
// expression indexes and row locks that pg-mem does not reproduce faithfully.
loadRootEnvFile();
process.env['NODE_ENV'] = 'test';
process.env['RATE_LIMIT_TTL_MS'] = '60000';
process.env['RATE_LIMIT_AUTH_MAX'] = '10000';
process.env['RATE_LIMIT_REFRESH_MAX'] = '10000';

import { Controller, Get, INestApplication, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { getDataSourceToken, InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ConfigModule } from '../src/config/config.module';
import { DatabaseModule } from '../src/database/database.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';

type Row = Record<string, unknown>;

const runId = `${Date.now()}`;
const emailFor = (label: string): string =>
  `pg-veh-${runId}-${label}@example.com`;

const baseVehicle = {
  make: 'Maruti Suzuki',
  model: 'Baleno',
  variant: 'ZXi',
  registrationNumber: 'MH 12 AB 1234',
  manufacturingYear: 2019,
  fuelType: 'PETROL',
  transmission: 'MANUAL',
  purchaseDate: '2019-06-15',
  currentOdometer: 42000,
};

const vehicleFields = [
  'id',
  'userId',
  'make',
  'model',
  'variant',
  'registrationNumber',
  'manufacturingYear',
  'fuelType',
  'transmission',
  'purchaseDate',
  'currentOdometer',
  'isDefault',
  'createdAt',
  'updatedAt',
];

describe('Vehicles against real PostgreSQL', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
    dataSource = moduleRef.get<DataSource>(getDataSourceToken());
  }, 60000);

  afterAll(async () => {
    // Vehicles disappear with their owner through ON DELETE CASCADE.
    await dataSource.query(
      `DELETE FROM users WHERE id = ANY($1::uuid[]) OR email LIKE $2`,
      [createdUserIds, `pg-veh-${runId}-%`],
    );
    await app?.close();
  });

  async function signUp(label: string): Promise<{ id: string; token: string }> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        name: 'Vehicle E2E',
        email: emailFor(label),
        password: 'password123',
      });
    expect(res.status).toBe(201);
    const id = res.body.user.id as string;
    createdUserIds.push(id);
    return { id, token: res.body.accessToken as string };
  }

  const api = (token: string) => ({
    post: (path: string, body: object) =>
      request(app.getHttpServer())
        .post(`/api/v1${path}`)
        .set('Authorization', `Bearer ${token}`)
        .send(body),
    patch: (path: string, body: object) =>
      request(app.getHttpServer())
        .patch(`/api/v1${path}`)
        .set('Authorization', `Bearer ${token}`)
        .send(body),
    get: (path: string) =>
      request(app.getHttpServer())
        .get(`/api/v1${path}`)
        .set('Authorization', `Bearer ${token}`),
    del: (path: string) =>
      request(app.getHttpServer())
        .delete(`/api/v1${path}`)
        .set('Authorization', `Bearer ${token}`),
  });

  async function vehicleRows(userId: string): Promise<Row[]> {
    return dataSource.query(
      `SELECT id, make, model, variant, registration_number, manufacturing_year,
              fuel_type, transmission, purchase_date, current_odometer, is_default
       FROM vehicles WHERE user_id = $1 ORDER BY created_at, id`,
      [userId],
    );
  }

  async function defaultCount(userId: string): Promise<number> {
    const rows = await dataSource.query(
      `SELECT count(*)::int AS n FROM vehicles WHERE user_id = $1 AND is_default`,
      [userId],
    );
    return rows[0]?.n as number;
  }

  /** The pg driver hands a raw `date` column back as a local-midnight Date. */
  function calendarDay(value: unknown): string {
    if (value instanceof Date) {
      const month = `${value.getMonth() + 1}`.padStart(2, '0');
      const day = `${value.getDate()}`.padStart(2, '0');
      return `${value.getFullYear()}-${month}-${day}`;
    }
    return String(value);
  }

  it('applied the vehicles migration with its constraints and indexes', async () => {
    const applied = await dataSource.query(
      `SELECT name FROM migrations ORDER BY id DESC`,
    );
    const appliedNames = applied.map((row: Row) => row.name);
    expect(appliedNames).toContain('CreateVehicles1793664000000');
    expect(appliedNames).toContain(
      'NormalizeVehicleRegistrationUniqueness1793750400000',
    );

    const indexes = await dataSource.query(
      `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'vehicles'`,
    );
    const names = indexes.map((row: Row) => row.indexname);
    expect(names).toEqual(
      expect.arrayContaining([
        'vehicles_pkey',
        'vehicles_user_id_idx',
        'vehicles_user_default_unique',
        'vehicles_user_registration_unique',
      ]),
    );
    const partial = indexes.find(
      (row: Row) => row.indexname === 'vehicles_user_default_unique',
    );
    expect(String(partial.indexdef)).toContain('WHERE is_default');

    const plateIndex = indexes.find(
      (row: Row) => row.indexname === 'vehicles_user_registration_unique',
    );
    const plateDefinition = String(plateIndex.indexdef);
    expect(plateDefinition).toContain(
      'WHERE (registration_number IS NOT NULL)',
    );

    // Separators are dropped so two spellings of one plate cannot both be stored.
    expect(plateDefinition).toContain(
      "regexp_replace(upper((registration_number)::text), '[^A-Z0-9]'::text, ''::text, 'g'::text)",
    );

    const checks = await dataSource.query(
      `SELECT conname FROM pg_constraint
       WHERE conrelid = 'vehicles'::regclass AND contype = 'c'`,
    );
    expect(checks.map((row: Row) => row.conname)).toEqual(
      expect.arrayContaining([
        'vehicles_manufacturing_year_range',
        'vehicles_fuel_type_check',
        'vehicles_transmission_check',
        'vehicles_odometer_range',
      ]),
    );
  });

  it('requires authentication for every vehicles route', async () => {
    const uuid = '00000000-0000-4000-8000-000000000000';
    const calls = [
      () => request(app.getHttpServer()).get('/api/v1/vehicles'),
      () => request(app.getHttpServer()).post('/api/v1/vehicles').send(baseVehicle),
      () => request(app.getHttpServer()).get(`/api/v1/vehicles/${uuid}`),
      () => request(app.getHttpServer()).patch(`/api/v1/vehicles/${uuid}`).send({ make: 'x' }),
      () => request(app.getHttpServer()).patch(`/api/v1/vehicles/${uuid}/default`).send({}),
      () => request(app.getHttpServer()).delete(`/api/v1/vehicles/${uuid}`),
    ];
    for (const call of calls) {
      expect((await call()).status).toBe(401);
    }
  });

  it('creates the first vehicle as the default and persists every column', async () => {
    const { id, token } = await signUp('create');
    const res = await api(token).post('/vehicles', baseVehicle);

    expect(res.status).toBe(201);
    expect(Object.keys(res.body).sort()).toEqual([...vehicleFields].sort());
    expect(res.body.userId).toBe(id);
    expect(res.body.isDefault).toBe(true);
    expect(res.body.currentOdometer).toBe(42000);
    expect(res.body.purchaseDate).toBe('2019-06-15');
    // A date-only field must survive as a calendar day, never as a timestamp
    // that shifts depending on the server's zone.
    expect(res.body.purchaseDate).not.toContain('T');

    const rows = await vehicleRows(id);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.registration_number).toBe('MH 12 AB 1234');
    expect(rows[0]?.manufacturing_year).toBe(2019);
    expect(calendarDay(rows[0]?.purchase_date)).toBe('2019-06-15');
  });

  it('normalizes a lower-case plate on the way in', async () => {
    const { id, token } = await signUp('plate');
    const res = await api(token).post('/vehicles', {
      ...baseVehicle,
      registrationNumber: '  mh   12 ab  1234 ',
    });
    expect(res.body.registrationNumber).toBe('MH 12 AB 1234');
    const rows = await vehicleRows(id);
    expect(rows[0]?.registration_number).toBe('MH 12 AB 1234');
  });

  it('stores null for optionals sent blank or omitted', async () => {
    const { id, token } = await signUp('nulls');
    const res = await api(token).post('/vehicles', {
      make: 'Tata',
      model: 'Nexon',
      variant: '',
      registrationNumber: '',
      purchaseDate: '',
      currentOdometer: '',
      manufacturingYear: 2022,
      fuelType: 'ELECTRIC',
      transmission: 'AUTOMATIC',
    });
    expect(res.status).toBe(201);
    expect(res.body.variant).toBeNull();
    expect(res.body.registrationNumber).toBeNull();
    expect(res.body.purchaseDate).toBeNull();
    expect(res.body.currentOdometer).toBeNull();

    // Two plateless vehicles of the same owner must not collide.
    const second = await api(token).post('/vehicles', {
      make: 'Hyundai',
      model: 'Creta',
      manufacturingYear: 2023,
      fuelType: 'DIESEL',
      transmission: 'AUTOMATIC',
    });
    expect(second.status).toBe(201);
    expect(second.body.isDefault).toBe(false);
    expect(await vehicleRows(id)).toHaveLength(2);
  });

  it('rejects invalid payloads with 400s that name the field, not the database', async () => {
    const { id, token } = await signUp('invalid');
    const cases: Array<Record<string, unknown>> = [
      { ...baseVehicle, fuelType: 'PETTROL' },
      { ...baseVehicle, transmission: 'DCT' },
      { ...baseVehicle, manufacturingYear: 1899 },
      { ...baseVehicle, manufacturingYear: new Date().getFullYear() + 5 },
      { ...baseVehicle, currentOdometer: -1 },
      { ...baseVehicle, currentOdometer: 2_000_001 },
      { ...baseVehicle, purchaseDate: '2019-02-30' },
      { ...baseVehicle, make: '' },
      { ...baseVehicle, registrationNumber: '!!' },
    ];

    for (const body of cases) {
      const res = await api(token).post('/vehicles', body);
      expect(res.status).toBe(400);
      const text = JSON.stringify(res.body);
      expect(text).not.toMatch(/insert into|vehicles_|23\d{3}|QueryFailedError/i);
    }
    expect(await vehicleRows(id)).toHaveLength(0);
  });

  it('keeps a second vehicle non-default and lists the default first', async () => {
    const { id, token } = await signUp('list');
    const first = await api(token).post('/vehicles', baseVehicle);
    const second = await api(token).post('/vehicles', {
      ...baseVehicle,
      model: 'Dzire',
      registrationNumber: 'MH 14 CD 5678',
    });
    expect(second.body.isDefault).toBe(false);
    expect(await defaultCount(id)).toBe(1);

    const list = await api(token).get('/vehicles');
    expect(list.status).toBe(200);
    expect(list.body.map((v: Row) => v.id)).toContain(first.body.id);
    expect(list.body[0].isDefault).toBe(true);
  });

  it('never lets one user read, edit or delete another user\'s vehicle', async () => {
    const owner = await signUp('owner');
    const intruder = await signUp('intruder');
    const created = await api(owner.token).post('/vehicles', baseVehicle);
    const vehicleId = created.body.id as string;

    const read = await api(intruder.token).get(`/vehicles/${vehicleId}`);
    expect(read.status).toBe(404);

    const edit = await api(intruder.token).patch(`/vehicles/${vehicleId}`, {
      currentOdometer: 999_999,
    });
    expect(edit.status).toBe(404);

    const promote = await api(intruder.token).patch(
      `/vehicles/${vehicleId}/default`,
      {},
    );
    expect(promote.status).toBe(404);

    const remove = await api(intruder.token).del(`/vehicles/${vehicleId}`);
    expect(remove.status).toBe(404);

    // The intruder sees an empty list, and the owner's row is untouched.
    expect(await api(intruder.token).get('/vehicles')).toEqual(
      expect.objectContaining({ status: 200, body: [] }),
    );
    const rows = await vehicleRows(owner.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.current_odometer).toBe(42000);
    expect(rows[0]?.is_default).toBe(true);
  });

  it('rejects malformed and unknown ids', async () => {
    const { token } = await signUp('ids');
    const malformed = await api(token).get('/vehicles/not-a-uuid');
    expect(malformed.status).toBe(400);
    expect(malformed.body.message).toBe('Vehicle id must be a UUID');
    expect(
      (
        await api(token).get(
          '/vehicles/00000000-0000-4000-8000-000000000000',
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await api(token).patch(
          '/vehicles/00000000-0000-4000-8000-000000000001',
          { make: 'Skoda' },
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await api(token).patch(
          '/vehicles/00000000-0000-4000-8000-000000000002/default',
          {},
        )
      ).status,
    ).toBe(404);
  });

  it('enforces one registration number per user, but not across users', async () => {
    const first = await signUp('plate-a');
    const second = await signUp('plate-b');
    await api(first.token).post('/vehicles', baseVehicle);

    const sameUser = await api(first.token).post('/vehicles', {
      ...baseVehicle,
      model: 'Dzire',
    });
    expect(sameUser.status).toBe(409);
    expect(sameUser.body.message).toBe(
      'A vehicle with this registration number already exists',
    );

    // The plate is unique per owner, so another user may register it.
    const otherUser = await api(second.token).post('/vehicles', baseVehicle);
    expect(otherUser.status).toBe(201);

    // ... and an owner editing their own vehicle may keep its own plate.
    const vehicleId = (await vehicleRows(first.id))[0]?.id as string;
    const keepOwn = await api(first.token).patch(`/vehicles/${vehicleId}`, {
      registrationNumber: 'MH 12 AB 1234',
      variant: 'VXi',
    });
    expect(keepOwn.status).toBe(200);
    expect(keepOwn.body.variant).toBe('VXi');

    // A different plate for the same owner is fine.
    const other = await api(first.token).post('/vehicles', {
      ...baseVehicle,
      model: 'Swift',
      registrationNumber: 'MH 15 EF 9999',
    });
    expect(other.status).toBe(201);

    // The same plate typed without separators is still the same plate.
    const respaced = await api(first.token).post('/vehicles', {
      ...baseVehicle,
      model: 'Brezza',
      registrationNumber: 'mh-12-ab-1234',
    });
    expect(respaced.status).toBe(409);
    expect(respaced.body.message).toBe(
      'A vehicle with this registration number already exists',
    );
  });

  it('updates only the fields that change and clears a field on null', async () => {
    const { id, token } = await signUp('update');
    const created = await api(token).post('/vehicles', baseVehicle);

    const res = await api(token).patch(`/vehicles/${created.body.id}`, {
      currentOdometer: 51000,
    });
    expect(res.status).toBe(200);
    expect(res.body.currentOdometer).toBe(51000);
    expect(res.body.make).toBe('Maruti Suzuki');
    expect(res.body.isDefault).toBe(true);

    const cleared = await api(token).patch(`/vehicles/${created.body.id}`, {
      variant: null,
      purchaseDate: null,
    });
    expect(cleared.status).toBe(200);
    expect(cleared.body.variant).toBeNull();
    expect(cleared.body.purchaseDate).toBeNull();
    expect(cleared.body.currentOdometer).toBe(51000);

    const rows = await vehicleRows(id);
    expect(rows[0]?.variant).toBeNull();
    expect(rows[0]?.current_odometer).toBe(51000);

    expect((await api(token).patch(`/vehicles/${created.body.id}`, {})).status).toBe(400);
  });

  it('switches the default atomically and keeps exactly one default row', async () => {
    const { id, token } = await signUp('default');
    const first = await api(token).post('/vehicles', baseVehicle);
    expect(first.body.isDefault).toBe(true);
    const second = await api(token).post('/vehicles', {
      ...baseVehicle,
      model: 'Dzire',
      registrationNumber: 'MH 14 CD 5678',
    });

    const promoted = await api(token).patch(
      `/vehicles/${second.body.id}/default`,
      {},
    );
    expect(promoted.status).toBe(200);
    expect(promoted.body.isDefault).toBe(true);

    const list = await api(token).get('/vehicles');
    const defaults = list.body.filter((v: Row) => v.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].id).toBe(second.body.id);
    expect(await defaultCount(id)).toBe(1);

    // Re-selecting the current default is a no-op, not a second default row.
    const again = await api(token).patch(
      `/vehicles/${second.body.id}/default`,
      {},
    );
    expect(again.status).toBe(200);
    expect(await defaultCount(id)).toBe(1);
  });

  it('serializes two concurrent default selections into one default', async () => {
    const { id, token } = await signUp('race');
    const a = await api(token).post('/vehicles', baseVehicle);
    const b = await api(token).post('/vehicles', {
      ...baseVehicle,
      model: 'Swift',
      registrationNumber: 'MH 14 CD 5678',
    });

    const results = await Promise.all([
      api(token).patch(`/vehicles/${a.body.id}/default`, {}),
      api(token).patch(`/vehicles/${b.body.id}/default`, {}),
    ]);
    expect(results.map((res) => res.status)).toEqual([200, 200]);

    // The user-row lock serializes both writes, so exactly one survives as
    // default — and the database index would have rejected two anyway.
    expect(await defaultCount(id)).toBe(1);
    const list = await api(token).get('/vehicles');
    expect(list.body).toHaveLength(2);
    expect(list.body.filter((v: Row) => v.isDefault)).toHaveLength(1);

    // And a race to create the very first vehicle yields one default too.
    const fresh = await signUp('race-create');
    const raced = await Promise.all([
      api(fresh.token).post('/vehicles', {
        ...baseVehicle,
        registrationNumber: 'MH 20 GH 1111',
      }),
      api(fresh.token).post('/vehicles', {
        ...baseVehicle,
        registrationNumber: 'MH 21 GH 2222',
      }),
    ]);
    expect(raced.map((res) => res.status).sort()).toEqual([201, 201]);
    expect(await defaultCount(fresh.id)).toBe(1);
  });

  it('rejects a second default row at the database level', async () => {
    const { id, token } = await signUp('index-guard');
    await api(token).post('/vehicles', baseVehicle);
    const second = await api(token).post('/vehicles', {
      ...baseVehicle,
      model: 'Dzire',
      registrationNumber: 'MH 14 CD 5678',
    });

    await expect(
      dataSource.query(
        `UPDATE vehicles SET is_default = true WHERE id = $1`,
        [second.body.id],
      ),
    ).rejects.toMatchObject({ code: '23505' });

    await expect(
      dataSource.query(
        `INSERT INTO vehicles (id, user_id, make, model, manufacturing_year,
                               fuel_type, transmission, is_default)
         VALUES (gen_random_uuid(), $1, 'Skoda', 'Rapid', 2020, 'DIESEL', 'MANUAL', true)`,
        [id],
      ),
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('promotes a remaining vehicle when the default is deleted', async () => {
    const { id, token } = await signUp('delete');
    const first = await api(token).post('/vehicles', baseVehicle);
    const second = await api(token).post('/vehicles', {
      ...baseVehicle,
      model: 'Dzire',
      registrationNumber: 'MH 14 CD 5678',
    });

    const del = await api(token).del(`/vehicles/${first.body.id}`);
    expect(del.status).toBe(204);

    const rows = await vehicleRows(id);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.is_default).toBe(true);
    expect(await defaultCount(id)).toBe(1);

    // Deleting a non-default vehicle must not disturb the default.
    const third = await api(token).post('/vehicles', {
      ...baseVehicle,
      model: 'Swift',
      registrationNumber: 'MH 15 EF 9999',
    });
    const delThird = await api(token).del(`/vehicles/${third.body.id}`);
    expect(delThird.status).toBe(204);
    expect(await defaultCount(id)).toBe(1);

    // Deleting the last vehicle leaves no default behind.
    const delRest = await api(token).del(`/vehicles/${second.body.id}`);
    expect(delRest.status).toBe(204);
    expect(await defaultCount(id)).toBe(0);
    expect(await api(token).get('/vehicles')).toEqual(
      expect.objectContaining({ status: 200, body: [] }),
    );
  });

  it('deletes the user\'s vehicles through the foreign key', async () => {
    const { id, token } = await signUp('cascade');
    await api(token).post('/vehicles', baseVehicle);
    expect(await vehicleRows(id)).toHaveLength(1);
    await dataSource.query(`DELETE FROM users WHERE id = $1`, [id]);
    const left = await dataSource.query(
      `SELECT count(*)::int AS n FROM vehicles WHERE user_id = $1`,
      [id],
    );
    expect(left[0].n).toBe(0);
    createdUserIds.splice(createdUserIds.indexOf(id), 1);
  });

  it('returns vehicles only to their owner', async () => {
    const { id, token } = await signUp('scoped');
    await api(token).post('/vehicles', baseVehicle);
    const list = await api(token).get('/vehicles');
    expect(list.body.every((v: Row) => v.userId === id)).toBe(true);
    expect(await defaultCount(id)).toBe(1);
  });
});

describe('database errors are never surfaced over HTTP', () => {
  let app: INestApplication;

  @Controller('probe')
  class ProbeController {
    constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

    // Deliberately breaks the CHECK and FK constraints: the API must react with
    // a generic 500 rather than leaking SQL, table or index names.
    @Get('raw-failure')
    async rawFailure(): Promise<Row> {
      const rows = await this.dataSource.query(
        `INSERT INTO vehicles (id, user_id, make, model, manufacturing_year,
                               fuel_type, transmission)
         VALUES (gen_random_uuid(), gen_random_uuid(), 'Leak', 'Probe', 1850,
                 'PETROL', 'MANUAL')
         RETURNING id`,
      );
      return rows[0];
    }
  }

  @Module({
    imports: [ConfigModule, DatabaseModule],
    controllers: [ProbeController],
    providers: [
      { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    ],
  })
  class ProbeModule {}

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ProbeModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  }, 60000);

  afterAll(async () => {
    await app?.close();
  });

  it('answers a driver failure with a generic 500', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/probe/raw-failure');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      statusCode: 500,
      message: 'Internal server error',
      error: 'InternalServerError',
    });
    expect(res.text).not.toMatch(/vehicles|23\d{3}|insert into|queryfailed/i);
  });
});
