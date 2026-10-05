import {
  AI_SAFETY_CRITICAL_SYMPTOMS,
  APP_NAME,
  APP_TAGLINE,
  DEFAULT_CURRENCY,
  EXPENSE_CATEGORIES,
  MAINTENANCE_CATEGORIES,
  QUOTATION_ASSESSMENTS,
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
});
