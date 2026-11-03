import type { LoginInput, RegisterInput } from '@autogenius/validation';
import { ApiError, apiFetch } from './client';
import { API_BASE_URL } from './config';
import type { AuthResponse, PublicUser } from '../../auth/types';

const BASE = API_BASE_URL;
const PREFIX = `${BASE}/api/v1`;

async function parseError(res: Response): Promise<ApiError> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // Keep the fallback message when the body is not JSON.
  }
  const message = (body as Record<string, unknown> | null)?.['message'];
  return new ApiError(
    res.status,
    typeof message === 'string' ? message : `Request failed (${res.status})`,
  );
}

async function postAuth(path: string, body: unknown): Promise<AuthResponse> {
  const res = await fetch(`${PREFIX}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as AuthResponse;
}

export function registerUser(input: RegisterInput): Promise<AuthResponse> {
  return postAuth('/auth/register', input);
}

export function loginUser(input: LoginInput): Promise<AuthResponse> {
  return postAuth('/auth/login', input);
}

export async function logoutUser(refreshToken: string): Promise<void> {
  const res = await fetch(`${PREFIX}/auth/logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  // Logout is idempotent server-side; a network/5xx failure must not block
  // clearing local credentials, so only 4xx JSON errors are surfaced.
  if (res.status >= 400 && res.status < 500) throw await parseError(res);
}

export function getMe(): Promise<PublicUser> {
  return apiFetch<PublicUser>('/auth/me');
}
