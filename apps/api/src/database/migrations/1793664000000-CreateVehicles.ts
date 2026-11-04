import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateVehicles1793664000000 implements MigrationInterface {
  name = 'CreateVehicles1793664000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE vehicles (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        make varchar(50) NOT NULL,
        model varchar(50) NOT NULL,
        variant varchar(50),
        registration_number varchar(20),
        manufacturing_year int NOT NULL,
        fuel_type varchar(20) NOT NULL,
        transmission varchar(20) NOT NULL,
        purchase_date date,
        current_odometer int,
        is_default boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT vehicles_manufacturing_year_range
          CHECK (manufacturing_year >= 1900 AND manufacturing_year <= 2100),
        CONSTRAINT vehicles_fuel_type_check
          CHECK (fuel_type IN ('PETROL', 'DIESEL', 'CNG', 'HYBRID', 'ELECTRIC')),
        CONSTRAINT vehicles_transmission_check
          CHECK (transmission IN ('MANUAL', 'AUTOMATIC', 'AMT', 'CVT')),
        CONSTRAINT vehicles_odometer_range
          CHECK (current_odometer IS NULL OR (current_odometer >= 0 AND current_odometer <= 2000000))
      )
    `);
    await queryRunner.query(
      `CREATE INDEX vehicles_user_id_idx ON vehicles (user_id)`,
    );
    // At most one default vehicle per user. The predicate keeps non-default
    // rows out of the index, so a user can own any number of them.
    await queryRunner.query(
      `CREATE UNIQUE INDEX vehicles_user_default_unique ON vehicles (user_id) WHERE is_default`,
    );
    // Plates are unique per user, compared case-insensitively; NULL plates are
    // excluded so vehicles without a registration never collide.
    await queryRunner.query(
      `CREATE UNIQUE INDEX vehicles_user_registration_unique ON vehicles (user_id, upper(registration_number)) WHERE registration_number IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX vehicles_user_created_at_idx ON vehicles (user_id, created_at DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS vehicles`);
  }
}
