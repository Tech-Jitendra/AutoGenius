import type { MaintenanceAlertStatus, ReminderStatus } from '@autogenius/types';
import { MAX_ODOMETER_KM } from '@autogenius/validation';
import { UPCOMING_DUE_WINDOW_DAYS, UPCOMING_DUE_WINDOW_KM } from '@autogenius/constants';

/** The stored shape of a reminder, narrowed to what the rules read. */
export interface ReminderDueValues {
  dueDate: string | null;
  dueOdometerKm: number | null;
}

export interface ReminderIntervals {
  intervalMonths: number | null;
  intervalKm: number | null;
}

export interface CompletedReminder extends ReminderDueValues, ReminderIntervals {
  lastCompletedDate: string | null;
  lastCompletedOdometerKm: number | null;
}

/**
 * All date maths here works on calendar days as `YYYY-MM-DD` strings and on
 * `Date.UTC`, so a server (or a reviewer) in Mumbai and one in Seattle compute
 * the same due date. The day boundary is UTC midnight; see docs/database.md.
 */
function parseIsoDay(iso: string): { year: number; month: number; day: number } {
  const [year, month, day] = iso.split('-').map(Number);
  return { year: year as number, month: month as number, day: day as number };
}

function fromUtcParts(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
}

function daysInMonth(year: number, month: number): number {
  // Day 0 of the following month is the last day of this one.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function isoDayFromInstant(instant: Date): string {
  return instant.toISOString().slice(0, 10);
}

export function addIsoDays(iso: string, days: number): string {
  const { year, month, day } = parseIsoDay(iso);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/**
 * Month arithmetic clamps to the end of a shorter month, the way a service book
 * reads: 31 Jan + 1 month is 28 Feb, never "1 Mar" and never an invalid 31 Feb.
 */
export function addIsoMonths(iso: string, months: number): string {
  const { year, month, day } = parseIsoDay(iso);
  const total = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(total / 12);
  const targetMonth = (total % 12) + 1;
  return fromUtcParts(
    targetYear,
    targetMonth,
    Math.min(day, daysInMonth(targetYear, targetMonth)),
  );
}

/**
 * OVERDUE: the due date is strictly in the past, or the vehicle has reached the
 * due odometer reading. Either condition alone is enough.
 * UPCOMING: due within the next 30 days, or within the next 1,000 km.
 * SCHEDULED: everything else. A reminder with no odometer recorded can only be
 * judged by its date, which is why the reading is allowed to be null.
 */
export function alertStatusFor(
  reminder: ReminderDueValues,
  currentOdometerKm: number | null,
  todayIso: string,
): MaintenanceAlertStatus {
  const horizonIso = addIsoDays(todayIso, UPCOMING_DUE_WINDOW_DAYS);

  const dateOverdue = reminder.dueDate !== null && reminder.dueDate < todayIso;
  const odometerOverdue =
    reminder.dueOdometerKm !== null &&
    currentOdometerKm !== null &&
    currentOdometerKm >= reminder.dueOdometerKm;
  if (dateOverdue || odometerOverdue) {
    return 'OVERDUE';
  }

  const dateSoon = reminder.dueDate !== null && reminder.dueDate <= horizonIso;
  const odometerSoon =
    reminder.dueOdometerKm !== null &&
    currentOdometerKm !== null &&
    reminder.dueOdometerKm - currentOdometerKm <= UPCOMING_DUE_WINDOW_KM;
  if (dateSoon || odometerSoon) {
    return 'UPCOMING';
  }

  return 'SCHEDULED';
}

export interface CompletionPlan {
  status: ReminderStatus;
  dueDate: string | null;
  dueOdometerKm: number | null;
  lastCompletedDate: string;
  lastCompletedOdometerKm: number;
  recurring: boolean;
}

/**
 * Recurring reminders roll their own due values forward:
 *
 *   next due date      = date base     + intervalMonths
 *   next due odometer  = odometer base + intervalKm
 *
 * The base is the previous completion, or this completion when the reminder has
 * no history yet. It is deliberately not the old due value: measuring from the
 * promise rather than from the work would put a long-overdue reminder back into
 * the past and make it instantly overdue again.
 *
 * A reminder with no interval keeps its due values untouched and becomes
 * COMPLETED — that is what makes a one-time reminder one-time. An odometer that
 * would exceed the column ceiling is clamped to it rather than reset, so the
 * reminder still reads as due instead of silently disappearing from the list.
 */
export function planCompletion(
  reminder: CompletedReminder,
  completionDate: string,
  completionOdometerKm: number,
): CompletionPlan {
  const recurring = reminder.intervalMonths !== null || reminder.intervalKm !== null;

  return {
    status: recurring ? 'ACTIVE' : 'COMPLETED',
    recurring,
    dueDate:
      reminder.intervalMonths === null
        ? reminder.dueDate
        : addIsoMonths(reminder.lastCompletedDate ?? completionDate, reminder.intervalMonths),
    dueOdometerKm:
      reminder.intervalKm === null
        ? reminder.dueOdometerKm
        : Math.min(
            (reminder.lastCompletedOdometerKm ?? completionOdometerKm) + reminder.intervalKm,
            MAX_ODOMETER_KM,
          ),
    lastCompletedDate: completionDate,
    lastCompletedOdometerKm: completionOdometerKm,
  };
}
