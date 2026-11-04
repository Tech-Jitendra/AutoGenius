import { groupReminders } from './reminder-groups';
import type { MaintenanceReminderDto } from './types';

const base: MaintenanceReminderDto = {
  id: 'm1',
  vehicleId: 'v1',
  title: 'Reminder',
  description: null,
  dueDate: '2026-12-01',
  dueOdometerKm: null,
  intervalMonths: null,
  intervalKm: null,
  lastCompletedDate: null,
  lastCompletedOdometerKm: null,
  status: 'ACTIVE',
  alertStatus: 'SCHEDULED',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const reminder = (overrides: Partial<MaintenanceReminderDto>): MaintenanceReminderDto => ({
  ...base,
  ...overrides,
});

describe('groupReminders', () => {
  it('orders the sections by how urgent they read', () => {
    const sections = groupReminders([
      reminder({ id: 'later', title: 'Later', alertStatus: 'SCHEDULED' }),
      reminder({ id: 'soon', title: 'Soon', alertStatus: 'UPCOMING' }),
      reminder({ id: 'late', title: 'Late', alertStatus: 'OVERDUE' }),
    ]);

    expect(sections.map((section) => section.title)).toEqual([
      'Overdue',
      'Upcoming',
      'Scheduled',
    ]);
    expect(sections[0]?.data.map((item) => item.id)).toEqual(['late']);
  });

  it('collects completed and dismissed reminders under a closed heading', () => {
    const sections = groupReminders([
      reminder({ id: 'done', title: 'Done', status: 'COMPLETED', alertStatus: null }),
      reminder({ id: 'gone', title: 'Gone', status: 'DISMISSED', alertStatus: null }),
      reminder({ id: 'live', title: 'Live', alertStatus: 'OVERDUE' }),
    ]);

    expect(sections.map((section) => section.title)).toEqual(['Overdue', 'Closed']);
    expect(sections[1]?.data.map((item) => item.id)).toEqual(['done', 'gone']);
  });

  it('never shows a closed reminder as an alert', () => {
    // A dismissed reminder that was overdue keeps its due date in the database,
    // so the only thing standing between it and an "Overdue" badge is the status.
    const sections = groupReminders([
      reminder({ id: 'gone', title: 'Gone', status: 'DISMISSED', alertStatus: null }),
    ]);

    expect(sections.map((section) => section.title)).toEqual(['Closed']);
    expect(sections[0]?.data[0]?.alertStatus).toBeNull();
  });

  it('drops empty sections and yields nothing for an untouched vehicle', () => {
    expect(groupReminders([])).toEqual([]);
    expect(groupReminders([reminder({ alertStatus: 'SCHEDULED' })]).map((s) => s.title)).toEqual([
      'Scheduled',
    ]);
  });
});
