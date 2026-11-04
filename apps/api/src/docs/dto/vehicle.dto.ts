import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  FUEL_TYPES,
  MAX_ODOMETER_KM,
  MIN_MANUFACTURING_YEAR,
  TRANSMISSION_TYPES,
} from '@autogenius/validation';

export const createVehicleExample = {
  make: 'Maruti Suzuki',
  model: 'Baleno',
  variant: 'ZXi CVT',
  manufacturingYear: 2019,
  fuelType: 'PETROL',
  transmission: 'CVT',
  registrationNumber: 'MH 12 AB 1234',
  purchaseDate: '2019-06-15',
  currentOdometer: 42000,
} as const;

export const updateVehicleExample = {
  currentOdometer: 43500,
  variant: null,
} as const;

const PLATE_DESCRIPTION =
  'Number plate. Spaces, hyphens and letter case are normalised before the uniqueness check, so "MH 12 AB 1234" and "mh12ab1234" are the same plate for a user.';

export class CreateVehicleInputDto {
  @ApiProperty({ maxLength: 50, example: createVehicleExample.make })
  make!: string;

  @ApiProperty({ maxLength: 50, example: createVehicleExample.model })
  model!: string;

  @ApiPropertyOptional({
    description: 'Trim or grade. Send null to clear it.',
    maxLength: 50,
    example: createVehicleExample.variant,
    type: String,
    nullable: true,
  })
  variant?: string | null;

  @ApiProperty({
    description: 'Year the vehicle was built.',
    minimum: MIN_MANUFACTURING_YEAR,
    maximum: new Date().getFullYear() + 1,
    example: createVehicleExample.manufacturingYear,
  })
  manufacturingYear!: number;

  @ApiProperty({
    enum: FUEL_TYPES,
    enumName: 'FuelType',
    example: createVehicleExample.fuelType,
  })
  fuelType!: string;

  @ApiProperty({
    enum: TRANSMISSION_TYPES,
    enumName: 'TransmissionType',
    example: createVehicleExample.transmission,
  })
  transmission!: string;

  @ApiPropertyOptional({
    description: PLATE_DESCRIPTION,
    example: createVehicleExample.registrationNumber,
    type: String,
    nullable: true,
    maxLength: 20,
  })
  registrationNumber?: string | null;

  @ApiPropertyOptional({
    description: 'Acquisition date as YYYY-MM-DD. Cannot be in the future. Send null to clear.',
    format: 'date',
    example: createVehicleExample.purchaseDate,
    type: String,
    nullable: true,
  })
  purchaseDate?: string | null;

  @ApiPropertyOptional({
    description: 'Last known reading in whole kilometres. Send null to clear.',
    minimum: 0,
    maximum: MAX_ODOMETER_KM,
    example: createVehicleExample.currentOdometer,
    type: Number,
    nullable: true,
  })
  currentOdometer?: number | null;
}

/**
 * A PATCH body carries only the keys to change, so only the keys of
 * `updateVehicleExample` show an example: pre-filling every optional field
 * would make the sample body look like a full replacement.
 */
export class UpdateVehicleInputDto {
  @ApiPropertyOptional({ description: '1-50 characters.', maxLength: 50, type: String })
  make?: string;

  @ApiPropertyOptional({ description: '1-50 characters.', maxLength: 50, type: String })
  model?: string;

  @ApiPropertyOptional({
    description: '1-50 characters. Omit the key to leave it unchanged, send null to clear it.',
    maxLength: 50,
    example: updateVehicleExample.variant,
    type: String,
    nullable: true,
  })
  variant?: string | null;

  @ApiPropertyOptional({
    description: `Whole year, ${MIN_MANUFACTURING_YEAR} to one year ahead.`,
    minimum: MIN_MANUFACTURING_YEAR,
    maximum: new Date().getFullYear() + 1,
    type: Number,
  })
  manufacturingYear?: number;

  @ApiPropertyOptional({ enum: FUEL_TYPES, enumName: 'FuelType' })
  fuelType?: string;

  @ApiPropertyOptional({ enum: TRANSMISSION_TYPES, enumName: 'TransmissionType' })
  transmission?: string;

  @ApiPropertyOptional({
    description: PLATE_DESCRIPTION,
    type: String,
    nullable: true,
    maxLength: 20,
  })
  registrationNumber?: string | null;

  @ApiPropertyOptional({
    description: 'YYYY-MM-DD, not in the future. Send null to clear.',
    format: 'date',
    type: String,
    nullable: true,
  })
  purchaseDate?: string | null;

  @ApiPropertyOptional({
    description: 'Whole kilometres, or null to clear.',
    minimum: 0,
    maximum: MAX_ODOMETER_KM,
    example: updateVehicleExample.currentOdometer,
    type: Number,
    nullable: true,
  })
  currentOdometer?: number | null;
}

export class VehicleDto {
  @ApiProperty({ format: 'uuid', example: '9c1c9a1e-4e10-4b0e-9b6f-2c2b0a1d3e4f' })
  id!: string;

  @ApiProperty({ format: 'uuid', description: 'Owning user; never supplied by the client.' })
  userId!: string;

  @ApiProperty({ example: createVehicleExample.make })
  make!: string;

  @ApiProperty({ example: createVehicleExample.model })
  model!: string;

  @ApiProperty({ nullable: true, type: String, example: createVehicleExample.variant })
  variant!: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Stored in normalised form.',
    example: 'MH12AB1234',
  })
  registrationNumber!: string | null;

  @ApiProperty({ example: createVehicleExample.manufacturingYear })
  manufacturingYear!: number;

  @ApiProperty({ enum: FUEL_TYPES, enumName: 'FuelType', example: createVehicleExample.fuelType })
  fuelType!: string;

  @ApiProperty({
    enum: TRANSMISSION_TYPES,
    enumName: 'TransmissionType',
    example: createVehicleExample.transmission,
  })
  transmission!: string;

  @ApiProperty({
    nullable: true,
    format: 'date',
    type: String,
    description: 'Kept as a date string so the value never shifts with time zones.',
    example: createVehicleExample.purchaseDate,
  })
  purchaseDate!: string | null;

  @ApiProperty({ nullable: true, type: Number, example: createVehicleExample.currentOdometer })
  currentOdometer!: number | null;

  @ApiProperty({
    description: 'At most one vehicle per user is default. The first vehicle added becomes it.',
    example: true,
  })
  isDefault!: boolean;

  @ApiProperty({ format: 'date-time', example: '2026-11-04T05:30:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time', example: '2026-11-04T05:31:00.000Z' })
  updatedAt!: Date;
}
