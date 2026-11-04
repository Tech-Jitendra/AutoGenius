import type {
  ExpenseCategory,
  FuelType,
  MaintenanceAlertStatus,
  QuotationItemAssessment,
  ReminderStatus,
  ServiceType,
  TransmissionType,
} from './index';

export const FUEL_TYPES: readonly FuelType[] = ['PETROL', 'DIESEL', 'CNG', 'HYBRID', 'ELECTRIC'];

export const TRANSMISSION_TYPES: readonly TransmissionType[] = ['MANUAL', 'AUTOMATIC', 'AMT', 'CVT'];

export const EXPENSE_CATEGORIES: readonly ExpenseCategory[] = [
  'FUEL',
  'SERVICE',
  'REPAIR',
  'INSURANCE',
  'PUC',
  'ACCESSORY',
  'OTHER',
];

export const QUOTATION_ITEM_ASSESSMENTS: readonly QuotationItemAssessment[] = [
  'NECESSARY',
  'REVIEW',
  'OPTIONAL',
  'POTENTIALLY_OVERPRICED',
  'UNKNOWN',
];

/**
 * Annotated with the union so a value that drifts from `packages/types`
 * `ServiceType` is a compile error rather than a runtime surprise.
 */
export const SERVICE_TYPES: readonly ServiceType[] = [
  'OIL_CHANGE',
  'BRAKE_INSPECTION',
  'TYRE_REPLACEMENT',
  'BATTERY',
  'AIR_FILTER',
  'COOLANT',
  'GENERAL_SERVICE',
  'OTHER',
];

export const REMINDER_STATUSES: readonly ReminderStatus[] = [
  'ACTIVE',
  'COMPLETED',
  'DISMISSED',
];

export const MAINTENANCE_ALERT_STATUSES: readonly MaintenanceAlertStatus[] = [
  'OVERDUE',
  'UPCOMING',
  'SCHEDULED',
];
