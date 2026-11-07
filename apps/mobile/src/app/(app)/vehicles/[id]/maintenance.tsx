import { useState } from 'react';
import { Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ApiError } from '../../../../lib/api/client';
import { KeyboardAvoiding } from '../../../../lib/keyboard-avoiding';
import { useVehicle } from '../../../../vehicles/vehicle-queries';
import { useReminderPages } from '../../../../service-history/service-history-queries';
import { ReminderActions } from '../../../../service-history/reminder-actions';
import {
  ALERT_LABELS,
  dueLabel,
  lastCompletedLabel,
  REMINDER_STATUS_LABELS,
} from '../../../../service-history/labels';
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
        <KeyboardAvoiding>
          <SectionList
            sections={groupReminders(reminders)}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />
            }
            onEndReached={() => void fetchNextPage()}
            onEndReachedThreshold={0.4}
            ListHeaderComponent={notice ? <Text style={styles.notice}>{notice}</Text> : null}
            ListFooterComponent={
              isFetchingNextPage ? (
                <Text style={styles.muted}>Loading more reminders…</Text>
              ) : hasNextPage ? null : (
                <Text style={styles.muted}>{reminders.length} reminder(s) on this vehicle.</Text>
              )
            }
            renderItem={({ item: reminder }) => (
              <ReminderRow
                vehicleId={id}
                reminder={reminder}
                currentOdometer={vehicle?.currentOdometer}
                onNotice={setNotice}
              />
            )}
            renderSectionHeader={({ section }) => (
              <Text style={styles.sectionTitle}>{section.title}</Text>
            )}
          />
        </KeyboardAvoiding>
      )}
    </View>
  );
}

function ReminderRow({
  vehicleId,
  reminder,
  currentOdometer,
  onNotice,
}: {
  vehicleId: string;
  reminder: MaintenanceReminderDto;
  currentOdometer: number | null | undefined;
  onNotice: (message: string) => void;
}) {
  const closed = reminder.status !== 'ACTIVE';
  const badge = closed
    ? REMINDER_STATUS_LABELS[reminder.status]
    : ALERT_LABELS[reminder.alertStatus ?? 'SCHEDULED'];

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() =>
          router.push({
            pathname: '/vehicles/[id]/maintenance/[reminderId]',
            params: { reminderId: reminder.id, vehicleId },
          })
        }
        accessibilityRole="button"
        accessibilityLabel={`Open ${reminder.title} details`}
      >
        <Text style={styles.rowTitle}>{reminder.title}</Text>
      </Pressable>
      <Text style={styles.badge}>{badge}</Text>
      <Text style={styles.muted}>{dueLabel(reminder)}</Text>
      <Text style={styles.muted}>{lastCompletedLabel(reminder)}</Text>
      {reminder.description ? (
        <Text style={styles.description}>{reminder.description}</Text>
      ) : null}

      <ReminderActions
        vehicleId={vehicleId}
        reminder={reminder}
        currentOdometer={currentOdometer}
        onNotice={onNotice}
        onEdit={() =>
          router.push({
            pathname: '/maintenance/[reminderId]/edit',
            params: { reminderId: reminder.id, vehicleId },
          })
        }
      />
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
