import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  MAX_COST,
  MAX_INTERVAL_MONTHS,
  MAX_ODOMETER_KM,
  MAX_PARTS_PER_RECORD,
  REMINDER_STATUSES,
  SERVICE_TYPES,
  MAINTENANCE_ALERT_STATUSES,
} from '@autogenius/validation';

export const createServiceRecordExample = {
  serviceDate: '2026-10-21',
  odometerKm: 43210,
  workshopName: 'City Auto Service',
  serviceType: 'GENERAL_SERVICE',
  description: 'Regular periodic service',
  partsReplaced: [
    { name: 'Engine oil 5W-30', quantity: 1, cost: 3200 },
    { name: 'Oil filter', quantity: 1, cost: 450 },
  ],
  labourCost: 900,
  partsCost: 3650,
  otherCost: 0,
  notes: 'Recommended the front brake pads next visit.',
} as const;

export const updateServiceRecordExample = {
  odometerKm: 43215,
  otherCost: 250.5,
  notes: null,
} as const;

export const createMaintenanceReminderExample = {
  title: 'Oil change',
  description: 'Every 10,000 km or 12 months, whichever comes first',
  dueDate: '2027-04-21',
  dueOdometerKm: 53210,
  intervalMonths: 12,
  intervalKm: 10000,
} as const;

export const updateMaintenanceReminderExample = {
  dueDate: '2027-06-30',
  intervalKm: null,
} as const;

export const completeMaintenanceReminderExample = {
  completionDate: '2026-10-21',
  completionOdometerKm: 44210,
} as const;

const ODOMETER_DESCRIPTION =
  'Whole kilometres, 0 to ' + MAX_ODOMETER_KM + '. The app stores the vehicle’s latest reading and never lets a completion move it backwards.';

/** Response shape: every key is always present, unset ones are null. */
export class ReplacedPartDto {
  @ApiProperty({ maxLength: 120, example: createServiceRecordExample.partsReplaced[0].name })
  name!: string;

  @ApiProperty({
    nullable: true,
    type: Number,
    minimum: 1,
    maximum: 9999,
    description: 'Units fitted, when the invoice states them.',
    example: 1,
  })
  quantity!: number | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    minimum: 0,
    description: 'Price charged for this part.',
    example: 3200,
  })
  cost!: number | null;
}

/** Request shape: only the name is mandatory, so a part can be listed alone. */
export class ReplacedPartInputDto {
  @ApiProperty({ maxLength: 120, example: createServiceRecordExample.partsReplaced[1].name })
  name!: string;

  @ApiPropertyOptional({
    nullable: true,
    type: Number,
    minimum: 1,
    maximum: 9999,
    description: 'Units fitted.',
  })
  quantity?: number | null;

  @ApiPropertyOptional({
    nullable: true,
    type: Number,
    minimum: 0,
    description: 'Price charged for this part.',
  })
  cost?: number | null;
}

export class ServiceRecordDto {
  @ApiProperty({ format: 'uuid', example: '4b7f0d3a-8f4e-4c1a-9d2b-6f0a1c3e5b7d' })
  id!: string;

  @ApiProperty({ format: 'uuid', example: '9c1c9a1e-4e10-4b0e-9b6f-2c2b0a1d3e4f' })
  vehicleId!: string;

  @ApiProperty({
    format: 'date',
    description: 'Kept as a date string so the day never shifts with time zones.',
    example: createServiceRecordExample.serviceDate,
  })
  serviceDate!: string;

  @ApiProperty({
    nullable: true,
    type: Number,
    description: ODOMETER_DESCRIPTION,
    example: createServiceRecordExample.odometerKm,
  })
  odometerKm!: number | null;

  @ApiProperty({
    nullable: true,
    type: String,
    maxLength: 120,
    example: createServiceRecordExample.workshopName,
  })
  workshopName!: string | null;

  @ApiProperty({
    enum: SERVICE_TYPES,
    enumName: 'ServiceType',
    example: createServiceRecordExample.serviceType,
  })
  serviceType!: string;

  @ApiProperty({ nullable: true, type: String, maxLength: 2000 })
  description!: string | null;

  @ApiProperty({ type: [ReplacedPartDto] })
  partsReplaced!: ReplacedPartDto[];

  @ApiProperty({ minimum: 0, example: createServiceRecordExample.labourCost })
  labourCost!: number;

  @ApiProperty({ minimum: 0, example: createServiceRecordExample.partsCost })
  partsCost!: number;

  @ApiProperty({ minimum: 0, example: createServiceRecordExample.otherCost })
  otherCost!: number;

  @ApiProperty({
    description: 'Always labour + parts + other; the client never sends it.',
    minimum: 0,
    example: 4550,
  })
  totalCost!: number;

  @ApiProperty({ nullable: true, type: String, maxLength: 2000 })
  notes!: string | null;

  @ApiProperty({ format: 'date-time', example: '2026-10-21T10:05:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time', example: '2026-10-21T10:05:00.000Z' })
  updatedAt!: Date;
}

export class PageMetaDto {
  @ApiProperty({ minimum: 1, example: 1 })
  page!: number;

  @ApiProperty({ minimum: 1, maximum: 100, example: 20 })
  pageSize!: number;

  @ApiProperty({ example: 3 })
  totalItems!: number;

  @ApiProperty({ example: 1 })
  totalPages!: number;
}

export class ServiceRecordPageDto extends PageMetaDto {
  @ApiProperty({ type: [ServiceRecordDto] })
  items!: ServiceRecordDto[];
}

export class MaintenanceReminderDto {
  @ApiProperty({ format: 'uuid', example: '7a2d5fd1-3c4b-4f57-9a1e-5d8b0c2f6a93' })
  id!: string;

  @ApiProperty({ format: 'uuid', example: '9c1c9a1e-4e10-4b0e-9b6f-2c2b0a1d3e4f' })
  vehicleId!: string;

  @ApiProperty({ maxLength: 120, example: createMaintenanceReminderExample.title })
  title!: string;

  @ApiProperty({ nullable: true, type: String, maxLength: 2000 })
  description!: string | null;

  @ApiProperty({
    nullable: true,
    format: 'date',
    example: createMaintenanceReminderExample.dueDate,
  })
  dueDate!: string | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    description: ODOMETER_DESCRIPTION,
    example: createMaintenanceReminderExample.dueOdometerKm,
  })
  dueOdometerKm!: number | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    minimum: 1,
    maximum: MAX_INTERVAL_MONTHS,
    example: createMaintenanceReminderExample.intervalMonths,
  })
  intervalMonths!: number | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    minimum: 1,
    maximum: MAX_ODOMETER_KM,
    example: createMaintenanceReminderExample.intervalKm,
  })
  intervalKm!: number | null;

  @ApiProperty({ nullable: true, format: 'date', type: String })
  lastCompletedDate!: string | null;

  @ApiProperty({ nullable: true, type: Number })
  lastCompletedOdometerKm!: number | null;

  @ApiProperty({
    enum: REMINDER_STATUSES,
    enumName: 'ReminderStatus',
    description: 'Stored life cycle. Changes only through /complete, /dismiss or a new reminder.',
    example: 'ACTIVE',
  })
  status!: string;

  @ApiProperty({
    enum: MAINTENANCE_ALERT_STATUSES,
    enumName: 'MaintenanceAlertStatus',
    nullable: true,
    type: String,
    description:
      'Computed on read from today and the vehicle’s stored odometer: OVERDUE when the date has passed or the reading is reached, UPCOMING within 30 days or 1,000 km, otherwise SCHEDULED. Null once the reminder is COMPLETED or DISMISSED, so closed history never shows as overdue.',
    example: 'SCHEDULED',
  })
  alertStatus!: string | null;

  @ApiProperty({ format: 'date-time', example: '2026-10-21T10:06:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time', example: '2026-10-21T10:06:00.000Z' })
  updatedAt!: Date;
}

export class MaintenanceReminderPageDto extends PageMetaDto {
  @ApiProperty({ type: [MaintenanceReminderDto] })
  items!: MaintenanceReminderDto[];
}

export class MaintenanceSummaryDto {
  @ApiProperty({ format: 'uuid', example: '9c1c9a1e-4e10-4b0e-9b6f-2c2b0a1d3e4f' })
  vehicleId!: string;

  @ApiProperty({ example: 3 })
  totalServiceRecords!: number;

  @ApiProperty({ description: 'Sum of total_cost across every record.', example: 18750.5 })
  totalExpenditure!: number;

  @ApiProperty({ nullable: true, format: 'date', type: String, example: '2026-10-21' })
  lastServiceDate!: string | null;

  @ApiProperty({ nullable: true, type: Number, example: 43210 })
  lastServiceOdometer!: number | null;

  @ApiProperty({ example: 2 })
  activeReminders!: number;

  @ApiProperty({ example: 1 })
  overdueReminders!: number;

  @ApiProperty({ example: 1 })
  upcomingReminders!: number;
}

export class CreateServiceRecordInputDto {
  @ApiProperty({
    format: 'date',
    description: 'YYYY-MM-DD, today or earlier.',
    example: createServiceRecordExample.serviceDate,
  })
  serviceDate!: string;

  @ApiPropertyOptional({
    description: ODOMETER_DESCRIPTION,
    minimum: 0,
    maximum: MAX_ODOMETER_KM,
    example: createServiceRecordExample.odometerKm,
    type: Number,
    nullable: true,
  })
  odometerKm?: number | null;

  @ApiPropertyOptional({ maxLength: 120, example: createServiceRecordExample.workshopName })
  workshopName?: string | null;

  @ApiProperty({
    enum: SERVICE_TYPES,
    enumName: 'ServiceType',
    example: createServiceRecordExample.serviceType,
  })
  serviceType!: string;

  @ApiPropertyOptional({ maxLength: 2000, example: createServiceRecordExample.description })
  description?: string | null;

  @ApiPropertyOptional({
    type: [ReplacedPartInputDto],
    maxItems: MAX_PARTS_PER_RECORD,
    example: createServiceRecordExample.partsReplaced,
    description: `Structured part lines, at most ${MAX_PARTS_PER_RECORD}. Stored as JSONB so a part never becomes a row the user has to manage separately.`,
  })
  partsReplaced?: ReplacedPartInputDto[];

  @ApiPropertyOptional({
    minimum: 0,
    maximum: MAX_COST,
    example: createServiceRecordExample.labourCost,
    description: 'Rounded to two decimals. Defaults to 0.',
  })
  labourCost?: number;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: MAX_COST,
    example: createServiceRecordExample.partsCost,
    description: 'Rounded to two decimals. Defaults to 0.',
  })
  partsCost?: number;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: MAX_COST,
    example: createServiceRecordExample.otherCost,
    description: 'Rounded to two decimals. Defaults to 0. `total_cost` is derived, never sent.',
  })
  otherCost?: number;

  @ApiPropertyOptional({ maxLength: 2000, example: createServiceRecordExample.notes })
  notes?: string | null;
}

/** A PATCH carries only the keys to change, so only those carry examples. */
export class UpdateServiceRecordInputDto {
  @ApiPropertyOptional({ format: 'date', description: 'YYYY-MM-DD, today or earlier.' })
  serviceDate?: string;

  @ApiPropertyOptional({
    description: ODOMETER_DESCRIPTION,
    minimum: 0,
    maximum: MAX_ODOMETER_KM,
    example: updateServiceRecordExample.odometerKm,
    type: Number,
    nullable: true,
  })
  odometerKm?: number | null;

  @ApiPropertyOptional({ maxLength: 120, type: String, nullable: true })
  workshopName?: string | null;

  @ApiPropertyOptional({ enum: SERVICE_TYPES, enumName: 'ServiceType' })
  serviceType?: string;

  @ApiPropertyOptional({ maxLength: 2000, type: String, nullable: true })
  description?: string | null;

  @ApiPropertyOptional({
    type: [ReplacedPartInputDto],
    maxItems: MAX_PARTS_PER_RECORD,
    description: 'Replaces the whole list. An empty array clears it.',
  })
  partsReplaced?: ReplacedPartInputDto[];

  @ApiPropertyOptional({ minimum: 0, maximum: MAX_COST })
  labourCost?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: MAX_COST })
  partsCost?: number;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: MAX_COST,
    example: updateServiceRecordExample.otherCost,
    description: 'Any supplied component re-derives total_cost together with the stored ones.',
  })
  otherCost?: number;

  @ApiPropertyOptional({
    maxLength: 2000,
    type: String,
    nullable: true,
    example: updateServiceRecordExample.notes,
  })
  notes?: string | null;
}

export class CreateMaintenanceReminderInputDto {
  @ApiProperty({ maxLength: 120, example: createMaintenanceReminderExample.title })
  title!: string;

  @ApiPropertyOptional({ maxLength: 2000, example: createMaintenanceReminderExample.description })
  description?: string | null;

  @ApiPropertyOptional({
    format: 'date',
    description:
      'YYYY-MM-DD. May be in the past — a reminder created late is legitimately overdue. Needs either this or dueOdometerKm.',
    example: createMaintenanceReminderExample.dueDate,
    type: String,
    nullable: true,
  })
  dueDate?: string | null;

  @ApiPropertyOptional({
    description: ODOMETER_DESCRIPTION + ' Needs either this or dueDate.',
    minimum: 0,
    maximum: MAX_ODOMETER_KM,
    example: createMaintenanceReminderExample.dueOdometerKm,
    type: Number,
    nullable: true,
  })
  dueOdometerKm?: number | null;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: MAX_INTERVAL_MONTHS,
    example: createMaintenanceReminderExample.intervalMonths,
    description:
      'Makes the reminder recurring. Completing it moves the due date to the last completion (or the due date it just met) plus this many months.',
  })
  intervalMonths?: number | null;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: MAX_ODOMETER_KM,
    example: createMaintenanceReminderExample.intervalKm,
    description: 'Same rule as intervalMonths, measured in kilometres.',
    type: Number,
  })
  intervalKm?: number | null;

  @ApiPropertyOptional({
    format: 'date',
    description: 'Seed the bookkeeping for work already done before the reminder existed.',
    type: String,
    nullable: true,
  })
  lastCompletedDate?: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true, minimum: 0, maximum: MAX_ODOMETER_KM })
  lastCompletedOdometerKm?: number | null;
}

/** PATCH body: only the keys to change; `status` is not editable here. */
export class UpdateMaintenanceReminderInputDto {
  @ApiPropertyOptional({ maxLength: 120 })
  title?: string;

  @ApiPropertyOptional({ maxLength: 2000, type: String, nullable: true })
  description?: string | null;

  @ApiPropertyOptional({
    format: 'date',
    type: String,
    nullable: true,
    example: updateMaintenanceReminderExample.dueDate,
  })
  dueDate?: string | null;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    minimum: 0,
    maximum: MAX_ODOMETER_KM,
  })
  dueOdometerKm?: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, minimum: 1, maximum: MAX_INTERVAL_MONTHS })
  intervalMonths?: number | null;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    minimum: 1,
    maximum: MAX_ODOMETER_KM,
    example: updateMaintenanceReminderExample.intervalKm,
  })
  intervalKm?: number | null;

  @ApiPropertyOptional({ format: 'date', type: String, nullable: true })
  lastCompletedDate?: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true, minimum: 0, maximum: MAX_ODOMETER_KM })
  lastCompletedOdometerKm?: number | null;
}

export class CompleteMaintenanceReminderInputDto {
  @ApiProperty({
    format: 'date',
    description: 'YYYY-MM-DD, today or earlier.',
    example: completeMaintenanceReminderExample.completionDate,
  })
  completionDate!: string;

  @ApiProperty({
    description:
      ODOMETER_DESCRIPTION +
      ' Must be at least the highest reading already on file for this vehicle.',
    minimum: 0,
    maximum: MAX_ODOMETER_KM,
    example: completeMaintenanceReminderExample.completionOdometerKm,
  })
  completionOdometerKm!: number;
}
