import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ApiError } from '../../../../lib/api/client';
import { vehicleName, vehicleSubtitle } from '../../../../vehicles/labels';
import { useVehicle, useVehicleWriter } from '../../../../vehicles/vehicle-queries';

export default function DeleteVehicleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: vehicle, isPending } = useVehicle(id);
  const { remove } = useVehicleWriter();

  if (isPending) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Loading vehicle…</Text>
      </View>
    );
  }

  if (!vehicle) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>This vehicle is no longer in your list</Text>
        <Pressable style={styles.primary} onPress={() => router.replace('/vehicles')}>
          <Text style={styles.primaryText}>Back to vehicles</Text>
        </Pressable>
      </View>
    );
  }

  const confirm = () => {
    remove.mutate(vehicle.id, { onSuccess: () => router.replace('/vehicles') });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Delete this vehicle?</Text>
      <Text style={styles.vehicleName}>{vehicleName(vehicle)}</Text>
      <Text style={styles.muted}>{vehicleSubtitle(vehicle)}</Text>

      <Text style={styles.warning}>
        {vehicle.isDefault
          ? 'It is your default vehicle. Another vehicle will take its place automatically.'
          : 'The vehicle and its history will be removed from your account.'}
      </Text>

      {remove.error instanceof ApiError && (
        <Text style={styles.error}>{remove.error.message}</Text>
      )}

      <Pressable
        style={({ pressed }) => [styles.danger, (pressed || remove.isPending) && styles.pressed]}
        onPress={confirm}
        disabled={remove.isPending}
        accessibilityRole="button"
      >
        <Text style={styles.dangerText}>
          {remove.isPending ? 'Deleting…' : 'Yes, delete vehicle'}
        </Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
        onPress={() => router.back()}
        disabled={remove.isPending}
        accessibilityRole="button"
      >
        <Text style={styles.cancelText}>Keep vehicle</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 8,
    backgroundColor: '#f7f8fa',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  vehicleName: {
    fontSize: 17,
    fontWeight: '600',
  },
  muted: {
    color: '#555',
    fontSize: 13,
  },
  warning: {
    marginTop: 8,
    fontSize: 14,
    color: '#333',
  },
  error: {
    color: '#c0392b',
    fontSize: 13,
  },
  danger: {
    marginTop: 16,
    backgroundColor: '#c0392b',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  dangerText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancel: {
    marginTop: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelText: {
    color: '#1f6feb',
    fontSize: 15,
    fontWeight: '600',
  },
  primary: {
    backgroundColor: '#1f6feb',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  primaryText: {
    color: '#fff',
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.7,
  },
});
