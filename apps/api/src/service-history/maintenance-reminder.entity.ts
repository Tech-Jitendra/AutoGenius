import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { MaintenanceReminder, ReminderStatus } from '@autogenius/types';

@Entity({ name: 'maintenance_reminders' })
export class MaintenanceReminderEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'vehicle_id', type: 'uuid' })
  vehicleId!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 120 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate!: string | null;

  @Column({ name: 'due_odometer_km', type: 'int', nullable: true })
  dueOdometerKm!: number | null;

  @Column({ name: 'interval_months', type: 'int', nullable: true })
  intervalMonths!: number | null;

  @Column({ name: 'interval_km', type: 'int', nullable: true })
  intervalKm!: number | null;

  @Column({ name: 'last_completed_date', type: 'date', nullable: true })
  lastCompletedDate!: string | null;

  @Column({ name: 'last_completed_odometer_km', type: 'int', nullable: true })
  lastCompletedOdometerKm!: number | null;

  /** Where the reminder is in its own life cycle; urgency is computed, never stored. */
  @Column({ type: 'varchar', length: 20, default: "'ACTIVE'" })
  status!: ReminderStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

export function toMaintenanceReminder(
  reminder: MaintenanceReminderEntity,
  alertStatus: MaintenanceReminder['alertStatus'],
): MaintenanceReminder {
  return {
    id: reminder.id,
    vehicleId: reminder.vehicleId,
    title: reminder.title,
    description: reminder.description,
    dueDate: reminder.dueDate,
    dueOdometerKm: reminder.dueOdometerKm,
    intervalMonths: reminder.intervalMonths,
    intervalKm: reminder.intervalKm,
    lastCompletedDate: reminder.lastCompletedDate,
    lastCompletedOdometerKm: reminder.lastCompletedOdometerKm,
    status: reminder.status,
    alertStatus,
    createdAt: reminder.createdAt,
    updatedAt: reminder.updatedAt,
  };
}
