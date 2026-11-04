import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VehicleEntity } from '../vehicles/vehicle.entity';
import { MaintenanceReminderEntity } from './maintenance-reminder.entity';
import { MaintenanceRemindersController } from './maintenance-reminders.controller';
import { MaintenanceSummaryController } from './maintenance-summary.controller';
import { ServiceRecordEntity } from './service-record.entity';
import { ServiceRecordsController } from './service-records.controller';
import { ServiceHistoryService } from './service-history.service';

@Module({
  // VehicleEntity is read here, not owned: ownership and the deletion guard stay
  // in the vehicles module, so the two modules never import each other.
  imports: [
    TypeOrmModule.forFeature([ServiceRecordEntity, MaintenanceReminderEntity, VehicleEntity]),
  ],
  controllers: [
    ServiceRecordsController,
    MaintenanceRemindersController,
    MaintenanceSummaryController,
  ],
  providers: [ServiceHistoryService],
})
export class ServiceHistoryModule {}
