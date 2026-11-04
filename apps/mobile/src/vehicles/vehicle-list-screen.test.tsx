import { act, create } from 'react-test-renderer';
import { Text } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError } from '../lib/api/client';
import VehicleListScreen from '../app/(app)/vehicles';
import type { VehicleDto } from './types';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  Link: () => null,
}));

const mockListVehicles = jest.fn();
jest.mock('../lib/api/vehicles-api', () => ({
  listVehicles: () => mockListVehicles(),
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
  currentOdometer: 42000,
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
        <VehicleListScreen />
      </QueryClientProvider>,
    );
  });

  // TanStack Query batches its subscriber notifications onto a timer, so a
  // microtask tick is not enough to flush the render.
  for (let tick = 0; tick < 5; tick += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  return { tree, queryClient };
}

describe('vehicle list screen', () => {
  beforeEach(() => {
    mockListVehicles.mockReset();
  });

  it('shows a loading state before the first response', async () => {
    mockListVehicles.mockReturnValue(new Promise(() => {}));

    const { tree } = await renderScreen();

    expect(textOf(tree)).toContain('Loading your vehicles…');
  });

  it('renders saved vehicles with the default badge', async () => {
    mockListVehicles.mockResolvedValue([vehicle, { ...vehicle, id: 'v2', isDefault: false }]);

    const { tree } = await renderScreen();
    const text = textOf(tree);

    expect(text).toContain('My vehicles');
    expect(text).toContain('Maruti Suzuki Baleno ZXi CVT');
    expect(text).toContain('MH 12 AB 1234 · 2019 · Petrol · Cvt');
    expect(text).toContain('42,000 km on record');
    expect(text.match(/Default/g)).toHaveLength(1);
  });

  it('invites the user to add their first vehicle', async () => {
    mockListVehicles.mockResolvedValue([]);

    const { tree } = await renderScreen();

    expect(textOf(tree)).toContain('No vehicles yet');
  });

  it('reports a failed load with the server message and a retry', async () => {
    mockListVehicles.mockRejectedValue(new ApiError(500, 'Internal server error'));

    const { tree } = await renderScreen();
    const text = textOf(tree);

    expect(text).toContain('Could not load your vehicles');
    expect(text).toContain('Internal server error');
    expect(text).toContain('Try again');
  });
});
