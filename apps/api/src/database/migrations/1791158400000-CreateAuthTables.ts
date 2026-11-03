import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuthTables1791158400000 implements MigrationInterface {
  name = 'CreateAuthTables1791158400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE users (
        id uuid PRIMARY KEY,
        name varchar(100) NOT NULL,
        email varchar(255) NOT NULL,
        phone varchar(20),
        password_hash text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX users_email_unique ON users (email)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX users_email_lower ON users (lower(email))`,
    );
    await queryRunner.query(`
      CREATE TABLE refresh_tokens (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash varchar(64) NOT NULL,
        expires_at timestamptz NOT NULL,
        revoked_at timestamptz,
        replaced_by_id uuid,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX refresh_tokens_token_hash_unique ON refresh_tokens (token_hash)`,
    );
    await queryRunner.query(
      `CREATE INDEX refresh_tokens_user_id_idx ON refresh_tokens (user_id)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS refresh_tokens`);
    await queryRunner.query(`DROP TABLE IF EXISTS users`);
  }
}
