import type { ExpenseCategory, FuelType, QuotationItemAssessment, TransmissionType } from './index';

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
