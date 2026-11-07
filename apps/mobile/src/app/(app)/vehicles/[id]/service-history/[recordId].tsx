import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ApiError } from '../../../../../lib/api/client';
import { useVehicle } from '../../../../../vehicles/vehicle-queries';
import {
  useServiceHistoryWriter,
  useServiceRecord,
} from '../../../../../service-history/service-history-queries';
import {
  costLabel,
  kmLabel,
  serviceTypeLabel,
} from '../../../../../service-history/labels';
import type { ReplacedPart } from '@autogenius/types';

export default function ServiceRecordDetailScreen() {
  const { id, recordId } = useLocalSearchParams<{ id: string; recordId: string }>();
  const { data: vehicle } = useVehicle(id);
  const { data: record, isPending, isError, error } = useServiceRecord(id, recordId);
  const { removeRecord } = useServiceHistoryWriter(id);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const historyHref = {
    pathname: '/vehicles/[id]/service-history',
    params: { id },
  } as const;

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
        <Pressable
          style={styles.secondary}
          onPress={() => router.replace(historyHref)}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryText}>Back to history</Text>
        </Pressable>
      </View>
    );
  }

  const deleteError = removeRecord.error instanceof ApiError ? removeRecord.error.message : null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityRole="button">
          <Text style={styles.back}>Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Service visit</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{record.serviceDate}</Text>
        <Text style={styles.subtitle}>
          {serviceTypeLabel(record)}
          {vehicle ? ` · ${vehicle.model}` : ''}
        </Text>

        <View style={styles.card}>
          <Detail label="Service date">{record.serviceDate}</Detail>
          <Detail label="Type of service">{serviceTypeLabel(record)}</Detail>
          <Detail label="Workshop">{record.workshopName ?? 'Not saved'}</Detail>
          <Detail label="Odometer">{kmLabel(record.odometerKm)}</Detail>
          <Detail label="Work performed">{record.description ?? 'Nothing noted'}</Detail>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Parts replaced</Text>
          {record.partsReplaced.length === 0 ? (
            <Text style={styles.detailValue}>None listed</Text>
          ) : (
            record.partsReplaced.map((part, index) => (
              <Text key={index} style={styles.part}>
                {partLabel(part)}
              </Text>
            ))
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Bill</Text>
          <Detail label="Labour">{costLabel(record.labourCost)}</Detail>
          <Detail label="Parts">{costLabel(record.partsCost)}</Detail>
          <Detail label="Other">{costLabel(record.otherCost)}</Detail>
          <Text style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total for this visit</Text>
            <Text style={styles.totalValue}>{costLabel(record.totalCost)}</Text>
          </Text>
        </View>

        <View style={styles.card}>
          <Detail label="Notes">{record.notes ?? 'Nothing noted'}</Detail>
        </View>

        <Pressable
          style={({ pressed }) => [styles.edit, pressed && styles.pressed]}
          onPress={() =>
            router.push({
              pathname: '/service-history/[recordId]/edit',
              params: { recordId: record.id, vehicleId: id },
            })
          }
          accessibilityRole="button"
          accessibilityLabel="Edit this visit"
        >
          <Text style={styles.editText}>Edit this visit</Text>
        </Pressable>

        {confirmingDelete ? (
          <View style={styles.deletePanel}>
            <Text style={styles.deleteQuestion}>
              Delete this service record? The visit disappears from your history and your
              expenditure total.
            </Text>
            {deleteError ? <Text style={styles.errorText}>{deleteError}</Text> : null}
            <Pressable
              style={({ pressed }) => [
                styles.danger,
                (pressed || removeRecord.isPending) && styles.pressed,
              ]}
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
          </View>
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
      </ScrollView>
    </View>
  );
}

function partLabel(part: ReplacedPart): string {
  return [
    part.name,
    part.quantity === null ? null : `×${part.quantity}`,
    part.cost === null ? null : costLabel(part.cost),
  ]
    .filter(Boolean)
    .join(' · ');
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
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    color: '#555',
    fontSize: 14,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e6e8ee',
    padding: 16,
    gap: 12,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#555',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
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
  part: {
    fontSize: 15,
    color: '#222',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e6e8ee',
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  totalValue: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1f6feb',
  },
  edit: {
    backgroundColor: '#1f6feb',
    paddingVertical: 13,
    borderRadius: 8,
    alignItems: 'center',
  },
  editText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
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
  deletePanel: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f2c7c1',
    backgroundColor: '#fdf1ef',
    gap: 10,
  },
  deleteQuestion: {
    fontSize: 14,
    color: '#333',
  },
  errorText: {
    color: '#c0392b',
    fontSize: 13,
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
    paddingVertical: 6,
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
});
