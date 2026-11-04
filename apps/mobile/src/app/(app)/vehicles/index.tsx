import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ApiError } from '../../../lib/api/client';
import { useVehicleList } from '../../../vehicles/vehicle-queries';
import { odometerLabel, vehicleName, vehicleSubtitle } from '../../../vehicles/labels';
import type { VehicleDto } from '../../../vehicles/types';

export default function VehicleListScreen() {
  const { data, isPending, isError, error, refetch, isRefetching } = useVehicleList();

  if (isPending) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Loading your vehicles…</Text>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Could not load your vehicles</Text>
        <Text style={styles.muted}>
          {error instanceof ApiError ? error.message : 'Please check your connection.'}
        </Text>
        <Pressable style={styles.retry} onPress={() => void refetch()} accessibilityRole="button">
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  const vehicles = data ?? [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My vehicles</Text>
        <Pressable
          style={({ pressed }) => [styles.add, pressed && styles.pressed]}
          onPress={() => router.push('/vehicles/add')}
          accessibilityRole="button"
        >
          <Text style={styles.addText}>Add vehicle</Text>
        </Pressable>
      </View>

      {vehicles.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No vehicles yet</Text>
          <Text style={styles.muted}>
            Add the vehicle you drive and AutoGenius will track its mileage, services and costs.
          </Text>
        </View>
      ) : (
        <FlatList
          data={vehicles}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />
          }
          renderItem={({ item }) => <VehicleRow vehicle={item} />}
        />
      )}
    </View>
  );
}

function VehicleRow({ vehicle }: { vehicle: VehicleDto }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      onPress={() => router.push({ pathname: '/vehicles/[id]', params: { id: vehicle.id } })}
      accessibilityRole="button"
      accessibilityLabel={`${vehicleName(vehicle)}${vehicle.isDefault ? ', default vehicle' : ''}`}
    >
      <View style={styles.rowTop}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {vehicleName(vehicle)}
        </Text>
        {vehicle.isDefault ? (
          <Text style={styles.badge}>Default</Text>
        ) : null}
      </View>
      <Text style={styles.muted}>{vehicleSubtitle(vehicle)}</Text>
      <Text style={styles.muted}>{odometerLabel(vehicle)}</Text>
    </Pressable>
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
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  add: {
    backgroundColor: '#1f6feb',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.7,
  },
  listContent: {
    paddingBottom: 32,
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
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  rowTitle: {
    flexShrink: 1,
    fontSize: 17,
    fontWeight: '700',
  },
  badge: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1f6feb',
    backgroundColor: '#eaf2ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: 'hidden',
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
