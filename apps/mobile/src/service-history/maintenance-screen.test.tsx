import { act, create } from 'react-test-renderer';
import { SectionList, Text } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MaintenanceScreen from '../app/(app)/vehicles/[id]/maintenance';
import { ApiError } from '../lib/api/client';
import { todayIsoDate } from './service-record-form';
import type { MaintenanceReminderDto } from './types';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => ({ id: 'v1' }),
}));

const mockListReminders = jest.fn();
const mockComplete = jest.fn();
const mockDismiss = jest.fn();
const mockReopen = jest.fn();
const mockDelete = jest.fn();
const mockGetVehicle = jest.fn();

jest.mock('../lib/api/service-history-api', () => ({
  listMaintenanceReminders: (vehicleId: string, params: unknown) =>
    mockListReminders(vehicleId, params),
  completeMaintenanceReminder: (write: unknown) => mockComplete(write),
  dismissMaintenanceReminder: (vehicleId: string, reminderId: string) =>
    mockDismiss(vehicleId, reminderId),
  reopenMaintenanceReminder: (vehicleId: string, reminderId: string) =>
    mockReopen(vehicleId, reminderId),
  deleteMaintenanceReminder: (vehicleId: string, reminderId: string) =>
    mockDelete(vehicleId, reminderId),
}));

jest.mock('../lib/api/vehicles-api', () => ({
  getVehicle: () => mockGetVehicle(),
}));

const overdue: MaintenanceReminderDto = {
  id: 'm1',
  vehicleId: 'v1',
  title: 'Oil change',
  description: '0W-20, every 10,000 km',
  dueDate: '2026-09-01',
  dueOdometerKm: 41_000,
  intervalMonths: 6,
  intervalKm: 10_000,
  lastCompletedDate: '2026-03-01',
  lastCompletedOdometerKm: 31_000,
  status: 'ACTIVE',
  alertStatus: 'OVERDUE',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const soon: MaintenanceReminderDto = {
  ...overdue,
  id: 'm2',
  title: 'Brake inspection',
  dueDate: '2026-11-20',
  dueOdometerKm: null,
  intervalMonths: null,
  intervalKm: null,
  status: 'ACTIVE',
  alertStatus: 'UPCOMING',
};

const dismissed: MaintenanceReminderDto = {
  ...overdue,
  id: 'm3',
  title: 'Coolant flush',
  status: 'DISMISSED',
  alertStatus: null,
};

const rolledForward: MaintenanceReminderDto = {
  ...overdue,
  dueDate: '2027-05-04',
  dueOdometerKm: 52_000,
  lastCompletedDate: todayIsoDate(),
  lastCompletedOdometerKm: 42_000,
  alertStatus: 'SCHEDULED',
};

const vehicle = {
  id: 'v1',
  userId: 'u1',
  make: 'Maruti Suzuki',
  model: 'Baleno',
  variant: null,
  registrationNumber: null,
  manufacturingYear: 2019,
  fuelType: 'PETROL',
  transmission: 'MANUAL',
  purchaseDate: null,
  currentOdometer: 42_000,
  isDefault: true,
  createdAt: '2026-10-05T00:00:00.000Z',
  updatedAt: '2026-10-05T00:00:00.000Z',
};

function textOf(tree: ReturnType<typeof create>): string {
  return tree.root
    .findAllByType(Text)
    .map((node) =>
      [node.props.children]
        .flat(Infinity as 1)
        .filter((child: unknown) => typeof child === 'string')
        .join(''),
    )
    .join('\n');
}

async function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  let tree!: ReturnType<typeof create>;
  await act(async () => {
    tree = create(
      <QueryClientProvider client={queryClient}>
        <MaintenanceScreen />
      </QueryClientProvider>,
    );
  });

  mounted.push(tree);
  clients.push(queryClient);
  await flush();

  return tree;
}

/**
 * TanStack Query notifies on a timer and a mutation invalidates the list, so
 * renders land after the awaited call. Everything is flushed inside `act` so no
 * update escapes into a Jest environment that has already been torn down.
 */
async function flush(): Promise<void> {
  for (let tick = 0; tick < 5; tick += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

const mounted: { unmount: () => void }[] = [];
const clients: QueryClient[] = [];

afterEach(async () => {
  // Unmounting drops the query observers, then clearing the cache cancels the
  // refetches a mutation invalidation left in flight.
  await act(async () => {
    while (mounted.length > 0) mounted.pop()?.unmount();
  });
  while (clients.length > 0) clients.pop()?.clear();
  await flush();
});

async function press(tree: ReturnType<typeof create>, label: string) {
  const button = tree.root.findAllByProps({ accessibilityLabel: label })[0];
  if (!button) throw new Error(`No control labelled ${label}`);
  await act(async () => {
    button.props.onPress();
  });
  await flush();
  return tree;
}

function valueOf(tree: ReturnType<typeof create>, label: string): string {
  const input = tree.root.findAllByProps({ accessibilityLabel: label })[0];
  if (!input) throw new Error(`No input labelled ${label}`);
  return String(input.props.value);
}

async function typeInto(tree: ReturnType<typeof create>, label: string, text: string) {
  const input = tree.root.findAllByProps({ accessibilityLabel: label })[0];
  if (!input) throw new Error(`No input labelled ${label}`);
  await act(async () => {
    input.props.onChangeText(text);
  });
  await flush();
}

describe('maintenance screen', () => {
  beforeEach(() => {
    mockListReminders.mockReset();
    mockComplete.mockReset();
    mockDismiss.mockReset();
    mockReopen.mockReset();
    mockDelete.mockReset();
    mockGetVehicle.mockReset();
    mockGetVehicle.mockResolvedValue(vehicle);
    mockListReminders.mockResolvedValue({
      items: [overdue, soon, dismissed],
      page: 1,
      pageSize: 20,
      totalItems: 3,
      totalPages: 1,
    });
    mockComplete.mockResolvedValue(rolledForward);
    mockDismiss.mockResolvedValue({ ...dismissed, status: 'DISMISSED' });
    mockReopen.mockResolvedValue({
      ...dismissed,
      status: 'ACTIVE',
      alertStatus: 'OVERDUE',
    });
    mockDelete.mockResolvedValue(undefined);
  });

  it('groups reminders by how urgent the server says they are', async () => {
    const tree = await renderScreen();
    const text = textOf(tree);

    expect(text).toContain('Overdue');
    expect(text).toContain('Oil change');
    expect(text).toContain('Upcoming');
    expect(text).toContain('Brake inspection');
    expect(text).toContain('Closed');
    expect(text).toContain('Coolant flush');
    expect(text).toContain('Due 2026-09-01 · by 41,000 km');
    expect(text).toContain('2026-03-01 · 31,000 km');
  });

  it('never offers completion for a reminder that is already closed', async () => {
    const tree = await renderScreen();

    const buttons = tree.root
      .findAllByProps({ accessibilityRole: 'button' })
      .map((node) => String(node.props.accessibilityLabel ?? ''));

    expect(buttons.filter((label) => label.startsWith('Mark Coolant flush'))).toEqual([]);
    expect(buttons.filter((label) => label.startsWith('Dismiss Coolant flush'))).toEqual([]);
    expect(buttons).toContain('Edit Coolant flush');
    expect(buttons).toContain('Reopen Coolant flush');
  });

  it('opens the completion panel with today and the saved odometer ready', async () => {
    const tree = await renderScreen();
    await press(tree, 'Mark Oil change completed');

    expect(valueOf(tree, 'Completion date')).toBe(todayIsoDate());
    expect(valueOf(tree, 'Completion odometer')).toBe('42000');
    expect(textOf(tree)).toContain(
      'Recurring, every 6 month(s) and every 10,000 km. The next due values are measured from this completion.',
    );
  });

  it('refuses a blank odometer without asking the server', async () => {
    mockGetVehicle.mockResolvedValue({ ...vehicle, currentOdometer: null });
    const tree = await renderScreen();
    await press(tree, 'Mark Oil change completed');
    await typeInto(tree, 'Completion odometer', '');
    await press(tree, 'Confirm completion');

    expect(textOf(tree)).toContain('Enter the odometer reading in whole kilometres');
    expect(mockComplete).not.toHaveBeenCalled();
  });

  it('completes the visit and shows the next due values the server rolled forward', async () => {
    const tree = await renderScreen();
    await press(tree, 'Mark Oil change completed');
    await press(tree, 'Confirm completion');

    expect(mockComplete).toHaveBeenCalledWith({
      vehicleId: 'v1',
      reminderId: 'm1',
      input: { completionDate: todayIsoDate(), completionOdometerKm: 42_000 },
    });
    expect(textOf(tree)).toContain('Completed. Due 2027-05-04 · by 52,000 km.');
    // The branch is invalidated, so the list comes back from the server.
    expect(mockListReminders.mock.calls.length).toBeGreaterThan(1);
  });

  it('shows the servers refusal when the odometer has gone backwards', async () => {
    mockComplete.mockRejectedValue(
      new ApiError(400, 'Odometer cannot be lower than the last recorded reading (31,000 km)'),
    );
    const tree = await renderScreen();
    await press(tree, 'Mark Oil change completed');
    await typeInto(tree, 'Completion odometer', '100');
    await press(tree, 'Confirm completion');

    expect(textOf(tree)).toContain(
      'Odometer cannot be lower than the last recorded reading (31,000 km)',
    );
  });

  it('asks before dismissing, then leaves the due values in place', async () => {
    const tree = await renderScreen();
    await press(tree, 'Dismiss Brake inspection');

    expect(textOf(tree)).toContain('Yes, dismiss reminder');
    expect(mockDismiss).not.toHaveBeenCalled();

    await press(tree, 'Confirm dismiss');

    expect(mockDismiss).toHaveBeenCalledWith('v1', 'm2');
    expect(textOf(tree)).toContain('is dismissed. Its due values were left untouched.');
  });

  it('asks before reopening, and says what reopening will not change', async () => {
    const tree = await renderScreen();
    await press(tree, 'Reopen Coolant flush');

    expect(textOf(tree)).toContain('Yes, reopen reminder');
    expect(textOf(tree)).toContain('it does not roll the schedule forward');
    expect(mockReopen).not.toHaveBeenCalled();

    await press(tree, 'Confirm reopen');

    expect(mockReopen).toHaveBeenCalledWith('v1', 'm3');
    expect(textOf(tree)).toContain(
      'Coolant flush is active again with the due values it was closed with.',
    );
  });

  it('reports the server refusing a reopen that was never needed', async () => {
    mockReopen.mockRejectedValue(
      new ApiError(409, 'Reminder is already active. Edit it instead of reopening it.'),
    );
    const tree = await renderScreen();
    await press(tree, 'Reopen Coolant flush');
    await press(tree, 'Confirm reopen');

    expect(textOf(tree)).toContain(
      'Reminder is already active. Edit it instead of reopening it.',
    );
  });

  it('opens a reminder on its own details screen', async () => {
    const { router } = jest.requireMock('expo-router') as {
      router: { push: jest.Mock };
    };
    const tree = await renderScreen();
    await press(tree, 'Open Oil change details');

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/vehicles/[id]/maintenance/[reminderId]',
      params: { reminderId: 'm1', vehicleId: 'v1' },
    });
  });

  it('walks the pages as the list reaches its end', async () => {
    const paged = { ...overdue, id: 'm4', title: 'Timing belt' };
    mockListReminders
      .mockResolvedValueOnce({
        items: [overdue],
        page: 1,
        pageSize: 20,
        totalItems: 25,
        totalPages: 2,
      })
      .mockResolvedValueOnce({
        items: [paged],
        page: 2,
        pageSize: 20,
        totalItems: 25,
        totalPages: 2,
      });
    const tree = await renderScreen();
    const list = tree.root.findByType(SectionList);

    await act(async () => {
      list.props.onEndReached?.();
    });

    expect(mockListReminders).toHaveBeenCalledWith('v1', { page: 2 });
  });
});
