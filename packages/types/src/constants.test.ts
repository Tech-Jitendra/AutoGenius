import {
  EXPENSE_CATEGORIES,
  FUEL_TYPES,
  MAINTENANCE_ALERT_STATUSES,
  QUOTATION_ITEM_ASSESSMENTS,
  REMINDER_STATUSES,
  SERVICE_TYPES,
  TRANSMISSION_TYPES,
} from './constants';

describe('domain constant lists', () => {
  it('contains all seven expense categories', () => {
    expect(EXPENSE_CATEGORIES).toHaveLength(7);
    expect(EXPENSE_CATEGORIES).toContain('FUEL');
    expect(EXPENSE_CATEGORIES).toContain('OTHER');
  });

  it('fuel and transmission types are non-empty', () => {
    expect(FUEL_TYPES.length).toBeGreaterThan(0);
    expect(TRANSMISSION_TYPES.length).toBeGreaterThan(0);
  });

  it('quotation assessments include UNKNOWN for insufficient evidence', () => {
    expect(QUOTATION_ITEM_ASSESSMENTS).toContain('UNKNOWN');
    expect(QUOTATION_ITEM_ASSESSMENTS).toContain('POTENTIALLY_OVERPRICED');
  });

  it('lists every service type and reminder state', () => {
    expect(SERVICE_TYPES).toHaveLength(8);
    expect(SERVICE_TYPES).toContain('GENERAL_SERVICE');
    expect(SERVICE_TYPES).toContain('OTHER');
    expect(REMINDER_STATUSES).toEqual(['ACTIVE', 'COMPLETED', 'DISMISSED']);
    expect(MAINTENANCE_ALERT_STATUSES).toContain('OVERDUE');
  });
});
