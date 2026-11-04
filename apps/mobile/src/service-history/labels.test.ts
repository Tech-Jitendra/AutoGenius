import {
  ALERT_LABELS,
  costLabel,
  dueLabel,
  humanizeEnum,
  kmLabel,
  lastCompletedLabel,
  partsLabel,
  recordLine,
  recurrenceLabel,
  REMINDER_STATUS_LABELS,
  serviceTypeLabel,
  summaryLine,
  totalCostInPaise,
} from './labels';
import type {
  MaintenanceReminderDto,
  MaintenanceSummaryDto,
  ServiceRecordDto,
} from './types';

const record: ServiceRecordDto = {
  id: 'r1',
  vehicleId: 'v1',
  serviceDate: '2026-05-12',
  odometerKm: 42_000,
  workshopName: 'City Auto Care',
  serviceType: 'OIL_CHANGE',
  description: 'Engine oil and filter',
  partsReplaced: [
    { name: 'Oil filter', quantity: 1, cost: 350 },
    { name: 'Engine oil 1L', quantity: 3, cost: 1450 },
    { name: 'Washer', quantity: null, cost: null },
  ],
  labourCost: 800,
  partsCost: 1250.5,
  otherCost: 149.5,
  totalCost: 2200,
  notes: null,
  createdAt: '2026-05-12T09:00:00.000Z',
  updatedAt: '2026-05-12T09:00:00.000Z',
};

const reminder: MaintenanceReminderDto = {
  id: 'm1',
  vehicleId: 'v1',
  title: 'Rotate tyres',
  description: null,
  dueDate: '2026-12-01',
  dueOdometerKm: 45_000,
  intervalMonths: 6,
  intervalKm: 10_000,
  lastCompletedDate: '2026-06-01',
  lastCompletedOdometerKm: 35_000,
  status: 'ACTIVE',
  alertStatus: 'SCHEDULED',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const summary: MaintenanceSummaryDto = {
  vehicleId: 'v1',
  totalServiceRecords: 7,
  totalExpenditure: 12_345.6,
  lastServiceDate: '2026-05-12',
  lastServiceOdometer: 42_000,
  activeReminders: 3,
  overdueReminders: 1,
  upcomingReminders: 1,
};

describe('service history labels', () => {
  it('reads enum values as words', () => {
    expect(humanizeEnum('OIL_CHANGE')).toBe('Oil Change');
    expect(humanizeEnum('BRAKE_INSPECTION')).toBe('Brake Inspection');
    expect(humanizeEnum('OTHER')).toBe('Other');
    expect(serviceTypeLabel(record)).toBe('Oil Change');
  });

  it('keeps both words of an alert and a reminder status', () => {
    expect(ALERT_LABELS['OVERDUE']).toBe('Overdue');
    expect(ALERT_LABELS['UPCOMING']).toBe('Upcoming');
    expect(ALERT_LABELS['SCHEDULED']).toBe('Scheduled');
    expect(REMINDER_STATUS_LABELS['COMPLETED']).toBe('Completed');
    expect(REMINDER_STATUS_LABELS['DISMISSED']).toBe('Dismissed');
  });

  it('formats kilometres and money in the Indian grouping', () => {
    expect(kmLabel(42_000)).toBe('42,000 km');
    expect(kmLabel(100_000)).toBe('1,00,000 km');
    expect(kmLabel(null)).toBe('—');
    expect(costLabel(2200)).toBe('₹2,200');
    expect(costLabel(12_345.6)).toBe('₹12,345.60');
  });

  it('adds costs in whole paise so no float artefact appears', () => {
    expect(totalCostInPaise(0.1, 0.2, 0)).toBe(30);
    expect(totalCostInPaise(800, 1250.5, 149.5)).toBe(220_000);
    expect(costLabel(totalCostInPaise(800, 1250.5, 149.5) / 100)).toBe('₹2,200');
  });

  it('lists parts with quantities and says so when there are none', () => {
    expect(partsLabel(record)).toBe('Oil filter ×1, Engine oil 1L ×3, Washer');
    expect(partsLabel({ ...record, partsReplaced: [] })).toBe('No parts listed');
  });

  it('puts the fields that identify a visit on one line', () => {
    expect(recordLine(record)).toBe('2026-05-12 · Oil Change · City Auto Care · 42,000 km');
    expect(recordLine({ ...record, workshopName: null, odometerKm: null })).toBe(
      '2026-05-12 · Oil Change · Workshop not saved',
    );
  });

  it('describes when a reminder is due', () => {
    expect(dueLabel(reminder)).toBe('Due 2026-12-01 · by 45,000 km');
    expect(dueLabel({ ...reminder, dueOdometerKm: null })).toBe('Due 2026-12-01');
    expect(dueLabel({ ...reminder, dueDate: null })).toBe('Due by 45,000 km');
    expect(dueLabel({ ...reminder, dueDate: null, dueOdometerKm: null })).toBe(
      'No due condition',
    );
  });

  it('explains recurrence instead of predicting a date', () => {
    expect(recurrenceLabel(reminder)).toBe(
      'Recurring, every 6 month(s) and every 10,000 km. The next due values are measured from this completion.',
    );
    expect(recurrenceLabel({ ...reminder, intervalKm: null })).toContain('every 6 month(s).');
    expect(recurrenceLabel({ ...reminder, intervalMonths: null, intervalKm: null })).toBe(
      'One-time reminder — it stays completed after you mark it done',
    );
  });

  it('describes the last completion', () => {
    expect(lastCompletedLabel(reminder)).toBe('2026-06-01 · 35,000 km');
    expect(
      lastCompletedLabel({ ...reminder, lastCompletedDate: null, lastCompletedOdometerKm: null }),
    ).toBe('Not completed yet');
  });

  it('summarises upkeep for the vehicle screen', () => {
    expect(summaryLine(summary)).toBe('Last service 2026-05-12 at 42,000 km');
    expect(summaryLine({ ...summary, lastServiceOdometer: null })).toBe(
      'Last service 2026-05-12',
    );
    expect(summaryLine({ ...summary, lastServiceDate: null, lastServiceOdometer: null })).toBe(
      'No service recorded yet',
    );
  });
});
