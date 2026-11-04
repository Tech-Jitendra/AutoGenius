import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { Env } from '@autogenius/validation';
import { ENV } from '../config/config.module';
import { CreateAuthTables1791158400000 } from './migrations/1791158400000-CreateAuthTables';
import { CreateVehicles1793664000000 } from './migrations/1793664000000-CreateVehicles';
import { NormalizeVehicleRegistrationUniqueness1793750400000 } from './migrations/1793750400000-NormalizeVehicleRegistrationUniqueness';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ENV],
      useFactory: (env: Env) => ({
        type: 'postgres' as const,
        url: env.DATABASE_URL,
        autoLoadEntities: true,
        synchronize: false,
        migrationsRun: true,
        migrations: [
          CreateAuthTables1791158400000,
          CreateVehicles1793664000000,
          NormalizeVehicleRegistrationUniqueness1793750400000,
        ],
      }),
    }),
  ],
})
export class DatabaseModule {}
