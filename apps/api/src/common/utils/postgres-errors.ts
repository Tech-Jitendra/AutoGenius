import { QueryFailedError } from 'typeorm';

const UNIQUE_VIOLATION = '23505';

/** PostgreSQL reports any unique-index clash as SQLSTATE 23505. */
export function isUniqueViolation(error: unknown): boolean {
  return queryErrorCode(error) === UNIQUE_VIOLATION;
}

/**
 * TypeORM copies the driver error's `code` and `constraint` onto
 * QueryFailedError, so a specific index can be identified without parsing the
 * SQL message. Older servers report the offending index only in the message,
 * so both are checked.
 */
export function isUniqueViolationOf(error: unknown, constraint: string): boolean {
  if (!isUniqueViolation(error)) {
    return false;
  }
  const e = error as { constraint?: unknown; message?: unknown };
  if (e.constraint === constraint) {
    return true;
  }
  return typeof e.message === 'string' && e.message.includes(`"${constraint}"`);
}

function queryErrorCode(error: unknown): string | undefined {
  if (!(error instanceof QueryFailedError)) {
    return undefined;
  }
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}
