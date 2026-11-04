import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateVehicleInput, UpdateVehicleInput } from '@autogenius/validation';
import {
  createVehicle,
  deleteVehicle,
  getVehicle,
  listVehicles,
  setDefaultVehicle,
  updateVehicle,
} from '../lib/api/vehicles-api';

export const vehicleKeys = {
  all: ['vehicles'] as const,
  list: () => [...vehicleKeys.all, 'list'] as const,
  detail: (id: string) => [...vehicleKeys.all, 'detail', id] as const,
};

export function useVehicleList() {
  return useQuery({
    queryKey: vehicleKeys.list(),
    queryFn: listVehicles,
  });
}

export function useVehicle(id: string | undefined) {
  return useQuery({
    queryKey: vehicleKeys.detail(id ?? ''),
    queryFn: () => getVehicle(id ?? ''),
    enabled: Boolean(id),
  });
}

/**
 * Every write invalidates the whole vehicles branch: the server may move the
 * default flag to another vehicle, so a targeted update would go stale.
 */
export function useVehicleWriter() {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: vehicleKeys.all });
  };

  return {
    create: useMutation({ mutationFn: createVehicle, onSuccess: invalidate }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: UpdateVehicleInput }) =>
        updateVehicle(id, input),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: deleteVehicle,
      onSuccess: (_result, id) => {
        queryClient.removeQueries({ queryKey: vehicleKeys.detail(id) });
        invalidate();
      },
    }),
    setDefault: useMutation({ mutationFn: setDefaultVehicle, onSuccess: invalidate }),
  };
}
