import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import type { CreateVehicleInput } from '@autogenius/validation';
import { ApiError } from '../../../lib/api/client';
import { VehicleForm } from '../../../vehicles/vehicle-form';
import { useVehicleWriter } from '../../../vehicles/vehicle-queries';

export default function AddVehicleScreen() {
  const { create } = useVehicleWriter();

  const onSubmit = (input: CreateVehicleInput) => {
    create.mutate(input, {
      onSuccess: () => router.replace('/vehicles'),
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityRole="button">
          <Text style={styles.back}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Add vehicle</Text>
      </View>

      <VehicleForm
        submitLabel="Save vehicle"
        pending={create.isPending}
        serverError={
          create.error instanceof ApiError ? create.error.message : null
        }
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
    fontSize: 20,
    fontWeight: '700',
  },
});
