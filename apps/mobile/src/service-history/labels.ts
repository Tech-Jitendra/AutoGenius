import { formatINRWithPaise } from '../lib/format';
import type { MaintenanceAlertStatus, ReminderStatus } from '@autogenius/types';
import type {
  MaintenanceReminderDto,
  MaintenanceSummaryDto,
  ServiceRecordDto,
} from './types';

/** `OIL_CHANGE` reads as "Oil Change" — the same convention the vehicle labels use. */
export function humanizeEnum(value: string): string {
  return value
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

export function serviceTypeLabel(record: ServiceRecordDto): string {
  return humanizeEnum(record.serviceType);
}

export const ALERT_LABELS: Record<MaintenanceAlertStatus, string> = {
  OVERDUE: 'Overdue',
  UPCOMING: 'Upcoming',
  SCHEDULED: 'Scheduled',
};

export const REMINDER_STATUS_LABELS: Record<ReminderStatus, string> = {
  ACTIVE: 'Active',
  COMPLETED: 'Completed',
  DISMISSED: 'Dismissed',
};

export function kmLabel(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : `${value.toLocaleString('en-IN')} km`;
}

export function costLabel(value: number): string {
  return formatINRWithPaise(value);
}

/**
 * Added in whole paise so a float artefact cannot make the preview disagree with
 * the total the server stores — the same reason the API sums in cents.
 */
export function totalCostInPaise(
  labour: number,
  parts: number,
  other: number,
): number {
  const paise = (value: number): number => Math.round(value * 100);
  return paise(labour) + paise(parts) + paise(other);
}

export function partsLabel(record: ServiceRecordDto): string {
  if (record.partsReplaced.length === 0) return 'No parts listed';
  return record.partsReplaced
    .map((part) => (part.quantity ? `${part.name} ×${part.quantity}` : part.name))
    .join(', ');
}

export function recordLine(record: ServiceRecordDto): string {
  return [
    record.serviceDate,
    serviceTypeLabel(record),
    record.workshopName ?? 'Workshop not saved',
    record.odometerKm === null ? null : kmLabel(record.odometerKm),
  ]
    .filter(Boolean)
    .join(' · ');
}

export function dueLabel(reminder: MaintenanceReminderDto): string {
  const parts = [
    reminder.dueDate ?? null,
    reminder.dueOdometerKm === null ? null : `by ${kmLabel(reminder.dueOdometerKm)}`,
  ].filter(Boolean);
  return parts.length === 0 ? 'No due condition' : `Due ${parts.join(' · ')}`;
}

/**
 * Whether the reminder will roll forward after completion. Stated as the rule
 * rather than a predicted date: the server computes the next due values, and it
 * is the only place that decides them.
 */
export function recurrenceLabel(reminder: MaintenanceReminderDto): string {
  const parts = [
    reminder.intervalMonths === null ? null : `every ${reminder.intervalMonths} month(s)`,
    reminder.intervalKm === null ? null : `every ${kmLabel(reminder.intervalKm)}`,
  ].filter(Boolean);
  return parts.length === 0
    ? 'One-time reminder — it stays completed after you mark it done'
    : `Recurring, ${parts.join(' and ')}. The next due values are measured from this completion.`;
}

export function lastCompletedLabel(reminder: MaintenanceReminderDto): string {
  if (reminder.lastCompletedDate === null && reminder.lastCompletedOdometerKm === null) {
    return 'Not completed yet';
  }
  return [
    reminder.lastCompletedDate ?? null,
    reminder.lastCompletedOdometerKm === null
      ? null
      : kmLabel(reminder.lastCompletedOdometerKm),
  ]
    .filter(Boolean)
    .join(' · ');
}

export function summaryLine(summary: MaintenanceSummaryDto): string {
  return summary.lastServiceDate === null
    ? 'No service recorded yet'
    : `Last service ${summary.lastServiceDate}${
        summary.lastServiceOdometer === null ? '' : ` at ${kmLabel(summary.lastServiceOdometer)}`
      }`;
}
