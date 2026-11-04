import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { MaintenanceSummary } from '@autogenius/types';
import { vehicleIdSchema } from '@autogenius/validation';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { MaintenanceSummaryDto } from '../docs/dto/service-history.dto';
import {
  UnauthorizedAccess,
  ValidationFailed,
  VehicleNotFound,
  vehicleIdParam,
} from './api-docs';
import { ServiceHistoryService } from './service-history.service';

@ApiTags('Service history')
@ApiBearerAuth('bearer')
@Controller('vehicles/:vehicleId/maintenance-summary')
export class MaintenanceSummaryController {
  constructor(private readonly history: ServiceHistoryService) {}

  @Get()
  @ApiOperation({
    summary: 'Snapshot of a vehicle’s upkeep',
    description:
      'Totals are aggregated from service_records and urgency is recomputed from maintenance_reminders on every call; nothing is cached in a roll-up column, so editing or deleting a record cannot leave a stale figure.',
  })
  @vehicleIdParam
  @ApiOkResponse({ description: 'The summary.', type: MaintenanceSummaryDto })
  @ValidationFailed('vehicleId is not a UUID.')
  @UnauthorizedAccess
  @VehicleNotFound
  summary(
    @CurrentUser() user: CurrentUserPayload,
    @Param('vehicleId', new ZodValidationPipe(vehicleIdSchema)) vehicleId: string,
  ): Promise<MaintenanceSummary> {
    return this.history.summary(user.id, vehicleId);
  }
}
