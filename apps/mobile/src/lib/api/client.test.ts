import {
  ApiError,
  apiFetch,
  configureApiClient,
  getClientSession,
  resetApiClientForTests,
  setClientSession,
} from './client';
import type { Session } from '../../auth/types';

const fetchMock = jest.fn();
(globalThis as Record<string, unknown>)['fetch'] = fetchMock;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const session: Session = {
  accessToken: 'old-access',
  refreshToken: 'old-refresh',
  user: {
    id: 'u1',
    name: 'Jitendra',
    email: 'a@b.com',
    phone: null,
    createdAt: '2026-10-05T00:00:00.000Z',
    updatedAt: '2026-10-05T00:00:00.000Z',
  },
};

describe('api client', () => {
  beforeEach(() => {
    resetApiClientForTests();
    fetchMock.mockReset();
  });

  it('sends the access token as a bearer header', async () => {
    setClientSession(session);
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'u1' }));

    const result = await apiFetch<{ id: string }>('/auth/me');

    expect(result.id).toBe('u1');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/auth/me');
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer old-access');
  });

  it('runs a single refresh for simultaneous 401s and retries each request once', async () => {
    const onSessionChange = jest.fn();
    const onAuthFailure = jest.fn();
    configureApiClient({ onSessionChange, onAuthFailure });
    setClientSession(session);

    fetchMock
      .mockImplementationOnce(async () => jsonResponse({ message: 'expired' }, 401))
      .mockImplementationOnce(async () => jsonResponse({ message: 'expired' }, 401))
      .mockImplementationOnce(async () =>
        jsonResponse({ accessToken: 'new-access', refreshToken: 'new-refresh' }),
      )
      .mockImplementationOnce(async () => jsonResponse({ ok: 'a' }))
      .mockImplementationOnce(async () => jsonResponse({ ok: 'b' }));

    const [a, b] = await Promise.all([
      apiFetch<{ ok: string }>('/a'),
      apiFetch<{ ok: string }>('/b'),
    ]);

    expect(a.ok).toBe('a');
    expect(b.ok).toBe('b');

    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(urls.filter((u) => u.endsWith('/auth/refresh'))).toHaveLength(1);

    const refreshInit = fetchMock.mock.calls[2][1] as RequestInit;
    expect(JSON.parse(String(refreshInit.body))).toEqual({ refreshToken: 'old-refresh' });

    const retryAuth = (fetchMock.mock.calls[3][1] as RequestInit).headers as Record<string, string>;
    expect(retryAuth['Authorization']).toBe('Bearer new-access');

    expect(onSessionChange).toHaveBeenCalledTimes(1);
    expect(onAuthFailure).not.toHaveBeenCalled();
    expect(getClientSession()?.accessToken).toBe('new-access');
  });

  it('logs out and rejects when the refresh token is rejected', async () => {
    const onSessionChange = jest.fn();
    const onAuthFailure = jest.fn();
    configureApiClient({ onSessionChange, onAuthFailure });
    setClientSession(session);

    fetchMock
      .mockImplementationOnce(async () => jsonResponse({ message: 'expired' }, 401))
      .mockImplementationOnce(async () => jsonResponse({ message: 'Invalid token' }, 401));

    await expect(apiFetch('/auth/me')).rejects.toMatchObject({
      status: 401,
      message: 'Invalid token',
    });
    expect(onAuthFailure).toHaveBeenCalledTimes(1);
    expect(onSessionChange).toHaveBeenCalledWith(null);
    expect(getClientSession()).toBeNull();

    // Later requests must not attempt another refresh and must not re-fire logout.
    fetchMock.mockImplementationOnce(async () => jsonResponse({ message: 'expired' }, 401));
    await expect(apiFetch('/auth/me')).rejects.toBeInstanceOf(ApiError);
    expect(onAuthFailure).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('surfaces non-401 errors without attempting a refresh', async () => {
    setClientSession(session);
    fetchMock.mockImplementationOnce(async () =>
      jsonResponse({ message: 'Email already registered' }, 409),
    );

    await expect(apiFetch('/auth/register')).rejects.toMatchObject({
      status: 409,
      message: 'Email already registered',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns undefined for 204 responses', async () => {
    setClientSession(session);
    fetchMock.mockImplementationOnce(async () => new Response(null, { status: 204 }));

    await expect(apiFetch('/auth/logout', { method: 'POST' })).resolves.toBeUndefined();
  });
});
