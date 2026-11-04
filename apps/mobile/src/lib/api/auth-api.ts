import type { LoginInput, RegisterInput } from '@autogenius/validation';
import { ApiError, apiFetch, publicPost } from './client';
import type { AuthResponse, PublicUser } from '../../auth/types';

export function registerUser(input: RegisterInput): Promise<AuthResponse> {
  return publicPost<AuthResponse>('/auth/register', input);
}

export function loginUser(input: LoginInput): Promise<AuthResponse> {
  return publicPost<AuthResponse>('/auth/login', input);
}

export async function logoutUser(refreshToken: string): Promise<void> {
  try {
    await publicPost<void>('/auth/logout', { refreshToken });
  } catch (error) {
    // Logout is idempotent server-side, so a request that never landed
    // (status 0) or a 5xx must not block clearing local credentials.
    if (error instanceof ApiError && (error.status === 0 || error.status >= 500)) return;
    throw error;
  }
}

export function getMe(): Promise<PublicUser> {
  return apiFetch<PublicUser>('/auth/me');
}
