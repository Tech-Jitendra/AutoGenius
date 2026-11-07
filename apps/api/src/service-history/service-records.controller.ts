import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Page, ServiceRecord } from '@autogenius/types';
import {
  createServiceRecordSchema,
  serviceRecordIdSchema,
  serviceRecordQuerySchema,
  updateServiceRecordSchema,
  vehicleIdSchema,
  SERVICE_TYPES,
  MAX_PAGE_SIZE,
  DEFAULT_PAGE_SIZE,
  type CreateServiceRecordInput,
  type ServiceRecordQuery,
  type UpdateServiceRecordInput,
} from '@autogenius/validation';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  CreateServiceRecordInputDto,
  ServiceRecordDto,
  ServiceRecordPageDto,
  UpdateServiceRecordInputDto,
} from '../docs/dto/service-history.dto';
import {
  RecordNotFound,
  UnauthorizedAccess,
  ValidationFailed,
  VehicleNotFound,
  recordIdParam,
  vehicleIdParam,
} from './api-docs';
import { ServiceHistoryService } from './service-history.service';

const idParam = new ZodValidationPipe(vehicleIdSchema);
const recordParam = new ZodValidationPipe(serviceRecordIdSchema);

@ApiTags('Service history')
@ApiBearerAuth('bearer')
@Controller('vehicles/:vehicleId/service-records')
export class ServiceRecordsController {
  constructor(private readonly history: ServiceHistoryService) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({
    summary: 'Record a workshop visit',
    description:
      'Adds one service record to the vehicle. Costs are stored as money (two decimals) and total_cost is derived from the three components, so a client cannot post a total that does not match its parts. `syncVehicleOdometer` is the user’s explicit confirmation to move the vehicle’s current odometer to this reading in the same transaction; it is ignored when the stored reading is already at least as high, and refused when the record has no reading or is dated before today.',
  })
  @vehicleIdParam
  @ApiBody({ type: CreateServiceRecordInputDto })
  @ApiCreatedResponse({ description: 'The stored record.', type: ServiceRecordDto })
  @ValidationFailed(
    'A field failed validation — for example a future service date, a negative cost, or an unknown service type. `message` lists each failure as `field: message`.',
  )
  @UnauthorizedAccess
  @VehicleNotFound
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Param('vehicleId', idParam) vehicleId: string,
    @Body(new ZodValidationPipe(createServiceRecordSchema)) body: CreateServiceRecordInput,
  ): Promise<ServiceRecord> {
    return this.history.createRecord(user.id, vehicleId, body);
  }

  @Get()
  @ApiOperation({
    summary: 'List a vehicle’s service history',
    description:
      'Newest service date first, newest created at as the tie-break. Ownership is checked on both the vehicle and the row, so another user’s record is never reachable through a guessed vehicle id.',
  })
  @vehicleIdParam
  @ApiQuery({
    name: 'page',
    required: false,
    schema: { type: 'integer', minimum: 1, default: 1 },
    description: '1-based page number.',
  })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    schema: {
      type: 'integer',
      minimum: 1,
      maximum: MAX_PAGE_SIZE,
      default: DEFAULT_PAGE_SIZE,
    },
  })
  @ApiQuery({
    name: 'from',
    required: false,
    schema: { type: 'string', format: 'date' },
    description: 'Keep records whose service date is on or after this date.',
    example: '2026-01-01',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    schema: { type: 'string', format: 'date' },
    description: 'Keep records whose service date is on or before this date.',
    example: '2026-12-31',
  })
  @ApiQuery({
    name: 'serviceType',
    required: false,
    schema: { type: 'string', enum: [...SERVICE_TYPES] },
    enumName: 'ServiceType',
    description: 'Keep records of one service type.',
  })
  @ApiOkResponse({ description: 'One page of records.', type: ServiceRecordPageDto })
  @ValidationFailed('A query filter was malformed, or from was later than to.')
  @UnauthorizedAccess
  @VehicleNotFound
  list(
    @CurrentUser() user: CurrentUserPayload,
    @Param('vehicleId', idParam) vehicleId: string,
    @Query(new ZodValidationPipe(serviceRecordQuerySchema)) query: ServiceRecordQuery,
  ): Promise<Page<ServiceRecord>> {
    return this.history.listRecords(user.id, vehicleId, query);
  }

  @Get(':recordId')
  @ApiOperation({ summary: 'Get one service record' })
  @vehicleIdParam
  @recordIdParam
  @ApiOkResponse({ description: 'The requested record.', type: ServiceRecordDto })
  @ValidationFailed('vehicleId or recordId is not a UUID.')
  @UnauthorizedAccess
  @VehicleNotFound
  @RecordNotFound
  findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Param('vehicleId', idParam) vehicleId: string,
    @Param('recordId', recordParam) recordId: string,
  ): Promise<ServiceRecord> {
    return this.history.findRecord(user.id, vehicleId, recordId);
  }

  @Patch(':recordId')
  @ApiOperation({ summary: 'Correct a service record' })
  @vehicleIdParam
  @recordIdParam
  @ApiBody({
    type: UpdateServiceRecordInputDto,
    description:
      'Only the keys present in the body change. Omit a nullable key to leave it alone; send null to clear it. Sending any cost component re-derives total_cost from all three.',
  })
  @ApiOkResponse({ description: 'The record after the update.', type: ServiceRecordDto })
  @ValidationFailed('A supplied field failed validation, or the body was empty.')
  @UnauthorizedAccess
  @VehicleNotFound
  @RecordNotFound
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('vehicleId', idParam) vehicleId: string,
    @Param('recordId', recordParam) recordId: string,
    @Body(new ZodValidationPipe(updateServiceRecordSchema)) body: UpdateServiceRecordInput,
  ): Promise<ServiceRecord> {
    return this.history.updateRecord(user.id, vehicleId, recordId, body);
  }

  @Delete(':recordId')
  @ApiOperation({ summary: 'Delete a service record' })
  @vehicleIdParam
  @recordIdParam
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Record deleted. No response body.' })
  @ValidationFailed('vehicleId or recordId is not a UUID.')
  @UnauthorizedAccess
  @VehicleNotFound
  @RecordNotFound
  async remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param('vehicleId', idParam) vehicleId: string,
    @Param('recordId', recordParam) recordId: string,
  ): Promise<void> {
    await this.history.removeRecord(user.id, vehicleId, recordId);
  }
}
