import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { completeMaintenanceReminderSchema } from '@autogenius/validation';
import { ApiError } from '../lib/api/client';
import { validateForm, type FieldErrors } from '../auth/form-validation';
import { useServiceHistoryWriter } from './service-history-queries';
import { dueLabel, kmLabel, recurrenceLabel } from './labels';
import { todayIsoDate } from './service-record-form';
import type { MaintenanceReminderDto } from './types';

type Panel = 'complete' | 'dismiss' | 'reopen' | 'delete';

interface ReminderActionsProps {
  vehicleId: string;
  reminder: MaintenanceReminderDto;
  /**
   * The vehicle's live reading, which seeds the completion box: the API refuses
   * a reading below the highest one it has already seen.
   */
  currentOdometer: number | null | undefined;
  onEdit: () => void;
  /** Shown after a completed action so the caller can report it in its own place. */
  onNotice?: (message: string) => void;
  /** Called after a delete; the list screen leaves it out and lets the row go. */
  onDeleted?: () => void;
}

/**
 * Complete, dismiss, reopen, edit and delete for one reminder, with the
 * confirmation panels the answers need. The maintenance list and the reminder
 * detail screen render the same actions, so both go through here: one set of
 * words, one set of mutations, one set of query invalidations.
 */
export function ReminderActions({
  vehicleId,
  reminder,
  currentOdometer,
  onEdit,
  onNotice,
  onDeleted,
}: ReminderActionsProps) {
  const { completeReminder, dismissReminder, reopenReminder, removeReminder } =
    useServiceHistoryWriter(vehicleId);

  const [panel, setPanel] = useState<Panel | null>(null);
  const [completionDate, setCompletionDate] = useState(todayIsoDate());
  const [completionOdometer, setCompletionOdometer] = useState('');
  const [completionErrors, setCompletionErrors] = useState<FieldErrors>({});

  const closed = reminder.status !== 'ACTIVE';
  const busy =
    completeReminder.isPending ||
    dismissReminder.isPending ||
    reopenReminder.isPending ||
    removeReminder.isPending;

  const messageFor = (mutation: { error: unknown }): string | null =>
    mutation.error instanceof ApiError ? mutation.error.message : null;

  const errorMessage =
    panel === 'complete'
      ? messageFor(completeReminder)
      : panel === 'dismiss'
        ? messageFor(dismissReminder)
        : panel === 'reopen'
          ? messageFor(reopenReminder)
          : messageFor(removeReminder);

  const openPanel = (mode: Panel) => {
    setCompletionErrors({});
    setCompletionDate(todayIsoDate());
    const knownReadings = [currentOdometer, reminder.lastCompletedOdometerKm].filter(
      (reading): reading is number => typeof reading === 'number',
    );
    setCompletionOdometer(knownReadings.length === 0 ? '' : String(Math.max(...knownReadings)));
    setPanel(mode);
  };

  const closePanel = () => setPanel(null);

  const confirmComplete = () => {
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
          closePanel();
          onNotice?.(
            updated.status === 'ACTIVE'
              ? `Completed. ${dueLabel(updated)}.`
              : 'Completed. It was a one-time reminder, so nothing further is due.',
          );
        },
      },
    );
  };

  const confirmDismiss = () => {
    dismissReminder.mutate(reminder.id, {
      onSuccess: (updated) => {
        closePanel();
        onNotice?.(`${updated.title} is dismissed. Its due values were left untouched.`);
      },
    });
  };

  const confirmReopen = () => {
    reopenReminder.mutate(reminder.id, {
      onSuccess: (updated) => {
        closePanel();
        onNotice?.(
          `${updated.title} is active again with the due values it was closed with. ` +
          `${dueLabel(updated)}.`,
        );
      },
    });
  };

  const confirmDelete = () => {
    removeReminder.mutate(reminder.id, {
      onSuccess: () => {
        closePanel();
        onNotice?.(`${reminder.title} is deleted.`);
        onDeleted?.();
      },
    });
  };

  return (
    <View style={styles.actionBlock}>
      <View style={styles.actions}>
        {!closed && (
          <>
            <Pressable
              style={({ pressed }) => [styles.complete, pressed && styles.pressed]}
              onPress={() => openPanel('complete')}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={`Mark ${reminder.title} completed`}
            >
              <Text style={styles.completeText}>Complete</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.ghost, pressed && styles.pressed]}
              onPress={() => openPanel('dismiss')}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={`Dismiss ${reminder.title}`}
            >
              <Text style={styles.ghostText}>Dismiss</Text>
            </Pressable>
          </>
        )}

        {closed && (
          <Pressable
            style={({ pressed }) => [styles.complete, pressed && styles.pressed]}
            onPress={() => openPanel('reopen')}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={`Reopen ${reminder.title}`}
          >
            <Text style={styles.completeText}>Reopen</Text>
          </Pressable>
        )}

        <Pressable
          style={({ pressed }) => [styles.ghost, pressed && styles.pressed]}
          onPress={onEdit}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${reminder.title}`}
        >
          <Text style={styles.ghostText}>Edit</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.delete, pressed && styles.pressed]}
          onPress={() => openPanel('delete')}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={`Delete ${reminder.title}`}
        >
          <Text style={styles.deleteText}>Delete</Text>
        </Pressable>
      </View>

      {panel === 'complete' && (
        <View style={styles.panel}>
          <Text style={styles.hint}>{recurrenceLabel(reminder)}</Text>
          <Text style={styles.panelLabel}>Completion date</Text>
          <TextInput
            style={styles.input}
            value={completionDate}
            onChangeText={setCompletionDate}
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
            onChangeText={setCompletionOdometer}
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
            onPress={confirmComplete}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Confirm completion"
          >
            <Text style={styles.completeText}>{busy ? 'Saving…' : 'Confirm completion'}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
            onPress={closePanel}
            accessibilityRole="button"
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      )}

      {panel === 'dismiss' && (
        <View style={styles.panel}>
          <Text style={styles.hint}>
            Dismissing takes {reminder.title} off your active list. It keeps its due date of{' '}
            {reminder.dueDate ?? 'none'} and due odometer of {kmLabel(reminder.dueOdometerKm)}, and
            it does not write a service record.
          </Text>
          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
          <Pressable
            style={({ pressed }) => [styles.danger, pressed && styles.pressed]}
            onPress={confirmDismiss}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Confirm dismiss"
          >
            <Text style={styles.dangerText}>{busy ? 'Saving…' : 'Yes, dismiss reminder'}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
            onPress={closePanel}
            accessibilityRole="button"
          >
            <Text style={styles.cancelText}>Keep reminder</Text>
          </Pressable>
        </View>
      )}

      {panel === 'reopen' && (
        <View style={styles.panel}>
          <Text style={styles.hint}>
            Reopening puts {reminder.title} back on your active list. AutoGenius keeps its due date
            of {reminder.dueDate ?? 'none'} and due odometer of{' '}
            {kmLabel(reminder.dueOdometerKm)} exactly as they were — it does not roll the schedule
            forward, so a due condition that passed while the reminder was closed comes back
            overdue.
          </Text>
          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
          <Pressable
            style={({ pressed }) => [styles.complete, (pressed || busy) && styles.pressed]}
            onPress={confirmReopen}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Confirm reopen"
          >
            <Text style={styles.completeText}>{busy ? 'Saving…' : 'Yes, reopen reminder'}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
            onPress={closePanel}
            accessibilityRole="button"
          >
            <Text style={styles.cancelText}>Leave it closed</Text>
          </Pressable>
        </View>
      )}

      {panel === 'delete' && (
        <View style={styles.panel}>
          <Text style={styles.hint}>
            Delete this reminder? Its due date and completion history go with it. Completions
            already recorded as service visits stay in your history.
          </Text>
          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
          <Pressable
            style={({ pressed }) => [styles.danger, (pressed || busy) && styles.pressed]}
            onPress={confirmDelete}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Confirm delete reminder"
          >
            <Text style={styles.dangerText}>{busy ? 'Deleting…' : 'Yes, delete reminder'}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
            onPress={closePanel}
            accessibilityRole="button"
          >
            <Text style={styles.cancelText}>Keep it</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  actionBlock: {
    gap: 6,
  },
  actions: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pressed: {
    opacity: 0.7,
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
  delete: {
    borderWidth: 1,
    borderColor: '#c0392b',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  deleteText: {
    color: '#c0392b',
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
});
