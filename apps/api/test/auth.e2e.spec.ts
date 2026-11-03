process.env['NODE_ENV'] = 'test';
process.env['DATABASE_URL'] = 'postgresql://test:test@localhost:5432/autogenius_test';
process.env['JWT_ACCESS_SECRET'] = 'a'.repeat(32);
process.env['JWT_REFRESH_SECRET'] = 'b'.repeat(32);
process.env['JWT_ACCESS_EXPIRES_IN'] = '15m';
process.env['JWT_REFRESH_EXPIRES_IN'] = '30d';
process.env['RATE_LIMIT_TTL_MS'] = '60000';
process.env['RATE_LIMIT_AUTH_MAX'] = '1000';
process.env['RATE_LIMIT_REFRESH_MAX'] = '1000';

import { INestApplication } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { getDataSourceToken, TypeOrmModule } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import request from 'supertest';
import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';
import { AuthModule } from '../src/auth/auth.module';
import { ConfigModule } from '../src/config/config.module';
import { CreateAuthTables1791158400000 } from '../src/database/migrations/1791158400000-CreateAuthTables';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { createPgMemDb } from './utils/create-pg-mem-db';

describe('Auth API (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

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
            const source = (await db.adapters.createTypeormConnection(
              options as never,
            )) as unknown as DataSource;
            await source.runMigrations();
            return source;
          },
        }),
        AuthModule,
      ],
      controllers: [AppController],
      providers: [
        AppService,
        { provide: APP_FILTER, useClass: GlobalExceptionFilter },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
    dataSource = moduleRef.get<DataSource>(getDataSourceToken());
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  const registerBody = {
    name: 'Jitendra',
    email: 'User@Example.com',
    phone: '+919876543210',
    password: 'password123',
  };

  async function registerUser(
    overrides: Record<string, unknown> = {},
  ): Promise<request.Response> {
    return request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ ...registerBody, ...overrides });
  }

  describe('health', () => {
    it('stays reachable without authentication', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });

  describe('POST /auth/register', () => {
    it('registers a user and returns tokens without the password hash', async () => {
      const res = await registerUser();
      expect(res.status).toBe(201);
      expect(res.body.user.email).toBe('user@example.com');
      expect(res.body.user.phone).toBe('+919876543210');
      expect(res.body.user.name).toBe('Jitendra');
      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(res.body.refreshToken).toEqual(expect.any(String));
      expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    });

    it('rejects a duplicate email with 409', async () => {
      await registerUser();
      const res = await registerUser({ name: 'Someone Else' });
      expect(res.status).toBe(409);
      expect(res.body.message).toBe('Email already registered');
    });

    it('rejects an invalid email with 400', async () => {
      const res = await registerUser({ email: 'not-an-email' });
      expect(res.status).toBe(400);
      expect(res.body.statusCode).toBe(400);
    });

    it('rejects a short password with 400', async () => {
      const res = await registerUser({ password: 'short' });
      expect(res.status).toBe(400);
    });

    it('rejects a missing name with 400', async () => {
      const res = await registerUser({ name: undefined });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /auth/login', () => {
    it('logs in with normalized email casing', async () => {
      await registerUser();
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: '  USER@example.COM ', password: 'password123' });
      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('user@example.com');
      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(res.body.refreshToken).toEqual(expect.any(String));
      expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    });

    it('rejects a wrong password with a generic 401', async () => {
      await registerUser();
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'user@example.com', password: 'wrong-password' });
      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Invalid email or password');
    });

    it('rejects a nonexistent user with the same generic 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'nobody@example.com', password: 'password123' });
      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Invalid email or password');
    });

    it('rejects an invalid body with 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'user@example.com' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /auth/me', () => {
    it('returns the current user with a valid access token', async () => {
      const { body } = await registerUser({ email: 'me@example.com' });
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${body.accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(body.user.id);
      expect(res.body.email).toBe('me@example.com');
      expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    });

    it('rejects a request without a token', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
    });

    it('rejects a garbage token', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer not-a-real-token');
      expect(res.status).toBe(401);
    });

    it('returns only the token owner, never another user', async () => {
      const first = await registerUser({ email: 'first@example.com' });
      const second = await registerUser({
        email: 'second@example.com',
        name: 'Second',
      });
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${first.body.accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(first.body.user.id);
      expect(res.body.id).not.toBe(second.body.user.id);
    });
  });

  describe('POST /auth/refresh', () => {
    it('rotates the refresh token and invalidates the old one', async () => {
      const { body } = await registerUser({ email: 'rotate@example.com' });
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: body.refreshToken });
      expect(res.status).toBe(200);
      expect(res.body.refreshToken).not.toBe(body.refreshToken);
      expect(res.body.accessToken).toEqual(expect.any(String));

      const reuse = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: body.refreshToken });
      expect(reuse.status).toBe(401);
    });

    it('rejects an unknown refresh token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'no-such-token' });
      expect(res.status).toBe(401);
    });

    it('rejects an expired refresh token', async () => {
      const { body } = await registerUser({ email: 'expired@example.com' });
      await dataSource.query(
        `UPDATE refresh_tokens SET expires_at = now() - interval '1 day' WHERE token_hash IS NOT NULL`,
      );
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: body.refreshToken });
      expect(res.status).toBe(401);
    });

    it('revokes every session of the user on reuse of a rotated token', async () => {
      const { body } = await registerUser({ email: 'reuse@example.com' });
      const rotated = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: body.refreshToken });
      expect(rotated.status).toBe(200);

      // Present the rotated (now revoked) token: reuse detection kicks in.
      const reuse = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: body.refreshToken });
      expect(reuse.status).toBe(401);

      // The token issued by the rotation is revoked as well.
      const rotatedReuse = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: rotated.body.refreshToken });
      expect(rotatedReuse.status).toBe(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('logs out and makes the refresh token unusable', async () => {
      const { body } = await registerUser({ email: 'logout@example.com' });
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .send({ refreshToken: body.refreshToken });
      expect(res.status).toBe(204);

      const after = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: body.refreshToken });
      expect(after.status).toBe(401);
    });

    it('is idempotent for unknown tokens', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .send({ refreshToken: 'never-existed' });
      expect(res.status).toBe(204);
    });
  });
});
