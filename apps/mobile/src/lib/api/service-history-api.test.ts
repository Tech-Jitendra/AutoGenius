import {
  completeMaintenanceReminder,
  createMaintenanceReminder,
  createServiceRecord,
  deleteMaintenanceReminder,
  deleteServiceRecord,
  dismissMaintenanceReminder,
  getMaintenanceReminder,
  getMaintenanceSummary,
  getServiceRecord,
  listMaintenanceReminders,
  listServiceRecords,
  updateMaintenanceReminder,
  updateServiceRecord,
} from './service-history-api';
import { resetApiClientForTests, setClientSession } from './client';
import type { MaintenanceReminderDto, ServiceRecordDto } from '../../service-history/types';

const fetchMock = jest.fn();
(globalThis as Record<string, unknown>)['fetch'] = fetchMock;

const VEHICLE = '9c1c9a1e-4e10-4b0e-9b6f-2c2b0a1d3e4f';
const RECORD = '1f1c9a1e-4e10-4b0e-9b6f-2c2b0a1d3e11';
const REMINDER = '2f2c9a1e-4e10-4b0e-9b6f-2c2b0a1d3e22';

const record: ServiceRecordDto = {
  id: RECORD,
  vehicleId: VEHICLE,
  serviceDate: '2026-05-12',
  odometerKm: 42_000,
  workshopName: 'City Auto Care',
  serviceType: 'OIL_CHANGE',
  description: null,
  partsReplaced: [],
  labourCost: 800,
  partsCost: 1250.5,
  otherCost: 149.5,
  totalCost: 2200,
  notes: null,
  createdAt: '2026-05-12T09:00:00.000Z',
  updatedAt: '2026-05-12T09:00:00.000Z',
};

const reminder: MaintenanceReminderDto = {
  id: REMINDER,
  vehicleId: VEHICLE,
  title: 'Rotate tyres',
  description: null,
  dueDate: '2026-12-01',
  dueOdometerKm: 45_000,
  intervalMonths: 6,
  intervalKm: null,
  lastCompletedDate: null,
  lastCompletedOdometerKm: null,
  status: 'ACTIVE',
  alertStatus: 'UPCOMING',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const page = <T>(items: T[], over: Record<string, unknown> = {}) => ({
  items,
  page: 1,
  pageSize: 20,
  totalItems: 1,
  totalPages: 1,
  ...over,
});

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

function bodyOf(init: RequestInit): unknown {
  return JSON.parse(String(init.body));
}

describe('service history api', () => {
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

  it('asks for a page of history newest-first', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(page([record])));

    await expect(listServiceRecords(VEHICLE, { page: 2 })).resolves.toEqual(page([record]));

    const [url, init] = lastCall();
    expect(url).toBe(`/api/v1/vehicles/${VEHICLE}/service-records?page=2`);
    expect(init.method ?? 'GET').toBe('GET');
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer access');
  });

  it('sends only the filters the caller set', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(page([])));

    await listServiceRecords(VEHICLE, {
      page: 1,
      serviceType: 'BATTERY',
      from: '2026-01-01',
      to: undefined,
    });

    const [url] = lastCall();
    expect(url).toContain('page=1');
    expect(url).toContain('serviceType=BATTERY');
    expect(url).toContain('from=2026-01-01');
    expect(url).not.toContain('to=');
  });

  it('posts a visit and lets the server compute the total', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(record, 201));

    const input = {
      serviceDate: '2026-05-12',
      serviceType: 'OIL_CHANGE' as const,
      labourCost: 800,
      partsCost: 1250.5,
      otherCost: 149.5,
    };
    await createServiceRecord(VEHICLE, input);

    const [url, init] = lastCall();
    expect(url).toBe(`/api/v1/vehicles/${VEHICLE}/service-records`);
    expect(init.method).toBe('POST');
    expect(bodyOf(init)).toEqual(input);
    // The client never sends a total: the API derives it and a CHECK enforces it.
    expect(bodyOf(init)).not.toHaveProperty('totalCost');
  });

  it('reads, patches and deletes one record under its vehicle', async () => {
    fetchMock.mockResolvedValue(jsonResponse(record));
    await expect(getServiceRecord(VEHICLE, RECORD)).resolves.toEqual(record);
    expect(lastCall()[0]).toBe(`/api/v1/vehicles/${VEHICLE}/service-records/${RECORD}`);

    await updateServiceRecord(VEHICLE, RECORD, { workshopName: null });
    const [patchUrl, patchInit] = lastCall();
    expect(patchUrl).toBe(`/api/v1/vehicles/${VEHICLE}/service-records/${RECORD}`);
    expect(patchInit.method).toBe('PATCH');
    expect(bodyOf(patchInit)).toEqual({ workshopName: null });

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(deleteServiceRecord(VEHICLE, RECORD)).resolves.toBeUndefined();
    expect(lastCall()[1].method).toBe('DELETE');
  });

  it('lists reminders with a status and due filter', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(page([reminder])));

    await listMaintenanceReminders(VEHICLE, { page: 1, status: 'ACTIVE', due: 'OVERDUE' });

    expect(lastCall()[0]).toBe(
      `/api/v1/vehicles/${VEHICLE}/maintenance-reminders?page=1&status=ACTIVE&due=OVERDUE`,
    );
  });

  it('creates a reminder under the vehicle', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(reminder, 201));

    const input = { title: 'Rotate tyres', dueDate: '2026-12-01' };
    await createMaintenanceReminder(VEHICLE, input);

    const [url, init] = lastCall();
    expect(url).toBe(`/api/v1/vehicles/${VEHICLE}/maintenance-reminders`);
    expect(init.method).toBe('POST');
    expect(bodyOf(init)).toEqual(input);
  });

  it('patches a reminder through the vehicle path', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...reminder, title: 'Align wheels' }));

    await updateMaintenanceReminder({
      vehicleId: VEHICLE,
      reminderId: REMINDER,
      input: { title: 'Align wheels' },
    });

    const [url, init] = lastCall();
    expect(url).toBe(`/api/v1/vehicles/${VEHICLE}/maintenance-reminders/${REMINDER}`);
    expect(init.method).toBe('PATCH');
    expect(bodyOf(init)).toEqual({ title: 'Align wheels' });
  });

  it('completes a reminder with the date and odometer it requires', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...reminder, dueDate: '2027-06-01' }));

    await completeMaintenanceReminder({
      vehicleId: VEHICLE,
      reminderId: REMINDER,
      input: { completionDate: '2026-12-01', completionOdometerKm: 44_210 },
    });

    const [url, init] = lastCall();
    expect(url).toBe(
      `/api/v1/vehicles/${VEHICLE}/maintenance-reminders/${REMINDER}/complete`,
    );
    expect(init.method).toBe('PATCH');
    expect(bodyOf(init)).toEqual({ completionDate: '2026-12-01', completionOdometerKm: 44_210 });
  });

  it('dismisses without a body and deletes a reminder', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...reminder, status: 'DISMISSED' }));
    await dismissMaintenanceReminder(VEHICLE, REMINDER);
    const [dismissUrl, dismissInit] = lastCall();
    expect(dismissUrl).toBe(
      `/api/v1/vehicles/${VEHICLE}/maintenance-reminders/${REMINDER}/dismiss`,
    );
    expect(dismissInit.method).toBe('PATCH');
    expect(dismissInit.body).toBeUndefined();

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(deleteMaintenanceReminder(VEHICLE, REMINDER)).resolves.toBeUndefined();
    expect(lastCall()[1].method).toBe('DELETE');
  });

  it('reads the summary that the vehicle card shows', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        vehicleId: VEHICLE,
        totalServiceRecords: 0,
        totalExpenditure: 0,
        lastServiceDate: null,
        lastServiceOdometer: null,
        activeReminders: 0,
        overdueReminders: 0,
        upcomingReminders: 0,
      }),
    );

    await getMaintenanceSummary(VEHICLE);

    expect(lastCall()[0]).toBe(`/api/v1/vehicles/${VEHICLE}/maintenance-summary`);
  });

  it('url-encodes ids so a crafted id cannot escape the path', async () => {
    fetchMock.mockResolvedValue(jsonResponse(record));

    await getServiceRecord('../../admin', '../x');

    expect(lastCall()[0]).toContain('/api/v1/vehicles/..%2F..%2Fadmin/service-records/..%2Fx');
  });

  it('surfaces the API error message to the caller', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ message: 'This vehicle still has service records' }, 409),
    );

    await expect(deleteServiceRecord(VEHICLE, RECORD)).rejects.toMatchObject({
      status: 409,
      message: 'This vehicle still has service records',
    });
  });
});
