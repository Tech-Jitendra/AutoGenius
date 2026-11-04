import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import type { EntityManager, Repository } from 'typeorm';
import { DataSource } from 'typeorm';
import type {
  MaintenanceReminder,
  MaintenanceSummary,
  Page,
  ReplacedPart,
  ServiceRecord,
} from '@autogenius/types';
import type {
  CompleteMaintenanceReminderInput,
  CreateMaintenanceReminderInput,
  CreateServiceRecordInput,
  MaintenanceReminderQuery,
  ServiceRecordQuery,
  UpdateMaintenanceReminderInput,
  UpdateServiceRecordInput,
} from '@autogenius/validation';
import {
  REMINDER_DUE_CONDITION_MESSAGE,
  reminderHasDueCondition,
} from '@autogenius/validation';
import { VehicleEntity } from '../vehicles/vehicle.entity';
import { lockUserRow } from '../common/utils/user-transaction';
import {
  MaintenanceReminderEntity,
  toMaintenanceReminder,
} from './maintenance-reminder.entity';
import { ServiceRecordEntity, toServiceRecord } from './service-record.entity';
import { alertStatusFor, isoDayFromInstant, planCompletion } from './maintenance-status';

const DEFAULT_COST = 0;

@Injectable()
export class ServiceHistoryService {
  constructor(
    @InjectRepository(ServiceRecordEntity)
    private readonly records: Repository<ServiceRecordEntity>,
    @InjectRepository(MaintenanceReminderEntity)
    private readonly reminders: Repository<MaintenanceReminderEntity>,
    @InjectRepository(VehicleEntity)
    private readonly vehicles: Repository<VehicleEntity>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  // -------------------------------------------------------------------------
  // Service records
  // -------------------------------------------------------------------------

  async createRecord(
    userId: string,
    vehicleId: string,
    input: CreateServiceRecordInput,
  ): Promise<ServiceRecord> {
    return this.writeForUser(userId, async (manager) => {
      const vehicle = await requireVehicle(
        manager.getRepository(VehicleEntity),
        userId,
        vehicleId,
      );
      const repo = manager.getRepository(ServiceRecordEntity);
      const saved = await repo.save(
        repo.create({
          id: crypto.randomUUID(),
          vehicleId: vehicle.id,
          userId,
          serviceDate: input.serviceDate,
          odometerKm: input.odometerKm ?? null,
          workshopName: input.workshopName ?? null,
          serviceType: input.serviceType,
          description: input.description ?? null,
          partsReplaced: normalizeParts(input.partsReplaced),
          ...costFields(input),
          notes: input.notes ?? null,
        }),
      );
      return toServiceRecord(saved);
    });
  }

  /**
   * Newest service dates first, then newest created — so a record added today for
   * a visit last month still lands where the user expects it.
   */
  async listRecords(
    userId: string,
    vehicleId: string,
    query: ServiceRecordQuery,
  ): Promise<Page<ServiceRecord>> {
    await this.requireReadableVehicle(userId, vehicleId);
    const builder = this.records
      .createQueryBuilder('record')
      .where('record.vehicle_id = :vehicleId', { vehicleId })
      .andWhere('record.user_id = :userId', { userId })
      .orderBy('record.service_date', 'DESC')
      .addOrderBy('record.created_at', 'DESC');

    if (query.serviceType) {
      builder.andWhere('record.service_type = :serviceType', {
        serviceType: query.serviceType,
      });
    }
    if (query.from) {
      builder.andWhere('record.service_date >= :from', { from: query.from });
    }
    if (query.to) {
      builder.andWhere('record.service_date <= :to', { to: query.to });
    }

    const [rows, totalItems] = await builder
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize)
      .getManyAndCount();

    return page(rows.map(toServiceRecord), query.page, query.pageSize, totalItems);
  }

  async findRecord(
    userId: string,
    vehicleId: string,
    recordId: string,
  ): Promise<ServiceRecord> {
    return toServiceRecord(await this.loadRecord(userId, vehicleId, recordId));
  }

  async updateRecord(
    userId: string,
    vehicleId: string,
    recordId: string,
    input: UpdateServiceRecordInput,
  ): Promise<ServiceRecord> {
    return this.writeForUser(userId, async (manager) => {
      await requireVehicle(manager.getRepository(VehicleEntity), userId, vehicleId);
      const repo = manager.getRepository(ServiceRecordEntity);
      const record = await loadRecordIn(repo, userId, vehicleId, recordId);

      if (input.serviceDate !== undefined) record.serviceDate = input.serviceDate;
      if (input.odometerKm !== undefined) record.odometerKm = input.odometerKm;
      if (input.workshopName !== undefined) record.workshopName = input.workshopName;
      if (input.serviceType !== undefined) record.serviceType = input.serviceType;
      if (input.description !== undefined) record.description = input.description;
      if (input.notes !== undefined) record.notes = input.notes;
      if (input.partsReplaced !== undefined) {
        record.partsReplaced = normalizeParts(input.partsReplaced);
      }

      // The total is always re-derived, including when only one component is
      // patched, so total_cost = labour + parts + other can never drift.
      const merged = {
        labourCost: input.labourCost ?? record.labourCost,
        partsCost: input.partsCost ?? record.partsCost,
        otherCost: input.otherCost ?? record.otherCost,
      };
      Object.assign(record, costFields(merged));

      return toServiceRecord(await repo.save(record));
    });
  }

  async removeRecord(
    userId: string,
    vehicleId: string,
    recordId: string,
  ): Promise<void> {
    await this.writeForUser(userId, async (manager) => {
      await requireVehicle(manager.getRepository(VehicleEntity), userId, vehicleId);
      const repo = manager.getRepository(ServiceRecordEntity);
      await repo.remove(await loadRecordIn(repo, userId, vehicleId, recordId));
    });
  }

  // -------------------------------------------------------------------------
  // Maintenance reminders
  // -------------------------------------------------------------------------

  async createReminder(
    userId: string,
    vehicleId: string,
    input: CreateMaintenanceReminderInput,
  ): Promise<MaintenanceReminder> {
    return this.writeForUser(userId, async (manager) => {
      const vehicle = await requireVehicle(
        manager.getRepository(VehicleEntity),
        userId,
        vehicleId,
      );
      const repo = manager.getRepository(MaintenanceReminderEntity);
      const saved = await repo.save(
        repo.create({
          id: crypto.randomUUID(),
          vehicleId: vehicle.id,
          userId,
          title: input.title,
          description: input.description ?? null,
          dueDate: input.dueDate ?? null,
          dueOdometerKm: input.dueOdometerKm ?? null,
          intervalMonths: input.intervalMonths ?? null,
          intervalKm: input.intervalKm ?? null,
          lastCompletedDate: input.lastCompletedDate ?? null,
          lastCompletedOdometerKm: input.lastCompletedOdometerKm ?? null,
          status: 'ACTIVE',
        }),
      );
      return this.withAlert(saved, vehicle.currentOdometer);
    });
  }

  /**
   * Reminder lists are paged in memory on purpose: urgency depends on today and
   * on the vehicle's odometer, and duplicating that rule in SQL would put two
   * implementations of "overdue" in the codebase. One vehicle carries a handful
   * of reminders, so the whole set is loaded, judged by `alertStatusFor`, then
   * sliced.
   */
  async listReminders(
    userId: string,
    vehicleId: string,
    query: MaintenanceReminderQuery,
  ): Promise<Page<MaintenanceReminder>> {
    const vehicle = await this.requireReadableVehicle(userId, vehicleId);
    const rows = await this.reminders.find({
      where: {
        vehicleId,
        userId,
        ...(query.status ? { status: query.status } : {}),
      },
      // Postgres sorts NULLs last on ASC, so undated reminders fall to the end.
      order: { dueDate: 'ASC', dueOdometerKm: 'ASC', createdAt: 'ASC' },
    });

    const today = isoDayFromInstant(new Date());
    const judged = rows
      .map((row) => ({
        row,
        alert: row.status === 'ACTIVE' ? alertStatusFor(row, vehicle.currentOdometer, today) : null,
      }))
      .filter(({ alert }) => !query.due || alert === query.due);

    const start = (query.page - 1) * query.pageSize;
    const items = judged
      .slice(start, start + query.pageSize)
      .map(({ row, alert }) => toMaintenanceReminder(row, alert));

    return page(items, query.page, query.pageSize, judged.length);
  }

  async findReminder(
    userId: string,
    vehicleId: string,
    reminderId: string,
  ): Promise<MaintenanceReminder> {
    const [vehicle, reminder] = await Promise.all([
      this.requireReadableVehicle(userId, vehicleId),
      this.loadReminder(userId, vehicleId, reminderId),
    ]);
    return this.withAlert(reminder, vehicle.currentOdometer);
  }

  async updateReminder(
    userId: string,
    vehicleId: string,
    reminderId: string,
    input: UpdateMaintenanceReminderInput,
  ): Promise<MaintenanceReminder> {
    return this.writeForUser(userId, async (manager) => {
      const vehicle = await requireVehicle(
        manager.getRepository(VehicleEntity),
        userId,
        vehicleId,
      );
      const repo = manager.getRepository(MaintenanceReminderEntity);
      const reminder = await loadReminderIn(repo, userId, vehicleId, reminderId);

      if (input.title !== undefined) reminder.title = input.title;
      if (input.description !== undefined) reminder.description = input.description;
      if (input.dueDate !== undefined) reminder.dueDate = input.dueDate;
      if (input.dueOdometerKm !== undefined) {
        reminder.dueOdometerKm = input.dueOdometerKm;
      }
      if (input.intervalMonths !== undefined) {
        reminder.intervalMonths = input.intervalMonths;
      }
      if (input.intervalKm !== undefined) reminder.intervalKm = input.intervalKm;
      if (input.lastCompletedDate !== undefined) {
        reminder.lastCompletedDate = input.lastCompletedDate;
      }
      if (input.lastCompletedOdometerKm !== undefined) {
        reminder.lastCompletedOdometerKm = input.lastCompletedOdometerKm;
      }

      // A PATCH only carries the changed keys, so the "needs a due condition"
      // rule is checked against the merged reminder, not against the body.
      if (!reminderHasDueCondition(reminder)) {
        throw new BadRequestException(REMINDER_DUE_CONDITION_MESSAGE);
      }

      return this.withAlert(await repo.save(reminder), vehicle.currentOdometer);
    });
  }

  /**
   * Completion is the only write that can roll a reminder forward, and it does
   * three things in one transaction: stamps when the work happened, moves the
   * due values on when the reminder is recurring, and leaves a non-recurring
   * reminder COMPLETED. No service record is created here — history is only
   * written when the user supplies the workshop and cost details explicitly.
   */
  async completeReminder(
    userId: string,
    vehicleId: string,
    reminderId: string,
    input: CompleteMaintenanceReminderInput,
  ): Promise<MaintenanceReminder> {
    return this.writeForUser(userId, async (manager) => {
      const vehicle = await requireVehicle(
        manager.getRepository(VehicleEntity),
        userId,
        vehicleId,
      );
      const reminderRepo = manager.getRepository(MaintenanceReminderEntity);
      const reminder = await loadReminderIn(
        reminderRepo,
        userId,
        vehicleId,
        reminderId,
      );
      if (reminder.status !== 'ACTIVE') {
        throw new ConflictException(alreadyClosedMessage(reminder.status));
      }

      const floor = await lowestAllowedOdometer(
        manager,
        vehicle,
        reminder.lastCompletedOdometerKm,
      );
      if (input.completionOdometerKm < floor) {
        throw new BadRequestException(
          `Odometer cannot be lower than the last recorded reading (${floor} km)`,
        );
      }

      const plan = planCompletion(
        reminder,
        input.completionDate,
        input.completionOdometerKm,
      );
      reminder.status = plan.status;
      reminder.dueDate = plan.dueDate;
      reminder.dueOdometerKm = plan.dueOdometerKm;
      reminder.lastCompletedDate = plan.lastCompletedDate;
      reminder.lastCompletedOdometerKm = plan.lastCompletedOdometerKm;

      return this.withAlert(
        await reminderRepo.save(reminder),
        vehicle.currentOdometer,
      );
    });
  }

  async dismissReminder(
    userId: string,
    vehicleId: string,
    reminderId: string,
  ): Promise<MaintenanceReminder> {
    return this.writeForUser(userId, async (manager) => {
      const vehicle = await requireVehicle(
        manager.getRepository(VehicleEntity),
        userId,
        vehicleId,
      );
      const repo = manager.getRepository(MaintenanceReminderEntity);
      const reminder = await loadReminderIn(repo, userId, vehicleId, reminderId);
      if (reminder.status !== 'ACTIVE') {
        throw new ConflictException(alreadyClosedMessage(reminder.status));
      }
      reminder.status = 'DISMISSED';
      // The due values are kept: dismissing a reminder must not rewrite history.
      return this.withAlert(await repo.save(reminder), vehicle.currentOdometer);
    });
  }

  async removeReminder(
    userId: string,
    vehicleId: string,
    reminderId: string,
  ): Promise<void> {
    await this.writeForUser(userId, async (manager) => {
      await requireVehicle(manager.getRepository(VehicleEntity), userId, vehicleId);
      const repo = manager.getRepository(MaintenanceReminderEntity);
      await repo.remove(await loadReminderIn(repo, userId, vehicleId, reminderId));
    });
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------

  /**
   * Every figure is derived from the rows on request — nothing is cached in a
   * totals column — so deleting or editing a record cannot leave a stale sum.
   */
  async summary(
    userId: string,
    vehicleId: string,
  ): Promise<MaintenanceSummary> {
    const vehicle = await this.requireReadableVehicle(userId, vehicleId);

    const totals = await this.records
      .createQueryBuilder('record')
      .select('COUNT(*)', 'recordCount')
      .addSelect('COALESCE(SUM(record.total_cost), 0)', 'expenditure')
      .where('record.vehicle_id = :vehicleId', { vehicleId })
      .andWhere('record.user_id = :userId', { userId })
      .getRawOne<{ recordCount: string; expenditure: string }>();

    const latest = await this.records.findOne({
      where: { vehicleId, userId },
      order: { serviceDate: 'DESC', createdAt: 'DESC' },
    });

    const active = await this.reminders.find({
      where: { vehicleId, userId, status: 'ACTIVE' },
    });
    const today = isoDayFromInstant(new Date());
    const alerts = active.map((reminder) =>
      alertStatusFor(reminder, vehicle.currentOdometer, today),
    );

    return {
      vehicleId,
      totalServiceRecords: Number(totals?.recordCount ?? 0),
      totalExpenditure: Number(totals?.expenditure ?? 0),
      lastServiceDate: latest?.serviceDate ?? null,
      lastServiceOdometer: latest?.odometerKm ?? null,
      activeReminders: active.length,
      overdueReminders: alerts.filter((alert) => alert === 'OVERDUE').length,
      upcomingReminders: alerts.filter((alert) => alert === 'UPCOMING').length,
    };
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private withAlert(
    reminder: MaintenanceReminderEntity,
    currentOdometerKm: number | null,
  ): MaintenanceReminder {
    return toMaintenanceReminder(
      reminder,
      reminder.status === 'ACTIVE'
        ? alertStatusFor(reminder, currentOdometerKm, isoDayFromInstant(new Date()))
        : null,
    );
  }

  private async requireReadableVehicle(
    userId: string,
    vehicleId: string,
  ): Promise<VehicleEntity> {
    return requireVehicle(this.vehicles, userId, vehicleId);
  }

  private async loadRecord(
    userId: string,
    vehicleId: string,
    recordId: string,
  ): Promise<ServiceRecordEntity> {
    await this.requireReadableVehicle(userId, vehicleId);
    const record = await this.records.findOne({
      where: { id: recordId, vehicleId, userId },
    });
    if (!record) {
      throw new NotFoundException('Service record not found');
    }
    return record;
  }

  private async loadReminder(
    userId: string,
    vehicleId: string,
    reminderId: string,
  ): Promise<MaintenanceReminderEntity> {
    await this.requireReadableVehicle(userId, vehicleId);
    const reminder = await this.reminders.findOne({
      where: { id: reminderId, vehicleId, userId },
    });
    if (!reminder) {
      throw new NotFoundException('Reminder not found');
    }
    return reminder;
  }

  /**
   * Writes take the same per-user row lock the vehicles module uses, so a
   * completion and a service record for the same vehicle cannot interleave.
   */
  private async writeForUser<T>(
    userId: string,
    work: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return this.dataSource.transaction(async (manager) => {
      await lockUserRow(manager, userId);
      return work(manager);
    });
  }
}

async function requireVehicle(
  vehicles: Repository<VehicleEntity>,
  userId: string,
  id: string,
): Promise<VehicleEntity> {
  const vehicle = await vehicles.findOne({ where: { id, userId } });
  if (!vehicle) {
    throw new NotFoundException('Vehicle not found');
  }
  return vehicle;
}

/**
 * A record id is only ever meaningful under its own vehicle: another user's
 * record, or the right record under the wrong vehicle, is a 404 rather than a
 * leak. `repo` is the transaction-bound repository, so the read is consistent
 * with the write that follows it.
 */
async function loadRecordIn(
  repo: Repository<ServiceRecordEntity>,
  userId: string,
  vehicleId: string,
  recordId: string,
): Promise<ServiceRecordEntity> {
  const record = await repo.findOne({ where: { id: recordId, vehicleId, userId } });
  if (!record) {
    throw new NotFoundException('Service record not found');
  }
  return record;
}

async function loadReminderIn(
  repo: Repository<MaintenanceReminderEntity>,
  userId: string,
  vehicleId: string,
  reminderId: string,
): Promise<MaintenanceReminderEntity> {
  const reminder = await repo.findOne({
    where: { id: reminderId, vehicleId, userId },
  });
  if (!reminder) {
    throw new NotFoundException('Reminder not found');
  }
  return reminder;
}

/**
 * Money is summed in whole cents so the `total_cost = labour + parts + other`
 * CHECK cannot be tripped by binary float rounding (0.1 + 0.2).
 */
function costFields(input: {
  labourCost?: number;
  partsCost?: number;
  otherCost?: number;
}): { labourCost: number; partsCost: number; otherCost: number; totalCost: number } {
  const labourCost = input.labourCost ?? DEFAULT_COST;
  const partsCost = input.partsCost ?? DEFAULT_COST;
  const otherCost = input.otherCost ?? DEFAULT_COST;
  const cents =
    Math.round(labourCost * 100) + Math.round(partsCost * 100) + Math.round(otherCost * 100);
  return { labourCost, partsCost, otherCost, totalCost: cents / 100 };
}

/** The Zod shape leaves blanks undefined; the column and the API use null. */
function normalizeParts(
  parts: CreateServiceRecordInput['partsReplaced'],
): ReplacedPart[] {
  return (parts ?? []).map((part) => ({
    name: part.name,
    quantity: part.quantity ?? null,
    cost: part.cost ?? null,
  }));
}

/**
 * The lowest reading a completion may carry: the vehicle's stored odometer, the
 * newest service record's reading, and the reminder's own last completion are all
 * readings the user already vouched for.
 */
async function lowestAllowedOdometer(
  manager: EntityManager,
  vehicle: VehicleEntity,
  lastCompletedOdometerKm: number | null,
): Promise<number> {
  const latest = await manager
    .getRepository(ServiceRecordEntity)
    .createQueryBuilder('record')
    .select('MAX(record.odometer_km)', 'reading')
    .where('record.vehicle_id = :vehicleId', { vehicleId: vehicle.id })
    .andWhere('record.user_id = :userId', { userId: vehicle.userId })
    .getRawOne<{ reading: string | null }>();

  return Math.max(
    vehicle.currentOdometer ?? 0,
    Number(latest?.reading ?? 0),
    lastCompletedOdometerKm ?? 0,
  );
}

function alreadyClosedMessage(status: string): string {
  return `Reminder is already ${status.toLowerCase()}. Reopen it by editing the reminder instead.`;
}

function page<T>(
  items: T[],
  pageNumber: number,
  pageSize: number,
  totalItems: number,
): Page<T> {
  return {
    items,
    page: pageNumber,
    pageSize,
    totalItems,
    totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
  };
}
