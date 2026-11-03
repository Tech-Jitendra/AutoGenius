import { getAuthRedirect } from './navigation-guard';

describe('getAuthRedirect', () => {
  it('never redirects while the session is still loading', () => {
    expect(getAuthRedirect(['(app)'], 'loading')).toBeNull();
    expect(getAuthRedirect(['(auth)'], 'loading')).toBeNull();
  });

  it('sends guests away from protected screens to login', () => {
    expect(getAuthRedirect(['(app)'], 'unauthenticated')).toBe('/login');
    expect(getAuthRedirect(['index'], 'unauthenticated')).toBe('/login');
  });

  it('lets guests stay on auth screens', () => {
    expect(getAuthRedirect(['(auth)', 'login'], 'unauthenticated')).toBeNull();
    expect(getAuthRedirect(['(auth)', 'register'], 'unauthenticated')).toBeNull();
  });

  it('sends authenticated users away from auth screens to the app', () => {
    expect(getAuthRedirect(['(auth)', 'login'], 'authenticated')).toBe('/(app)');
    expect(getAuthRedirect(['index'], 'authenticated')).toBe('/(app)');
  });

  it('lets authenticated users stay inside the app group', () => {
    expect(getAuthRedirect(['(app)'], 'authenticated')).toBeNull();
    expect(getAuthRedirect(['(app)', 'settings'], 'authenticated')).toBeNull();
  });
});
