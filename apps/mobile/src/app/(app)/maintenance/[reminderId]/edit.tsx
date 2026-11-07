import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type { CreateMaintenanceReminderInput } from '@autogenius/validation';
import { ApiError } from '../../../../lib/api/client';
import { KeyboardAvoiding } from '../../../../lib/keyboard-avoiding';
import {
  MaintenanceReminderForm,
  reminderToFormValues,
  toUpdateReminderInput,
} from '../../../../service-history/maintenance-reminder-form';
import {
  useMaintenanceReminder,
  useServiceHistoryWriter,
} from '../../../../service-history/service-history-queries';
import { ALERT_LABELS, REMINDER_STATUS_LABELS } from '../../../../service-history/labels';

export default function EditReminderScreen() {
  const { reminderId, vehicleId } = useLocalSearchParams<{
    reminderId: string;
    vehicleId: string;
  }>();
  const { data: reminder, isPending, isError, error } = useMaintenanceReminder(
    vehicleId,
    reminderId,
  );
  const { updateReminder, removeReminder } = useServiceHistoryWriter(vehicleId);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const listHref = {
    pathname: '/vehicles/[id]/maintenance',
    params: { id: vehicleId },
  } as const;

  if (isPending) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Loading reminder…</Text>
      </View>
    );
  }

  if (isError || !reminder) {
    const missing = error instanceof ApiError && error.status === 404;
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>
          {missing ? 'This reminder is no longer on this vehicle' : 'Could not load this reminder'}
        </Text>
        <Text style={styles.muted}>
          {missing
            ? 'It may have been deleted, or it belongs to another vehicle.'
            : error instanceof ApiError
              ? error.message
              : 'Please check your connection.'}
        </Text>
        <Pressable style={styles.secondary} onPress={() => router.replace(listHref)} accessibilityRole="button">
          <Text style={styles.secondaryText}>Back to maintenance</Text>
        </Pressable>
      </View>
    );
  }

  const statusLine =
    reminder.status === 'ACTIVE' && reminder.alertStatus
      ? `${REMINDER_STATUS_LABELS[reminder.status]} · ${ALERT_LABELS[reminder.alertStatus]}`
      : REMINDER_STATUS_LABELS[reminder.status];

  const onSubmit = (values: CreateMaintenanceReminderInput) => {
    updateReminder.mutate(
      { reminderId: reminder.id, input: toUpdateReminderInput(values) },
      { onSuccess: () => router.back() },
    );
  };

  const deleteError =
    removeReminder.error instanceof ApiError ? removeReminder.error.message : null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityRole="button">
          <Text style={styles.back}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Edit reminder</Text>
      </View>
      <Text style={styles.subtitle}>{statusLine}</Text>

      <KeyboardAvoiding>
        <MaintenanceReminderForm
          key={reminder.id}
          initial={reminderToFormValues(reminder)}
          submitLabel="Save changes"
          pending={updateReminder.isPending}
          serverError={
            updateReminder.error instanceof ApiError ? updateReminder.error.message : null
          }
          onSubmit={onSubmit}
        />
      </KeyboardAvoiding>

      <View style={styles.deleteSection}>
        {confirmingDelete ? (
          <>
            <Text style={styles.deleteQuestion}>
              Delete this reminder? Its due date and completion history go with it.
            </Text>
            {deleteError ? <Text style={styles.errorText}>{deleteError}</Text> : null}
            <Pressable
              style={({ pressed }) => [styles.danger, (pressed || removeReminder.isPending) && styles.pressed]}
              onPress={() =>
                removeReminder.mutate(reminder.id, {
                  onSuccess: () => router.replace(listHref),
                })
              }
              disabled={removeReminder.isPending}
              accessibilityRole="button"
              accessibilityLabel="Confirm delete reminder"
            >
              <Text style={styles.dangerText}>
                {removeReminder.isPending ? 'Deleting…' : 'Yes, delete reminder'}
              </Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
              onPress={() => setConfirmingDelete(false)}
              disabled={removeReminder.isPending}
              accessibilityRole="button"
            >
              <Text style={styles.cancelText}>Keep it</Text>
            </Pressable>
          </>
        ) : (
          <Pressable
            style={({ pressed }) => [styles.delete, pressed && styles.pressed]}
            onPress={() => setConfirmingDelete(true)}
            accessibilityRole="button"
            accessibilityLabel="Delete this reminder"
          >
            <Text style={styles.deleteText}>Delete this reminder</Text>
          </Pressable>
        )}
      </View>
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
    paddingBottom: 4,
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
  subtitle: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    color: '#555',
    fontSize: 13,
  },
  muted: {
    color: '#555',
    fontSize: 13,
    textAlign: 'center',
  },
  errorTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#c0392b',
    textAlign: 'center',
  },
  errorText: {
    marginBottom: 8,
    color: '#c0392b',
    fontSize: 13,
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
  deleteSection: {
    padding: 20,
    gap: 8,
  },
  delete: {
    borderWidth: 1,
    borderColor: '#c0392b',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteText: {
    color: '#c0392b',
    fontSize: 15,
    fontWeight: '600',
  },
  deleteQuestion: {
    fontSize: 14,
    color: '#333',
  },
  danger: {
    backgroundColor: '#c0392b',
    paddingVertical: 13,
    borderRadius: 8,
    alignItems: 'center',
  },
  dangerText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  cancel: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelText: {
    color: '#1f6feb',
    fontSize: 15,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.7,
  },
});
