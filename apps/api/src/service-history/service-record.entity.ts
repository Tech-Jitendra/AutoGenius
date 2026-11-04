import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { ReplacedPart, ServiceRecord, ServiceType } from '@autogenius/types';
import { numericTransformer } from './numeric-transformer';

/**
 * `user_id` is stored alongside `vehicle_id` and both are checked by the
 * composite foreign key `service_records_vehicle_owner_fkey`, so a row can never
 * claim a different owner than its vehicle.
 */
@Entity({ name: 'service_records' })
export class ServiceRecordEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'vehicle_id', type: 'uuid' })
  vehicleId!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  /** Date-only column: TypeORM hydrates it as `YYYY-MM-DD`, so no timezone shift. */
  @Column({ name: 'service_date', type: 'date' })
  serviceDate!: string;

  @Column({ name: 'odometer_km', type: 'int', nullable: true })
  odometerKm!: number | null;

  @Column({ name: 'workshop_name', type: 'varchar', length: 120, nullable: true })
  workshopName!: string | null;

  @Column({ name: 'service_type', type: 'varchar', length: 30 })
  serviceType!: ServiceType;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({
    name: 'parts_replaced',
    type: 'jsonb',
    default: () => `'[]'::jsonb`,
  })
  partsReplaced!: ReplacedPart[];

  @Column({
    name: 'labour_cost',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: numericTransformer,
  })
  labourCost!: number;

  @Column({
    name: 'parts_cost',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: numericTransformer,
  })
  partsCost!: number;

  @Column({
    name: 'other_cost',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: numericTransformer,
  })
  otherCost!: number;

  @Column({
    name: 'total_cost',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: numericTransformer,
  })
  totalCost!: number;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

export function toServiceRecord(record: ServiceRecordEntity): ServiceRecord {
  return {
    id: record.id,
    vehicleId: record.vehicleId,
    serviceDate: record.serviceDate,
    odometerKm: record.odometerKm,
    workshopName: record.workshopName,
    serviceType: record.serviceType,
    description: record.description,
    partsReplaced: record.partsReplaced,
    labourCost: record.labourCost,
    partsCost: record.partsCost,
    otherCost: record.otherCost,
    totalCost: record.totalCost,
    notes: record.notes,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
