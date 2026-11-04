import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { parseEnv } from '@autogenius/validation';
import { loadLocalEnv } from '../config/load-env';
import { CreateAuthTables1791158400000 } from './migrations/1791158400000-CreateAuthTables';
import { CreateVehicles1793664000000 } from './migrations/1793664000000-CreateVehicles';
import { NormalizeVehicleRegistrationUniqueness1793750400000 } from './migrations/1793750400000-NormalizeVehicleRegistrationUniqueness';
import { CreateServiceHistory1793836800000 } from './migrations/1793836800000-CreateServiceHistory';

loadLocalEnv();

const env = parseEnv(process.env);

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: env.DATABASE_URL,
  synchronize: false,
  migrations: [
    CreateAuthTables1791158400000,
    CreateVehicles1793664000000,
    NormalizeVehicleRegistrationUniqueness1793750400000,
    CreateServiceHistory1793836800000,
  ],
});
