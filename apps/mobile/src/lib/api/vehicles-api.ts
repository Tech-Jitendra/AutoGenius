import type { CreateVehicleInput, UpdateVehicleInput } from '@autogenius/validation';
import { apiFetch } from './client';
import type { VehicleDto } from '../../vehicles/types';

const jsonHeaders = { 'Content-Type': 'application/json' };

// Ids come from the database, but encoding them keeps a malformed param from
// escaping the path.
const path = (id: string): string => `/vehicles/${encodeURIComponent(id)}`;

export function listVehicles(): Promise<VehicleDto[]> {
  return apiFetch<VehicleDto[]>('/vehicles');
}

export function getVehicle(id: string): Promise<VehicleDto> {
  return apiFetch<VehicleDto>(path(id));
}

export function createVehicle(input: CreateVehicleInput): Promise<VehicleDto> {
  return apiFetch<VehicleDto>('/vehicles', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(input),
  });
}

export function updateVehicle(
  id: string,
  input: UpdateVehicleInput,
): Promise<VehicleDto> {
  return apiFetch<VehicleDto>(path(id), {
    method: 'PATCH',
    headers: jsonHeaders,
    body: JSON.stringify(input),
  });
}

export function setDefaultVehicle(id: string): Promise<VehicleDto> {
  return apiFetch<VehicleDto>(`${path(id)}/default`, { method: 'PATCH' });
}

export function deleteVehicle(id: string): Promise<void> {
  return apiFetch<void>(path(id), { method: 'DELETE' });
}
