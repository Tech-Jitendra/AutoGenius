import {
  AI_SAFETY_CRITICAL_SYMPTOMS,
  APP_NAME,
  APP_TAGLINE,
  DEFAULT_CURRENCY,
  EXPENSE_CATEGORIES,
  MAINTENANCE_ALERT_STATUSES,
  MAINTENANCE_CATEGORIES,
  QUOTATION_ASSESSMENTS,
  REMINDER_STATUSES,
  SERVICE_TYPES,
  UPCOMING_DUE_WINDOW_DAYS,
  UPCOMING_DUE_WINDOW_KM,
} from './index';

describe('app constants', () => {
  it('defines product identity', () => {
    expect(APP_NAME).toBe('AutoGenius');
    expect(APP_TAGLINE.length).toBeGreaterThan(0);
    expect(DEFAULT_CURRENCY).toBe('INR');
  });

  it('defines all V1 maintenance categories from the spec', () => {
    expect(MAINTENANCE_CATEGORIES).toContain('OIL_CHANGE');
    expect(MAINTENANCE_CATEGORIES).toContain('BRAKE_INSPECTION');
    expect(MAINTENANCE_CATEGORIES).toHaveLength(7);
  });

  it('safety-critical symptom list covers the spec set', () => {
    expect(AI_SAFETY_CRITICAL_SYMPTOMS).toContain('brake failure');
    expect(AI_SAFETY_CRITICAL_SYMPTOMS).toContain('airbag warning');
    expect(QUOTATION_ASSESSMENTS).toHaveLength(5);
    expect(EXPENSE_CATEGORIES).toHaveLength(7);
  });

  it('derives service types from the maintenance vocabulary plus OTHER', () => {
    expect(SERVICE_TYPES).toEqual([...MAINTENANCE_CATEGORIES, 'OTHER']);
  });

  it('defines the reminder life cycle and the computed urgency bands', () => {
    expect(REMINDER_STATUSES).toEqual(['ACTIVE', 'COMPLETED', 'DISMISSED']);
    expect(MAINTENANCE_ALERT_STATUSES).toEqual(['OVERDUE', 'UPCOMING', 'SCHEDULED']);
  });

  it('keeps the upcoming window at the spec values', () => {
    expect(UPCOMING_DUE_WINDOW_DAYS).toBe(30);
    expect(UPCOMING_DUE_WINDOW_KM).toBe(1000);
  });
});
