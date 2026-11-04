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
import { VehiclesService } from './vehicles.service';

@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehicles: VehiclesService) {}

  @Post()
  @HttpCode(201)
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body(new ZodValidationPipe(createVehicleSchema)) body: CreateVehicleInput,
  ): Promise<Vehicle> {
    return this.vehicles.create(user.id, body);
  }

  @Get()
  list(@CurrentUser() user: CurrentUserPayload): Promise<Vehicle[]> {
    return this.vehicles.list(user.id);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ZodValidationPipe(vehicleIdSchema)) id: string,
  ): Promise<Vehicle> {
    return this.vehicles.findOwned(user.id, id);
  }

  @Patch(':id/default')
  setDefault(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ZodValidationPipe(vehicleIdSchema)) id: string,
  ): Promise<Vehicle> {
    return this.vehicles.setDefault(user.id, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ZodValidationPipe(vehicleIdSchema)) id: string,
    @Body(new ZodValidationPipe(updateVehicleSchema)) body: UpdateVehicleInput,
  ): Promise<Vehicle> {
    return this.vehicles.update(user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ZodValidationPipe(vehicleIdSchema)) id: string,
  ): Promise<void> {
    await this.vehicles.remove(user.id, id);
  }
}
