import { API_BASE_URL } from './config';
import type { AuthTokens, Session } from '../../auth/types';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ClientHandlers {
  onSessionChange: (session: Session | null) => void;
  onAuthFailure: () => void;
}

let currentSession: Session | null = null;
let refreshPromise: Promise<AuthTokens> | null = null;
let handlers: ClientHandlers = {
  onSessionChange: () => {},
  onAuthFailure: () => {},
};

export function configureApiClient(next: ClientHandlers): void {
  handlers = next;
}

export function setClientSession(session: Session | null): void {
  currentSession = session;
}

export function getClientSession(): Session | null {
  return currentSession;
}

function errorMessage(body: unknown, fallback: string): string {
  if (typeof body === 'object' && body !== null) {
    const message = (body as Record<string, unknown>)['message'];
    if (typeof message === 'string') return message;
    if (Array.isArray(message)) return message.join('; ');
  }
  return fallback;
}

function fallbackMessage(status: number): string {
  if (status === 429) {
    return 'Too many attempts. Please wait a moment before trying again.';
  }
  return `Request failed (${status})`;
}

async function parseError(res: Response): Promise<ApiError> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // Keep the fallback message when the body is not JSON.
  }
  return new ApiError(res.status, errorMessage(body, fallbackMessage(res.status)));
}

async function rawFetch(path: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(`${API_BASE_URL}/api/v1${path}`, init);
  } catch {
    // fetch only rejects when the request never reached the server, which is
    // almost always an unreachable or misconfigured base URL.
    throw new ApiError(
      0,
      `Cannot reach the AutoGenius API at ${API_BASE_URL}. Check that the server is running and that EXPO_PUBLIC_API_URL points at it.`,
    );
  }
}

async function postJson(path: string, body: unknown): Promise<Response> {
  return rawFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** POST to an unauthenticated endpoint and return the parsed JSON body. */
export async function publicPost<T>(path: string, body: unknown): Promise<T> {
  const res = await postJson(path, body);
  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function refreshTokens(refreshToken: string): Promise<AuthTokens> {
  return publicPost<AuthTokens>('/auth/refresh', { refreshToken });
}

async function ensureFreshTokens(): Promise<AuthTokens> {
  if (!refreshPromise) {
    const session = currentSession;
    if (!session) throw new ApiError(401, 'No session to refresh');
    refreshPromise = refreshTokens(session.refreshToken)
      .then((tokens) => {
        currentSession = { ...session, ...tokens };
        handlers.onSessionChange(currentSession);
        return tokens;
      })
      .catch((error: unknown) => {
        if (currentSession) {
          currentSession = null;
          handlers.onSessionChange(null);
          handlers.onAuthFailure();
        }
        throw error;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const attempt = (accessToken: string | undefined): Promise<Response> =>
    rawFetch(path, {
      ...init,
      headers: {
        ...init.headers,
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
    });

  let res = await attempt(currentSession?.accessToken);

  if (res.status === 401 && currentSession?.refreshToken) {
    await ensureFreshTokens();
    res = await attempt(currentSession.accessToken);
  }

  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// Test-only hook: reset module-level state between specs.
export function resetApiClientForTests(): void {
  currentSession = null;
  refreshPromise = null;
  handlers = { onSessionChange: () => {}, onAuthFailure: () => {} };
}
