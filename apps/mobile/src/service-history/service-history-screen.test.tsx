import { act, create } from 'react-test-renderer';
import { FlatList, RefreshControl, Text } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ServiceHistoryScreen from '../app/(app)/vehicles/[id]/service-history';
import { ApiError } from '../lib/api/client';
import type { ServiceRecordDto } from './types';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => ({ id: 'v1' }),
}));

const mockListRecords = jest.fn();
const mockGetVehicle = jest.fn();

jest.mock('../lib/api/service-history-api', () => ({
  listServiceRecords: (vehicleId: string, params: unknown) =>
    mockListRecords(vehicleId, params),
}));

jest.mock('../lib/api/vehicles-api', () => ({
  getVehicle: () => mockGetVehicle(),
}));

const record: ServiceRecordDto = {
  id: 'r1',
  vehicleId: 'v1',
  serviceDate: '2026-05-12',
  odometerKm: 42_000,
  workshopName: 'City Auto Care',
  serviceType: 'OIL_CHANGE',
  description: null,
  partsReplaced: [{ name: 'Oil filter', quantity: 1, cost: 350 }],
  labourCost: 800,
  partsCost: 1250.5,
  otherCost: 149.5,
  totalCost: 2200,
  notes: null,
  createdAt: '2026-05-12T09:00:00.000Z',
  updatedAt: '2026-05-12T09:00:00.000Z',
};

const page = (items: ServiceRecordDto[], over: Record<string, unknown> = {}) => ({
  items,
  page: 1,
  pageSize: 20,
  totalItems: items.length,
  totalPages: 1,
  ...over,
});

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
        <ServiceHistoryScreen />
      </QueryClientProvider>,
    );
  });

  for (let tick = 0; tick < 5; tick += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  return tree;
}

describe('service history screen', () => {
  beforeEach(() => {
    mockListRecords.mockReset();
    mockGetVehicle.mockReset();
    mockGetVehicle.mockResolvedValue({
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
    });
  });

  it('shows a loading state before the first page arrives', async () => {
    mockListRecords.mockReturnValue(new Promise(() => {}));

    const tree = await renderScreen();

    expect(textOf(tree)).toContain('Loading service history…');
  });

  it('lists visits newest-first with the cost of each', async () => {
    mockListRecords.mockResolvedValue(
      page([
        record,
        {
          ...record,
          id: 'r2',
          serviceDate: '2026-02-01',
          serviceType: 'TYRE_REPLACEMENT',
          workshopName: null,
          odometerKm: null,
          partsReplaced: [],
          labourCost: 0,
          partsCost: 4000,
          otherCost: 0,
          totalCost: 4000,
        },
      ]),
    );

    const tree = await renderScreen();
    const text = textOf(tree);

    expect(text).toContain('Service history');
    expect(text).toContain('2 records, newest first');
    expect(text).toContain('2026-05-12');
    expect(text).toContain('Oil Change · City Auto Care · 42,000 km');
    expect(text).toContain('₹2,200');
    expect(text).toContain('No parts listed');
    expect(text).toContain('₹4,000');
    expect(mockListRecords).toHaveBeenCalledWith('v1', { page: 1 });
  });

  it('invites the first visit when there is no history', async () => {
    mockListRecords.mockResolvedValue(page([]));

    const tree = await renderScreen();

    expect(textOf(tree)).toContain('No visits recorded yet');
  });

  it('reports a failed load with the server message and a retry', async () => {
    mockListRecords.mockRejectedValue(new ApiError(404, 'Vehicle not found'));

    const tree = await renderScreen();
    const text = textOf(tree);

    expect(text).toContain('Could not load this history');
    expect(text).toContain('Vehicle not found');
    expect(text).toContain('Try again');
  });

  it('pulls the next page when the list reaches its end', async () => {
    mockListRecords.mockResolvedValue(page([record], { page: 1, totalPages: 3, totalItems: 41 }));

    const tree = await renderScreen();
    const list = tree.root.findByType(FlatList);

    await act(async () => {
      list.props.onEndReached?.();
    });

    expect(mockListRecords).toHaveBeenCalledWith('v1', { page: 2 });
  });

  it('refetches on pull-to-refresh', async () => {
    mockListRecords.mockResolvedValue(page([record]));

    const tree = await renderScreen();
    const control = tree.root.findByType(RefreshControl);

    await act(async () => {
      control.props.onRefresh?.();
    });

    expect(mockListRecords.mock.calls.length).toBeGreaterThan(1);
  });

  it('opens a visit to view or change it', async () => {
    const { router } = jest.requireMock('expo-router') as {
      router: { push: jest.Mock };
    };
    mockListRecords.mockResolvedValue(page([record]));

    const tree = await renderScreen();
    const buttons = tree.root.findAllByProps({ accessibilityRole: 'button' });
    const row = buttons[buttons.length - 1];

    await act(async () => {
      row?.props.onPress();
    });

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/service-history/[recordId]/edit',
      params: { recordId: 'r1', vehicleId: 'v1' },
    });
  });
});
