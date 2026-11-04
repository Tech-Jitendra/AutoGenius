import {
  createVehicle,
  deleteVehicle,
  getVehicle,
  listVehicles,
  setDefaultVehicle,
  updateVehicle,
} from './vehicles-api';
import { resetApiClientForTests, setClientSession } from './client';
import type { VehicleDto } from '../../vehicles/types';

const fetchMock = jest.fn();
(globalThis as Record<string, unknown>)['fetch'] = fetchMock;

const vehicle: VehicleDto = {
  id: '9c1c9a1e-4e10-4b0e-9b6f-2c2b0a1d3e4f',
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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

type Call = [string, RequestInit];

function lastCall(): Call {
  return fetchMock.mock.calls[fetchMock.mock.calls.length - 1] as Call;
}

function headersOf(init: RequestInit): Record<string, string> {
  return init.headers as Record<string, string>;
}

describe('vehicles api', () => {
  beforeEach(() => {
    resetApiClientForTests();
    setClientSession({
      accessToken: 'access',
      refreshToken: 'refresh',
      user: {
        id: 'u1',
        name: 'Jitendra',
        email: 'a@b.com',
        phone: null,
        createdAt: '2026-10-05T00:00:00.000Z',
        updatedAt: '2026-10-05T00:00:00.000Z',
      },
    });
    fetchMock.mockReset();
  });

  it('lists the authenticated users vehicles', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([vehicle]));

    await expect(listVehicles()).resolves.toEqual([vehicle]);

    const [url, init] = lastCall();
    expect(url).toContain('/api/v1/vehicles');
    expect(init.method ?? 'GET').toBe('GET');
    expect(headersOf(init)['Authorization']).toBe('Bearer access');
  });

  it('fetches one vehicle by id', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(vehicle));

    await expect(getVehicle(vehicle.id)).resolves.toEqual(vehicle);

    expect(lastCall()[0]).toContain(`/api/v1/vehicles/${vehicle.id}`);
  });

  it('posts the create payload as json', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(vehicle, 201));

    const input = {
      make: 'Maruti Suzuki',
      model: 'Baleno',
      manufacturingYear: 2019,
      fuelType: 'PETROL' as const,
      transmission: 'CVT' as const,
    };
    await createVehicle(input);

    const [url, init] = lastCall();
    expect(url).toContain('/api/v1/vehicles');
    expect(init.method).toBe('POST');
    expect(headersOf(init)['Content-Type']).toBe('application/json');
    expect(JSON.parse(String(init.body))).toEqual(input);
  });

  it('patches a vehicle with a partial payload', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...vehicle, currentOdometer: null }));

    await updateVehicle(vehicle.id, { currentOdometer: null });

    const [url, init] = lastCall();
    expect(url).toContain(`/api/v1/vehicles/${vehicle.id}`);
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(String(init.body))).toEqual({ currentOdometer: null });
  });

  it('promotes a vehicle to default without a body', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(vehicle));

    await setDefaultVehicle(vehicle.id);

    const [url, init] = lastCall();
    expect(url).toContain(`/api/v1/vehicles/${vehicle.id}/default`);
    expect(init.method).toBe('PATCH');
    expect(init.body).toBeUndefined();
  });

  it('sends no vehicle id in the delete path and resolves on 204', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(deleteVehicle(vehicle.id)).resolves.toBeUndefined();

    const [url, init] = lastCall();
    expect(url).toContain(`/api/v1/vehicles/${vehicle.id}`);
    expect(init.method).toBe('DELETE');
  });

  it('url-encodes ids so a crafted id cannot escape the path', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(vehicle));

    await getVehicle('../../admin');

    expect(lastCall()[0]).toContain('/api/v1/vehicles/..%2F..%2Fadmin');
  });

  it('surfaces the API error message to the caller', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'Vehicle not found' }, 404));

    await expect(getVehicle(vehicle.id)).rejects.toMatchObject({
      status: 404,
      message: 'Vehicle not found',
    });
  });
});
