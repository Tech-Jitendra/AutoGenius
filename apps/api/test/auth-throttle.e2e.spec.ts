process.env['NODE_ENV'] = 'test';
process.env['DATABASE_URL'] = 'postgresql://test:test@localhost:5432/autogenius_throttle_test';
process.env['JWT_ACCESS_SECRET'] = 'c'.repeat(32);
process.env['JWT_REFRESH_SECRET'] = 'd'.repeat(32);
process.env['RATE_LIMIT_TTL_MS'] = '60000';
process.env['RATE_LIMIT_AUTH_MAX'] = '3';
process.env['RATE_LIMIT_REFRESH_MAX'] = '4';

import { INestApplication } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { AuthModule } from '../src/auth/auth.module';
import { ConfigModule } from '../src/config/config.module';
import { CreateAuthTables1791158400000 } from '../src/database/migrations/1791158400000-CreateAuthTables';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { createPgMemDb } from './utils/create-pg-mem-db';

describe('Auth rate limiting (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule,
        TypeOrmModule.forRootAsync({
          useFactory: () => ({
            type: 'postgres' as const,
            autoLoadEntities: true,
            synchronize: false,
            migrations: [CreateAuthTables1791158400000],
          }),
          dataSourceFactory: async (options) => {
            const db = createPgMemDb();
            const source = await db.adapters.createTypeormConnection(
              options as never,
            );
            await source.runMigrations();
            return source;
          },
        }),
        AuthModule,
      ],
      providers: [{ provide: APP_FILTER, useClass: GlobalExceptionFilter }],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 429 after exceeding the login rate limit', async () => {
    const send = () =>
      request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'nobody@example.com', password: 'password123' });

    const first = await send();
    expect(first.status).toBe(401);

    await send();
    await send();
    const blocked = await send();
    expect(blocked.status).toBe(429);
  });

  it('returns 429 after exceeding the refresh rate limit', async () => {
    const send = () =>
      request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'invalid-token' });

    await send();
    await send();
    await send();
    await send();
    const blocked = await send();
    expect(blocked.status).toBe(429);
  });
});
