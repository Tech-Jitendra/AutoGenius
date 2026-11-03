import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { Env } from '@autogenius/validation';
import { ENV } from '../config/config.module';
import { CreateAuthTables1791158400000 } from './migrations/1791158400000-CreateAuthTables';

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
        migrations: [CreateAuthTables1791158400000],
      }),
    }),
  ],
})
export class DatabaseModule {}
