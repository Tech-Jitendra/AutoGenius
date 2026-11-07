import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type {
  CompleteMaintenanceReminderInput,
  CreateMaintenanceReminderInput,
  CreateServiceRecordInput,
  UpdateMaintenanceReminderInput,
  UpdateServiceRecordInput,
} from '@autogenius/validation';
import {
  completeMaintenanceReminder,
  createMaintenanceReminder,
  createServiceRecord,
  deleteMaintenanceReminder,
  deleteServiceRecord,
  dismissMaintenanceReminder,
  getMaintenanceReminder,
  getMaintenanceSummary,
  getServiceRecord,
  listMaintenanceReminders,
  listServiceRecords,
  reopenMaintenanceReminder,
  updateMaintenanceReminder,
  updateServiceRecord,
} from '../lib/api/service-history-api';
import { vehicleKeys } from '../vehicles/vehicle-queries';

export const serviceHistoryKeys = {
  all: (vehicleId: string) => ['service-history', vehicleId] as const,
  records: (vehicleId: string) => [...serviceHistoryKeys.all(vehicleId), 'records'] as const,
  record: (vehicleId: string, recordId: string) =>
    [...serviceHistoryKeys.records(vehicleId), 'detail', recordId] as const,
  reminders: (vehicleId: string) => [...serviceHistoryKeys.all(vehicleId), 'reminders'] as const,
  reminder: (vehicleId: string, reminderId: string) =>
    [...serviceHistoryKeys.reminders(vehicleId), 'detail', reminderId] as const,
  summary: (vehicleId: string) => [...serviceHistoryKeys.all(vehicleId), 'summary'] as const,
};

/**
 * Offset pages are walked one at a time and appended, which matches how the
 * history reads: newest first, then older visits as the user scrolls.
 */
export function useServiceRecordPages(vehicleId: string | undefined) {
  return useInfiniteQuery({
    queryKey: serviceHistoryKeys.records(vehicleId ?? ''),
    queryFn: ({ pageParam }) => listServiceRecords(vehicleId ?? '', { page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
    enabled: Boolean(vehicleId),
  });
}

export function useServiceRecord(vehicleId: string | undefined, recordId: string | undefined) {
  return useQuery({
    queryKey: serviceHistoryKeys.record(vehicleId ?? '', recordId ?? ''),
    queryFn: () => getServiceRecord(vehicleId ?? '', recordId ?? ''),
    enabled: Boolean(vehicleId && recordId),
  });
}

export function useReminderPages(vehicleId: string | undefined) {
  return useInfiniteQuery({
    queryKey: serviceHistoryKeys.reminders(vehicleId ?? ''),
    queryFn: ({ pageParam }) => listMaintenanceReminders(vehicleId ?? '', { page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
    enabled: Boolean(vehicleId),
  });
}

export function useMaintenanceReminder(
  vehicleId: string | undefined,
  reminderId: string | undefined,
) {
  return useQuery({
    queryKey: serviceHistoryKeys.reminder(vehicleId ?? '', reminderId ?? ''),
    queryFn: () => getMaintenanceReminder(vehicleId ?? '', reminderId ?? ''),
    enabled: Boolean(vehicleId && reminderId),
  });
}

export function useMaintenanceSummary(vehicleId: string | undefined) {
  return useQuery({
    queryKey: serviceHistoryKeys.summary(vehicleId ?? ''),
    queryFn: () => getMaintenanceSummary(vehicleId ?? ''),
    enabled: Boolean(vehicleId),
  });
}

/**
 * Every write invalidates the whole branch for this vehicle: the summary counts,
 * the list order and the detail screen all depend on the row that just changed,
 * and re-deriving them from the server is cheaper than keeping three caches in
 * step by hand.
 */
export function useServiceHistoryWriter(vehicleId: string | undefined) {
  const queryClient = useQueryClient();
  const branch = serviceHistoryKeys.all(vehicleId ?? '');

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: branch });
  };

  return {
    createRecord: useMutation({
      mutationFn: (input: CreateServiceRecordInput) =>
        createServiceRecord(vehicleId ?? '', input),
      onSuccess: (_record, input) => {
        invalidate();
        // A confirmed sync changed the vehicle's own reading, and that number
        // is what the vehicle card shows and what reminder urgency is judged
        // against, so the vehicles branch has to come back from the server too.
        if (input.syncVehicleOdometer === true) {
          queryClient.invalidateQueries({ queryKey: vehicleKeys.all });
        }
      },
    }),

    updateRecord: useMutation({
      mutationFn: ({
        recordId,
        input,
      }: {
        recordId: string;
        input: UpdateServiceRecordInput;
      }) => updateServiceRecord(vehicleId ?? '', recordId, input),
      onSuccess: invalidate,
    }),

    removeRecord: useMutation({
      mutationFn: (recordId: string) => deleteServiceRecord(vehicleId ?? '', recordId),
      onSuccess: invalidate,
    }),

    createReminder: useMutation({
      mutationFn: (input: CreateMaintenanceReminderInput) =>
        createMaintenanceReminder(vehicleId ?? '', input),
      onSuccess: invalidate,
    }),

    updateReminder: useMutation({
      mutationFn: ({
        reminderId,
        input,
      }: {
        reminderId: string;
        input: UpdateMaintenanceReminderInput;
      }) => updateMaintenanceReminder({ vehicleId: vehicleId ?? '', reminderId, input }),
      onSuccess: invalidate,
    }),

    completeReminder: useMutation({
      mutationFn: ({
        reminderId,
        input,
      }: {
        reminderId: string;
        input: CompleteMaintenanceReminderInput;
      }) => completeMaintenanceReminder({ vehicleId: vehicleId ?? '', reminderId, input }),
      onSuccess: invalidate,
    }),

    dismissReminder: useMutation({
      mutationFn: (reminderId: string) =>
        dismissMaintenanceReminder(vehicleId ?? '', reminderId),
      onSuccess: invalidate,
    }),

    removeReminder: useMutation({
      mutationFn: (reminderId: string) =>
        deleteMaintenanceReminder(vehicleId ?? '', reminderId),
      onSuccess: invalidate,
    }),

    reopenReminder: useMutation({
      mutationFn: (reminderId: string) =>
        reopenMaintenanceReminder(vehicleId ?? '', reminderId),
      onSuccess: invalidate,
    }),
  };
}
