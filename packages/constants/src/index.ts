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
