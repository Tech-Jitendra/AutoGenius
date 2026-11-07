import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type { CreateServiceRecordInput } from '@autogenius/validation';
import { ApiError } from '../../../lib/api/client';
import { KeyboardAvoiding } from '../../../lib/keyboard-avoiding';
import { vehicleName } from '../../../vehicles/labels';
import { useVehicle } from '../../../vehicles/vehicle-queries';
import {
  BLANK_RECORD,
  odometerSyncOffer,
  ServiceRecordForm,
  todayIsoDate,
} from '../../../service-history/service-record-form';
import { useServiceHistoryWriter } from '../../../service-history/service-history-queries';

/** The wording the product asks for, verbatim, because the choice is about trust. */
const ODOMETER_SYNC_QUESTION =
  'Your service record shows a higher odometer reading. Would you like to update your ' +
  "vehicle's current odometer?";

export default function AddServiceRecordScreen() {
  const { vehicleId } = useLocalSearchParams<{ vehicleId: string }>();
  const { data: vehicle } = useVehicle(vehicleId);
  const { createRecord } = useServiceHistoryWriter(vehicleId);

  // Held back from the server until the user answers the odometer question, so
  // the visit is never saved with a reading the vehicle was never told about.
  const [awaitingSyncAnswer, setAwaitingSyncAnswer] =
    useState<CreateServiceRecordInput | null>(null);

  const save = (input: CreateServiceRecordInput, syncVehicleOdometer: boolean) => {
    setAwaitingSyncAnswer(null);
    createRecord.mutate(
      { ...input, syncVehicleOdometer },
      {
        onSuccess: () =>
          router.replace({
            pathname: '/vehicles/[id]/service-history',
            params: { id: vehicleId },
          }),
      },
    );
  };

  const onSubmit = (input: CreateServiceRecordInput) => {
    if (odometerSyncOffer(input, vehicle?.currentOdometer)) {
      setAwaitingSyncAnswer(input);
      return;
    }
    save(input, false);
  };

  const pending = createRecord.isPending;
  const currentOdometer = vehicle?.currentOdometer ?? null;
  const keepsNote =
    currentOdometer === null
      ? null
      : `Declining keeps the vehicle at ${currentOdometer.toLocaleString('en-IN')} km.`;

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

      <KeyboardAvoiding>
        <ServiceRecordForm
          initial={{ ...BLANK_RECORD, serviceDate: todayIsoDate() }}
          submitLabel="Save visit"
          pending={pending}
          serverError={
            createRecord.error instanceof ApiError ? createRecord.error.message : null
          }
          banner={
            awaitingSyncAnswer ? (
              <View style={styles.syncPanel}>
                <Text style={styles.syncQuestion}>{ODOMETER_SYNC_QUESTION}</Text>
                {keepsNote ? <Text style={styles.syncNote}>{keepsNote}</Text> : null}
                <Pressable
                  style={({ pressed }) => [styles.syncConfirm, (pressed || pending) && styles.pressed]}
                  onPress={() => save(awaitingSyncAnswer, true)}
                  disabled={pending}
                  accessibilityRole="button"
                  accessibilityLabel="Update vehicle odometer"
                >
                  <Text style={styles.syncConfirmText}>Update odometer</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.syncDecline, pressed && styles.pressed]}
                  onPress={() => save(awaitingSyncAnswer, false)}
                  disabled={pending}
                  accessibilityRole="button"
                  accessibilityLabel="Keep current odometer"
                >
                  <Text style={styles.syncDeclineText}>Keep the odometer as it is</Text>
                </Pressable>
              </View>
            ) : null
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
  syncPanel: {
    marginBottom: 14,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#eaf2ff',
    borderWidth: 1,
    borderColor: '#bcd6ff',
    gap: 10,
  },
  syncQuestion: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1c3d6b',
  },
  syncNote: {
    fontSize: 12,
    color: '#555',
  },
  syncConfirm: {
    backgroundColor: '#1f6feb',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  syncConfirmText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  syncDecline: {
    borderWidth: 1,
    borderColor: '#1f6feb',
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: 'center',
  },
  syncDeclineText: {
    color: '#1f6feb',
    fontSize: 15,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.7,
  },
});
