import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `MH 12 AB 1234` and `MH12AB1234` are the same plate typed two ways, so they must
 * not both be allowed for one owner. The stored value keeps the readable spacing;
 * only the uniqueness key drops separators.
 */
const INDEX = 'vehicles_user_registration_unique';
const CANONICAL_PLATE =
  "regexp_replace(upper(registration_number), '[^A-Z0-9]', '', 'g')";

export class NormalizeVehicleRegistrationUniqueness1793750400000
  implements MigrationInterface
{
  name = 'NormalizeVehicleRegistrationUniqueness1793750400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS ${INDEX}`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX ${INDEX}
        ON vehicles (user_id, ${CANONICAL_PLATE})
        WHERE registration_number IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS ${INDEX}`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX ${INDEX}
        ON vehicles (user_id, upper(registration_number))
        WHERE registration_number IS NOT NULL
    `);
  }
}
