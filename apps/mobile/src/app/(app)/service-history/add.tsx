import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type { CreateServiceRecordInput } from '@autogenius/validation';
import { ApiError } from '../../../lib/api/client';
import { vehicleName } from '../../../vehicles/labels';
import { useVehicle } from '../../../vehicles/vehicle-queries';
import {
  BLANK_RECORD,
  ServiceRecordForm,
  todayIsoDate,
} from '../../../service-history/service-record-form';
import { useServiceHistoryWriter } from '../../../service-history/service-history-queries';

export default function AddServiceRecordScreen() {
  const { vehicleId } = useLocalSearchParams<{ vehicleId: string }>();
  const { data: vehicle } = useVehicle(vehicleId);
  const { createRecord } = useServiceHistoryWriter(vehicleId);

  const onSubmit = (input: CreateServiceRecordInput) => {
    createRecord.mutate(input, {
      onSuccess: () =>
        router.replace({
          pathname: '/vehicles/[id]/service-history',
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
        <Text style={styles.title}>Record a service</Text>
      </View>
      <Text style={styles.subtitle}>
        {vehicle ? `For ${vehicleName(vehicle)}` : 'Workshop visit'}
      </Text>

      <ServiceRecordForm
        initial={{ ...BLANK_RECORD, serviceDate: todayIsoDate() }}
        submitLabel="Save visit"
        pending={createRecord.isPending}
        serverError={
          createRecord.error instanceof ApiError ? createRecord.error.message : null
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
