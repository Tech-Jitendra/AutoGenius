import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type { CreateVehicleInput } from '@autogenius/validation';
import { ApiError } from '../../../../lib/api/client';
import { vehicleName } from '../../../../vehicles/labels';
import {
  toUpdateInput,
  VehicleForm,
  vehicleToFormValues,
} from '../../../../vehicles/vehicle-form';
import { useVehicle, useVehicleWriter } from '../../../../vehicles/vehicle-queries';

export default function EditVehicleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: vehicle, isPending, isError, error } = useVehicle(id);
  const { update } = useVehicleWriter();

  if (isPending) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Loading vehicle…</Text>
      </View>
    );
  }

  if (isError || !vehicle) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>
          {error instanceof ApiError && error.status === 404
            ? 'Vehicle not found'
            : 'Could not load this vehicle'}
        </Text>
        <Pressable style={styles.secondary} onPress={() => router.replace('/vehicles')}>
          <Text style={styles.secondaryText}>Back to vehicles</Text>
        </Pressable>
      </View>
    );
  }

  const onSubmit = (values: CreateVehicleInput) => {
    update.mutate(
      { id: vehicle.id, input: toUpdateInput(values) },
      { onSuccess: () => router.back() },
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityRole="button">
          <Text style={styles.back}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Edit {vehicleName(vehicle)}</Text>
      </View>

      <VehicleForm
        key={vehicle.id}
        initial={vehicleToFormValues(vehicle)}
        submitLabel="Save changes"
        pending={update.isPending}
        serverError={update.error instanceof ApiError ? update.error.message : null}
        onSubmit={onSubmit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f8fa',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 20,
    paddingBottom: 8,
  },
  back: {
    color: '#1f6feb',
    fontSize: 15,
    fontWeight: '600',
  },
  title: {
    flexShrink: 1,
    fontSize: 18,
    fontWeight: '700',
  },
  muted: {
    color: '#555',
    fontSize: 13,
  },
  errorTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#c0392b',
    textAlign: 'center',
  },
  secondary: {
    borderWidth: 1,
    borderColor: '#1f6feb',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  secondaryText: {
    color: '#1f6feb',
    fontWeight: '600',
  },
});
