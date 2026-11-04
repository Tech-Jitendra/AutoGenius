import type { MaintenanceReminder, MaintenanceSummary, Page, ServiceRecord } from '@autogenius/types';

/**
 * The API sends timestamps as ISO strings, so the app models the wire shape
 * rather than the server-side entity.
 */
type WireTimestamps<T> = Omit<T, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};

export type ServiceRecordDto = WireTimestamps<ServiceRecord>;
export type MaintenanceReminderDto = WireTimestamps<MaintenanceReminder>;
export type MaintenanceSummaryDto = MaintenanceSummary;
export type PageDto<T> = Page<T>;
