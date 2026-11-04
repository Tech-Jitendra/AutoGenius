import { ApiResponse, ApiParam } from '@nestjs/swagger';
import { ErrorResponseDto } from '../docs/dto/auth.dto';

/**
 * Reusable Swagger fragments for the service-history controllers. Three
 * controllers share the same path parameters and the same failure shapes, so
 * they are declared once here instead of copied per file.
 */
export const vehicleIdParam = ApiParam({
  name: 'vehicleId',
  description: 'Identifier of a vehicle owned by the authenticated user.',
  schema: { type: 'string', format: 'uuid' },
  example: '9c1c9a1e-4e10-4b0e-9b6f-2c2b0a1d3e4f',
});

export const recordIdParam = ApiParam({
  name: 'recordId',
  description: 'Identifier of a service record that belongs to this vehicle.',
  schema: { type: 'string', format: 'uuid' },
  example: '4b7f0d3a-8f4e-4c1a-9d2b-6f0a1c3e5b7d',
});

export const reminderIdParam = ApiParam({
  name: 'reminderId',
  description: 'Identifier of a maintenance reminder that belongs to this vehicle.',
  schema: { type: 'string', format: 'uuid' },
  example: '7a2d5fd1-3c4b-4f57-9a1e-5d8b0c2f6a93',
});

export function ValidationFailed(description: string) {
  return ApiResponse({ status: 400, description, type: ErrorResponseDto });
}

export const UnauthorizedAccess = ApiResponse({
  status: 401,
  description: 'Access token missing, malformed, or expired.',
  type: ErrorResponseDto,
});

export const VehicleNotFound = ApiResponse({
  status: 404,
  description: 'No vehicle with this id belongs to the authenticated user.',
  type: ErrorResponseDto,
});

export const RecordNotFound = ApiResponse({
  status: 404,
  description:
    'No service record with this id under this vehicle for this user. A record reached through the wrong vehicle is a 404, not a 403, so ids cannot be probed.',
  type: ErrorResponseDto,
});

export const ReminderNotFound = ApiResponse({
  status: 404,
  description: 'No reminder with this id under this vehicle for this user.',
  type: ErrorResponseDto,
});

export const ReminderClosedConflict = ApiResponse({
  status: 409,
  description:
    'The reminder is already COMPLETED or DISMISSED. Completing it again would silently reopen history, so the request is refused.',
  type: ErrorResponseDto,
});
