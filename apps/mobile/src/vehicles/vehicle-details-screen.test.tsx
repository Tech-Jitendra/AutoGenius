import { act, create } from 'react-test-renderer';
import { Text } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from 'expo-router';
import VehicleDetailsScreen from '../app/(app)/vehicles/[id]';
import type { MaintenanceSummaryDto, MaintenanceReminderDto } from '../service-history/types';
import type { VehicleDto } from './types';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => ({ id: 'v1' }),
}));

const mockGetVehicle = jest.fn();
const mockSummary = jest.fn();
const mockListReminders = jest.fn();

jest.mock('../lib/api/vehicles-api', () => ({
  getVehicle: () => mockGetVehicle(),
}));

jest.mock('../lib/api/service-history-api', () => ({
  getMaintenanceSummary: (vehicleId: string) => mockSummary(vehicleId),
  listMaintenanceReminders: (vehicleId: string, params: unknown) =>
    mockListReminders(vehicleId, params),
}));

const vehicle: VehicleDto = {
  id: 'v1',
  userId: 'u1',
  make: 'Maruti Suzuki',
  model: 'Baleno',
  variant: 'ZXi CVT',
  registrationNumber: 'MH 12 AB 1234',
  manufacturingYear: 2019,
  fuelType: 'PETROL',
  transmission: 'CVT',
  purchaseDate: '2019-06-15',
  currentOdometer: 42_000,
  isDefault: true,
  createdAt: '2026-10-05T00:00:00.000Z',
  updatedAt: '2026-10-05T00:00:00.000Z',
};

/** Everything here is computed by the API; the card only re-present it. */
const summary: MaintenanceSummaryDto = {
  vehicleId: 'v1',
  totalServiceRecords: 3,
  totalExpenditure: 14_500.5,
  lastServiceDate: '2026-05-12',
  lastServiceOdometer: 42_000,
  activeReminders: 2,
  overdueReminders: 1,
  upcomingReminders: 1,
};

const overdue: MaintenanceReminderDto = {
  id: 'm1',
  vehicleId: 'v1',
  title: 'Oil change',
  description: null,
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

const upcoming: MaintenanceReminderDto = {
  ...overdue,
  id: 'm2',
  title: 'Brake inspection',
  dueDate: '2026-11-20',
  dueOdometerKm: null,
  intervalMonths: null,
  intervalKm: null,
  alertStatus: 'UPCOMING',
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
  await act(async () => {
    while (mounted.length > 0) mounted.pop()?.unmount();
  });
  while (clients.length > 0) clients.pop()?.clear();
  await flush();
});

async function renderScreen(): Promise<ReturnType<typeof create>> {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  let tree!: ReturnType<typeof create>;
  await act(async () => {
    tree = create(
      <QueryClientProvider client={queryClient}>
        <VehicleDetailsScreen />
      </QueryClientProvider>,
    );
  });

  mounted.push(tree);
  clients.push(queryClient);
  await flush();

  return tree;
}

async function press(tree: ReturnType<typeof create>, label: string) {
  const control = tree.root.findAllByProps({ accessibilityLabel: label })[0];
  if (!control) throw new Error(`No control labelled ${label}`);
  await act(async () => {
    control.props.onPress();
  });
  await flush();
}

describe('vehicle details upkeep card', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVehicle.mockResolvedValue(vehicle);
    mockSummary.mockResolvedValue(summary);
    mockListReminders.mockResolvedValue({
      items: [overdue, upcoming],
      page: 1,
      pageSize: 20,
      totalItems: 2,
      totalPages: 1,
    });
  });

  it('shows the figures the API computed, not a local guess', async () => {
    const tree = await renderScreen();
    const text = textOf(tree);

    expect(text).toContain('Last service 2026-05-12 at 42,000 km');
    expect(text).toContain('₹14,500.50');
    expect(text).toContain('Oil change — Due 2026-09-01 · by 41,000 km');
    expect(mockSummary).toHaveBeenCalledWith('v1');
  });

  it('separates the overdue and upcoming counts from the reminder list', async () => {
    const tree = await renderScreen();
    const rows = textOf(tree)
      .split('\n')
      .filter((line) => line === 'Overdue' || line === 'Upcoming');

    expect(rows).toHaveLength(2);
    expect(textOf(tree)).toContain('Overdue\n1');
    expect(textOf(tree)).toContain('Upcoming\n1');
  });

  it('says upkeep is still loading until the summary arrives', async () => {
    mockSummary.mockReturnValue(new Promise(() => {}));
    mockListReminders.mockReturnValue(new Promise(() => {}));

    const tree = await renderScreen();
    const text = textOf(tree);

    expect(text).toContain('Loading upkeep…');
    expect(text).toContain('Loading reminders…');
    expect(text).not.toContain('₹14,500.50');
  });

  it('reports nothing scheduled when there are no active reminders', async () => {
    mockListReminders.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 20,
      totalItems: 0,
      totalPages: 1,
    });

    const tree = await renderScreen();

    expect(textOf(tree)).toContain('Nothing scheduled');
  });

  it('links the card to the two upkeep screens for this vehicle', async () => {
    const tree = await renderScreen();

    await press(tree, 'Open service history');
    await press(tree, 'Open maintenance');

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/vehicles/[id]/service-history',
      params: { id: 'v1' },
    });
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/vehicles/[id]/maintenance',
      params: { id: 'v1' },
    });
  });
});
