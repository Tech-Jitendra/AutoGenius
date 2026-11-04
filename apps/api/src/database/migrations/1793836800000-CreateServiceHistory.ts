import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Task 04 — service history and maintenance reminders.
 *
 * Money is stored in NUMERIC(12,2), never float: a float cannot represent
 * rupees-and-paise exactly, and totals here feed both a CHECK constraint and
 * expenditure reports.
 *
 * Two rules live in the shared Zod schemas instead of CHECK constraints because
 * PostgreSQL only allows IMMUTABLE expressions in a CHECK, and "today" is not
 * immutable: no future service date, and no completion date in the future.
 */
export class CreateServiceHistory1793836800000 implements MigrationInterface {
  name = 'CreateServiceHistory1793836800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Lets a history row reference (vehicle id, owner id) as one unit, so the
    // database itself rejects a record whose user_id disagrees with the vehicle.
    await queryRunner.query(
      `ALTER TABLE vehicles
         ADD CONSTRAINT vehicles_id_user_id_unique UNIQUE (id, user_id)`,
    );

    await queryRunner.query(`
      CREATE TABLE service_records (
        id uuid PRIMARY KEY,
        vehicle_id uuid NOT NULL,
        user_id uuid NOT NULL,
        service_date date NOT NULL,
        odometer_km int,
        workshop_name varchar(120),
        service_type varchar(30) NOT NULL,
        description text,
        parts_replaced jsonb NOT NULL DEFAULT '[]'::jsonb,
        labour_cost numeric(12,2) NOT NULL DEFAULT 0,
        parts_cost numeric(12,2) NOT NULL DEFAULT 0,
        other_cost numeric(12,2) NOT NULL DEFAULT 0,
        total_cost numeric(12,2) NOT NULL DEFAULT 0,
        notes text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT service_records_vehicle_owner_fkey
          FOREIGN KEY (vehicle_id, user_id)
          REFERENCES vehicles (id, user_id)
          ON DELETE RESTRICT,
        CONSTRAINT service_records_user_fkey
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        CONSTRAINT service_records_type_check
          CHECK (service_type IN (
            'OIL_CHANGE', 'BRAKE_INSPECTION', 'TYRE_REPLACEMENT', 'BATTERY',
            'AIR_FILTER', 'COOLANT', 'GENERAL_SERVICE', 'OTHER'
          )),
        CONSTRAINT service_records_odometer_range
          CHECK (odometer_km IS NULL OR (odometer_km >= 0 AND odometer_km <= 2000000)),
        CONSTRAINT service_records_costs_non_negative
          CHECK (labour_cost >= 0 AND parts_cost >= 0 AND other_cost >= 0 AND total_cost >= 0),
        CONSTRAINT service_records_costs_within_precision
          CHECK (
            labour_cost <= 10000000 AND parts_cost <= 10000000 AND
            other_cost <= 10000000 AND total_cost <= 30000000
          ),
        CONSTRAINT service_records_total_is_components
          CHECK (total_cost = labour_cost + parts_cost + other_cost),
        CONSTRAINT service_records_parts_is_array
          CHECK (jsonb_typeof(parts_replaced) = 'array')
      )
    `);

    await queryRunner.query(
      `CREATE INDEX service_records_vehicle_date_idx
         ON service_records (vehicle_id, service_date DESC, created_at DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX service_records_user_id_idx ON service_records (user_id)`,
    );
    // The list endpoint filters by type while keeping newest-first order.
    await queryRunner.query(
      `CREATE INDEX service_records_vehicle_type_idx
         ON service_records (vehicle_id, service_type, service_date DESC)`,
    );

    await queryRunner.query(`
      CREATE TABLE maintenance_reminders (
        id uuid PRIMARY KEY,
        vehicle_id uuid NOT NULL,
        user_id uuid NOT NULL,
        title varchar(120) NOT NULL,
        description text,
        due_date date,
        due_odometer_km int,
        interval_months int,
        interval_km int,
        last_completed_date date,
        last_completed_odometer_km int,
        status varchar(20) NOT NULL DEFAULT 'ACTIVE',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT maintenance_reminders_vehicle_owner_fkey
          FOREIGN KEY (vehicle_id, user_id)
          REFERENCES vehicles (id, user_id)
          ON DELETE RESTRICT,
        CONSTRAINT maintenance_reminders_user_fkey
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        CONSTRAINT maintenance_reminders_status_check
          CHECK (status IN ('ACTIVE', 'COMPLETED', 'DISMISSED')),
        -- Without either value a reminder could never become due.
        CONSTRAINT maintenance_reminders_has_due_condition
          CHECK (due_date IS NOT NULL OR due_odometer_km IS NOT NULL),
        CONSTRAINT maintenance_reminders_due_odometer_range
          CHECK (due_odometer_km IS NULL OR (due_odometer_km >= 0 AND due_odometer_km <= 2000000)),
        CONSTRAINT maintenance_reminders_last_odometer_range
          CHECK (
            last_completed_odometer_km IS NULL OR
            (last_completed_odometer_km >= 0 AND last_completed_odometer_km <= 2000000)
          ),
        -- Intervals are never zero: a zero interval would complete and instantly
        -- come due again at the same reading.
        CONSTRAINT maintenance_reminders_interval_months_positive
          CHECK (interval_months IS NULL OR (interval_months >= 1 AND interval_months <= 120)),
        CONSTRAINT maintenance_reminders_interval_km_positive
          CHECK (interval_km IS NULL OR (interval_km >= 1 AND interval_km <= 2000000))
      )
    `);

    await queryRunner.query(
      `CREATE INDEX maintenance_reminders_vehicle_status_idx
         ON maintenance_reminders (vehicle_id, status)`,
    );
    await queryRunner.query(
      `CREATE INDEX maintenance_reminders_user_id_idx
         ON maintenance_reminders (user_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX maintenance_reminders_due_date_idx
         ON maintenance_reminders (due_date)`,
    );
    await queryRunner.query(
      `CREATE INDEX maintenance_reminders_status_due_date_idx
         ON maintenance_reminders (status, due_date)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS maintenance_reminders`);
    await queryRunner.query(`DROP TABLE IF EXISTS service_records`);
    await queryRunner.query(
      `ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_id_user_id_unique`,
    );
  }
}
