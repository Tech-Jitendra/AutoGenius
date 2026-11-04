import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreateMaintenanceReminderInput,
  CreateServiceRecordInput,
  MaintenanceReminderQuery,
  ServiceRecordQuery,
  UpdateMaintenanceReminderInput,
  UpdateServiceRecordInput,
} from '@autogenius/validation';
import { VehicleEntity } from '../vehicles/vehicle.entity';
import { MaintenanceReminderEntity } from './maintenance-reminder.entity';
import { ServiceRecordEntity } from './service-record.entity';
import { ServiceHistoryService } from './service-history.service';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_USER = '22222222-2222-4222-8222-222222222222';
const VEHICLE_ID = '33333333-3333-4333-8333-333333333333';
const RECORD_ID = '44444444-4444-4444-8444-444444444444';
const REMINDER_ID = '55555555-5555-4555-8555-555555555555';

/** Fixed so the overdue/upcoming windows have one answer for the whole suite. */
const NOW = new Date('2026-11-04T05:30:00.000Z');

const minimalRecord = {
  serviceDate: '2026-10-21',
  serviceType: 'GENERAL_SERVICE',
} satisfies CreateServiceRecordInput;

const minimalReminder = {
  title: 'Oil change',
  dueDate: '2026-12-20',
} satisfies CreateMaintenanceReminderInput;

interface QueryBuilder {
  select: jest.Mock;
  addSelect: jest.Mock;
  where: jest.Mock;
  andWhere: jest.Mock;
  orderBy: jest.Mock;
  addOrderBy: jest.Mock;
  skip: jest.Mock;
  take: jest.Mock;
  getManyAndCount: jest.Mock;
  getRawOne: jest.Mock;
}

function makeQueryBuilder(options: {
  rows?: ServiceRecordEntity[];
  totalItems?: number;
  rawOne?: Record<string, string | number | null> | null;
} = {}): QueryBuilder {
  const builder = {} as QueryBuilder;
  const chained = ['select', 'addSelect', 'where', 'andWhere', 'orderBy', 'addOrderBy', 'skip', 'take'] as const;
  for (const method of chained) {
    builder[method] = jest.fn(() => builder);
  }
  builder.getManyAndCount = jest
    .fn()
    .mockResolvedValue([options.rows ?? [], options.totalItems ?? (options.rows ?? []).length]);
  builder.getRawOne = jest.fn().mockResolvedValue(options.rawOne ?? null);
  return builder;
}

function makeVehicle(overrides: Partial<VehicleEntity> = {}): VehicleEntity {
  return {
    id: VEHICLE_ID,
    userId: USER_ID,
    currentOdometer: 44_000,
    ...overrides,
  } as unknown as VehicleEntity;
}

function makeRecord(overrides: Partial<ServiceRecordEntity> = {}): ServiceRecordEntity {
  return {
    id: RECORD_ID,
    vehicleId: VEHICLE_ID,
    userId: USER_ID,
    serviceDate: '2026-10-21',
    odometerKm: 43_215,
    workshopName: 'City Motors',
    serviceType: 'GENERAL_SERVICE',
    description: null,
    partsReplaced: [],
    labourCost: 800,
    partsCost: 1_250.5,
    otherCost: 0,
    totalCost: 2_050.5,
    notes: null,
    createdAt: new Date('2026-10-21T10:00:00Z'),
    updatedAt: new Date('2026-10-21T10:00:00Z'),
    ...overrides,
  } as unknown as ServiceRecordEntity;
}

function makeReminderRow(
  overrides: Partial<MaintenanceReminderEntity> = {},
): MaintenanceReminderEntity {
  return {
    id: REMINDER_ID,
    vehicleId: VEHICLE_ID,
    userId: USER_ID,
    title: 'Oil change',
    description: null,
    dueDate: '2026-12-20',
    dueOdometerKm: null,
    intervalMonths: null,
    intervalKm: null,
    lastCompletedDate: null,
    lastCompletedOdometerKm: null,
    status: 'ACTIVE',
    createdAt: new Date('2026-10-01T10:00:00Z'),
    updatedAt: new Date('2026-10-01T10:00:00Z'),
    ...overrides,
  } as unknown as MaintenanceReminderEntity;
}

interface Fakes {
  service: ServiceHistoryService;
  records: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  reminders: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
  };
  vehicles: { findOne: jest.Mock };
  lock: jest.Mock;
  transaction: jest.Mock;
  builder: QueryBuilder;
}

function makeFakes(
  overrides: {
    vehicle?: VehicleEntity | null;
    record?: ServiceRecordEntity | null;
    reminder?: MaintenanceReminderEntity | null;
    builder?: QueryBuilder;
  } = {},
): Fakes {
  const builder = overrides.builder ?? makeQueryBuilder();
  const records = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(overrides.record ?? null),
    create: jest.fn((input: Record<string, unknown>) => input),
    save: jest.fn(async (entity: Record<string, unknown>) => entity),
    remove: jest.fn().mockResolvedValue(undefined),
    createQueryBuilder: jest.fn(() => builder),
  };
  const reminders = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(overrides.reminder ?? null),
    create: jest.fn((input: Record<string, unknown>) => input),
    save: jest.fn(async (entity: Record<string, unknown>) => entity),
    remove: jest.fn().mockResolvedValue(undefined),
  };
  const vehicles = {
    findOne: jest.fn().mockResolvedValue(
      overrides.vehicle === undefined ? makeVehicle() : overrides.vehicle,
    ),
  };

  const repos: Record<string, unknown> = {
    [ServiceRecordEntity.name]: records,
    [MaintenanceReminderEntity.name]: reminders,
    [VehicleEntity.name]: vehicles,
  };
  const lock = jest.fn().mockResolvedValue([{ id: USER_ID }]);
  const manager = {
    query: lock,
    getRepository: (entity: { name: string }): unknown => repos[entity.name],
  };
  const transaction = jest.fn(async (work: (m: unknown) => Promise<unknown>) =>
    work(manager),
  );

  const service = new ServiceHistoryService(
    records as unknown as never,
    reminders as unknown as never,
    vehicles as unknown as never,
    { transaction } as unknown as never,
  );
  return { service, records, reminders, vehicles, lock, transaction, builder };
}

const listQuery = { page: 1, pageSize: 20 } satisfies ServiceRecordQuery;
const reminderQuery = { page: 1, pageSize: 20 } satisfies MaintenanceReminderQuery;

describe('ServiceHistoryService', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('createRecord', () => {
    it('adds up the costs into the stored total', async () => {
      const fakes = makeFakes();
      await fakes.service.createRecord(USER_ID, VEHICLE_ID, {
        ...minimalRecord,
        labourCost: 800,
        partsCost: 1_250.5,
        otherCost: 250.5,
      });

      expect(fakes.records.create).toHaveBeenCalledWith(
        expect.objectContaining({ labourCost: 800, partsCost: 1_250.5, otherCost: 250.5, totalCost: 2_301 }),
      );
    });

    it('sums in cents so the database total CHECK cannot be tripped by float noise', async () => {
      const fakes = makeFakes();
      await fakes.service.createRecord(USER_ID, VEHICLE_ID, {
        ...minimalRecord,
        labourCost: 0.1,
        partsCost: 0.2,
      });

      const created = fakes.records.create.mock.calls[0]?.[0] as { totalCost: number };
      expect(created.totalCost).toBe(0.3);
    });

    it('treats omitted cost components as zero', async () => {
      const fakes = makeFakes();
      const record = await fakes.service.createRecord(USER_ID, VEHICLE_ID, minimalRecord);

      expect(fakes.records.create).toHaveBeenCalledWith(
        expect.objectContaining({
          labourCost: 0,
          partsCost: 0,
          otherCost: 0,
          totalCost: 0,
        }),
      );
      expect(record.totalCost).toBe(0);
    });

    it('stores null for blanks and pins the row to the caller and the vehicle', async () => {
      const fakes = makeFakes();
      await fakes.service.createRecord(USER_ID, VEHICLE_ID, minimalRecord);

      expect(fakes.records.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: USER_ID,
          vehicleId: VEHICLE_ID,
          odometerKm: null,
          workshopName: null,
          description: null,
          notes: null,
          partsReplaced: [],
        }),
      );
    });

    it('keeps a quantity or cost the caller left out as null, not as zero', async () => {
      const fakes = makeFakes();
      await fakes.service.createRecord(USER_ID, VEHICLE_ID, {
        ...minimalRecord,
        partsReplaced: [{ name: 'Oil filter' }, { name: 'Filter case', quantity: 1, cost: 120 }],
      } as CreateServiceRecordInput);

      expect(fakes.records.create).toHaveBeenCalledWith(
        expect.objectContaining({
          partsReplaced: [
            { name: 'Oil filter', quantity: null, cost: null },
            { name: 'Filter case', quantity: 1, cost: 120 },
          ],
        }),
      );
    });

    it('locks the owning user row before writing', async () => {
      const fakes = makeFakes();
      await fakes.service.createRecord(USER_ID, VEHICLE_ID, minimalRecord);

      expect(fakes.lock).toHaveBeenCalledWith(expect.stringContaining('FOR UPDATE'), [USER_ID]);
      expect(fakes.lock.mock.invocationCallOrder[0] ?? 0).toBeLessThan(
        fakes.records.save.mock.invocationCallOrder[0] ?? 0,
      );
    });

    it('refuses a record for a vehicle the caller does not own', async () => {
      const fakes = makeFakes({ vehicle: null });
      await expect(
        fakes.service.createRecord(OTHER_USER, VEHICLE_ID, minimalRecord),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(fakes.records.save).not.toHaveBeenCalled();
    });

    it('never hands the owner id back to the client', async () => {
      const fakes = makeFakes();
      const record = await fakes.service.createRecord(USER_ID, VEHICLE_ID, minimalRecord);
      expect(Object.keys(record).sort()).toEqual(
        [
          'createdAt',
          'id',
          'labourCost',
          'notes',
          'odometerKm',
          'otherCost',
          'partsCost',
          'partsReplaced',
          'serviceDate',
          'serviceType',
          'totalCost',
          'updatedAt',
          'vehicleId',
          'workshopName',
          'description',
        ].sort(),
      );
    });
  });

  describe('listRecords', () => {
    it('scopes both the vehicle and the user and pages newest first', async () => {
      const fakes = makeFakes({ builder: makeQueryBuilder({ rows: [makeRecord()], totalItems: 41 }) });
      const result = await fakes.service.listRecords(USER_ID, VEHICLE_ID, listQuery);

      const whereCalls = fakes.builder.where.mock.calls.concat(fakes.builder.andWhere.mock.calls);
      expect(whereCalls).toEqual(
        expect.arrayContaining([
          ['record.vehicle_id = :vehicleId', { vehicleId: VEHICLE_ID }],
          ['record.user_id = :userId', { userId: USER_ID }],
        ]),
      );
      expect(fakes.builder.orderBy).toHaveBeenCalledWith('record.service_date', 'DESC');
      expect(fakes.builder.addOrderBy).toHaveBeenCalledWith('record.created_at', 'DESC');
      expect(fakes.builder.skip).toHaveBeenCalledWith(0);
      expect(fakes.builder.take).toHaveBeenCalledWith(20);
      expect(result).toMatchObject({ page: 1, pageSize: 20, totalItems: 41, totalPages: 3 });
      expect(result.items[0]?.totalCost).toBe(2_050.5);
    });

    it('offsets by the requested page', async () => {
      const fakes = makeFakes();
      await fakes.service.listRecords(USER_ID, VEHICLE_ID, { page: 3, pageSize: 10 });
      expect(fakes.builder.skip).toHaveBeenCalledWith(20);
      expect(fakes.builder.take).toHaveBeenCalledWith(10);
    });

    it('adds only the filters that were supplied', async () => {
      const fakes = makeFakes();
      await fakes.service.listRecords(USER_ID, VEHICLE_ID, {
        ...listQuery,
        serviceType: 'OIL_CHANGE',
        from: '2026-01-01',
      });

      expect(fakes.builder.andWhere).toHaveBeenCalledWith(
        'record.service_type = :serviceType',
        { serviceType: 'OIL_CHANGE' },
      );
      expect(fakes.builder.andWhere).toHaveBeenCalledWith('record.service_date >= :from', {
        from: '2026-01-01',
      });
      const filters = fakes.builder.andWhere.mock.calls.map(([sql]) => sql);
      expect(filters).not.toContain('record.service_date <= :to');
    });

    it('reports a single page for a vehicle with no history', async () => {
      const result = await makeFakes().service.listRecords(USER_ID, VEHICLE_ID, listQuery);
      expect(result).toEqual({ items: [], page: 1, pageSize: 20, totalItems: 0, totalPages: 1 });
    });

    it('will not list someone else\'s vehicle', async () => {
      const fakes = makeFakes({ vehicle: null });
      await expect(
        fakes.service.listRecords(OTHER_USER, VEHICLE_ID, listQuery),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(fakes.builder.getManyAndCount).not.toHaveBeenCalled();
    });
  });

  describe('updateRecord', () => {
    it('re-derives the total when only one component is patched', async () => {
      const fakes = makeFakes({ record: makeRecord() });
      const input: UpdateServiceRecordInput = { otherCost: 149.5 };
      const record = await fakes.service.updateRecord(USER_ID, VEHICLE_ID, RECORD_ID, input);

      expect(record.labourCost).toBe(800);
      expect(record.partsCost).toBe(1_250.5);
      expect(record.otherCost).toBe(149.5);
      expect(record.totalCost).toBe(2_200);
    });

    it('changes only the keys the caller sent', async () => {
      const fakes = makeFakes({ record: makeRecord() });
      const record = await fakes.service.updateRecord(USER_ID, VEHICLE_ID, RECORD_ID, {
        workshopName: 'Riverside Garage',
        notes: null,
      });

      expect(record.workshopName).toBe('Riverside Garage');
      expect(record.notes).toBeNull();
      expect(record.serviceDate).toBe('2026-10-21');
      expect(record.odometerKm).toBe(43_215);
    });

    it('replaces the whole parts list, and an empty one clears it', async () => {
      const fakes = makeFakes({ record: makeRecord({ partsReplaced: [{ name: 'Old part', quantity: 1, cost: 10 }] }) });

      const replaced = await fakes.service.updateRecord(USER_ID, VEHICLE_ID, RECORD_ID, {
        partsReplaced: [{ name: 'Brake pads', quantity: 4, cost: 2_400 }],
      } as UpdateServiceRecordInput);
      expect(replaced.partsReplaced).toEqual([
        { name: 'Brake pads', quantity: 4, cost: 2_400 },
      ]);

      const cleared = await fakes.service.updateRecord(USER_ID, VEHICLE_ID, RECORD_ID, {
        partsReplaced: [],
      });
      expect(cleared.partsReplaced).toEqual([]);
    });

    it('reads the row through the vehicle and the caller, so a foreign id is a 404', async () => {
      const fakes = makeFakes();
      await expect(
        fakes.service.updateRecord(OTHER_USER, VEHICLE_ID, RECORD_ID, { notes: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(fakes.records.findOne).toHaveBeenCalledWith({
        where: { id: RECORD_ID, vehicleId: VEHICLE_ID, userId: OTHER_USER },
      });
      expect(fakes.records.save).not.toHaveBeenCalled();
    });

    it('is not found under a different vehicle even for the owner', async () => {
      const otherVehicle = '66666666-6666-4666-8666-666666666666';
      const fakes = makeFakes();
      await expect(
        fakes.service.updateRecord(USER_ID, otherVehicle, RECORD_ID, { notes: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(fakes.records.save).not.toHaveBeenCalled();
    });
  });

  describe('removeRecord', () => {
    it('deletes only the row scoped to the caller and the vehicle', async () => {
      const fakes = makeFakes({ record: makeRecord() });
      await fakes.service.removeRecord(USER_ID, VEHICLE_ID, RECORD_ID);

      expect(fakes.records.remove).toHaveBeenCalledWith(
        expect.objectContaining({ id: RECORD_ID, userId: USER_ID, vehicleId: VEHICLE_ID }),
      );
    });

    it('refuses to delete another user\'s record', async () => {
      const fakes = makeFakes();
      await expect(
        fakes.service.removeRecord(OTHER_USER, VEHICLE_ID, RECORD_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(fakes.records.remove).not.toHaveBeenCalled();
    });
  });

  describe('createReminder', () => {
    it('starts every reminder ACTIVE, urgency computed rather than stored', async () => {
      const fakes = makeFakes();
      const reminder = await fakes.service.createReminder(USER_ID, VEHICLE_ID, {
        ...minimalReminder,
        dueOdometerKm: 44_500,
        intervalKm: 5_000,
      });

      expect(fakes.records.save).not.toHaveBeenCalled();
      expect(fakes.reminders.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: USER_ID,
          vehicleId: VEHICLE_ID,
          status: 'ACTIVE',
          description: null,
          intervalMonths: null,
          lastCompletedDate: null,
        }),
      );
      // 44_500 - 44_000 km is inside the 1,000 km window.
      expect(reminder.alertStatus).toBe('UPCOMING');
    });

    it('cannot judge an odometer reminder before the car has a reading', async () => {
      const fakes = makeFakes({ vehicle: makeVehicle({ currentOdometer: null }) });
      const reminder = await fakes.service.createReminder(USER_ID, VEHICLE_ID, {
        title: 'Tyre rotation',
        dueOdometerKm: 45_000,
      } satisfies CreateMaintenanceReminderInput);
      expect(reminder.alertStatus).toBe('SCHEDULED');
    });
  });

  describe('listReminders', () => {
    const rows = (): MaintenanceReminderEntity[] => [
      makeReminderRow({ id: REMINDER_ID, dueDate: '2026-10-01' }),
      makeReminderRow({ id: REMINDER_ID, dueDate: '2026-11-20' }),
      makeReminderRow({ id: REMINDER_ID, dueDate: '2027-06-01' }),
    ];

    it('judges each reminder and keeps the ordering the query asked for', async () => {
      const fakes = makeFakes();
      fakes.reminders.find.mockResolvedValue(rows());

      const result = await fakes.service.listReminders(USER_ID, VEHICLE_ID, reminderQuery);

      expect(fakes.reminders.find).toHaveBeenCalledWith({
        where: { vehicleId: VEHICLE_ID, userId: USER_ID },
        order: { dueDate: 'ASC', dueOdometerKm: 'ASC', createdAt: 'ASC' },
      });
      expect(result.items.map((item) => item.alertStatus)).toEqual([
        'OVERDUE',
        'UPCOMING',
        'SCHEDULED',
      ]);
      expect(result.totalItems).toBe(3);
    });

    it('filters by due state without duplicating the date rules', async () => {
      const fakes = makeFakes();
      fakes.reminders.find.mockResolvedValue(rows());

      const result = await fakes.service.listReminders(USER_ID, VEHICLE_ID, {
        ...reminderQuery,
        due: 'OVERDUE',
      });

      expect(result.items).toHaveLength(1);
      expect(result.totalItems).toBe(1);
      expect(result.items[0]?.dueDate).toBe('2026-10-01');
    });

    it('never reports a closed reminder as due', async () => {
      const fakes = makeFakes();
      fakes.reminders.find.mockResolvedValue([
        makeReminderRow({ dueDate: '2020-01-01', status: 'COMPLETED' }),
        makeReminderRow({ dueDate: '2020-01-01', status: 'DISMISSED' }),
      ]);

      const result = await fakes.service.listReminders(USER_ID, VEHICLE_ID, reminderQuery);
      expect(result.items.map((item) => item.alertStatus)).toEqual([null, null]);

      const overdueOnly = await fakes.service.listReminders(USER_ID, VEHICLE_ID, {
        ...reminderQuery,
        due: 'OVERDUE',
      });
      expect(overdueOnly.items).toEqual([]);
    });

    it('pushes the status filter into the query', async () => {
      const fakes = makeFakes();
      await fakes.service.listReminders(USER_ID, VEHICLE_ID, { ...reminderQuery, status: 'ACTIVE' });
      expect(fakes.reminders.find).toHaveBeenCalledWith({
        where: { vehicleId: VEHICLE_ID, userId: USER_ID, status: 'ACTIVE' },
        order: { dueDate: 'ASC', dueOdometerKm: 'ASC', createdAt: 'ASC' },
      });
    });

    it('slices the judged list for the requested page', async () => {
      const fakes = makeFakes();
      fakes.reminders.find.mockResolvedValue([
        makeReminderRow({ dueDate: '2026-10-01' }),
        makeReminderRow({ dueDate: '2026-10-02' }),
        makeReminderRow({ dueDate: '2026-10-03' }),
      ]);

      const page2 = await fakes.service.listReminders(USER_ID, VEHICLE_ID, { page: 2, pageSize: 2 });
      expect(page2.items).toHaveLength(1);
      expect(page2).toMatchObject({ totalItems: 3, totalPages: 2, page: 2 });
    });

    it('scopes the read by the caller', async () => {
      const fakes = makeFakes({ vehicle: null });
      await expect(
        fakes.service.listReminders(OTHER_USER, VEHICLE_ID, reminderQuery),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(fakes.reminders.find).not.toHaveBeenCalled();
    });
  });

  describe('updateReminder', () => {
    it('leaves the untouched schedule alone', async () => {
      const fakes = makeFakes({
        reminder: makeReminderRow({ intervalKm: 5_000, dueOdometerKm: 44_000 }),
      });
      const input: UpdateMaintenanceReminderInput = { title: 'Full synthetic oil', dueDate: null };
      const reminder = await fakes.service.updateReminder(USER_ID, VEHICLE_ID, REMINDER_ID, input);

      expect(reminder.title).toBe('Full synthetic oil');
      expect(reminder.dueDate).toBeNull();
      expect(reminder.dueOdometerKm).toBe(44_000);
      expect(reminder.intervalKm).toBe(5_000);
      expect(reminder.status).toBe('ACTIVE');
    });

    it('checks the due-condition rule against the merged reminder, not the body', async () => {
      const fakes = makeFakes({ reminder: makeReminderRow({ dueOdometerKm: null }) });
      await expect(
        fakes.service.updateReminder(USER_ID, VEHICLE_ID, REMINDER_ID, { dueDate: null }),
      ).rejects.toThrow(/due date or a due odometer/);
      expect(fakes.reminders.save).not.toHaveBeenCalled();
    });

    it('accepts a patch that leaves one due condition standing', async () => {
      const fakes = makeFakes({ reminder: makeReminderRow({ dueDate: '2026-12-20', dueOdometerKm: 50_000 }) });
      const reminder = await fakes.service.updateReminder(USER_ID, VEHICLE_ID, REMINDER_ID, {
        dueDate: null,
      });
      expect(reminder.dueDate).toBeNull();
      expect(reminder.dueOdometerKm).toBe(50_000);
    });

    it('treats another user\'s reminder as not found', async () => {
      const fakes = makeFakes();
      await expect(
        fakes.service.updateReminder(OTHER_USER, VEHICLE_ID, REMINDER_ID, { title: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('completeReminder', () => {
    const completion = { completionDate: '2026-11-02', completionOdometerKm: 44_210 };

    it('closes a one-off reminder and stamps when the work happened', async () => {
      const fakes = makeFakes({
        reminder: makeReminderRow({ dueDate: '2026-11-01', dueOdometerKm: 44_000 }),
      });
      const reminder = await fakes.service.completeReminder(USER_ID, VEHICLE_ID, REMINDER_ID, completion);

      expect(fakes.reminders.create).not.toHaveBeenCalled();
      expect(reminder.status).toBe('COMPLETED');
      expect(reminder.lastCompletedDate).toBe('2026-11-02');
      expect(reminder.lastCompletedOdometerKm).toBe(44_210);
      // A finished one-off keeps the schedule it had, for the history books.
      expect(reminder.dueDate).toBe('2026-11-01');
      expect(reminder.dueOdometerKm).toBe(44_000);
      expect(reminder.alertStatus).toBeNull();
    });

    it('rolls a recurring reminder forward and keeps it active', async () => {
      const fakes = makeFakes({
        reminder: makeReminderRow({
          dueDate: '2026-11-01',
          dueOdometerKm: 44_000,
          intervalMonths: 6,
          intervalKm: 5_000,
        }),
      });
      const reminder = await fakes.service.completeReminder(USER_ID, VEHICLE_ID, REMINDER_ID, completion);

      expect(reminder.status).toBe('ACTIVE');
      expect(reminder.dueDate).toBe('2027-05-02');
      expect(reminder.dueOdometerKm).toBe(49_210);
      expect(reminder.alertStatus).toBe('SCHEDULED');
    });

    it('writes no service record as a side effect', async () => {
      const fakes = makeFakes({ reminder: makeReminderRow() });
      await fakes.service.completeReminder(USER_ID, VEHICLE_ID, REMINDER_ID, completion);
      expect(fakes.records.save).not.toHaveBeenCalled();
      expect(fakes.records.create).not.toHaveBeenCalled();
    });

    it('takes the newest service record reading as the floor', async () => {
      const fakes = makeFakes({
        reminder: makeReminderRow({ lastCompletedOdometerKm: 44_000 }),
        builder: makeQueryBuilder({ rawOne: { reading: '44100' } }),
      });

      const reminder = await fakes.service.completeReminder(USER_ID, VEHICLE_ID, REMINDER_ID, {
        completionDate: '2026-11-02',
        completionOdometerKm: 44_100,
      });
      expect(reminder.lastCompletedOdometerKm).toBe(44_100);
    });

    it('rejects a reading below the last one the user vouched for', async () => {
      const fakes = makeFakes({
        reminder: makeReminderRow({ lastCompletedOdometerKm: 44_000 }),
        builder: makeQueryBuilder({ rawOne: { reading: '44210' } }),
      });

      await expect(
        fakes.service.completeReminder(USER_ID, VEHICLE_ID, REMINDER_ID, {
          completionDate: '2026-11-02',
          completionOdometerKm: 44_209,
        }),
      ).rejects.toThrow('Odometer cannot be lower than the last recorded reading (44210 km)');
      expect(fakes.reminders.save).not.toHaveBeenCalled();
    });

    it('falls back to the vehicle reading when there is no newer one', async () => {
      const fakes = makeFakes({
        vehicle: makeVehicle({ currentOdometer: 44_000 }),
        reminder: makeReminderRow(),
      });
      await expect(
        fakes.service.completeReminder(USER_ID, VEHICLE_ID, REMINDER_ID, {
          completionDate: '2026-11-02',
          completionOdometerKm: 43_999,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuses to complete a reminder that is already closed', async () => {
      const fakes = makeFakes({ reminder: makeReminderRow({ status: 'DISMISSED' }) });
      await expect(
        fakes.service.completeReminder(USER_ID, VEHICLE_ID, REMINDER_ID, completion),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(fakes.reminders.save).not.toHaveBeenCalled();
    });

    it('refuses a reminder that does not belong to the caller', async () => {
      const fakes = makeFakes();
      await expect(
        fakes.service.completeReminder(OTHER_USER, VEHICLE_ID, REMINDER_ID, completion),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('dismissReminder', () => {
    it('marks it dismissed and keeps the schedule intact', async () => {
      const fakes = makeFakes({ reminder: makeReminderRow({ dueOdometerKm: 44_000 }) });
      const reminder = await fakes.service.dismissReminder(USER_ID, VEHICLE_ID, REMINDER_ID);

      expect(reminder.status).toBe('DISMISSED');
      expect(reminder.dueDate).toBe('2026-12-20');
      expect(reminder.dueOdometerKm).toBe(44_000);
      expect(reminder.lastCompletedDate).toBeNull();
      expect(reminder.alertStatus).toBeNull();
    });

    it('cannot dismiss a completed reminder twice', async () => {
      const fakes = makeFakes({ reminder: makeReminderRow({ status: 'COMPLETED' }) });
      await expect(
        fakes.service.dismissReminder(USER_ID, VEHICLE_ID, REMINDER_ID),
      ).rejects.toThrow(/already completed/);
    });

    it('still needs the vehicle to be the caller\'s', async () => {
      const fakes = makeFakes({ vehicle: null });
      await expect(
        fakes.service.dismissReminder(USER_ID, VEHICLE_ID, REMINDER_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('removeReminder', () => {
    it('deletes the row the caller owns', async () => {
      const fakes = makeFakes({ reminder: makeReminderRow() });
      await fakes.service.removeReminder(USER_ID, VEHICLE_ID, REMINDER_ID);
      expect(fakes.reminders.remove).toHaveBeenCalledWith(
        expect.objectContaining({ id: REMINDER_ID, userId: USER_ID }),
      );
    });

    it('refuses another user\'s reminder', async () => {
      const fakes = makeFakes();
      await expect(
        fakes.service.removeReminder(OTHER_USER, VEHICLE_ID, REMINDER_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(fakes.reminders.remove).not.toHaveBeenCalled();
    });
  });

  describe('summary', () => {
    it('derives every figure from the rows', async () => {
      const fakes = makeFakes({
        record: makeRecord({ serviceDate: '2026-10-21', odometerKm: 43_215 }),
        builder: makeQueryBuilder({
          rawOne: { recordCount: '7', expenditure: '12345.60' },
        }),
      });
      fakes.reminders.find.mockResolvedValue([
        makeReminderRow({ dueDate: '2026-10-01' }),
        makeReminderRow({ dueDate: '2026-11-20' }),
        makeReminderRow({ dueDate: '2027-06-01' }),
      ]);

      const result = await fakes.service.summary(USER_ID, VEHICLE_ID);

      expect(result).toEqual({
        vehicleId: VEHICLE_ID,
        totalServiceRecords: 7,
        totalExpenditure: 12_345.6,
        lastServiceDate: '2026-10-21',
        lastServiceOdometer: 43_215,
        activeReminders: 3,
        overdueReminders: 1,
        upcomingReminders: 1,
      });
      expect(fakes.builder.select).toHaveBeenCalledWith('COUNT(*)', 'recordCount');
      expect(fakes.records.findOne).toHaveBeenCalledWith({
        where: { vehicleId: VEHICLE_ID, userId: USER_ID },
        order: { serviceDate: 'DESC', createdAt: 'DESC' },
      });
      // Closed reminders are excluded in the query, so they cannot inflate the counts.
      expect(fakes.reminders.find).toHaveBeenCalledWith({
        where: { vehicleId: VEHICLE_ID, userId: USER_ID, status: 'ACTIVE' },
      });
    });

    it('reports zeroes for a vehicle with no history', async () => {
      const fakes = makeFakes({ record: null });
      const result = await fakes.service.summary(USER_ID, VEHICLE_ID);

      expect(result).toMatchObject({
        totalServiceRecords: 0,
        totalExpenditure: 0,
        lastServiceDate: null,
        lastServiceOdometer: null,
        activeReminders: 0,
        overdueReminders: 0,
        upcomingReminders: 0,
      });
    });

    it('counts overdue by odometer as well as by date', async () => {
      const fakes = makeFakes();
      fakes.reminders.find.mockResolvedValue([
        makeReminderRow({ dueDate: null, dueOdometerKm: 44_000 }),
      ]);

      const result = await fakes.service.summary(USER_ID, VEHICLE_ID);
      expect(result.overdueReminders).toBe(1);
      expect(result.upcomingReminders).toBe(0);
    });

    it('refuses a vehicle the caller does not own', async () => {
      const fakes = makeFakes({ vehicle: null });
      await expect(fakes.service.summary(OTHER_USER, VEHICLE_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(fakes.builder.getRawOne).not.toHaveBeenCalled();
    });
  });
});
