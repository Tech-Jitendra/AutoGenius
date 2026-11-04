import { useState } from 'react';
import {
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { completeMaintenanceReminderSchema } from '@autogenius/validation';
import { ApiError } from '../../../../lib/api/client';
import { validateForm, type FieldErrors } from '../../../../auth/form-validation';
import { useVehicle } from '../../../../vehicles/vehicle-queries';
import {
  useReminderPages,
  useServiceHistoryWriter,
} from '../../../../service-history/service-history-queries';
import {
  ALERT_LABELS,
  dueLabel,
  kmLabel,
  lastCompletedLabel,
  recurrenceLabel,
  REMINDER_STATUS_LABELS,
} from '../../../../service-history/labels';
import { todayIsoDate } from '../../../../service-history/service-record-form';
import { groupReminders } from '../../../../service-history/reminder-groups';
import type { MaintenanceReminderDto } from '../../../../service-history/types';

export default function MaintenanceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: vehicle } = useVehicle(id);
  const {
    data,
    isPending,
    isError,
    error,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useReminderPages(id);
  const { dismissReminder, completeReminder } = useServiceHistoryWriter(id);

  const [panel, setPanel] = useState<{ reminderId: string; mode: 'complete' | 'dismiss' } | null>(
    null,
  );
  const [completionDate, setCompletionDate] = useState(todayIsoDate());
  const [completionOdometer, setCompletionOdometer] = useState('');
  const [completionErrors, setCompletionErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<string | null>(null);

  if (isPending) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Loading maintenance…</Text>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Could not load maintenance</Text>
        <Text style={styles.muted}>
          {error instanceof ApiError ? error.message : 'Please check your connection.'}
        </Text>
        <Pressable style={styles.retry} onPress={() => void refetch()} accessibilityRole="button">
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  const reminders = data?.pages.flatMap((page) => page.items) ?? [];

  const openPanel = (reminder: MaintenanceReminderDto, mode: 'complete' | 'dismiss') => {
    setNotice(null);
    setCompletionErrors({});
    setCompletionDate(todayIsoDate());
    setCompletionOdometer(
      reminder.lastCompletedOdometerKm !== null
        ? String(reminder.lastCompletedOdometerKm)
        : vehicle?.currentOdometer === null || vehicle?.currentOdometer === undefined
          ? ''
          : String(vehicle.currentOdometer),
    );
    setPanel({ reminderId: reminder.id, mode });
  };

  const confirmComplete = (reminder: MaintenanceReminderDto) => {
    const result = validateForm(completeMaintenanceReminderSchema, {
      completionDate,
      completionOdometerKm: completionOdometer,
    });
    if (!result.success) {
      setCompletionErrors(result.errors);
      return;
    }
    setCompletionErrors({});

    completeReminder.mutate(
      { reminderId: reminder.id, input: result.values },
      {
        onSuccess: (updated) => {
          setPanel(null);
          setNotice(
            updated.status === 'ACTIVE'
              ? `Completed. ${dueLabel(updated)}.`
              : 'Completed. It was a one-time reminder, so nothing further is due.',
          );
        },
      },
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityRole="button">
          <Text style={styles.back}>Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Maintenance</Text>
        <Pressable
          style={({ pressed }) => [styles.add, pressed && styles.pressed]}
          onPress={() =>
            router.push({ pathname: '/maintenance/add', params: { vehicleId: id } })
          }
          accessibilityRole="button"
          accessibilityLabel="Add reminder"
        >
          <Text style={styles.addText}>Add reminder</Text>
        </Pressable>
      </View>

      {reminders.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No reminders yet</Text>
          <Text style={styles.muted}>
            Add the maintenance this vehicle still needs — an oil change by a date, or tyres by an
            odometer reading — and AutoGenius tracks when it becomes due.
          </Text>
        </View>
      ) : (
        <SectionList
          sections={groupReminders(reminders)}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />
          }
          onEndReached={() => void fetchNextPage()}
          onEndReachedThreshold={0.4}
          ListHeaderComponent={
            notice ? <Text style={styles.notice}>{notice}</Text> : null
          }
          ListFooterComponent={
            isFetchingNextPage ? (
              <Text style={styles.muted}>Loading more reminders…</Text>
            ) : hasNextPage ? null : (
              <Text style={styles.muted}>
                {reminders.length} reminder(s) on this vehicle.
              </Text>
            )
          }
          renderItem={({ item: reminder }) => (
            <ReminderRow
              reminder={reminder}
              open={panel?.reminderId === reminder.id}
              panelMode={panel?.mode ?? null}
              completionDate={completionDate}
              completionOdometer={completionOdometer}
              completionErrors={completionErrors}
              onCompleteDraft={setCompletionDate}
              onCompletionOdometer={setCompletionOdometer}
              busy={completeReminder.isPending || dismissReminder.isPending}
              errorMessage={
                completeReminder.error instanceof ApiError
                  ? completeReminder.error.message
                  : dismissReminder.error instanceof ApiError
                    ? dismissReminder.error.message
                    : null
              }
              onOpenPanel={(mode) => openPanel(reminder, mode)}
              onClosePanel={() => setPanel(null)}
              onConfirmComplete={() => confirmComplete(reminder)}
              onConfirmDismiss={() =>
                dismissReminder.mutate(reminder.id, {
                  onSuccess: (updated) => {
                    setPanel(null);
                    setNotice(`${updated.title} is dismissed. Its due values were left untouched.`);
                  },
                })
              }
              onEdit={() =>
                router.push({
                  pathname: '/maintenance/[reminderId]/edit',
                  params: { reminderId: reminder.id, vehicleId: id },
                })
              }
            />
          )}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionTitle}>{section.title}</Text>
          )}
        />
      )}
    </View>
  );
}

function ReminderRow({
  reminder,
  open,
  panelMode,
  completionDate,
  completionOdometer,
  completionErrors,
  onCompleteDraft,
  onCompletionOdometer,
  busy,
  errorMessage,
  onOpenPanel,
  onClosePanel,
  onConfirmComplete,
  onConfirmDismiss,
  onEdit,
}: {
  reminder: MaintenanceReminderDto;
  open: boolean;
  panelMode: 'complete' | 'dismiss' | null;
  completionDate: string;
  completionOdometer: string;
  completionErrors: FieldErrors;
  onCompleteDraft: (value: string) => void;
  onCompletionOdometer: (value: string) => void;
  busy: boolean;
  errorMessage: string | null;
  onOpenPanel: (mode: 'complete' | 'dismiss') => void;
  onClosePanel: () => void;
  onConfirmComplete: () => void;
  onConfirmDismiss: () => void;
  onEdit: () => void;
}) {
  const closed = reminder.status !== 'ACTIVE';
  const badge = closed
    ? REMINDER_STATUS_LABELS[reminder.status]
    : ALERT_LABELS[reminder.alertStatus ?? 'SCHEDULED'];

  return (
    <View style={styles.row}>
      <Text style={styles.rowTitle}>{reminder.title}</Text>
      <Text style={styles.badge}>{badge}</Text>
      <Text style={styles.muted}>{dueLabel(reminder)}</Text>
      <Text style={styles.muted}>{lastCompletedLabel(reminder)}</Text>
      {reminder.description ? <Text style={styles.description}>{reminder.description}</Text> : null}

      {!closed && (
        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.complete, pressed && styles.pressed]}
            onPress={() => onOpenPanel('complete')}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={`Mark ${reminder.title} completed`}
          >
            <Text style={styles.completeText}>Complete</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.ghost, pressed && styles.pressed]}
            onPress={() => onOpenPanel('dismiss')}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={`Dismiss ${reminder.title}`}
          >
            <Text style={styles.ghostText}>Dismiss</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.ghost, pressed && styles.pressed]}
            onPress={onEdit}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${reminder.title}`}
          >
            <Text style={styles.ghostText}>Edit</Text>
          </Pressable>
        </View>
      )}

      {closed && (
        <Pressable
          style={({ pressed }) => [styles.ghost, pressed && styles.pressed]}
          onPress={onEdit}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${reminder.title}`}
        >
          <Text style={styles.ghostText}>Edit</Text>
        </Pressable>
      )}

      {open && panelMode === 'complete' && (
        <View style={styles.panel}>
          <Text style={styles.hint}>{recurrenceLabel(reminder)}</Text>
          <Text style={styles.panelLabel}>Completion date</Text>
          <TextInput
            style={styles.input}
            value={completionDate}
            onChangeText={onCompleteDraft}
            placeholder="YYYY-MM-DD"
            autoCapitalize="none"
            accessibilityLabel="Completion date"
          />
          {completionErrors['completionDate'] ? (
            <Text style={styles.errorText}>{completionErrors['completionDate']}</Text>
          ) : null}
          <Text style={styles.panelLabel}>Current odometer in km</Text>
          <TextInput
            style={styles.input}
            value={completionOdometer}
            onChangeText={onCompletionOdometer}
            placeholder="42000"
            keyboardType="number-pad"
            accessibilityLabel="Completion odometer"
          />
          {completionErrors['completionOdometerKm'] ? (
            <Text style={styles.errorText}>{completionErrors['completionOdometerKm']}</Text>
          ) : null}
          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
          <Pressable
            style={({ pressed }) => [styles.complete, pressed && styles.pressed]}
            onPress={onConfirmComplete}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Confirm completion"
          >
            <Text style={styles.completeText}>{busy ? 'Saving…' : 'Confirm completion'}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
            onPress={onClosePanel}
            accessibilityRole="button"
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      )}

      {open && panelMode === 'dismiss' && (
        <View style={styles.panel}>
          <Text style={styles.hint}>
            Dismissing takes {reminder.title} off your active list. It keeps its due date of{' '}
            {reminder.dueDate ?? 'none'} and due odometer of {kmLabel(reminder.dueOdometerKm)}, and
            it does not write a service record.
          </Text>
          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
          <Pressable
            style={({ pressed }) => [styles.danger, pressed && styles.pressed]}
            onPress={onConfirmDismiss}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Confirm dismiss"
          >
            <Text style={styles.dangerText}>{busy ? 'Saving…' : 'Yes, dismiss reminder'}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
            onPress={onClosePanel}
            accessibilityRole="button"
          >
            <Text style={styles.cancelText}>Keep reminder</Text>
          </Pressable>
        </View>
      )}
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
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    gap: 8,
  },
  back: {
    color: '#1f6feb',
    fontSize: 15,
    fontWeight: '600',
  },
  headerTitle: {
    flexShrink: 1,
    fontSize: 18,
    fontWeight: '700',
  },
  add: {
    backgroundColor: '#1f6feb',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
  },
  addText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.7,
  },
  listContent: {
    paddingBottom: 32,
  },
  sectionTitle: {
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 16,
    fontSize: 13,
    fontWeight: '700',
    color: '#555',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  notice: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#e7f6ec',
    color: '#1e7d34',
    fontSize: 13,
  },
  row: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e6e8ee',
    gap: 4,
  },
  rowTitle: {
    fontSize: 16,
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
    fontSize: 13,
    color: '#333',
  },
  muted: {
    color: '#555',
    fontSize: 13,
  },
  actions: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  complete: {
    backgroundColor: '#1f6feb',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
  },
  completeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  ghost: {
    borderWidth: 1,
    borderColor: '#1f6feb',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  ghostText: {
    color: '#1f6feb',
    fontSize: 13,
    fontWeight: '600',
  },
  danger: {
    backgroundColor: '#c0392b',
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: 'center',
  },
  dangerText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  cancel: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  cancelText: {
    color: '#1f6feb',
    fontSize: 14,
    fontWeight: '600',
  },
  panel: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e6e8ee',
    gap: 6,
  },
  panelLabel: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  hint: {
    marginBottom: 6,
    color: '#555',
    fontSize: 12,
  },
  errorText: {
    marginTop: 6,
    color: '#c0392b',
    fontSize: 13,
  },
  empty: {
    alignItems: 'center',
    padding: 32,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#c0392b',
  },
  retry: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#1f6feb',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryText: {
    color: '#1f6feb',
    fontWeight: '600',
  },
});
