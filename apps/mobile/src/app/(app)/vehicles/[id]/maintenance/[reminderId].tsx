import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ApiError } from '../../../../../lib/api/client';
import { KeyboardAvoiding } from '../../../../../lib/keyboard-avoiding';
import { useVehicle } from '../../../../../vehicles/vehicle-queries';
import {
  useMaintenanceReminder,
} from '../../../../../service-history/service-history-queries';
import { ReminderActions } from '../../../../../service-history/reminder-actions';
import {
  ALERT_LABELS,
  kmLabel,
  lastCompletedLabel,
  recurrenceLabel,
  REMINDER_STATUS_LABELS,
} from '../../../../../service-history/labels';
import type { MaintenanceReminderDto } from '../../../../../service-history/types';

export default function MaintenanceReminderDetailScreen() {
  const { id, reminderId } = useLocalSearchParams<{ id: string; reminderId: string }>();
  const { data: vehicle } = useVehicle(id);
  const { data: reminder, isPending, isError, error } = useMaintenanceReminder(id, reminderId);
  const [notice, setNotice] = useState<string | null>(null);

  const listHref = { pathname: '/vehicles/[id]/maintenance', params: { id } } as const;

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
        <Pressable
          style={styles.secondary}
          onPress={() => router.replace(listHref)}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryText}>Back to maintenance</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityRole="button">
          <Text style={styles.back}>Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Reminder</Text>
      </View>

      <KeyboardAvoiding>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>{reminder.title}</Text>
          <Text style={styles.badge}>{statusLabel(reminder)}</Text>
          {reminder.description ? (
            <Text style={styles.description}>{reminder.description}</Text>
          ) : null}

          {notice ? <Text style={styles.notice}>{notice}</Text> : null}

          <View style={styles.card}>
            <Detail label="Due date">{reminder.dueDate ?? 'Not dated'}</Detail>
            <Detail label="Due odometer">{kmLabel(reminder.dueOdometerKm)}</Detail>
            <Detail label="Repeats">{recurrenceLabel(reminder)}</Detail>
            <Detail label="Last completed">{lastCompletedLabel(reminder)}</Detail>
            <Detail label="Status">{REMINDER_STATUS_LABELS[reminder.status]}</Detail>
            <Detail label="Alert">
              {reminder.alertStatus === null
                ? 'Nothing — it is not being tracked'
                : ALERT_LABELS[reminder.alertStatus]}
            </Detail>
            <Detail label="Vehicle odometer">{kmLabel(vehicle?.currentOdometer)}</Detail>
          </View>

          <ReminderActions
            vehicleId={id}
            reminder={reminder}
            currentOdometer={vehicle?.currentOdometer}
            onNotice={setNotice}
            onDeleted={() => router.replace(listHref)}
            onEdit={() =>
              router.push({
                pathname: '/maintenance/[reminderId]/edit',
                params: { reminderId: reminder.id, vehicleId: id },
              })
            }
          />
        </ScrollView>
      </KeyboardAvoiding>
    </View>
  );
}

function statusLabel(reminder: MaintenanceReminderDto): string {
  if (reminder.status !== 'ACTIVE') return REMINDER_STATUS_LABELS[reminder.status];
  return `Active · ${ALERT_LABELS[reminder.alertStatus ?? 'SCHEDULED']}`;
}

function Detail({ label, children }: { label: string; children: string }) {
  return (
    <View style={styles.detail}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{children}</Text>
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    padding: 20,
    paddingBottom: 48,
    gap: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  badge: {
    alignSelf: 'flex-start',
    fontSize: 12,
    fontWeight: '600',
    color: '#1f6feb',
    backgroundColor: '#eaf2ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: 'hidden',
  },
  description: {
    fontSize: 14,
    color: '#333',
  },
  notice: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#e7f6ec',
    color: '#1e7d34',
    fontSize: 13,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e6e8ee',
    padding: 16,
    gap: 12,
    marginVertical: 4,
  },
  detail: {
    gap: 2,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#555',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  detailValue: {
    fontSize: 15,
    color: '#222',
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
