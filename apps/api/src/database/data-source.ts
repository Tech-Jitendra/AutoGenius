import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { parseEnv } from '@autogenius/validation';
import { loadLocalEnv } from '../config/load-env';
import { CreateAuthTables1791158400000 } from './migrations/1791158400000-CreateAuthTables';

loadLocalEnv();

const env = parseEnv(process.env);

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: env.DATABASE_URL,
  synchronize: false,
  migrations: [CreateAuthTables1791158400000],
});
