import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type { CreateMaintenanceReminderInput } from '@autogenius/validation';
import { ApiError } from '../../../lib/api/client';
import { KeyboardAvoiding } from '../../../lib/keyboard-avoiding';
import { vehicleName } from '../../../vehicles/labels';
import { useVehicle } from '../../../vehicles/vehicle-queries';
import {
  BLANK_REMINDER,
  MaintenanceReminderForm,
} from '../../../service-history/maintenance-reminder-form';
import { useServiceHistoryWriter } from '../../../service-history/service-history-queries';

export default function AddReminderScreen() {
  const { vehicleId } = useLocalSearchParams<{ vehicleId: string }>();
  const { data: vehicle } = useVehicle(vehicleId);
  const { createReminder } = useServiceHistoryWriter(vehicleId);

  const onSubmit = (input: CreateMaintenanceReminderInput) => {
    createReminder.mutate(input, {
      onSuccess: () =>
        router.replace({
          pathname: '/vehicles/[id]/maintenance',
          params: { id: vehicleId },
        }),
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityRole="button">
          <Text style={styles.back}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Add reminder</Text>
      </View>
      <Text style={styles.subtitle}>
        {vehicle ? `For ${vehicleName(vehicle)}` : 'Maintenance reminder'}
      </Text>

      <KeyboardAvoiding>
        <MaintenanceReminderForm
          submitLabel="Save reminder"
          pending={createReminder.isPending}
          serverError={
            createReminder.error instanceof ApiError ? createReminder.error.message : null
          }
          onSubmit={onSubmit}
        />
      </KeyboardAvoiding>
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
    paddingBottom: 4,
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
  subtitle: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    color: '#555',
    fontSize: 13,
  },
});
