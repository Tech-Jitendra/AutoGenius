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
import type { MaintenanceReminder, Page } from '@autogenius/types';
import {
  MAINTENANCE_ALERT_STATUSES,
  REMINDER_STATUSES,
  completeMaintenanceReminderSchema,
  createMaintenanceReminderSchema,
  maintenanceReminderIdSchema,
  maintenanceReminderQuerySchema,
  updateMaintenanceReminderSchema,
  vehicleIdSchema,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  type CompleteMaintenanceReminderInput,
  type CreateMaintenanceReminderInput,
  type MaintenanceReminderQuery,
  type UpdateMaintenanceReminderInput,
} from '@autogenius/validation';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  CompleteMaintenanceReminderInputDto,
  CreateMaintenanceReminderInputDto,
  MaintenanceReminderDto,
  MaintenanceReminderPageDto,
  UpdateMaintenanceReminderInputDto,
} from '../docs/dto/service-history.dto';
import {
  ReminderActiveConflict,
  ReminderClosedConflict,
  ReminderNotFound,
  UnauthorizedAccess,
  ValidationFailed,
  VehicleNotFound,
  reminderIdParam,
  vehicleIdParam,
} from './api-docs';
import { ServiceHistoryService } from './service-history.service';

const idParam = new ZodValidationPipe(vehicleIdSchema);
const reminderParam = new ZodValidationPipe(maintenanceReminderIdSchema);

@ApiTags('Service history')
@ApiBearerAuth('bearer')
@Controller('vehicles/:vehicleId/maintenance-reminders')
export class MaintenanceRemindersController {
  constructor(private readonly history: ServiceHistoryService) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({
    summary: 'Plan upcoming maintenance',
    description:
      'A reminder needs at least one due condition — a due date or a due odometer reading. Intervals are optional; giving one makes the reminder recurring, and it is never mandatory.',
  })
  @vehicleIdParam
  @ApiBody({ type: CreateMaintenanceReminderInputDto })
  @ApiCreatedResponse({ description: 'The new reminder.', type: MaintenanceReminderDto })
  @ValidationFailed(
    'A field failed validation, or neither dueDate nor dueOdometerKm was provided.',
  )
  @UnauthorizedAccess
  @VehicleNotFound
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Param('vehicleId', idParam) vehicleId: string,
    @Body(new ZodValidationPipe(createMaintenanceReminderSchema))
      body: CreateMaintenanceReminderInput,
  ): Promise<MaintenanceReminder> {
    return this.history.createReminder(user.id, vehicleId, body);
  }

  @Get()
  @ApiOperation({
    summary: 'List a vehicle’s reminders',
    description:
      'Active work first: sorted by soonest due date (reminders without a date fall last), then by due odometer. Urgency is computed on read, so `alertStatus` always reflects today and the vehicle’s stored odometer.',
  })
  @vehicleIdParam
  @ApiQuery({
    name: 'page',
    required: false,
    schema: { type: 'integer', minimum: 1, default: 1 },
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
    name: 'status',
    required: false,
    schema: { type: 'string', enum: [...REMINDER_STATUSES] },
    enumName: 'ReminderStatus',
    description:
      'Filter by life cycle. Case-insensitive on the wire. Defaults to every status.',
  })
  @ApiQuery({
    name: 'due',
    required: false,
    schema: { type: 'string', enum: [...MAINTENANCE_ALERT_STATUSES] },
    enumName: 'MaintenanceAlertStatus',
    description:
      'Filter by computed urgency. Only ACTIVE reminders have an urgency, so combining this with COMPLETED or DISMISSED returns an empty page.',
  })
  @ApiOkResponse({ description: 'One page of reminders.', type: MaintenanceReminderPageDto })
  @ValidationFailed('A query filter was malformed.')
  @UnauthorizedAccess
  @VehicleNotFound
  list(
    @CurrentUser() user: CurrentUserPayload,
    @Param('vehicleId', idParam) vehicleId: string,
    @Query(new ZodValidationPipe(maintenanceReminderQuerySchema))
    query: MaintenanceReminderQuery,
  ): Promise<Page<MaintenanceReminder>> {
    return this.history.listReminders(user.id, vehicleId, query);
  }

  @Get(':reminderId')
  @ApiOperation({ summary: 'Get one reminder' })
  @vehicleIdParam
  @reminderIdParam
  @ApiOkResponse({ description: 'The requested reminder.', type: MaintenanceReminderDto })
  @ValidationFailed('vehicleId or reminderId is not a UUID.')
  @UnauthorizedAccess
  @VehicleNotFound
  @ReminderNotFound
  findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Param('vehicleId', idParam) vehicleId: string,
    @Param('reminderId', reminderParam) reminderId: string,
  ): Promise<MaintenanceReminder> {
    return this.history.findReminder(user.id, vehicleId, reminderId);
  }

  @Patch(':reminderId')
  @ApiOperation({
    summary: 'Edit a reminder',
    description:
      'Changes the plan, not the life cycle: status only moves through /complete and /dismiss. The “needs a due condition” rule is validated against the merged reminder, so clearing the last due value is refused.',
  })
  @vehicleIdParam
  @reminderIdParam
  @ApiBody({ type: UpdateMaintenanceReminderInputDto })
  @ApiOkResponse({ description: 'The reminder after the update.', type: MaintenanceReminderDto })
  @ValidationFailed(
    'A supplied field failed validation, the body was empty, or the update would leave the reminder with no due condition.',
  )
  @UnauthorizedAccess
  @VehicleNotFound
  @ReminderNotFound
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('vehicleId', idParam) vehicleId: string,
    @Param('reminderId', reminderParam) reminderId: string,
    @Body(new ZodValidationPipe(updateMaintenanceReminderSchema))
      body: UpdateMaintenanceReminderInput,
  ): Promise<MaintenanceReminder> {
    return this.history.updateReminder(user.id, vehicleId, reminderId, body);
  }

  @Patch(':reminderId/complete')
  @ApiOperation({
    summary: 'Mark maintenance done',
    description:
      'Requires the completion date and the current odometer, and the odometer cannot be lower than the highest reading already on file for the vehicle. A recurring reminder rolls its due values forward from the last completion (or from the due value it just met) and stays ACTIVE; a reminder without intervals becomes COMPLETED. No service record is created — book the cost explicitly if you want it in the history.',
  })
  @vehicleIdParam
  @reminderIdParam
  @ApiBody({ type: CompleteMaintenanceReminderInputDto })
  @ApiOkResponse({
    description:
      'The reminder with its new due values. A recurring one is ACTIVE again and reads SCHEDULED.',
    type: MaintenanceReminderDto,
  })
  @ValidationFailed(
    'The date or odometer was malformed, the date is in the future, or the reading moved the odometer backwards.',
  )
  @UnauthorizedAccess
  @VehicleNotFound
  @ReminderNotFound
  @ReminderClosedConflict
  complete(
    @CurrentUser() user: CurrentUserPayload,
    @Param('vehicleId', idParam) vehicleId: string,
    @Param('reminderId', reminderParam) reminderId: string,
    @Body(new ZodValidationPipe(completeMaintenanceReminderSchema))
      body: CompleteMaintenanceReminderInput,
  ): Promise<MaintenanceReminder> {
    return this.history.completeReminder(user.id, vehicleId, reminderId, body);
  }

  @Patch(':reminderId/dismiss')
  @ApiOperation({
    summary: 'Stop following a reminder',
    description:
      'Keeps the reminder and its due values as history and removes it from the active list. It stops counting as overdue immediately.',
  })
  @vehicleIdParam
  @reminderIdParam
  @ApiOkResponse({ description: 'The dismissed reminder.', type: MaintenanceReminderDto })
  @ValidationFailed('vehicleId or reminderId is not a UUID.')
  @UnauthorizedAccess
  @VehicleNotFound
  @ReminderNotFound
  @ReminderClosedConflict
  dismiss(
    @CurrentUser() user: CurrentUserPayload,
    @Param('vehicleId', idParam) vehicleId: string,
    @Param('reminderId', reminderParam) reminderId: string,
  ): Promise<MaintenanceReminder> {
    return this.history.dismissReminder(user.id, vehicleId, reminderId);
  }

  @Patch(':reminderId/reopen')
  @ApiOperation({
    summary: 'Track a closed reminder again',
    description:
      'Brings a COMPLETED or DISMISSED reminder back to ACTIVE exactly as it was: the due date, the due odometer, both intervals and the historical last-completed values are all left untouched, so nothing about the original promise is rewritten. Urgency is recomputed on read, which means a reminder whose due condition passed while it was closed comes back OVERDUE.',
  })
  @vehicleIdParam
  @reminderIdParam
  @ApiOkResponse({
    description:
      'The same reminder with status ACTIVE. Everything else is byte-for-byte what it was before.',
    type: MaintenanceReminderDto,
  })
  @ValidationFailed('vehicleId or reminderId is not a UUID.')
  @UnauthorizedAccess
  @VehicleNotFound
  @ReminderNotFound
  @ReminderActiveConflict
  reopen(
    @CurrentUser() user: CurrentUserPayload,
    @Param('vehicleId', idParam) vehicleId: string,
    @Param('reminderId', reminderParam) reminderId: string,
  ): Promise<MaintenanceReminder> {
    return this.history.reopenReminder(user.id, vehicleId, reminderId);
  }

  @Delete(':reminderId')
  @ApiOperation({ summary: 'Delete a reminder' })
  @vehicleIdParam
  @reminderIdParam
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Reminder deleted. No response body.' })
  @ValidationFailed('vehicleId or reminderId is not a UUID.')
  @UnauthorizedAccess
  @VehicleNotFound
  @ReminderNotFound
  async remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param('vehicleId', idParam) vehicleId: string,
    @Param('reminderId', reminderParam) reminderId: string,
  ): Promise<void> {
    await this.history.removeReminder(user.id, vehicleId, reminderId);
  }
}
