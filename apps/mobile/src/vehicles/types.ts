import type { Vehicle } from '@autogenius/types';

/**
 * The API sends timestamps as ISO strings, so the app models the wire shape
 * rather than the server-side entity.
 */
export type VehicleDto = Omit<Vehicle, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};
