import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { FuelType, TransmissionType } from '@autogenius/types';

@Entity({ name: 'vehicles' })
export class VehicleEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 50 })
  make!: string;

  @Column({ type: 'varchar', length: 50 })
  model!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  variant!: string | null;

  @Column({ name: 'registration_number', type: 'varchar', length: 20, nullable: true })
  registrationNumber!: string | null;

  @Column({ name: 'manufacturing_year', type: 'int' })
  manufacturingYear!: number;

  @Column({ name: 'fuel_type', type: 'varchar', length: 20 })
  fuelType!: FuelType;

  @Column({ type: 'varchar', length: 20 })
  transmission!: TransmissionType;

  /**
   * A calendar day, not an instant: TypeORM hydrates a `date` column as the
   * `YYYY-MM-DD` string, so the value cannot shift with the server's timezone.
   */
  @Column({
    name: 'purchase_date',
    type: 'date',
    nullable: true,
  })
  purchaseDate!: string | null;

  @Column({ name: 'current_odometer', type: 'int', nullable: true })
  currentOdometer!: number | null;

  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
