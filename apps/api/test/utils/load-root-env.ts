import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT_ENV_FILE = resolve(__dirname, '..', '..', '..', '..', '.env');

/**
 * The API boots through `process.loadEnvFile()`, which writes to the real
 * process environment. Jest gives each worker a sandboxed copy of
 * `process.env` that native writes never reach, so this suite reads the same
 * file itself. Values already present (CI, shell) win.
 */
export function loadRootEnvFile(): void {
  if (!existsSync(ROOT_ENV_FILE)) {
    throw new Error(
      `Real-PostgreSQL tests need ${ROOT_ENV_FILE} for DATABASE_URL and the JWT secrets.`,
    );
  }
  for (const line of readFileSync(ROOT_ENV_FILE, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!match) {
      continue;
    }
    const [, key = '', rawValue = ''] = match;
    if (process.env[key] !== undefined) {
      continue;
    }
    process.env[key] = rawValue.replace(/^(['"])(.*)\1$/, '$2');
  }
}
