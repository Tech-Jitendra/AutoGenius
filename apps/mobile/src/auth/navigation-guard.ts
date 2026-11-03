import type { AuthStatus } from './types';

export type RedirectTarget = '/login' | '/(app)';

export function getAuthRedirect(
  segments: readonly string[],
  status: AuthStatus,
): RedirectTarget | null {
  if (status === 'loading') return null;
  const group = segments[0];
  if (status === 'unauthenticated') {
    return group === '(auth)' ? null : '/login';
  }
  return group === '(app)' ? null : '/(app)';
}
