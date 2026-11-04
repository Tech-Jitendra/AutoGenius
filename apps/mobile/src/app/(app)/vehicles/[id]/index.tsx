import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ApiError } from '../../../../lib/api/client';
import {
  odometerLabel,
  purchaseDateLabel,
  vehicleName,
} from '../../../../vehicles/labels';
import { useVehicle, useVehicleWriter } from '../../../../vehicles/vehicle-queries';
import {
  useMaintenanceSummary,
  useReminderPages,
} from '../../../../service-history/service-history-queries';
import { groupReminders } from '../../../../service-history/reminder-groups';
import { costLabel, dueLabel, summaryLine } from '../../../../service-history/labels';

export default function VehicleDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: vehicle, isPending, isError, error } = useVehicle(id);
  const { setDefault } = useVehicleWriter();
  // Both read the same caches the upkeep screens use, so this card costs no
  // second request when the user walks on to either of them.
  const { data: summary } = useMaintenanceSummary(id);
  const { data: reminderPages } = useReminderPages(id);

  if (isPending) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Loading vehicle…</Text>
      </View>
    );
  }

  if (isError || !vehicle) {
    const missing = error instanceof ApiError && error.status === 404;
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>
          {missing ? 'Vehicle not found' : 'Could not load this vehicle'}
        </Text>
        <Text style={styles.muted}>
          {missing
            ? 'It may have been deleted, or it belongs to another account.'
            : error instanceof ApiError
              ? error.message
              : 'Please check your connection.'}
        </Text>
        <Pressable style={styles.secondary} onPress={() => router.replace('/vehicles')}>
          <Text style={styles.secondaryText}>Back to vehicles</Text>
        </Pressable>
      </View>
    );
  }

  const reminders = reminderPages?.pages.flatMap((page) => page.items) ?? [];
  const nextDue = groupReminders(reminders)[0]?.data[0] ?? null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable onPress={() => router.back()} accessibilityRole="button">
        <Text style={styles.back}>Back</Text>
      </Pressable>

      <Text style={styles.title}>{vehicleName(vehicle)}</Text>
      {vehicle.isDefault ? <Text style={styles.badge}>Default vehicle</Text> : null}

      <View style={styles.card}>
        <Row label="Registration number" value={vehicle.registrationNumber ?? 'Not saved'} />
        <Row label="Manufacturing year" value={String(vehicle.manufacturingYear)} />
        <Row label="Fuel type" value={vehicle.fuelType} />
        <Row label="Transmission" value={vehicle.transmission} />
        <Row label="Purchase date" value={purchaseDateLabel(vehicle)} />
        <Row label="Odometer" value={odometerLabel(vehicle)} />
        <Row
          label="Added on"
          value={new Date(vehicle.createdAt).toLocaleDateString('en-IN')}
        />
      </View>

      <Text style={styles.sectionTitle}>Service history</Text>
      <View style={styles.card}>
        <Row
          label="Last service"
          value={summary ? summaryLine(summary) : 'Loading upkeep…'}
        />
        <Row
          label="Total spent on upkeep"
          value={summary ? costLabel(summary.totalExpenditure) : '—'}
        />
      </View>

      <Text style={styles.sectionTitle}>Maintenance</Text>
      <View style={styles.card}>
        <Row
          label="Overdue"
          value={summary ? `${summary.overdueReminders}` : '—'}
        />
        <Row
          label="Upcoming"
          value={summary ? `${summary.upcomingReminders}` : '—'}
        />
        <Row
          label="Next due"
          value={
            nextDue
              ? `${nextDue.title} — ${dueLabel(nextDue)}`
              : summary
                ? 'Nothing scheduled'
                : 'Loading reminders…'
          }
        />
      </View>

      <Pressable
        style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
        onPress={() =>
          router.push({ pathname: '/vehicles/[id]/service-history', params: { id: vehicle.id } })
        }
        accessibilityRole="button"
        accessibilityLabel="Open service history"
      >
        <Text style={styles.secondaryText}>Open service history</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
        onPress={() =>
          router.push({ pathname: '/vehicles/[id]/maintenance', params: { id: vehicle.id } })
        }
        accessibilityRole="button"
        accessibilityLabel="Open maintenance"
      >
        <Text style={styles.secondaryText}>Open maintenance reminders</Text>
      </Pressable>

      {!vehicle.isDefault && (
        <Pressable
          style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
          onPress={() => setDefault.mutate(vehicle.id)}
          disabled={setDefault.isPending}
          accessibilityRole="button"
        >
          <Text style={styles.primaryText}>
            {setDefault.isPending ? 'Setting as default…' : 'Set as default vehicle'}
          </Text>
        </Pressable>
      )}

      {setDefault.isError && (
        <Text style={styles.errorText}>
          {setDefault.error instanceof ApiError
            ? setDefault.error.message
            : 'Could not update the default vehicle.'}
        </Text>
      )}

      <Pressable
        style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
        onPress={() =>
          router.push({ pathname: '/vehicles/[id]/edit', params: { id: vehicle.id } })
        }
        accessibilityRole="button"
      >
        <Text style={styles.secondaryText}>Edit vehicle</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.danger, pressed && styles.pressed]}
        onPress={() =>
          router.push({ pathname: '/vehicles/[id]/delete', params: { id: vehicle.id } })
        }
        accessibilityRole="button"
      >
        <Text style={styles.dangerText}>Delete vehicle</Text>
      </Pressable>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f8fa',
  },
  content: {
    padding: 20,
    paddingBottom: 48,
    gap: 10,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  back: {
    color: '#1f6feb',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
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
  card: {
    marginTop: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e6e8ee',
    paddingVertical: 4,
  },
  sectionTitle: {
    marginTop: 18,
    fontSize: 12,
    fontWeight: '700',
    color: '#555',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 12,
  },
  rowLabel: {
    color: '#555',
    fontSize: 13,
  },
  rowValue: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
  },
  primary: {
    marginTop: 16,
    backgroundColor: '#1f6feb',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondary: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#1f6feb',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  secondaryText: {
    color: '#1f6feb',
    fontSize: 15,
    fontWeight: '600',
  },
  danger: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#c0392b',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  dangerText: {
    color: '#c0392b',
    fontSize: 15,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.7,
  },
  muted: {
    color: '#555',
    fontSize: 13,
    textAlign: 'center',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#c0392b',
  },
  errorText: {
    color: '#c0392b',
    fontSize: 13,
    textAlign: 'center',
  },
});
