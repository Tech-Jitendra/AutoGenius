import type { EntityManager } from 'typeorm';

/**
 * Serializes every write a single user makes, so two concurrent requests cannot
 * read a stale odometer or duplicate a default flag. The lock is always taken on
 * the user row first and never on two rows at once, so it cannot deadlock itself.
 */
export function lockUserRow(manager: EntityManager, userId: string): Promise<unknown> {
  return manager.query(`SELECT id FROM users WHERE id = $1 FOR UPDATE`, [userId]);
}
