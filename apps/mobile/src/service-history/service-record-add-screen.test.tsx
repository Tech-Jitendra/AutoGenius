import { act, create } from 'react-test-renderer';
import { Text } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AddServiceRecordScreen from '../app/(app)/service-history/add';
import { odometerSyncOffer, todayIsoDate } from './service-record-form';
import type { CreateServiceRecordInput } from '@autogenius/validation';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => ({ vehicleId: 'v1' }),
}));

const mockCreateRecord = jest.fn();
const mockGetVehicle = jest.fn();

jest.mock('../lib/api/service-history-api', () => ({
  createServiceRecord: (vehicleId: string, input: unknown) =>
    mockCreateRecord(vehicleId, input),
}));

jest.mock('../lib/api/vehicles-api', () => ({
  getVehicle: () => mockGetVehicle(),
}));

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
  currentOdometer: 44_000,
  isDefault: true,
  createdAt: '2026-10-05T00:00:00.000Z',
  updatedAt: '2026-10-05T00:00:00.000Z',
};

const input = (over: Partial<CreateServiceRecordInput> = {}): CreateServiceRecordInput => ({
  serviceDate: todayIsoDate(),
  serviceType: 'OIL_CHANGE',
  odometerKm: 47_000,
  ...over,
});

describe('the offer to sync the vehicle odometer', () => {
  it('is made for a current visit whose reading is above the vehicle', () => {
    expect(odometerSyncOffer(input(), 44_000)).toBe(true);
  });

  it('is not made for a lower or equal reading', () => {
    expect(odometerSyncOffer(input({ odometerKm: 43_999 }), 44_000)).toBe(false);
    expect(odometerSyncOffer(input({ odometerKm: 44_000 }), 44_000)).toBe(false);
  });

  it('is never made for a backdated visit, however high its reading', () => {
    expect(odometerSyncOffer(input({ serviceDate: '2026-01-04' }), 44_000)).toBe(false);
  });

  it('is not made when the visit carries no reading to sync from', () => {
    expect(odometerSyncOffer(input({ odometerKm: undefined }), 44_000)).toBe(false);
    expect(odometerSyncOffer(input({ odometerKm: null }), 44_000)).toBe(false);
  });

  it('is made for a vehicle that has no reading yet', () => {
    expect(odometerSyncOffer(input(), null)).toBe(true);
    expect(odometerSyncOffer(input(), undefined)).toBe(true);
  });
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

async function flush(): Promise<void> {
  for (let tick = 0; tick < 5; tick += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

const mounted: ReturnType<typeof create>[] = [];
const clients: QueryClient[] = [];

async function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  let tree!: ReturnType<typeof create>;
  await act(async () => {
    tree = create(
      <QueryClientProvider client={queryClient}>
        <AddServiceRecordScreen />
      </QueryClientProvider>,
    );
  });

  mounted.push(tree);
  clients.push(queryClient);
  await flush();

  return tree;
}

afterEach(async () => {
  await act(async () => {
    while (mounted.length > 0) mounted.pop()?.unmount();
  });
  while (clients.length > 0) clients.pop()?.clear();
  await flush();
});

async function press(tree: ReturnType<typeof create>, label: string) {
  const control = tree.root.findAllByProps({ accessibilityLabel: label })[0];
  if (!control) throw new Error(`No control labelled ${label}`);
  await act(async () => {
    control.props.onPress();
  });
  await flush();
}

async function typeInto(tree: ReturnType<typeof create>, label: string, text: string) {
  const inputNode = tree.root.findAllByProps({ accessibilityLabel: label })[0];
  if (!inputNode) throw new Error(`No input labelled ${label}`);
  await act(async () => {
    inputNode.props.onChangeText(text);
  });
  await flush();
}

/** The shortest path through the form that the schema accepts. */
async function fillAndSubmit(tree: ReturnType<typeof create>, odometer: string) {
  await press(tree, 'Type of service: OIL_CHANGE');
  await typeInto(tree, 'Service odometer', odometer);
  await press(tree, 'Save visit');
}

describe('recording a service', () => {
  beforeEach(() => {
    mockCreateRecord.mockReset();
    mockGetVehicle.mockReset();
    mockGetVehicle.mockResolvedValue(vehicle);
    mockCreateRecord.mockResolvedValue({ id: 'r1' });
  });

  it('asks before using a higher reading as the vehicle odometer', async () => {
    const tree = await renderScreen();
    await fillAndSubmit(tree, '47000');

    expect(textOf(tree)).toContain(
      'Your service record shows a higher odometer reading. Would you like to update your ' +
        "vehicle's current odometer?",
    );
    // Nothing has reached the server yet: the answer comes first.
    expect(mockCreateRecord).not.toHaveBeenCalled();
  });

  it('saves with the sync only when the user confirms it', async () => {
    const { router } = jest.requireMock('expo-router') as { router: { replace: jest.Mock } };
    const tree = await renderScreen();
    await fillAndSubmit(tree, '47000');
    await press(tree, 'Update vehicle odometer');

    expect(mockCreateRecord).toHaveBeenCalledWith(
      'v1',
      expect.objectContaining({ odometerKm: 47_000, syncVehicleOdometer: true }),
    );
    expect(router.replace).toHaveBeenCalledWith({
      pathname: '/vehicles/[id]/service-history',
      params: { id: 'v1' },
    });
  });

  it('keeps the vehicle reading when the user declines, and still saves the visit', async () => {
    const tree = await renderScreen();
    await fillAndSubmit(tree, '47000');
    await press(tree, 'Keep current odometer');

    expect(mockCreateRecord).toHaveBeenCalledWith(
      'v1',
      expect.objectContaining({ odometerKm: 47_000, syncVehicleOdometer: false }),
    );
  });

  it('saves a lower or equal reading without asking anything', async () => {
    for (const reading of ['43999', '44000']) {
      const tree = await renderScreen();
      await fillAndSubmit(tree, reading);

      expect(textOf(tree)).not.toContain('higher odometer reading');
      expect(mockCreateRecord).toHaveBeenCalledWith(
        'v1',
        expect.objectContaining({ odometerKm: Number(reading), syncVehicleOdometer: false }),
      );
    }
  });

  it('saves a backdated visit without offering to move the odometer', async () => {
    const tree = await renderScreen();
    await typeInto(tree, 'Service date', '2026-01-04');
    await fillAndSubmit(tree, '47000');

    expect(textOf(tree)).not.toContain('higher odometer reading');
    expect(mockCreateRecord).toHaveBeenCalledWith(
      'v1',
      expect.objectContaining({
        serviceDate: '2026-01-04',
        odometerKm: 47_000,
        syncVehicleOdometer: false,
      }),
    );
  });

  it('saves a visit with no odometer reading at all without asking', async () => {
    const tree = await renderScreen();
    await fillAndSubmit(tree, '');

    expect(textOf(tree)).not.toContain('higher odometer reading');
    expect(mockCreateRecord).toHaveBeenCalledWith(
      'v1',
      expect.objectContaining({ syncVehicleOdometer: false }),
    );
  });

  it('shows what declining keeps, so the choice is not a guess', async () => {
    const tree = await renderScreen();
    await fillAndSubmit(tree, '47000');

    expect(textOf(tree)).toContain('Declining keeps the vehicle at 44,000 km.');
  });
});
