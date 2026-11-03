import { DataType, newDb, type IMemoryDb } from 'pg-mem';

export function createPgMemDb(): IMemoryDb {
  const db = newDb();
  db.public.registerFunction({
    name: 'version',
    returns: DataType.text,
    implementation: () => 'PostgreSQL 16.0 (pg-mem)',
  });
  db.public.registerFunction({
    name: 'current_database',
    returns: DataType.text,
    implementation: () => 'autogenius_test',
  });
  db.public.registerFunction({
    name: 'current_schema',
    returns: DataType.text,
    implementation: () => 'public',
  });
  db.public.registerFunction({
    name: 'pg_get_userbyid',
    returns: DataType.text,
    implementation: () => 'postgres',
  });
  return db;
}
