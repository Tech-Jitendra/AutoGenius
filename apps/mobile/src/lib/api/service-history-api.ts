import type {
  CompleteMaintenanceReminderInput,
  CreateMaintenanceReminderInput,
  CreateServiceRecordInput,
  ServiceTypeInput,
  UpdateMaintenanceReminderInput,
  UpdateServiceRecordInput,
} from '@autogenius/validation';
import {
  MAINTENANCE_ALERT_STATUSES,
  REMINDER_STATUSES,
} from '@autogenius/validation';
import { apiFetch } from './client';
import type {
  MaintenanceReminderDto,
  MaintenanceSummaryDto,
  PageDto,
  ServiceRecordDto,
} from '../../service-history/types';

const jsonHeaders = { 'Content-Type': 'application/json' };

export type ReminderStatusFilter = (typeof REMINDER_STATUSES)[number];
export type ReminderDueFilter = (typeof MAINTENANCE_ALERT_STATUSES)[number];

export interface PageParams {
  page: number;
  pageSize?: number;
}

export interface ServiceRecordParams extends PageParams {
  from?: string;
  to?: string;
  serviceType?: ServiceTypeInput;
}

export interface ReminderParams extends PageParams {
  status?: ReminderStatusFilter;
  due?: ReminderDueFilter;
}

// Ids come from the database, but encoding them keeps a malformed param from
// escaping the path.
const vehiclePath = (vehicleId: string): string =>
  `/vehicles/${encodeURIComponent(vehicleId)}`;

const recordsPath = (vehicleId: string): string =>
  `${vehiclePath(vehicleId)}/service-records`;

const remindersPath = (vehicleId: string): string =>
  `${vehiclePath(vehicleId)}/maintenance-reminders`;

/** Only the filters the caller set are sent, so the server applies its defaults. */
function queryString(params: Record<string, string | number | undefined>): string {
  const pairs = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  return pairs.length === 0 ? '' : `?${pairs.join('&')}`;
}

export function listServiceRecords(
  vehicleId: string,
  params: ServiceRecordParams,
): Promise<PageDto<ServiceRecordDto>> {
  return apiFetch<PageDto<ServiceRecordDto>>(
    `${recordsPath(vehicleId)}${queryString({ ...params })}`,
  );
}

export function getServiceRecord(
  vehicleId: string,
  recordId: string,
): Promise<ServiceRecordDto> {
  return apiFetch<ServiceRecordDto>(
    `${recordsPath(vehicleId)}/${encodeURIComponent(recordId)}`,
  );
}

export function createServiceRecord(
  vehicleId: string,
  input: CreateServiceRecordInput,
): Promise<ServiceRecordDto> {
  return apiFetch<ServiceRecordDto>(recordsPath(vehicleId), {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(input),
  });
}

export function updateServiceRecord(
  vehicleId: string,
  recordId: string,
  input: UpdateServiceRecordInput,
): Promise<ServiceRecordDto> {
  return apiFetch<ServiceRecordDto>(
    `${recordsPath(vehicleId)}/${encodeURIComponent(recordId)}`,
    { method: 'PATCH', headers: jsonHeaders, body: JSON.stringify(input) },
  );
}

export function deleteServiceRecord(
  vehicleId: string,
  recordId: string,
): Promise<void> {
  return apiFetch<void>(
    `${recordsPath(vehicleId)}/${encodeURIComponent(recordId)}`,
    { method: 'DELETE' },
  );
}

export function listMaintenanceReminders(
  vehicleId: string,
  params: ReminderParams,
): Promise<PageDto<MaintenanceReminderDto>> {
  return apiFetch<PageDto<MaintenanceReminderDto>>(
    `${remindersPath(vehicleId)}${queryString({ ...params })}`,
  );
}

export function getMaintenanceReminder(
  vehicleId: string,
  reminderId: string,
): Promise<MaintenanceReminderDto> {
  return apiFetch<MaintenanceReminderDto>(
    `${remindersPath(vehicleId)}/${encodeURIComponent(reminderId)}`,
  );
}

export function createMaintenanceReminder(
  vehicleId: string,
  input: CreateMaintenanceReminderInput,
): Promise<MaintenanceReminderDto> {
  return apiFetch<MaintenanceReminderDto>(remindersPath(vehicleId), {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(input),
  });
}

export interface ReminderWrite {
  vehicleId: string;
  reminderId: string;
  input: UpdateMaintenanceReminderInput;
}

export function updateMaintenanceReminder({
  vehicleId,
  reminderId,
  input,
}: ReminderWrite): Promise<MaintenanceReminderDto> {
  return apiFetch<MaintenanceReminderDto>(
    `${remindersPath(vehicleId)}/${encodeURIComponent(reminderId)}`,
    { method: 'PATCH', headers: jsonHeaders, body: JSON.stringify(input) },
  );
}

export interface CompletionWrite {
  vehicleId: string;
  reminderId: string;
  input: CompleteMaintenanceReminderInput;
}

/**
 * Returns the reminder as the server rolled it forward — due values included —
 * so the app can show the real next due date rather than its own guess.
 */
export function completeMaintenanceReminder({
  vehicleId,
  reminderId,
  input,
}: CompletionWrite): Promise<MaintenanceReminderDto> {
  return apiFetch<MaintenanceReminderDto>(
    `${remindersPath(vehicleId)}/${encodeURIComponent(reminderId)}/complete`,
    { method: 'PATCH', headers: jsonHeaders, body: JSON.stringify(input) },
  );
}

export function dismissMaintenanceReminder(
  vehicleId: string,
  reminderId: string,
): Promise<MaintenanceReminderDto> {
  return apiFetch<MaintenanceReminderDto>(
    `${remindersPath(vehicleId)}/${encodeURIComponent(reminderId)}/dismiss`,
    { method: 'PATCH' },
  );
}

/**
 * Only flips the life cycle back to ACTIVE — the server keeps the due values,
 * the intervals and the last-completed history exactly as they were.
 */
export function reopenMaintenanceReminder(
  vehicleId: string,
  reminderId: string,
): Promise<MaintenanceReminderDto> {
  return apiFetch<MaintenanceReminderDto>(
    `${remindersPath(vehicleId)}/${encodeURIComponent(reminderId)}/reopen`,
    { method: 'PATCH' },
  );
}

export function deleteMaintenanceReminder(
  vehicleId: string,
  reminderId: string,
): Promise<void> {
  return apiFetch<void>(
    `${remindersPath(vehicleId)}/${encodeURIComponent(reminderId)}`,
    { method: 'DELETE' },
  );
}

export function getMaintenanceSummary(
  vehicleId: string,
): Promise<MaintenanceSummaryDto> {
  return apiFetch<MaintenanceSummaryDto>(
    `${vehiclePath(vehicleId)}/maintenance-summary`,
  );
}
