import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ApiError } from '../../../../lib/api/client';
import { vehicleName } from '../../../../vehicles/labels';
import { useVehicle } from '../../../../vehicles/vehicle-queries';
import { useServiceRecordPages } from '../../../../service-history/service-history-queries';
import { costLabel, partsLabel, recordLine } from '../../../../service-history/labels';
import type { ServiceRecordDto } from '../../../../service-history/types';

export default function ServiceHistoryScreen() {
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
  } = useServiceRecordPages(id);

  if (isPending) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Loading service history…</Text>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Could not load this history</Text>
        <Text style={styles.muted}>
          {error instanceof ApiError ? error.message : 'Please check your connection.'}
        </Text>
        <Pressable style={styles.retry} onPress={() => void refetch()} accessibilityRole="button">
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  const records = data?.pages.flatMap((page) => page.items) ?? [];
  const pages = data?.pages ?? [];
  const totalItems = pages.length === 0 ? 0 : (pages[pages.length - 1]?.totalItems ?? 0);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityRole="button">
          <Text style={styles.back}>Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Service history</Text>
        <Pressable
          style={({ pressed }) => [styles.add, pressed && styles.pressed]}
          onPress={() =>
            router.push({ pathname: '/service-history/add', params: { vehicleId: id } })
          }
          accessibilityRole="button"
          accessibilityLabel="Record a service"
        >
          <Text style={styles.addText}>Record service</Text>
        </Pressable>
      </View>

      {records.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No visits recorded yet</Text>
          <Text style={styles.muted}>
            {vehicle
              ? `Add the first workshop visit for ${vehicleName(vehicle)} and AutoGenius keeps the bills, parts and odometer readings together.`
              : 'Add a workshop visit and AutoGenius keeps the bills, parts and odometer readings together.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={records}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />
          }
          onEndReached={() => void fetchNextPage()}
          onEndReachedThreshold={0.4}
          ListHeaderComponent={<Text style={styles.count}>{totalItems} records, newest first</Text>}
          ListFooterComponent={
            isFetchingNextPage ? (
              <Text style={styles.muted}>Loading older records…</Text>
            ) : hasNextPage ? null : (
              <Text style={styles.muted}>That is the whole history.</Text>
            )
          }
          renderItem={({ item }) => <RecordRow vehicleId={id} record={item} />}
        />
      )}
    </View>
  );
}

function RecordRow({ vehicleId, record }: { vehicleId: string; record: ServiceRecordDto }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      onPress={() =>
        router.push({
          pathname: '/service-history/[recordId]/edit',
          params: { recordId: record.id, vehicleId },
        })
      }
      accessibilityRole="button"
      accessibilityLabel={`${recordLine(record)}, ${costLabel(record.totalCost)}`}
    >
      <Text style={styles.rowTitle}>{record.serviceDate}</Text>
      <Text style={styles.muted}>{recordLine(record)}</Text>
      <Text style={styles.muted}>{partsLabel(record)}</Text>
      <Text style={styles.cost}>{costLabel(record.totalCost)}</Text>
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
  count: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    color: '#555',
    fontSize: 12,
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
  cost: {
    marginTop: 4,
    fontSize: 15,
    fontWeight: '700',
    color: '#1f6feb',
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
