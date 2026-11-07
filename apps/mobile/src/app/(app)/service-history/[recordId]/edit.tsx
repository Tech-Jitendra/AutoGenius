import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type { CreateServiceRecordInput } from '@autogenius/validation';
import { ApiError } from '../../../../lib/api/client';
import { KeyboardAvoiding } from '../../../../lib/keyboard-avoiding';
import {
  recordToFormValues,
  ServiceRecordForm,
  toUpdateRecordInput,
} from '../../../../service-history/service-record-form';
import {
  useServiceHistoryWriter,
  useServiceRecord,
} from '../../../../service-history/service-history-queries';

export default function EditServiceRecordScreen() {
  const { recordId, vehicleId } = useLocalSearchParams<{
    recordId: string;
    vehicleId: string;
  }>();
  const { data: record, isPending, isError, error } = useServiceRecord(vehicleId, recordId);
  const { updateRecord, removeRecord } = useServiceHistoryWriter(vehicleId);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const historyHref = { pathname: '/vehicles/[id]/service-history', params: { id: vehicleId } } as const;

  if (isPending) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Loading visit…</Text>
      </View>
    );
  }

  if (isError || !record) {
    const missing = error instanceof ApiError && error.status === 404;
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>
          {missing ? 'This visit is no longer in your history' : 'Could not load this visit'}
        </Text>
        <Text style={styles.muted}>
          {missing
            ? 'It may have been deleted, or it belongs to another vehicle.'
            : error instanceof ApiError
              ? error.message
              : 'Please check your connection.'}
        </Text>
        <Pressable style={styles.secondary} onPress={() => router.replace(historyHref)} accessibilityRole="button">
          <Text style={styles.secondaryText}>Back to history</Text>
        </Pressable>
      </View>
    );
  }

  const onSubmit = (values: CreateServiceRecordInput) => {
    updateRecord.mutate(
      { recordId: record.id, input: toUpdateRecordInput(values) },
      { onSuccess: () => router.back() },
    );
  };

  const deleteError =
    removeRecord.error instanceof ApiError ? removeRecord.error.message : null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityRole="button">
          <Text style={styles.back}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Edit visit</Text>
      </View>

      <KeyboardAvoiding>
        <ServiceRecordForm
          key={record.id}
          initial={recordToFormValues(record)}
          submitLabel="Save changes"
          pending={updateRecord.isPending}
          serverError={
            updateRecord.error instanceof ApiError ? updateRecord.error.message : null
          }
          onSubmit={onSubmit}
        />
      </KeyboardAvoiding>

      <View style={styles.deleteSection}>
        {confirmingDelete ? (
          <>
            <Text style={styles.deleteQuestion}>
              Delete this service record? The visit disappears from your history and your
              expenditure total.
            </Text>
            {deleteError ? <Text style={styles.errorText}>{deleteError}</Text> : null}
            <Pressable
              style={({ pressed }) => [styles.danger, (pressed || removeRecord.isPending) && styles.pressed]}
              onPress={() =>
                removeRecord.mutate(record.id, {
                  onSuccess: () => router.replace(historyHref),
                })
              }
              disabled={removeRecord.isPending}
              accessibilityRole="button"
              accessibilityLabel="Confirm delete visit"
            >
              <Text style={styles.dangerText}>
                {removeRecord.isPending ? 'Deleting…' : 'Yes, delete this visit'}
              </Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
              onPress={() => setConfirmingDelete(false)}
              disabled={removeRecord.isPending}
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
            accessibilityLabel="Delete this visit"
          >
            <Text style={styles.deleteText}>Delete this visit</Text>
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
