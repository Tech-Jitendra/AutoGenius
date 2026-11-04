import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Vehicle } from '@autogenius/types';
import {
  createVehicleSchema,
  updateVehicleSchema,
  vehicleIdSchema,
  type CreateVehicleInput,
  type UpdateVehicleInput,
} from '@autogenius/validation';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ErrorResponseDto } from '../docs/dto/auth.dto';
import {
  CreateVehicleInputDto,
  UpdateVehicleInputDto,
  VehicleDto,
} from '../docs/dto/vehicle.dto';
import { VehiclesService } from './vehicles.service';

const vehicleIdParam = ApiParam({
  name: 'id',
  description: 'Identifier of a vehicle owned by the authenticated user.',
  schema: { type: 'string', format: 'uuid' },
  example: '9c1c9a1e-4e10-4b0e-9b6f-2c2b0a1d3e4f',
});

function ValidationFailed(description: string) {
  return ApiResponse({
    status: 400,
    description,
    type: ErrorResponseDto,
  });
}

const UnauthorizedAccess = ApiResponse({
  status: 401,
  description: 'Access token missing, malformed, or expired.',
  type: ErrorResponseDto,
});

const VehicleNotFound = ApiResponse({
  status: 404,
  description: 'No vehicle with this id belongs to the authenticated user.',
  type: ErrorResponseDto,
});

@ApiTags('Vehicles')
@ApiBearerAuth('bearer')
@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehicles: VehiclesService) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Add a vehicle' })
  @ApiBody({ type: CreateVehicleInputDto })
  @ApiCreatedResponse({ description: 'Vehicle created for the caller.', type: VehicleDto })
  @ValidationFailed(
    'A field failed validation. `message` lists each failure as `field: message`.',
  )
  @UnauthorizedAccess
  @ApiResponse({
    status: 409,
    description:
      'Another of this user’s vehicles already carries that plate. Plates are unique per user after normalisation.',
    type: ErrorResponseDto,
  })
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body(new ZodValidationPipe(createVehicleSchema)) body: CreateVehicleInput,
  ): Promise<Vehicle> {
    return this.vehicles.create(user.id, body);
  }

  @Get()
  @ApiOperation({ summary: 'List my vehicles' })
  @ApiOkResponse({
    description:
      'Every vehicle owned by the caller: the default one first, the rest newest first. The list is empty rather than 404 when the user has none.',
    type: [VehicleDto],
  })
  @UnauthorizedAccess
  list(@CurrentUser() user: CurrentUserPayload): Promise<Vehicle[]> {
    return this.vehicles.list(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one of my vehicles' })
  @vehicleIdParam
  @ApiOkResponse({ description: 'The requested vehicle.', type: VehicleDto })
  @ValidationFailed('id is not a UUID.')
  @UnauthorizedAccess
  @VehicleNotFound
  findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ZodValidationPipe(vehicleIdSchema)) id: string,
  ): Promise<Vehicle> {
    return this.vehicles.findOwned(user.id, id);
  }

  @Patch(':id/default')
  @ApiOperation({ summary: 'Mark a vehicle as default' })
  @vehicleIdParam
  @ApiOkResponse({
    description:
      'The vehicle, now flagged default. Any previous default for the same user is demoted in the same transaction.',
    type: VehicleDto,
  })
  @ValidationFailed('id is not a UUID.')
  @UnauthorizedAccess
  @VehicleNotFound
  setDefault(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ZodValidationPipe(vehicleIdSchema)) id: string,
  ): Promise<Vehicle> {
    return this.vehicles.setDefault(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a vehicle' })
  @vehicleIdParam
  @ApiBody({
    type: UpdateVehicleInputDto,
    description:
      'Only the keys present in the body are changed. Omit a nullable key to leave it alone; send null to clear it.',
  })
  @ApiOkResponse({ description: 'The vehicle after the update.', type: VehicleDto })
  @ValidationFailed(
    'A supplied field failed validation, or the body was empty after normalisation.',
  )
  @UnauthorizedAccess
  @VehicleNotFound
  @ApiResponse({
    status: 409,
    description: 'Another of this user’s vehicles already carries that plate.',
    type: ErrorResponseDto,
  })
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ZodValidationPipe(vehicleIdSchema)) id: string,
    @Body(new ZodValidationPipe(updateVehicleSchema)) body: UpdateVehicleInput,
  ): Promise<Vehicle> {
    return this.vehicles.update(user.id, id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a vehicle' })
  @vehicleIdParam
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Vehicle deleted. No response body.' })
  @ValidationFailed('id is not a UUID.')
  @UnauthorizedAccess
  @VehicleNotFound
  async remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ZodValidationPipe(vehicleIdSchema)) id: string,
  ): Promise<void> {
    await this.vehicles.remove(user.id, id);
  }
}
