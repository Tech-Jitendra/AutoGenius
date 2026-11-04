import type { MaintenanceReminder } from '@autogenius/types';
import {
  addIsoDays,
  addIsoMonths,
  alertStatusFor,
  isoDayFromInstant,
  planCompletion,
} from './maintenance-status';

const TODAY = '2026-03-15';

function reminder(
  overrides: Partial<MaintenanceReminder> = {},
): MaintenanceReminder {
  return {
    id: '7a2d5fd1-3c4b-4f57-9a1e-5d8b0c2f6a93',
    vehicleId: '9c1c9a1e-4e10-4b0e-9b6f-2c2b0a1d3e4f',
    title: 'Oil change',
    description: null,
    dueDate: null,
    dueOdometerKm: null,
    intervalMonths: null,
    intervalKm: null,
    lastCompletedDate: null,
    lastCompletedOdometerKm: null,
    status: 'ACTIVE',
    alertStatus: null,
    createdAt: new Date('2026-01-10T00:00:00Z'),
    updatedAt: new Date('2026-01-10T00:00:00Z'),
    ...overrides,
  };
}

describe('iso day helpers', () => {
  it('reads a calendar day out of an instant in UTC', () => {
    expect(isoDayFromInstant(new Date('2026-03-15T23:59:59Z'))).toBe('2026-03-15');
    expect(isoDayFromInstant(new Date('2026-03-16T00:00:00Z'))).toBe('2026-03-16');
  });

  it('adds days across a month and a year boundary', () => {
    expect(addIsoDays('2026-03-30', 5)).toBe('2026-04-04');
    expect(addIsoDays('2026-12-30', 5)).toBe('2027-01-04');
    expect(addIsoDays('2026-03-15', 30)).toBe('2026-04-14');
  });

  it('adds whole months', () => {
    expect(addIsoMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addIsoMonths('2026-01-31', 2)).toBe('2026-03-31');
    expect(addIsoMonths('2026-11-30', 6)).toBe('2027-05-30');
    expect(addIsoMonths('2026-12-31', 1)).toBe('2027-01-31');
  });

  it('clamps a day-of-month that the target month does not have', () => {
    // 30 Jan + 1 month is not 30 Feb.
    expect(addIsoMonths('2026-01-30', 1)).toBe('2026-02-28');
    expect(addIsoMonths('2024-01-31', 1)).toBe('2024-02-29');
    expect(addIsoMonths('2026-08-31', 6)).toBe('2027-02-28');
  });
});

describe('alertStatusFor', () => {
  it('calls a reminder due today UPCOMING, not OVERDUE', () => {
    expect(alertStatusFor(reminder({ dueDate: TODAY }), null, TODAY)).toBe('UPCOMING');
  });

  it('calls a reminder due yesterday OVERDUE', () => {
    expect(alertStatusFor(reminder({ dueDate: '2026-03-14' }), null, TODAY)).toBe('OVERDUE');
  });

  it('treats the last day of the 30-day window as UPCOMING', () => {
    expect(alertStatusFor(reminder({ dueDate: '2026-04-14' }), null, TODAY)).toBe('UPCOMING');
    expect(alertStatusFor(reminder({ dueDate: '2026-04-15' }), null, TODAY)).toBe('SCHEDULED');
  });

  it('reaches OVERDUE exactly at the due odometer reading', () => {
    const target = reminder({ dueOdometerKm: 50_000 });
    expect(alertStatusFor(target, 49_999, TODAY)).toBe('UPCOMING');
    expect(alertStatusFor(target, 50_000, TODAY)).toBe('OVERDUE');
    expect(alertStatusFor(target, 51_000, TODAY)).toBe('OVERDUE');
  });

  it('treats the last kilometre of the 1,000 km window as UPCOMING', () => {
    const target = reminder({ dueOdometerKm: 51_000 });
    expect(alertStatusFor(target, 50_000, TODAY)).toBe('UPCOMING');
    expect(alertStatusFor(target, 49_999, TODAY)).toBe('SCHEDULED');
  });

  it('cannot judge an odometer threshold without a reading', () => {
    expect(alertStatusFor(reminder({ dueOdometerKm: 50_000 }), null, TODAY)).toBe('SCHEDULED');
  });

  it('lets either condition make a reminder overdue', () => {
    // The date is far away but the car has already passed the reading.
    expect(
      alertStatusFor(reminder({ dueDate: '2027-01-01', dueOdometerKm: 50_000 }), 52_000, TODAY),
    ).toBe('OVERDUE');
    // The reading is distant but the date has passed.
    expect(
      alertStatusFor(reminder({ dueDate: '2026-02-01', dueOdometerKm: 90_000 }), 42_000, TODAY),
    ).toBe('OVERDUE');
  });

  it('is timezone-stable for the same calendar day', () => {
    const IST_MIDNIGHT = new Date('2026-03-15T00:00:00+05:30');
    const SEATTLE_MIDNIGHT = new Date('2026-03-15T00:00:00-07:00');
    // Both instants fall on 2026-03-14 or 2026-03-15 in UTC, and the day the
    // rule uses is the UTC day — one answer, no matter who asks.
    expect(isoDayFromInstant(IST_MIDNIGHT)).toBe('2026-03-14');
    expect(isoDayFromInstant(SEATTLE_MIDNIGHT)).toBe('2026-03-15');
  });
});

describe('planCompletion', () => {
  it('completes a reminder without intervals and leaves its due values alone', () => {
    const plan = planCompletion(
      reminder({ dueDate: '2026-03-10', dueOdometerKm: 48_000 }),
      '2026-03-15',
      48_210,
    );

    expect(plan).toEqual({
      status: 'COMPLETED',
      recurring: false,
      dueDate: '2026-03-10',
      dueOdometerKm: 48_000,
      lastCompletedDate: '2026-03-15',
      lastCompletedOdometerKm: 48_210,
    });
  });

  it('rolls both due values forward from the last completion', () => {
    const plan = planCompletion(
      reminder({
        dueDate: '2026-03-15',
        dueOdometerKm: 50_000,
        intervalMonths: 12,
        intervalKm: 10_000,
        lastCompletedDate: '2025-10-20',
        lastCompletedOdometerKm: 40_000,
      }),
      '2026-03-15',
      50_000,
    );

    expect(plan.status).toBe('ACTIVE');
    expect(plan.recurring).toBe(true);
    expect(plan.dueDate).toBe('2026-10-20');
    expect(plan.dueOdometerKm).toBe(50_000);
    expect(plan.lastCompletedDate).toBe('2026-03-15');
    expect(plan.lastCompletedOdometerKm).toBe(50_000);
  });

  it('measures the interval from this completion when there is no prior one', () => {
    const plan = planCompletion(
      reminder({
        dueDate: '2026-03-15',
        dueOdometerKm: 50_000,
        intervalMonths: 6,
        intervalKm: 5_000,
      }),
      '2026-03-15',
      50_120,
    );

    expect(plan.dueDate).toBe('2026-09-15');
    expect(plan.dueOdometerKm).toBe(55_120);
  });

  it('uses the completion odometer as the base, not the old due reading', () => {
    const plan = planCompletion(
      reminder({ dueDate: '2026-03-15', dueOdometerKm: 40_000, intervalKm: 10_000 }),
      '2026-03-15',
      50_120,
    );
    expect(plan.dueOdometerKm).toBe(60_120);
  });

  it('falls back to this completion when the reminder had no due value at all', () => {
    const plan = planCompletion(
      reminder({ dueDate: '2026-03-15', intervalMonths: 3 }),
      '2026-02-28',
      12_345,
    );
    expect(plan.dueDate).toBe('2026-05-28');
  });

  it('moves only the dimension that has an interval', () => {
    const plan = planCompletion(
      reminder({ dueDate: '2026-03-15', dueOdometerKm: 50_000, intervalKm: 10_000 }),
      '2026-03-15',
      50_000,
    );
    expect(plan.dueDate).toBe('2026-03-15');
    expect(plan.dueOdometerKm).toBe(60_000);
  });

  it('clamps a rolled-forward reading to the odometer ceiling instead of resetting it', () => {
    const plan = planCompletion(
      reminder({ dueOdometerKm: 1_999_000, intervalKm: 10_000 }),
      '2026-03-15',
      1_999_000,
    );
    expect(plan.dueOdometerKm).toBe(2_000_000);
    expect(plan.status).toBe('ACTIVE');
  });

  it('does not put a long-overdue reminder straight back into the past', () => {
    const plan = planCompletion(
      reminder({ dueDate: '2020-01-01', intervalMonths: 1 }),
      '2026-03-15',
      10_000,
    );
    // The stale due date is ignored: the interval is measured from the work
    // that was just done, so the reminder earns a real window instead of
    // being overdue again the moment it is completed.
    expect(plan.dueDate).toBe('2026-04-15');
    expect(plan.lastCompletedDate).toBe('2026-03-15');
  });
});
