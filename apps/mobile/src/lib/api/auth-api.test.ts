import { getMe, loginUser, logoutUser, registerUser } from './auth-api';
import { ApiError, resetApiClientForTests, setClientSession } from './client';
import { API_BASE_URL } from './config';
import type { AuthResponse, Session } from '../../auth/types';

const fetchMock = jest.fn();
(globalThis as Record<string, unknown>)['fetch'] = fetchMock;

const authResponse: AuthResponse = {
  user: {
    id: 'u1',
    name: 'Jitendra',
    email: 'a@b.com',
    phone: '+919876543210',
    createdAt: '2026-11-04T00:00:00.000Z',
    updatedAt: '2026-11-04T00:00:00.000Z',
  },
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

type Call = [string, RequestInit];

describe('auth api', () => {
  beforeEach(() => {
    resetApiClientForTests();
    fetchMock.mockReset();
  });

  it('posts the registration payload to /api/v1/auth/register', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(authResponse, 201));

    const result = await registerUser({
      name: 'Jitendra',
      email: 'a@b.com',
      phone: '+919876543210',
      password: 'password123',
    });

    const [url, init] = fetchMock.mock.calls[0] as Call;
    expect(url).toBe(`${API_BASE_URL}/api/v1/auth/register`);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      name: 'Jitendra',
      email: 'a@b.com',
      phone: '+919876543210',
      password: 'password123',
    });
    // The whole session must come back in one parse, or the app cannot sign in.
    expect(result).toEqual(authResponse);
  });

  it('surfaces the server message for a rejected registration', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'Email already registered' }, 409));

    await expect(
      registerUser({ name: 'A', email: 'a@b.com', password: 'password123' }),
    ).rejects.toThrow(new ApiError(409, 'Email already registered'));
  });

  it('names the base URL when the request never reaches the API', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Network request failed'));

    await expect(loginUser({ email: 'a@b.com', password: 'password123' })).rejects.toThrow(
      new ApiError(
        0,
        `Cannot reach the AutoGenius API at ${API_BASE_URL}. Check that the server is running and that EXPO_PUBLIC_API_URL points at it.`,
      ),
    );
  });

  it('explains a rate limit instead of showing a bare status', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 429));

    await expect(loginUser({ email: 'a@b.com', password: 'password123' })).rejects.toThrow(
      'Too many attempts. Please wait a moment before trying again.',
    );
  });

  it('treats logout as best effort but still reports rejected credentials', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(logoutUser('refresh-token')).resolves.toBeUndefined();

    fetchMock.mockRejectedValueOnce(new Error('Network request failed'));
    await expect(logoutUser('refresh-token')).resolves.toBeUndefined();

    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'Invalid refresh token' }, 401));
    await expect(logoutUser('refresh-token')).rejects.toThrow('Invalid refresh token');
  });

  it('sends the bearer token to /auth/me', async () => {
    const session: Session = { ...authResponse };
    setClientSession(session);
    fetchMock.mockResolvedValueOnce(jsonResponse(authResponse.user));

    await getMe();

    const [url, init] = fetchMock.mock.calls[0] as Call;
    expect(url).toBe(`${API_BASE_URL}/api/v1/auth/me`);
    expect((init.headers as Record<string, string>)['Authorization']).toBe(
      'Bearer access-token',
    );
  });
});
