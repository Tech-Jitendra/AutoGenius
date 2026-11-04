import type { MaintenanceAlertStatus } from '@autogenius/types';
import { ALERT_LABELS } from './labels';
import type { MaintenanceReminderDto } from './types';

export interface ReminderSection {
  title: string;
  data: MaintenanceReminderDto[];
}

const ALERT_ORDER: MaintenanceAlertStatus[] = ['OVERDUE', 'UPCOMING', 'SCHEDULED'];

/**
 * The server judges urgency on every row, so grouping reads those judgements
 * instead of carrying a second copy of the overdue rule. Closed reminders land
 * in one section at the bottom, where they can never look like an alert.
 */
export function groupReminders(
  reminders: MaintenanceReminderDto[],
): ReminderSection[] {
  const sections = ALERT_ORDER.map((alert) => ({
    title: ALERT_LABELS[alert],
    data: reminders.filter(
      (reminder) => reminder.status === 'ACTIVE' && reminder.alertStatus === alert,
    ),
  }));

  sections.push({
    title: 'Closed',
    data: reminders.filter((reminder) => reminder.status !== 'ACTIVE'),
  });

  return sections.filter((section) => section.data.length > 0);
}
