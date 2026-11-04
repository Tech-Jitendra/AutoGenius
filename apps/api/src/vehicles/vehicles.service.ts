import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import type { EntityManager, Repository } from 'typeorm';
import { DataSource } from 'typeorm';
import type { Vehicle } from '@autogenius/types';
import type { CreateVehicleInput, UpdateVehicleInput } from '@autogenius/validation';
import { isUniqueViolationOf } from '../common/utils/postgres-errors';
import { lockUserRow } from '../common/utils/user-transaction';
import { VehicleEntity } from './vehicle.entity';

/** Created by the migration; a violation of it means a duplicate plate for this user. */
const REGISTRATION_INDEX = 'vehicles_user_registration_unique';

@Injectable()
export class VehiclesService {
  constructor(
    @InjectRepository(VehicleEntity)
    private readonly vehicles: Repository<VehicleEntity>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async list(userId: string): Promise<Vehicle[]> {
    const rows = await this.vehicles.find({
      where: { userId },
      order: { isDefault: 'DESC', createdAt: 'DESC' },
    });
    return rows.map(toVehicle);
  }

  async findOwned(userId: string, id: string): Promise<Vehicle> {
    return toVehicle(await this.requireOwned(this.vehicles, userId, id));
  }

  async create(userId: string, input: CreateVehicleInput): Promise<Vehicle> {
    const saved = await this.transactionForUser(userId, async (vehicles) => {
      // Inside the user lock this read is stable, so the first vehicle a user
      // adds is the one that becomes the default.
      const ownedCount = await vehicles.count({ where: { userId } });
      return vehicles.save(
        vehicles.create({
          id: crypto.randomUUID(),
          userId,
          make: input.make,
          model: input.model,
          variant: input.variant ?? null,
          registrationNumber: input.registrationNumber ?? null,
          manufacturingYear: input.manufacturingYear,
          fuelType: input.fuelType,
          transmission: input.transmission,
          purchaseDate: input.purchaseDate ?? null,
          currentOdometer: input.currentOdometer ?? null,
          isDefault: ownedCount === 0,
        }),
      );
    });
    return toVehicle(saved);
  }

  async update(
    userId: string,
    id: string,
    input: UpdateVehicleInput,
  ): Promise<Vehicle> {
    const saved = await this.transactionForUser(userId, async (vehicles) => {
      const vehicle = await this.requireOwned(vehicles, userId, id);
      if (input.make !== undefined) vehicle.make = input.make;
      if (input.model !== undefined) vehicle.model = input.model;
      if (input.variant !== undefined) vehicle.variant = input.variant;
      if (input.manufacturingYear !== undefined) {
        vehicle.manufacturingYear = input.manufacturingYear;
      }
      if (input.fuelType !== undefined) vehicle.fuelType = input.fuelType;
      if (input.transmission !== undefined) {
        vehicle.transmission = input.transmission;
      }
      if (input.registrationNumber !== undefined) {
        vehicle.registrationNumber = input.registrationNumber;
      }
      if (input.purchaseDate !== undefined) {
        vehicle.purchaseDate = input.purchaseDate;
      }
      if (input.currentOdometer !== undefined) {
        vehicle.currentOdometer = input.currentOdometer;
      }
      return vehicles.save(vehicle);
    });
    return toVehicle(saved);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.transactionForUser(userId, async (vehicles, manager) => {
      const vehicle = await this.requireOwned(vehicles, userId, id);
      // Service history is worth more than the row that points at it, so a
      // vehicle with a past is never deleted as a side effect. The database
      // refuses with ON DELETE RESTRICT as well; checking first turns that into
      // a message the user can act on.
      const history = await countHistory(manager, id);
      if (history.serviceRecords > 0 || history.reminders > 0) {
        throw new ConflictException(historyBlockMessage(history));
      }
      await vehicles.remove(vehicle);
      if (vehicle.isDefault) await this.promoteDefault(vehicles, userId);
    });
  }

  async setDefault(userId: string, id: string): Promise<Vehicle> {
    const saved = await this.transactionForUser(userId, async (vehicles) => {
      const vehicle = await this.requireOwned(vehicles, userId, id);
      if (vehicle.isDefault) return vehicle;
      // Clear before set: the partial unique index on (user_id) WHERE is_default
      // would reject the inverse order.
      await vehicles.update({ userId, isDefault: true }, { isDefault: false });
      vehicle.isDefault = true;
      return vehicles.save(vehicle);
    });
    return toVehicle(saved);
  }

  /**
   * Every write runs inside a transaction that first locks the owning user row.
   * That serializes a single user's vehicle writes — default selection included
   * — without ever holding two row locks at once, so it cannot deadlock itself.
   */
  private async transactionForUser<T>(
    userId: string,
    work: (
      vehicles: Repository<VehicleEntity>,
      manager: EntityManager,
    ) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        await lockUserRow(manager, userId);
        return work(manager.getRepository(VehicleEntity), manager);
      });
    } catch (error) {
      if (isUniqueViolationOf(error, REGISTRATION_INDEX)) {
        throw new ConflictException(
          'A vehicle with this registration number already exists',
        );
      }
      throw error;
    }
  }

  private async requireOwned(
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

  private async promoteDefault(
    vehicles: Repository<VehicleEntity>,
    userId: string,
  ): Promise<void> {
    const successor = await vehicles.findOne({
      where: { userId },
      order: { createdAt: 'DESC', id: 'DESC' },
    });
    if (!successor) {
      return;
    }
    successor.isDefault = true;
    await vehicles.save(successor);
  }
}

interface HistoryCounts {
  serviceRecords: number;
  reminders: number;
}

/**
 * Counted with raw SQL rather than by importing the service-history
 * repositories: the vehicles module must not depend on that module, and this is
 * the only thing it needs to know about a vehicle's past.
 */
async function countHistory(manager: EntityManager, vehicleId: string): Promise<HistoryCounts> {
  const rows = await manager.query(
    `SELECT
       (SELECT count(*) FROM service_records WHERE vehicle_id = $1) AS "serviceRecords",
       (SELECT count(*) FROM maintenance_reminders WHERE vehicle_id = $1) AS "reminders"`,
    [vehicleId],
  );
  return {
    serviceRecords: Number(rows?.[0]?.serviceRecords ?? 0),
    reminders: Number(rows?.[0]?.reminders ?? 0),
  };
}

function historyBlockMessage(counts: HistoryCounts): string {
  const listed = [
    counts.serviceRecords > 0
      ? `${counts.serviceRecords} service record${counts.serviceRecords === 1 ? '' : 's'}`
      : null,
    counts.reminders > 0
      ? `${counts.reminders} maintenance reminder${counts.reminders === 1 ? '' : 's'}`
      : null,
  ].filter((entry): entry is string => entry !== null);

  return `This vehicle still has ${listed.join(' and ')}. Delete those first if you really want the vehicle gone — service history is never removed as a side effect of deleting a vehicle.`;
}

export function toVehicle(vehicle: VehicleEntity): Vehicle {
  return {
    id: vehicle.id,
    userId: vehicle.userId,
    make: vehicle.make,
    model: vehicle.model,
    variant: vehicle.variant,
    registrationNumber: vehicle.registrationNumber,
    manufacturingYear: vehicle.manufacturingYear,
    fuelType: vehicle.fuelType,
    transmission: vehicle.transmission,
    purchaseDate: vehicle.purchaseDate,
    currentOdometer: vehicle.currentOdometer,
    isDefault: vehicle.isDefault,
    createdAt: vehicle.createdAt,
    updatedAt: vehicle.updatedAt,
  };
}
