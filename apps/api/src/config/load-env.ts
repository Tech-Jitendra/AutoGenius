import { existsSync } from 'fs';
import { resolve } from 'path';

// process.loadEnvFile never overwrites a variable that is already set, so
// injected environment (Docker Compose, CI) keeps winning over this file.
const candidates = [
  process.env['API_ENV_FILE'],
  resolve(process.cwd(), '.env'),
  // apps/api/{src,dist}/config -> repository root
  resolve(__dirname, '..', '..', '..', '..', '.env'),
].filter((candidate): candidate is string => Boolean(candidate));

export function loadLocalEnv(): void {
  for (const file of candidates) {
    if (existsSync(file)) {
      process.loadEnvFile(file);
      return;
    }
  }
}
