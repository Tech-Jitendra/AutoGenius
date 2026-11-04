export const APP_NAME = 'AutoGenius';
export const APP_TAGLINE = 'Your AI second opinion before you spend money on your car.';

export const EXPENSE_CATEGORIES = [
  'FUEL',
  'SERVICE',
  'REPAIR',
  'INSURANCE',
  'PUC',
  'ACCESSORY',
  'OTHER',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const MAINTENANCE_CATEGORIES = [
  'OIL_CHANGE',
  'BRAKE_INSPECTION',
  'TYRE_REPLACEMENT',
  'BATTERY',
  'AIR_FILTER',
  'COOLANT',
  'GENERAL_SERVICE',
] as const;

export type MaintenanceCategory = (typeof MAINTENANCE_CATEGORIES)[number];

/** Every maintenance category is also a service type, plus a catch-all. */
export const SERVICE_TYPES = [...MAINTENANCE_CATEGORIES, 'OTHER'] as const;

export type ServiceType = (typeof SERVICE_TYPES)[number];

export const REMINDER_STATUSES = ['ACTIVE', 'COMPLETED', 'DISMISSED'] as const;

export type ReminderStatus = (typeof REMINDER_STATUSES)[number];

export const MAINTENANCE_ALERT_STATUSES = [
  'OVERDUE',
  'UPCOMING',
  'SCHEDULED',
] as const;

export type MaintenanceAlertStatus = (typeof MAINTENANCE_ALERT_STATUSES)[number];

/** "Upcoming" windows. Outside both, an active reminder is merely scheduled. */
export const UPCOMING_DUE_WINDOW_DAYS = 30;
export const UPCOMING_DUE_WINDOW_KM = 1000;

export const QUOTATION_ASSESSMENTS = [
  'NECESSARY',
  'REVIEW',
  'OPTIONAL',
  'POTENTIALLY_OVERPRICED',
  'UNKNOWN',
] as const;

export type QuotationAssessment = (typeof QUOTATION_ASSESSMENTS)[number];

export const AI_SAFETY_CRITICAL_SYMPTOMS = [
  'brake failure',
  'steering failure',
  'smoke',
  'fuel leakage',
  'overheating',
  'electrical burning smell',
  'engine seizure',
  'airbag warning',
  'major accident damage',
] as const;

export const DEFAULT_CURRENCY = 'INR';
