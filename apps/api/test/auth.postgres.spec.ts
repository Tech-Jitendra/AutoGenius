import 'reflect-metadata';
import { loadRootEnvFile } from './utils/load-root-env';

// Real PostgreSQL only. Never falls back to pg-mem and never invents secrets:
// DATABASE_URL and the JWT secrets come from the repository .env.
loadRootEnvFile();
process.env['NODE_ENV'] = 'test';
process.env['RATE_LIMIT_TTL_MS'] = '60000';
process.env['RATE_LIMIT_AUTH_MAX'] = '10000';
process.env['RATE_LIMIT_REFRESH_MAX'] = '10000';

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { hashRefreshToken } from '../src/refresh-tokens/token-hash';

type Row = Record<string, unknown>;

const runId = `${Date.now()}`;
const emailFor = (label: string): string =>
  `pg-e2e-${runId}-${label}@example.com`;

describe('Auth against real PostgreSQL', () => {
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

    const info = await dataSource.query(
      `SELECT version() AS version, current_database() AS database,
              current_user AS username`,
    );
    console.log('Connected to:', JSON.stringify(info[0]));
  }, 60000);

  afterAll(async () => {
    // Remove exactly the rows this run created. The per-run id in the email
    // makes the sweep safe even when an assertion failed before the row could
    // be tracked; cascading deletes take its refresh tokens with it.
    await dataSource.query(
      `DELETE FROM users
       WHERE id = ANY($1::uuid[]) OR email LIKE $2`,
      [createdUserIds, `pg-e2e-${runId}-%`],
    );
    await app?.close();
  });

  async function register(label: string, overrides: Row = {}) {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        name: 'PG E2E',
        email: emailFor(label),
        phone: '+919876543210',
        password: 'password123',
        ...overrides,
      });
    const id = res.body?.user?.id as string | undefined;
    if (id) {
      createdUserIds.push(id);
    }
    return res;
  }

  async function activeTokenCount(userId: string): Promise<number> {
    const rows = await dataSource.query(
      `SELECT count(*)::int AS n FROM refresh_tokens
       WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now()`,
      [userId],
    );
    return rows[0].n as number;
  }

  async function tokenRow(token: string): Promise<Row | undefined> {
    const rows = await dataSource.query(
      `SELECT id, user_id, expires_at, revoked_at, replaced_by_id
       FROM refresh_tokens WHERE token_hash = $1`,
      [hashRefreshToken(token)],
    );
    return rows[0];
  }

  it('confirms the target is a real PostgreSQL server with the applied migration', async () => {
    const version = await dataSource.query(`SELECT version() AS v`);
    expect(version[0].v).toContain('PostgreSQL 17');
    const applied = await dataSource.query(
      `SELECT name FROM migrations ORDER BY id DESC`,
    );
    expect(applied.map((r: Row) => r.name)).toContain(
      'CreateAuthTables1791158400000',
    );
  });

  it('registers and persists the user with a normalized email and hashed password', async () => {
    const res = await register('persist', { email: emailFor('peRsist') });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe(emailFor('persist'));

    const rows = await dataSource.query(
      `SELECT email, password_hash, phone FROM users WHERE id = $1`,
      [res.body.user.id],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe(emailFor('persist'));
    expect(rows[0].password_hash).not.toBe('password123');
    expect(String(rows[0].password_hash)).toMatch(/^\$2[aby]\$\d{2}\$/);
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
  });

  it('stores a phone typed with separators in canonical form', async () => {
    // The mobile form submits exactly what the user typed, so the API — not the
    // device — is responsible for the stored format.
    const res = await register('phone', { phone: '+91 (98765) 43210' });
    expect(res.status).toBe(201);
    expect(res.body.user.phone).toBe('+919876543210');

    const rows = await dataSource.query(
      `SELECT phone FROM users WHERE id = $1`,
      [res.body.user.id],
    );
    expect(rows[0].phone).toBe('+919876543210');
  });

  it('stores a null phone when the field is left blank', async () => {
    const res = await register('no-phone', { phone: '' });
    expect(res.status).toBe(201);
    expect(res.body.user.phone).toBeNull();

    const rows = await dataSource.query(
      `SELECT phone FROM users WHERE id = $1`,
      [res.body.user.id],
    );
    expect(rows[0].phone).toBeNull();
  });

  it('rejects an unparseable phone with 400 and a field-scoped message', async () => {
    const res = await register('bad-phone', { phone: 'abcdefgh' });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('phone:');
  });

  it('rejects a duplicate email with 409', async () => {
    await register('dup');
    const res = await register('dup', { name: 'Someone Else' });
    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Email already registered');
  });

  it('maps the PostgreSQL 23505 unique violation to 409 when two registers race', async () => {
    const email = emailFor('race-email');
    const send = () =>
      request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ name: 'Racer', email, password: 'password123' });

    const results = await Promise.all([send(), send()]);
    const statuses = results.map((r) => r.status).sort();
    // One request wins the insert; the other is the 23505 that used to leak as
    // a 500 because the pre-check had already passed.
    expect(statuses).toEqual([201, 409]);

    const conflict = results.find((r) => r.status === 409);
    expect(conflict?.body.message).toBe('Email already registered');
    const winner = results.find((r) => r.status === 201);
    expect(winner?.body.accessToken).toEqual(expect.any(String));

    const rows = await dataSource.query(
      `SELECT id FROM users WHERE lower(email) = lower($1)`,
      [email],
    );
    expect(rows).toHaveLength(1);
    createdUserIds.push(rows[0].id as string);
  });

  it('enforces both unique indexes at the database level', async () => {
    const first = await register('constraint');
    const email = String(first.body.user.email);

    // Different casing: users_email_unique passes, users_email_lower does not.
    await expect(
      dataSource.query(
        `INSERT INTO users (id, name, email, password_hash)
         VALUES (gen_random_uuid(), 'Case', $1, 'hash')`,
        [email.toUpperCase()],
      ),
    ).rejects.toMatchObject({ code: '23505' });

    await expect(
      dataSource.query(
        `INSERT INTO users (id, name, email, password_hash)
         VALUES (gen_random_uuid(), 'Same', $1, 'hash')`,
        [email],
      ),
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('cascades refresh tokens when a user row is removed', async () => {
    const { body } = await register('cascade');
    expect(await activeTokenCount(body.user.id)).toBe(1);
    await dataSource.query(`DELETE FROM users WHERE id = $1`, [body.user.id]);
    const left = await dataSource.query(
      `SELECT count(*)::int AS n FROM refresh_tokens WHERE user_id = $1`,
      [body.user.id],
    );
    expect(left[0].n).toBe(0);
  });

  it('logs in on success and returns a generic 401 on failure', async () => {
    await register('login');
    const ok = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: `  ${emailFor('login').toUpperCase()} `, password: 'password123' });
    expect(ok.status).toBe(200);
    expect(ok.body.user.email).toBe(emailFor('login'));
    expect(ok.body.accessToken).toEqual(expect.any(String));

    const wrongPassword = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: emailFor('login'), password: 'wrong-password' });
    expect(wrongPassword.status).toBe(401);
    expect(wrongPassword.body.message).toBe('Invalid email or password');

    const unknownUser = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: emailFor('never-registered'), password: 'password123' });
    expect(unknownUser.status).toBe(401);
    expect(unknownUser.body.message).toBe('Invalid email or password');
    expect(unknownUser.body).toEqual(wrongPassword.body);
  });

  it('serves /auth/me for a valid token and rejects missing or foreign tokens', async () => {
    const { body } = await register('me');
    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${body.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(body.user.id);
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');

    const anonymous = await request(app.getHttpServer()).get('/api/v1/auth/me');
    expect(anonymous.status).toBe(401);

    const forged = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${body.accessToken}x`);
    expect(forged.status).toBe(401);

    const [headerPart = ''] = String(body.accessToken).split('.');
    const header = JSON.parse(Buffer.from(headerPart, 'base64url').toString()) as
      | { alg?: string }
      | null;
    expect(header?.alg).toBe('HS256');
  });

  it('rotates the refresh token and records the lineage in PostgreSQL', async () => {
    const { body } = await register('rotate');
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: body.refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.refreshToken).not.toBe(body.refreshToken);

    const oldRow = await tokenRow(body.refreshToken);
    expect(oldRow?.revoked_at).toBeTruthy();

    const newRow = await tokenRow(res.body.refreshToken);
    expect(newRow?.revoked_at).toBeNull();
    expect(newRow?.id).toBe(oldRow?.replaced_by_id);
    expect(String(newRow?.user_id)).toBe(String(oldRow?.user_id));
  });

  it('detects reuse of a rotated token and revokes every session of the user', async () => {
    const { body } = await register('reuse');
    const rotated = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: body.refreshToken });
    expect(rotated.status).toBe(200);

    const reuse = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: body.refreshToken });
    expect(reuse.status).toBe(401);

    expect(await activeTokenCount(body.user.id)).toBe(0);

    const after = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: rotated.body.refreshToken });
    expect(after.status).toBe(401);
  });

  it('accepts only one of two concurrent refreshes with the same token', async () => {
    const { body } = await register('concurrent');
    const send = () =>
      request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: body.refreshToken });

    const results = await Promise.all([send(), send()]);
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([200, 401]);

    // A detected reuse must leave no session able to refresh again.
    expect(await activeTokenCount(body.user.id)).toBe(0);
    const tokens = await dataSource.query(
      `SELECT count(*)::int AS n FROM refresh_tokens WHERE user_id = $1`,
      [body.user.id],
    );
    expect(tokens[0].n).toBeLessThanOrEqual(3);
  });

  it('rejects an expired refresh token', async () => {
    const { body } = await register('expired');
    await dataSource.query(
      `UPDATE refresh_tokens SET expires_at = now() - interval '1 day'
       WHERE user_id = $1`,
      [body.user.id],
    );
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: body.refreshToken });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Refresh token expired');
  });

  it('rejects an unknown refresh token', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: 'this-token-does-not-exist' });
    expect(res.status).toBe(401);
  });

  it('logs out by revoking the stored token hash', async () => {
    const { body } = await register('logout');
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .send({ refreshToken: body.refreshToken });
    expect(res.status).toBe(204);

    const row = await tokenRow(body.refreshToken);
    expect(row?.revoked_at).toBeTruthy();

    const after = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: body.refreshToken });
    expect(after.status).toBe(401);

    const idempotent = await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .send({ refreshToken: body.refreshToken });
    expect(idempotent.status).toBe(204);
  });

  it('stores only the SHA-256 hash of a refresh token, never the raw value', async () => {
    const { body } = await register('hash');
    const rows = await dataSource.query(
      `SELECT token_hash FROM refresh_tokens WHERE user_id = $1`,
      [body.user.id],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].token_hash).toBe(hashRefreshToken(body.refreshToken));
    expect(rows[0].token_hash).toHaveLength(64);
    expect(String(rows[0].token_hash)).not.toContain(body.refreshToken);

    const raw = await dataSource.query(
      `SELECT count(*)::int AS n FROM refresh_tokens WHERE token_hash = $1`,
      [body.refreshToken],
    );
    expect(raw[0].n).toBe(0);
  });
});
