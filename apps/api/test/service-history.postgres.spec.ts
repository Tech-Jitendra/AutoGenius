import 'reflect-metadata';
import { loadRootEnvFile } from './utils/load-root-env';

// Real PostgreSQL only: this suite exercises the composite foreign key, the
// NUMERIC money columns, the CHECK constraints and the per-user row locks, none
// of which an in-memory double reproduces faithfully.
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

type Row = Record<string, unknown>;

const runId = `${Date.now()}`;
const emailPrefix = `pg-hist-${runId}`;
const emailFor = (label: string): string => `${emailPrefix}-${label}@example.com`;

/** UTC calendar day, offset from today, so the fixtures never rot. */
const isoDay = (offsetDays: number): string => {
  const day = new Date();
  day.setUTCDate(day.getUTCDate() + offsetDays);
  return day.toISOString().slice(0, 10);
};

/** The same clamped month arithmetic the server uses, written out here on purpose. */
const addIsoMonths = (iso: string, months: number): string => {
  const [year = 0, month = 1, day = 1] = iso.split('-').map(Number);
  const zeroBased = ((month - 1 + months) % 12 + 12) % 12;
  const targetYear = year + Math.floor((month - 1 + months) / 12);
  const lastDay = new Date(Date.UTC(targetYear, zeroBased + 1, 0)).getUTCDate();
  const targetMonth = `${zeroBased + 1}`.padStart(2, '0');
  return `${targetYear}-${targetMonth}-${`${Math.min(day, lastDay)}`.padStart(2, '0')}`;
};

const vehicleBody = {
  make: 'Maruti Suzuki',
  model: 'Baleno',
  registrationNumber: 'MH 12 AB 1234',
  manufacturingYear: 2019,
  fuelType: 'PETROL',
  transmission: 'MANUAL',
  currentOdometer: 44_000,
};

const baseRecord = {
  serviceDate: '2026-09-12',
  odometerKm: 43_215,
  workshopName: 'City Motors',
  serviceType: 'GENERAL_SERVICE',
  description: 'Annual service',
  partsReplaced: [
    { name: 'Engine oil 5W-30', quantity: 1, cost: 2_400.5 },
    { name: 'Air filter' },
  ],
  labourCost: 800,
  partsCost: 2_400.5,
  otherCost: 150,
  notes: 'Customer asked for a wash',
};

const recordFields = [
  'id',
  'vehicleId',
  'serviceDate',
  'odometerKm',
  'workshopName',
  'serviceType',
  'description',
  'partsReplaced',
  'labourCost',
  'partsCost',
  'otherCost',
  'totalCost',
  'notes',
  'createdAt',
  'updatedAt',
];

const reminderFields = [
  'id',
  'vehicleId',
  'title',
  'description',
  'dueDate',
  'dueOdometerKm',
  'intervalMonths',
  'intervalKm',
  'lastCompletedDate',
  'lastCompletedOdometerKm',
  'status',
  'alertStatus',
  'createdAt',
  'updatedAt',
];

const summaryFields = [
  'vehicleId',
  'totalServiceRecords',
  'totalExpenditure',
  'lastServiceDate',
  'lastServiceOdometer',
  'activeReminders',
  'overdueReminders',
  'upcomingReminders',
];

const NULL_UUID = '00000000-0000-4000-8000-000000000000';

describe('Service history against real PostgreSQL', () => {
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
  }, 60_000);

  afterAll(async () => {
    // History points at vehicles with ON DELETE RESTRICT, so it goes first: the
    // users below would otherwise refuse to disappear.
    const pattern = `${emailPrefix}-%`;
    await dataSource.query(
      `DELETE FROM service_records WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)`,
      [pattern],
    );
    await dataSource.query(
      `DELETE FROM maintenance_reminders WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)`,
      [pattern],
    );
    await dataSource.query(
      `DELETE FROM users WHERE id = ANY($1::uuid[]) OR email LIKE $2`,
      [createdUserIds, pattern],
    );
    await app?.close();
  });

  async function signUp(label: string): Promise<{ id: string; token: string }> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name: 'History E2E', email: emailFor(label), password: 'password123' });
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
    patch: (path: string, body: object = {}) =>
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

  async function vehicleFor(token: string, overrides: Row = {}): Promise<string> {
    const res = await api(token).post('/vehicles', { ...vehicleBody, ...overrides });
    expect(res.status).toBe(201);
    return res.body.id as string;
  }

  const recordsPath = (vehicleId: string): string =>
    `/vehicles/${vehicleId}/service-records`;
  const remindersPath = (vehicleId: string): string =>
    `/vehicles/${vehicleId}/maintenance-reminders`;

  async function createRecord(token: string, vehicleId: string, body: object = baseRecord) {
    const res = await api(token).post(recordsPath(vehicleId), body);
    expect(res.status).toBe(201);
    return res;
  }

  async function createReminder(token: string, vehicleId: string, body: Row) {
    const res = await api(token).post(remindersPath(vehicleId), body);
    expect(res.status).toBe(201);
    return res;
  }

  async function recordRows(vehicleId: string): Promise<Row[]> {
    return dataSource.query(
      `SELECT id, user_id, service_date, odometer_km, service_type, parts_replaced,
              labour_cost, parts_cost, other_cost, total_cost, notes
       FROM service_records WHERE vehicle_id = $1 ORDER BY service_date, id`,
      [vehicleId],
    );
  }

  async function reminderRows(vehicleId: string): Promise<Row[]> {
    return dataSource.query(
      `SELECT id, user_id, title, due_date, due_odometer_km, interval_months, interval_km,
              last_completed_date, last_completed_odometer_km, status
       FROM maintenance_reminders WHERE vehicle_id = $1 ORDER BY created_at, id`,
      [vehicleId],
    );
  }

  it('applied the service-history migration with its constraints and indexes', async () => {
    const applied = await dataSource.query(`SELECT name FROM migrations ORDER BY id DESC`);
    expect(applied.map((row: Row) => row.name)).toContain('CreateServiceHistory1793836800000');

    const indexes = await dataSource.query(
      `SELECT indexname FROM pg_indexes
       WHERE tablename IN ('service_records', 'maintenance_reminders')`,
    );
    expect(indexes.map((row: Row) => row.indexname)).toEqual(
      expect.arrayContaining([
        'service_records_pkey',
        'service_records_vehicle_date_idx',
        'service_records_user_id_idx',
        'service_records_vehicle_type_idx',
        'maintenance_reminders_pkey',
        'maintenance_reminders_vehicle_status_idx',
        'maintenance_reminders_user_id_idx',
        'maintenance_reminders_due_date_idx',
        'maintenance_reminders_status_due_date_idx',
      ]),
    );

    const checks = await dataSource.query(
      `SELECT conname FROM pg_constraint
       WHERE contype = 'c' AND conrelid::regclass::text IN ('service_records', 'maintenance_reminders')`,
    );
    expect(checks.map((row: Row) => row.conname)).toEqual(
      expect.arrayContaining([
        'service_records_costs_non_negative',
        'service_records_costs_within_precision',
        'service_records_total_is_components',
        'service_records_parts_is_array',
        'service_records_odometer_range',
        'service_records_type_check',
        'maintenance_reminders_status_check',
        'maintenance_reminders_has_due_condition',
        'maintenance_reminders_due_odometer_range',
        'maintenance_reminders_interval_months_positive',
        'maintenance_reminders_interval_km_positive',
      ]),
    );

    // Money is exact: NUMERIC(12,2), never a float.
    const columns = await dataSource.query(
      `SELECT column_name, data_type, numeric_precision, numeric_scale
       FROM information_schema.columns
       WHERE table_name = 'service_records'
         AND column_name IN ('total_cost', 'parts_replaced', 'service_date')`,
    );
    const byName = Object.fromEntries(
      columns.map((row: Row) => [row.column_name as string, row]),
    );
    expect(byName['total_cost']).toMatchObject({
      data_type: 'numeric',
      numeric_precision: 12,
      numeric_scale: 2,
    });
    expect(byName['parts_replaced']?.data_type).toBe('jsonb');
    expect(byName['service_date']?.data_type).toBe('date');

    // The composite key that lets a history row bind a vehicle and its owner as
    // one unit, so ownership cannot disagree with the vehicle.
    const vehicleKeys = await dataSource.query(
      `SELECT conname FROM pg_constraint WHERE conrelid = 'vehicles'::regclass AND contype = 'u'`,
    );
    expect(vehicleKeys.map((row: Row) => row.conname)).toContain('vehicles_id_user_id_unique');
  });

  it('requires authentication for every new route', async () => {
    const calls = [
      () => request(app.getHttpServer()).post(`/api/v1${recordsPath(NULL_UUID)}`).send(baseRecord),
      () => request(app.getHttpServer()).get(`/api/v1${recordsPath(NULL_UUID)}`),
      () => request(app.getHttpServer()).get(`/api/v1${recordsPath(NULL_UUID)}/${NULL_UUID}`),
      () => request(app.getHttpServer()).patch(`/api/v1${recordsPath(NULL_UUID)}/${NULL_UUID}`).send({ notes: 'x' }),
      () => request(app.getHttpServer()).delete(`/api/v1${recordsPath(NULL_UUID)}/${NULL_UUID}`),
      () => request(app.getHttpServer()).post(`/api/v1${remindersPath(NULL_UUID)}`).send({ title: 'x', dueDate: isoDay(10) }),
      () => request(app.getHttpServer()).get(`/api/v1${remindersPath(NULL_UUID)}`),
      () => request(app.getHttpServer()).get(`/api/v1${remindersPath(NULL_UUID)}/${NULL_UUID}`),
      () => request(app.getHttpServer()).patch(`/api/v1${remindersPath(NULL_UUID)}/${NULL_UUID}`).send({ title: 'y' }),
      () => request(app.getHttpServer()).patch(`/api/v1${remindersPath(NULL_UUID)}/${NULL_UUID}/complete`).send({ completionDate: isoDay(-1), completionOdometerKm: 1 }),
      () => request(app.getHttpServer()).patch(`/api/v1${remindersPath(NULL_UUID)}/${NULL_UUID}/dismiss`),
      () => request(app.getHttpServer()).delete(`/api/v1${remindersPath(NULL_UUID)}/${NULL_UUID}`),
      () => request(app.getHttpServer()).get(`/api/v1/vehicles/${NULL_UUID}/maintenance-summary`),
    ];
    for (const call of calls) {
      expect((await call()).status).toBe(401);
    }
  });

  it('stores a record with money precision and derives the total itself', async () => {
    const { token } = await signUp('create');
    const vehicleId = await vehicleFor(token);

    // A client-supplied total, and a guessed owner, are both ignored.
    const res = await api(token).post(recordsPath(vehicleId), {
      ...baseRecord,
      totalCost: 9_999_999,
      userId: NULL_UUID,
    });

    expect(res.status).toBe(201);
    expect(Object.keys(res.body).sort()).toEqual([...recordFields].sort());
    expect(res.body.vehicleId).toBe(vehicleId);
    expect(res.body.totalCost).toBe(3_350.5);
    expect(res.body.partsCost).toBe(2_400.5);
    // A date-only column must survive as a calendar day, never as a shifting timestamp.
    expect(res.body.serviceDate).toBe('2026-09-12');
    expect(res.body.serviceDate).not.toContain('T');
    expect(res.body.partsReplaced).toEqual([
      { name: 'Engine oil 5W-30', quantity: 1, cost: 2_400.5 },
      { name: 'Air filter', quantity: null, cost: null },
    ]);

    const row = (await recordRows(vehicleId))[0] ?? {};
    expect(row.total_cost).toBe('3350.50');
    expect(row.labour_cost).toBe('800.00');
    // jsonb comes back parsed, in the order the user listed the parts.
    expect(row.parts_replaced).toEqual([
      { name: 'Engine oil 5W-30', quantity: 1, cost: 2_400.5 },
      { name: 'Air filter', quantity: null, cost: null },
    ]);
    // The row records the same owner as the vehicle, because the key says so.
    expect(row.user_id).toBeTruthy();
  });

  it('defaults what the caller left out instead of inventing values', async () => {
    const { token } = await signUp('defaults');
    const vehicleId = await vehicleFor(token);

    const res = await api(token).post(recordsPath(vehicleId), {
      serviceDate: '2026-09-01',
      serviceType: 'OIL_CHANGE',
      workshopName: '',
      odometerKm: '',
      notes: '',
    });

    expect(res.status).toBe(201);
    expect(res.body.workshopName).toBeNull();
    expect(res.body.odometerKm).toBeNull();
    expect(res.body.notes).toBeNull();
    expect(res.body.description).toBeNull();
    expect(res.body.partsReplaced).toEqual([]);
    expect(res.body).toMatchObject({
      labourCost: 0,
      partsCost: 0,
      otherCost: 0,
      totalCost: 0,
    });

    const row = (await recordRows(vehicleId))[0] ?? {};
    expect(row.total_cost).toBe('0.00');
  });

  it('rejects impossible records with field-level 400s, not database errors', async () => {
    const { token } = await signUp('invalid');
    const vehicleId = await vehicleFor(token);

    const cases: Array<Record<string, unknown>> = [
      { ...baseRecord, labourCost: -1 },
      { ...baseRecord, otherCost: -0.01 },
      { ...baseRecord, partsCost: 10_000_001 },
      { ...baseRecord, serviceDate: isoDay(3) },
      { ...baseRecord, serviceDate: '2026-02-30' },
      { ...baseRecord, serviceDate: '12/09/2026' },
      { ...baseRecord, serviceType: 'CAR_WASH' },
      { ...baseRecord, odometerKm: 2_000_001 },
      { ...baseRecord, odometerKm: 43_215.5 },
      { ...baseRecord, partsReplaced: 'Engine oil' },
      { ...baseRecord, partsReplaced: [{ quantity: 1, cost: 100 }] },
      { ...baseRecord, workshopName: 'x'.repeat(121) },
    ];

    for (const body of cases) {
      const res = await api(token).post(recordsPath(vehicleId), body);
      expect(res.status).toBe(400);
      const text = JSON.stringify(res.body);
      expect(text).not.toMatch(/insert into|service_records_|23\d{3}|QueryFailedError/i);
    }

    expect(await recordRows(vehicleId)).toHaveLength(0);

    // Even a full body cannot write history onto a vehicle that is not yours.
    const foreign = await api(token).post(recordsPath(NULL_UUID), baseRecord);
    expect(foreign.status).toBe(404);
    expect(foreign.body.message).toBe('Vehicle not found');
  });

  it('keeps one user out of another user\'s history entirely', async () => {
    const owner = await signUp('owner');
    const intruder = await signUp('intruder');
    const vehicleId = await vehicleFor(owner.token);
    const otherVehicleId = await vehicleFor(intruder.token, {
      registrationNumber: 'MH 14 CD 5678',
    });

    const record = await createRecord(owner.token, vehicleId);
    const reminder = await createReminder(owner.token, vehicleId, {
      title: 'Oil change',
      dueDate: isoDay(5),
    });
    const recordId = record.body.id as string;
    const reminderId = reminder.body.id as string;

    const probes: Array<() => Promise<{ status: number }>> = [
      () => api(intruder.token).get(recordsPath(vehicleId)),
      () => api(intruder.token).post(recordsPath(vehicleId), baseRecord),
      () => api(intruder.token).get(`${recordsPath(vehicleId)}/${recordId}`),
      () => api(intruder.token).patch(`${recordsPath(vehicleId)}/${recordId}`, { notes: 'pwn' }),
      () => api(intruder.token).del(`${recordsPath(vehicleId)}/${recordId}`),
      () => api(intruder.token).get(remindersPath(vehicleId)),
      () => api(intruder.token).post(remindersPath(vehicleId), { title: 'pwn', dueDate: isoDay(1) }),
      () => api(intruder.token).get(`${remindersPath(vehicleId)}/${reminderId}`),
      () => api(intruder.token).patch(`${remindersPath(vehicleId)}/${reminderId}`, { title: 'pwn' }),
      () => api(intruder.token).patch(`${remindersPath(vehicleId)}/${reminderId}/complete`, {
        completionDate: isoDay(-1),
        completionOdometerKm: 44_000,
      }),
      () => api(intruder.token).patch(`${remindersPath(vehicleId)}/${reminderId}/dismiss`),
      () => api(intruder.token).del(`${remindersPath(vehicleId)}/${reminderId}`),
      () => api(intruder.token).get(`/vehicles/${vehicleId}/maintenance-summary`),
    ];
    for (const probe of probes) {
      expect((await probe()).status).toBe(404);
    }

    // The intruder's own vehicle is still empty, and the owner's rows survive.
    expect((await api(intruder.token).get(recordsPath(otherVehicleId))).body.totalItems).toBe(0);
    expect(await recordRows(vehicleId)).toHaveLength(1);
    expect(await reminderRows(vehicleId)).toHaveLength(1);

    // The right row under the wrong vehicle is a 404 for the owner too.
    expect(
      (await api(owner.token).get(`${recordsPath(otherVehicleId)}/${recordId}`)).status,
    ).toBe(404);
    expect(
      (await api(owner.token).del(`${remindersPath(otherVehicleId)}/${reminderId}`)).status,
    ).toBe(404);
    expect(await reminderRows(vehicleId)).toHaveLength(1);
  });

  it('patches only what was sent and re-derives the total every time', async () => {
    const { token } = await signUp('patch');
    const vehicleId = await vehicleFor(token);
    const created = await createRecord(token, vehicleId);

    const patched = await api(token).patch(`${recordsPath(vehicleId)}/${created.body.id}`, {
      otherCost: 250.5,
    });
    expect(patched.status).toBe(200);
    expect(patched.body.labourCost).toBe(800);
    expect(patched.body.partsCost).toBe(2_400.5);
    expect(patched.body.otherCost).toBe(250.5);
    expect(patched.body.totalCost).toBe(3_451);
    // 800 + 2400.50 + 250.50 — the database CHECK is the referee here.
    expect((await recordRows(vehicleId))[0]?.total_cost).toBe('3451.00');

    const cleared = await api(token).patch(`${recordsPath(vehicleId)}/${created.body.id}`, {
      notes: null,
      odometerKm: null,
      partsReplaced: [],
    });
    expect(cleared.body.notes).toBeNull();
    expect(cleared.body.odometerKm).toBeNull();
    expect(cleared.body.partsReplaced).toEqual([]);
    expect(cleared.body.workshopName).toBe('City Motors');
    expect(cleared.body.serviceDate).toBe('2026-09-12');

    // A parts list is replaced wholesale, never merged into the old one.
    const replaced = await api(token).patch(`${recordsPath(vehicleId)}/${created.body.id}`, {
      partsReplaced: [{ name: 'Brake pads', quantity: 4, cost: 2_400 }],
    });
    expect(replaced.body.partsReplaced).toEqual([
      { name: 'Brake pads', quantity: 4, cost: 2_400 },
    ]);

    const empty = await api(token).patch(`${recordsPath(vehicleId)}/${created.body.id}`, {});
    expect(empty.status).toBe(400);
    expect(empty.body.message).toBe('Provide at least one field to update');

    const del = await api(token).del(`${recordsPath(vehicleId)}/${created.body.id}`);
    expect(del.status).toBe(204);
    expect(await recordRows(vehicleId)).toHaveLength(0);
    expect(
      (await api(token).del(`${recordsPath(vehicleId)}/${created.body.id}`)).status,
    ).toBe(404);
  });

  it('paginates a vehicle\'s history newest first and filters without losing scope', async () => {
    const { token } = await signUp('list');
    const vehicleId = await vehicleFor(token);
    const otherVehicleId = await vehicleFor(token, { registrationNumber: 'MH 14 CD 5678' });

    await createRecord(token, vehicleId, { ...baseRecord, serviceDate: '2026-01-10', serviceType: 'OIL_CHANGE' });
    await createRecord(token, vehicleId, { ...baseRecord, serviceDate: '2026-03-05', serviceType: 'GENERAL_SERVICE' });
    await createRecord(token, vehicleId, { ...baseRecord, serviceDate: '2026-06-20', serviceType: 'OIL_CHANGE' });
    await createRecord(token, vehicleId, { ...baseRecord, serviceDate: '2026-02-15', serviceType: 'BRAKE_INSPECTION' });
    await createRecord(token, otherVehicleId, { ...baseRecord, serviceDate: '2026-05-05' });

    const all = await api(token).get(recordsPath(vehicleId));
    expect(all.status).toBe(200);
    expect(Object.keys(all.body).sort()).toEqual(['items', 'page', 'pageSize', 'totalItems', 'totalPages']);
    expect(all.body.totalItems).toBe(4);
    expect(all.body.totalPages).toBe(1);
    expect(all.body.items.map((item: Row) => item.serviceDate)).toEqual([
      '2026-06-20',
      '2026-03-05',
      '2026-02-15',
      '2026-01-10',
    ]);
    expect(all.body.items[0]).toMatchObject({ vehicleId });

    const typed = await api(token).get(`${recordsPath(vehicleId)}?serviceType=OIL_CHANGE`);
    expect(typed.body.items.map((item: Row) => item.serviceDate)).toEqual([
      '2026-06-20',
      '2026-01-10',
    ]);

    const ranged = await api(token).get(`${recordsPath(vehicleId)}?from=2026-02-01&to=2026-06-01`);
    expect(ranged.body.items.map((item: Row) => item.serviceDate)).toEqual([
      '2026-03-05',
      '2026-02-15',
    ]);
    expect(ranged.body.totalItems).toBe(2);

    const paged = await api(token).get(`${recordsPath(vehicleId)}?page=2&pageSize=2`);
    expect(paged.body.items.map((item: Row) => item.serviceDate)).toEqual([
      '2026-02-15',
      '2026-01-10',
    ]);
    expect(paged.body).toMatchObject({ page: 2, pageSize: 2, totalItems: 4, totalPages: 2 });

    const badRange = await api(token).get(`${recordsPath(vehicleId)}?from=2026-06-01&to=2026-01-01`);
    expect(badRange.status).toBe(400);
    expect(badRange.body.message).toContain('from cannot be later than to');

    const badSize = await api(token).get(`${recordsPath(vehicleId)}?pageSize=500`);
    expect(badSize.status).toBe(400);

    const badId = await api(token).get(`${recordsPath(vehicleId)}/not-a-uuid`);
    expect(badId.status).toBe(400);
    expect(badId.body.message).toBe('Service record id must be a UUID');

    const single = await api(token).get(`${recordsPath(vehicleId)}/${(all.body.items[0] as Row).id}`);
    expect(single.status).toBe(200);
    expect(Object.keys(single.body).sort()).toEqual([...recordFields].sort());
  });

  it('creates a reminder as ACTIVE and judges its urgency from today and the odometer', async () => {
    const { token } = await signUp('reminder-create');
    const vehicleId = await vehicleFor(token);

    const res = await api(token).post(remindersPath(vehicleId), {
      title: 'Oil change',
      description: 'Semi-synthetic',
      dueDate: isoDay(10),
      dueOdometerKm: 44_500,
      intervalMonths: 6,
      intervalKm: 5_000,
    });

    expect(res.status).toBe(201);
    expect(Object.keys(res.body).sort()).toEqual([...reminderFields].sort());
    expect(res.body.userId).toBeUndefined();
    expect(res.body.status).toBe('ACTIVE');
    expect(res.body.lastCompletedDate).toBeNull();
    expect(res.body.lastCompletedOdometerKm).toBeNull();
    // 44_500 - 44_000 km sits inside the 1,000 km window.
    expect(res.body.alertStatus).toBe('UPCOMING');

    const row = (await reminderRows(vehicleId))[0] ?? {};
    expect(row.status).toBe('ACTIVE');
    expect(row.interval_months).toBe(6);
    expect(row.last_completed_date).toBeNull();

    const blank = await api(token).post(remindersPath(vehicleId), {
      title: 'Wash',
      description: '',
      dueOdometerKm: 45_000,
      intervalMonths: '',
    });
    expect(blank.status).toBe(201);
    expect(blank.body.description).toBeNull();
    expect(blank.body.intervalMonths).toBeNull();
    expect(blank.body.dueDate).toBeNull();

    const single = await api(token).get(`${remindersPath(vehicleId)}/${res.body.id}`);
    expect(single.status).toBe(200);
    expect(Object.keys(single.body).sort()).toEqual([...reminderFields].sort());
  });

  it('refuses a reminder that could never become due', async () => {
    const { token } = await signUp('no-due');
    const vehicleId = await vehicleFor(token);

    const missing = await api(token).post(remindersPath(vehicleId), { title: 'Someday' });
    expect(missing.status).toBe(400);
    expect(missing.body.message).toBe('A reminder needs a due date or a due odometer reading');

    const bothBlank = await api(token).post(remindersPath(vehicleId), {
      title: 'Someday',
      dueDate: '',
      dueOdometerKm: '',
    });
    expect(bothBlank.status).toBe(400);

    const badDate = await api(token).post(remindersPath(vehicleId), {
      title: 'Broken',
      dueDate: 'tomorrow',
    });
    expect(badDate.status).toBe(400);

    const badInterval = await api(token).post(remindersPath(vehicleId), {
      title: 'Instant',
      dueDate: isoDay(1),
      intervalKm: 0,
    });
    expect(badInterval.status).toBe(400);

    const badSize = await api(token).post(remindersPath(vehicleId), {
      title: 'Huge',
      dueOdometerKm: 2_000_001,
    });
    expect(badSize.status).toBe(400);

    expect(await reminderRows(vehicleId)).toHaveLength(0);

    const created = await createReminder(token, vehicleId, {
      title: 'Oil change',
      dueDate: isoDay(10),
      dueOdometerKm: 46_000,
    });

    // A PATCH only clears the last due condition when the merged row would be
    // left with none at all.
    const bothCleared = await api(token).patch(`${remindersPath(vehicleId)}/${created.body.id}`, {
      dueDate: null,
      dueOdometerKm: null,
    });
    expect(bothCleared.status).toBe(400);
    expect(bothCleared.body.message).toBe('A reminder needs a due date or a due odometer reading');

    const oneStanding = await api(token).patch(`${remindersPath(vehicleId)}/${created.body.id}`, {
      dueDate: null,
    });
    expect(oneStanding.status).toBe(200);
    expect(oneStanding.body.dueDate).toBeNull();
    expect(oneStanding.body.dueOdometerKm).toBe(46_000);

    const renamed = await api(token).patch(`${remindersPath(vehicleId)}/${created.body.id}`, {
      title: 'Full synthetic oil change',
      intervalMonths: 12,
    });
    expect(renamed.body.title).toBe('Full synthetic oil change');
    expect(renamed.body.dueOdometerKm).toBe(46_000);
    expect(renamed.body.intervalMonths).toBe(12);
    expect(renamed.body.status).toBe('ACTIVE');

    const empty = await api(token).patch(`${remindersPath(vehicleId)}/${created.body.id}`, {});
    expect(empty.status).toBe(400);

    const badId = await api(token).get(`${remindersPath(vehicleId)}/not-a-uuid`);
    expect(badId.status).toBe(400);
    expect(badId.body.message).toBe('Reminder id must be a UUID');
  });

  it('judges the overdue and upcoming boundaries on the real day edge', async () => {
    const { token } = await signUp('boundaries');
    const vehicleId = await vehicleFor(token);

    const edges: Array<[number, string]> = [
      [-1, 'OVERDUE'],
      [0, 'UPCOMING'],
      [30, 'UPCOMING'],
      [31, 'SCHEDULED'],
    ];
    for (const [offset, expected] of edges) {
      const created = await createReminder(token, vehicleId, {
        title: `Edge ${offset}`,
        dueDate: isoDay(offset),
      });
      expect(created.body.alertStatus).toBe(expected);
    }

    const readings: Array<[number, string]> = [
      [44_000, 'OVERDUE'],
      [45_000, 'UPCOMING'],
      [45_001, 'SCHEDULED'],
    ];
    for (const [due, expected] of readings) {
      const created = await createReminder(token, vehicleId, {
        title: `Reading ${due}`,
        dueOdometerKm: due,
      });
      expect(created.body.alertStatus).toBe(expected);
    }

    // Either condition alone is enough to make a reminder overdue.
    const mixed = await createReminder(token, vehicleId, {
      title: 'Mixed',
      dueDate: isoDay(200),
      dueOdometerKm: 44_000,
    });
    expect(mixed.body.alertStatus).toBe('OVERDUE');

    // A reminder that was overdue becomes upcoming once it is rolled forward.
    const rolled = await api(token).patch(
      `${remindersPath(vehicleId)}/${mixed.body.id}/complete`,
      { completionDate: isoDay(-1), completionOdometerKm: 44_000 },
    );
    expect(rolled.status).toBe(200);
    expect(rolled.body.status).toBe('COMPLETED');
    expect(rolled.body.alertStatus).toBeNull();
  });

  it('filters reminders by status and due state, with closed ones never counted as due', async () => {
    const { token } = await signUp('reminder-list');
    const vehicleId = await vehicleFor(token);

    const overdue = await createReminder(token, vehicleId, {
      title: 'Brake fluid',
      dueDate: isoDay(-9),
    });
    const soon = await createReminder(token, vehicleId, {
      title: 'Oil change',
      dueDate: isoDay(4),
    });
    await createReminder(token, vehicleId, { title: 'Tyre rotation', dueDate: isoDay(120) });
    const undated = await createReminder(token, vehicleId, {
      title: 'Timing belt',
      dueOdometerKm: 1_900_000,
    });

    const list = await api(token).get(remindersPath(vehicleId));
    expect(list.status).toBe(200);
    expect(list.body.totalItems).toBe(4);
    expect(Object.keys(list.body).sort()).toEqual(['items', 'page', 'pageSize', 'totalItems', 'totalPages']);
    expect(list.body.items.map((item: Row) => item.title)).toEqual([
      'Brake fluid',
      'Oil change',
      'Tyre rotation',
      'Timing belt',
    ]);
    expect(list.body.items.map((item: Row) => item.alertStatus)).toEqual([
      'OVERDUE',
      'UPCOMING',
      'SCHEDULED',
      'SCHEDULED',
    ]);

    const overdueOnly = await api(token).get(`${remindersPath(vehicleId)}?due=overdue`);
    expect(overdueOnly.body.items.map((item: Row) => item.title)).toEqual(['Brake fluid']);
    expect(overdueOnly.body.totalItems).toBe(1);

    const closed = await api(token).patch(
      `${remindersPath(vehicleId)}/${overdue.body.id}/dismiss`,
    );
    expect(closed.status).toBe(200);
    expect(closed.body.alertStatus).toBeNull();
    expect(closed.body.dueDate).toBe(isoDay(-9));

    await api(token).patch(`${remindersPath(vehicleId)}/${soon.body.id}/complete`, {
      completionDate: isoDay(-1),
      completionOdometerKm: 44_000,
    });

    const afterClose = await api(token).get(`${remindersPath(vehicleId)}?due=overdue`);
    expect(afterClose.body.items).toEqual([]);
    expect(afterClose.body.totalItems).toBe(0);
    expect(afterClose.body.totalPages).toBe(1);

    const active = await api(token).get(`${remindersPath(vehicleId)}?status=ACTIVE`);
    expect(active.body.items.map((item: Row) => item.title)).toEqual([
      'Tyre rotation',
      'Timing belt',
    ]);
    const completed = await api(token).get(`${remindersPath(vehicleId)}?status=COMPLETED`);
    expect(completed.body.items.map((item: Row) => item.title)).toEqual(['Oil change']);
    expect(completed.body.items[0]).toMatchObject({
      status: 'COMPLETED',
      alertStatus: null,
      lastCompletedDate: isoDay(-1),
      lastCompletedOdometerKm: 44_000,
      dueDate: isoDay(4),
    });

    const paged = await api(token).get(`${remindersPath(vehicleId)}?page=2&pageSize=2`);
    expect(paged.body.items.map((item: Row) => item.title)).toEqual([
      'Tyre rotation',
      'Timing belt',
    ]);
    expect(paged.body).toMatchObject({ page: 2, pageSize: 2, totalItems: 4, totalPages: 2 });

    const badStatus = await api(token).get(`${remindersPath(vehicleId)}?status=ARCHIVED`);
    expect(badStatus.status).toBe(400);

    const del = await api(token).del(`${remindersPath(vehicleId)}/${undated.body.id}`);
    expect(del.status).toBe(204);
    expect((await api(token).get(remindersPath(vehicleId))).body.totalItems).toBe(3);
    expect(
      (await api(token).del(`${remindersPath(vehicleId)}/${undated.body.id}`)).status,
    ).toBe(404);
  });

  it('completes a one-off reminder without inventing a paid visit', async () => {
    const { token } = await signUp('complete-once');
    const vehicleId = await vehicleFor(token);
    const created = await createReminder(token, vehicleId, {
      title: 'Wiper replacement',
      dueDate: isoDay(-2),
      dueOdometerKm: 44_000,
    });

    const done = await api(token).patch(
      `${remindersPath(vehicleId)}/${created.body.id}/complete`,
      { completionDate: isoDay(-1), completionOdometerKm: 44_050 },
    );

    expect(done.status).toBe(200);
    expect(done.body.status).toBe('COMPLETED');
    expect(done.body.alertStatus).toBeNull();
    expect(done.body.lastCompletedDate).toBe(isoDay(-1));
    expect(done.body.lastCompletedOdometerKm).toBe(44_050);
    // A finished one-off keeps the schedule it had, for the history books.
    expect(done.body.dueDate).toBe(isoDay(-2));
    expect(done.body.dueOdometerKm).toBe(44_000);

    const row = (await reminderRows(vehicleId))[0] ?? {};
    expect(row.status).toBe('COMPLETED');
    expect(row.last_completed_odometer_km).toBe(44_050);

    // Marking it done wrote no service record.
    expect((await api(token).get(recordsPath(vehicleId))).body.totalItems).toBe(0);

    const again = await api(token).patch(
      `${remindersPath(vehicleId)}/${created.body.id}/complete`,
      { completionDate: isoDay(-1), completionOdometerKm: 44_050 },
    );
    expect(again.status).toBe(409);
    expect(again.body.message).toMatch(/already completed/);
    expect(
      (await api(token).patch(`${remindersPath(vehicleId)}/${created.body.id}/dismiss`)).status,
    ).toBe(409);

    const missing = await api(token).patch(
      `${remindersPath(vehicleId)}/${created.body.id}/complete`,
      { completionDate: isoDay(-1) },
    );
    expect(missing.status).toBe(400);
  });

  it('rolls a recurring reminder forward from the visit that just happened', async () => {
    const { token } = await signUp('recurring');
    const vehicleId = await vehicleFor(token);
    const created = await createReminder(token, vehicleId, {
      title: 'Oil change',
      dueDate: isoDay(-30),
      dueOdometerKm: 44_000,
      intervalMonths: 6,
      intervalKm: 5_000,
    });

    // Measured from the completion, not from the stale due value, so a visit that
    // happened late does not come back overdue the moment it is marked done.
    const first = await api(token).patch(
      `${remindersPath(vehicleId)}/${created.body.id}/complete`,
      { completionDate: isoDay(-1), completionOdometerKm: 49_400 },
    );
    expect(first.status).toBe(200);
    expect(first.body.status).toBe('ACTIVE');
    expect(first.body.dueOdometerKm).toBe(54_400);
    expect(first.body.dueDate).toBe(addIsoMonths(isoDay(-1), 6));
    expect(first.body.lastCompletedDate).toBe(isoDay(-1));
    expect(first.body.lastCompletedOdometerKm).toBe(49_400);
    expect(first.body.alertStatus).toBe('SCHEDULED');

    // The interval stays anchored on the last completion, so a visit done a
    // little late keeps the schedule on pace instead of drifting further ahead.
    const second = await api(token).patch(
      `${remindersPath(vehicleId)}/${created.body.id}/complete`,
      { completionDate: isoDay(-1), completionOdometerKm: 54_500 },
    );
    expect(second.body.dueOdometerKm).toBe(54_400);
    expect(second.body.dueDate).toBe(first.body.dueDate);
    expect(second.body.lastCompletedOdometerKm).toBe(54_500);
    expect(second.body.status).toBe('ACTIVE');

    const row = (await reminderRows(vehicleId))[0] ?? {};
    expect(row.status).toBe('ACTIVE');
    expect(row.due_odometer_km).toBe(54_400);
    expect(row.last_completed_odometer_km).toBe(54_500);

    // A reminder with only a kilometre interval keeps its date schedule alone.
    const kmOnly = await createReminder(token, vehicleId, {
      title: 'Tyre rotation',
      dueOdometerKm: 44_200,
      intervalKm: 10_000,
      dueDate: isoDay(60),
    });
    const turned = await api(token).patch(
      `${remindersPath(vehicleId)}/${kmOnly.body.id}/complete`,
      { completionDate: isoDay(-1), completionOdometerKm: 44_200 },
    );
    expect(turned.body.dueOdometerKm).toBe(54_200);
    expect(turned.body.dueDate).toBe(isoDay(60));
  });

  it('refuses a completion reading that goes backwards in time', async () => {
    const { token } = await signUp('regression');
    const vehicleId = await vehicleFor(token, { currentOdometer: 45_000 });
    const created = await createReminder(token, vehicleId, {
      title: 'Oil change',
      dueOdometerKm: 46_000,
      intervalKm: 5_000,
    });
    const complete = (completionOdometerKm: number, completionDate = isoDay(-1)) =>
      api(token).patch(`${remindersPath(vehicleId)}/${created.body.id}/complete`, {
        completionDate,
        completionOdometerKm,
      });

    // The vehicle's own stored reading is a floor the user already vouched for.
    const low = await complete(44_999);
    expect(low.status).toBe(400);
    expect(low.body.message).toBe(
      'Odometer cannot be lower than the last recorded reading (45000 km)',
    );

    // A service record raises that floor above the vehicle's own column.
    await createRecord(token, vehicleId, {
      ...baseRecord,
      serviceDate: isoDay(-1),
      odometerKm: 47_000,
    });
    const stale = await complete(46_000);
    expect(stale.status).toBe(400);
    expect(stale.body.message).toContain('(47000 km)');

    // A completion date in the future is refused before anything is written.
    const future = await complete(47_000, isoDay(2));
    expect(future.status).toBe(400);

    const done = await complete(47_000);
    expect(done.status).toBe(200);
    expect(done.body.status).toBe('ACTIVE');
    expect(done.body.dueOdometerKm).toBe(52_000);
    expect(done.body.lastCompletedOdometerKm).toBe(47_000);

    // The completion just made is the new floor.
    const backwards = await complete(46_999);
    expect(backwards.status).toBe(400);
    expect(backwards.body.message).toContain('(47000 km)');

    const row = (await reminderRows(vehicleId))[0] ?? {};
    expect(row.last_completed_odometer_km).toBe(47_000);
  });

  it('dismisses without rewriting the schedule and refuses to reopen silently', async () => {
    const { token } = await signUp('dismiss');
    const vehicleId = await vehicleFor(token);
    const created = await createReminder(token, vehicleId, {
      title: 'Recall fix',
      dueDate: isoDay(-5),
      dueOdometerKm: 44_500,
      intervalMonths: 12,
    });

    const dismissed = await api(token).patch(
      `${remindersPath(vehicleId)}/${created.body.id}/dismiss`,
    );
    expect(dismissed.status).toBe(200);
    expect(dismissed.body.status).toBe('DISMISSED');
    expect(dismissed.body.alertStatus).toBeNull();
    expect(dismissed.body.dueDate).toBe(isoDay(-5));
    expect(dismissed.body.dueOdometerKm).toBe(44_500);
    expect(dismissed.body.intervalMonths).toBe(12);
    expect(dismissed.body.lastCompletedDate).toBeNull();

    const twice = await api(token).patch(
      `${remindersPath(vehicleId)}/${created.body.id}/dismiss`,
    );
    expect(twice.status).toBe(409);
    expect(twice.body.message).toMatch(/already dismissed/);

    expect(
      (
        await api(token).patch(`${remindersPath(vehicleId)}/${created.body.id}/complete`, {
          completionDate: isoDay(-1),
          completionOdometerKm: 44_000,
        })
      ).status,
    ).toBe(409);

    const del = await api(token).del(`${remindersPath(vehicleId)}/${created.body.id}`);
    expect(del.status).toBe(204);
    expect(await reminderRows(vehicleId)).toHaveLength(0);
  });

  it('summarises a vehicle from the rows themselves, with nothing left stale', async () => {
    const { token } = await signUp('summary');
    const vehicleId = await vehicleFor(token);

    const empty = await api(token).get(`/vehicles/${vehicleId}/maintenance-summary`);
    expect(empty.status).toBe(200);
    expect(Object.keys(empty.body).sort()).toEqual([...summaryFields].sort());
    expect(empty.body).toEqual({
      vehicleId,
      totalServiceRecords: 0,
      totalExpenditure: 0,
      lastServiceDate: null,
      lastServiceOdometer: null,
      activeReminders: 0,
      overdueReminders: 0,
      upcomingReminders: 0,
    });

    await createRecord(token, vehicleId, {
      ...baseRecord,
      serviceDate: '2026-02-01',
      odometerKm: 40_000,
      labourCost: 1_000,
      partsCost: 200.25,
      otherCost: 0,
    });
    const newest = await createRecord(token, vehicleId, {
      ...baseRecord,
      serviceDate: '2026-05-01',
      odometerKm: 42_000,
      labourCost: 500,
      partsCost: 1_000,
      otherCost: 50,
    });

    await createReminder(token, vehicleId, { title: 'Overdue', dueDate: isoDay(-9) });
    await createReminder(token, vehicleId, { title: 'Soon', dueDate: isoDay(4) });
    await createReminder(token, vehicleId, { title: 'Later', dueDate: isoDay(120) });
    const dismissed = await createReminder(token, vehicleId, {
      title: 'Gone',
      dueDate: isoDay(-300),
    });
    await api(token).patch(`${remindersPath(vehicleId)}/${dismissed.body.id}/dismiss`);

    const summary = await api(token).get(`/vehicles/${vehicleId}/maintenance-summary`);
    expect(summary.body).toEqual({
      vehicleId,
      totalServiceRecords: 2,
      totalExpenditure: 2_750.25,
      lastServiceDate: '2026-05-01',
      lastServiceOdometer: 42_000,
      activeReminders: 3,
      overdueReminders: 1,
      upcomingReminders: 1,
    });

    // Deleting the newest record moves the last service back and the money down:
    // no cached totals to go stale.
    expect(
      (await api(token).del(`${recordsPath(vehicleId)}/${newest.body.id}`)).status,
    ).toBe(204);

    const afterDelete = await api(token).get(`/vehicles/${vehicleId}/maintenance-summary`);
    expect(afterDelete.body).toEqual({
      vehicleId,
      totalServiceRecords: 1,
      totalExpenditure: 1_200.25,
      lastServiceDate: '2026-02-01',
      lastServiceOdometer: 40_000,
      activeReminders: 3,
      overdueReminders: 1,
      upcomingReminders: 1,
    });

    expect((await api(token).get(`/vehicles/${NULL_UUID}/maintenance-summary`)).status).toBe(404);
  });

  it('refuses to delete a vehicle that has a past', async () => {
    const { id, token } = await signUp('deletion-guard');
    const vehicleId = await vehicleFor(token);

    // Vehicles with no history keep deleting exactly as before.
    const clean = await vehicleFor(token, { registrationNumber: 'MH 14 CD 5678' });
    expect((await api(token).del(`/vehicles/${clean}`)).status).toBe(204);

    const record = await createRecord(token, vehicleId);
    const reminder = await createReminder(token, vehicleId, {
      title: 'Oil change',
      dueDate: isoDay(10),
    });

    const blocked = await api(token).del(`/vehicles/${vehicleId}`);
    expect(blocked.status).toBe(409);
    expect(blocked.body.message).toBe(
      'This vehicle still has 1 service record and 1 maintenance reminder. Delete those first if you really want the vehicle gone — service history is never removed as a side effect of deleting a vehicle.',
    );
    expect(blocked.body).toMatchObject({ statusCode: 409, error: 'Conflict' });

    await api(token).del(`${recordsPath(vehicleId)}/${record.body.id}`);

    const remindersOnly = await api(token).del(`/vehicles/${vehicleId}`);
    expect(remindersOnly.status).toBe(409);
    expect(remindersOnly.body.message).toBe(
      'This vehicle still has 1 maintenance reminder. Delete those first if you really want the vehicle gone — service history is never removed as a side effect of deleting a vehicle.',
    );

    await api(token).del(`${remindersPath(vehicleId)}/${reminder.body.id}`);
    expect((await api(token).del(`/vehicles/${vehicleId}`)).status).toBe(204);

    await dataSource.query(`DELETE FROM users WHERE id = $1`, [id]);
    createdUserIds.splice(createdUserIds.indexOf(id), 1);
  });

  it('lets the database, not only the API, refuse history that changes hands', async () => {
    const owner = await signUp('db-owner');
    const stranger = await signUp('db-stranger');
    const vehicleId = await vehicleFor(owner.token);

    // A row that claims a different owner than its vehicle never lands.
    await expect(
      dataSource.query(
        `INSERT INTO service_records (id, vehicle_id, user_id, service_date, service_type)
         VALUES (gen_random_uuid(), $1, $2, '2026-09-01', 'OTHER')`,
        [vehicleId, stranger.id],
      ),
    ).rejects.toMatchObject({ code: '23503' });

    await expect(
      dataSource.query(
        `INSERT INTO maintenance_reminders (id, vehicle_id, user_id, title, due_date)
         VALUES (gen_random_uuid(), $1, $2, 'Hijack', '2026-09-01')`,
        [vehicleId, stranger.id],
      ),
    ).rejects.toMatchObject({ code: '23503' });

    // Nor does a row for a vehicle that does not exist.
    await expect(
      dataSource.query(
        `INSERT INTO service_records (id, vehicle_id, user_id, service_date, service_type)
         VALUES (gen_random_uuid(), gen_random_uuid(), $1, '2026-09-01', 'OTHER')`,
        [owner.id],
      ),
    ).rejects.toMatchObject({ code: '23503' });

    const breaking: string[] = [
      `INSERT INTO service_records (id, vehicle_id, user_id, service_date, service_type, labour_cost, total_cost)
         VALUES (gen_random_uuid(), $1, $2, '2026-09-01', 'OTHER', -1, -1)`,
      `INSERT INTO service_records (id, vehicle_id, user_id, service_date, service_type, labour_cost, parts_cost, other_cost, total_cost)
         VALUES (gen_random_uuid(), $1, $2, '2026-09-01', 'OTHER', 100, 0, 0, 999)`,
      `INSERT INTO service_records (id, vehicle_id, user_id, service_date, service_type, parts_replaced)
         VALUES (gen_random_uuid(), $1, $2, '2026-09-01', 'OTHER', '{"name":"oil"}'::jsonb)`,
      `INSERT INTO service_records (id, vehicle_id, user_id, service_date, service_type, odometer_km)
         VALUES (gen_random_uuid(), $1, $2, '2026-09-01', 'OTHER', 2000001)`,
      `INSERT INTO service_records (id, vehicle_id, user_id, service_date, service_type)
         VALUES (gen_random_uuid(), $1, $2, '2026-09-01', 'CAR_WASH')`,
      `INSERT INTO maintenance_reminders (id, vehicle_id, user_id, title)
         VALUES (gen_random_uuid(), $1, $2, 'Endless')`,
      `INSERT INTO maintenance_reminders (id, vehicle_id, user_id, title, due_date, status)
         VALUES (gen_random_uuid(), $1, $2, 'Who', '2026-09-01', 'ARCHIVED')`,
      `INSERT INTO maintenance_reminders (id, vehicle_id, user_id, title, due_date, interval_km)
         VALUES (gen_random_uuid(), $1, $2, 'Instant', '2026-09-01', 0)`,
    ];

    for (const sql of breaking) {
      await expect(dataSource.query(sql, [vehicleId, owner.id])).rejects.toMatchObject({
        code: '23514',
      });
    }

    // Deleting the vehicle through SQL while a reminder still points at it.
    await createReminder(owner.token, vehicleId, { title: 'Keeper', dueDate: isoDay(3) });
    await expect(
      dataSource.query(`DELETE FROM vehicles WHERE id = $1`, [vehicleId]),
    ).rejects.toMatchObject({ code: '23503' });

    // The owner still cascades away once the history is removed first.
    await dataSource.query(`DELETE FROM maintenance_reminders WHERE vehicle_id = $1`, [vehicleId]);
    await dataSource.query(`DELETE FROM users WHERE id = $1`, [owner.id]);
    expect(
      (await dataSource.query(`SELECT count(*)::int AS n FROM vehicles WHERE user_id = $1`, [owner.id]))[0].n,
    ).toBe(0);
    createdUserIds.splice(createdUserIds.indexOf(owner.id), 1);
  });

  it('serialises two concurrent completions of the same reminder', async () => {
    const { token } = await signUp('race');
    const vehicleId = await vehicleFor(token);
    const created = await createReminder(token, vehicleId, {
      title: 'Oil change',
      dueDate: isoDay(-1),
    });

    const results = await Promise.all([
      api(token).patch(`${remindersPath(vehicleId)}/${created.body.id}/complete`, {
        completionDate: isoDay(-1),
        completionOdometerKm: 44_000,
      }),
      api(token).patch(`${remindersPath(vehicleId)}/${created.body.id}/complete`, {
        completionDate: isoDay(-1),
        completionOdometerKm: 44_000,
      }),
    ]);

    // The user-row lock makes the second one see an already-closed reminder.
    expect(results.map((res) => res.status).sort()).toEqual([200, 409]);
    const rows = await reminderRows(vehicleId);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe('COMPLETED');
  });
});
