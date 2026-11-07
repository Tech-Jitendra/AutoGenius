// Read-only audit of leftover integration-test fixtures. Deletes nothing.
import fs from 'node:fs';
import pg from 'pg';

const env = fs.readFileSync(new URL('../../../../.env', import.meta.url), 'utf8');
const line = env
  .split(/\r?\n/)
  .find((l) => /^(DATABASE_URL)\s*=/.test(l));
if (!line) {
  throw new Error('no DATABASE_URL in .env');
}
const value = line.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '');
const client = new pg.Client({ connectionString: value });
await client.connect();
await client.query('SET default_transaction_read_only = on');

// The run identifier is `pg-hist-<epoch ms>`: one per suite process, so every
// leftover row names the run that made it.
const runs = await client.query(
  `SELECT (regexp_match(email, '^pg-hist-\\d+'))[1] AS run_id, count(*)::int AS users
   FROM users
   WHERE email LIKE 'pg-hist-%'
   GROUP BY 1
   ORDER BY 1`,
);

const rows = [];
const totals = { users: 0, vehicles: 0, records: 0, reminders: 0 };
for (const run of runs.rows) {
  const pattern = `${run.run_id}-%`;
  const count = async (table) =>
    (
      await client.query(
        `SELECT count(*)::int AS n FROM ${table}
         WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)`,
        [pattern],
      )
    ).rows[0].n;
  const vehicles = await count('vehicles');
  const records = await count('service_records');
  const reminders = await count('maintenance_reminders');
  rows.push({
    runId: run.run_id,
    startedUtc: new Date(Number(run.run_id.split('-')[2])).toISOString(),
    users: run.users,
    vehicles,
    records,
    reminders,
  });
  totals.users += run.users;
  totals.vehicles += vehicles;
  totals.records += records;
  totals.reminders += reminders;
}

console.table(rows);
console.log('TOTALS', JSON.stringify(totals));
console.log('oldest_leftover', JSON.stringify(rows[0] ?? null));
console.log('newest_leftover', JSON.stringify(rows[rows.length - 1] ?? null));

const real = await client.query(
  `SELECT count(*)::int AS users FROM users WHERE email NOT LIKE 'pg-%'`,
);
console.log('non_test_users', JSON.stringify(real.rows[0]));

await client.end();
