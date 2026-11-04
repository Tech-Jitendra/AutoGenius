import { resolveBaseUrl } from './config';

describe('resolveBaseUrl', () => {
  it('uses EXPO_PUBLIC_API_URL when it is set, for any platform', () => {
    expect(
      resolveBaseUrl({
        envUrl: 'http://192.168.1.5:3001',
        hostUri: '10.11.12.13:8081',
        os: 'android',
      }),
    ).toBe('http://192.168.1.5:3001');
  });

  it('strips trailing slashes so /api/v1 is never duplicated', () => {
    expect(
      resolveBaseUrl({ envUrl: 'http://192.168.1.5:3001///', hostUri: undefined, os: 'ios' }),
    ).toBe('http://192.168.1.5:3001');
  });

  it('derives the host from the dev server so a physical device reaches the API', () => {
    expect(
      resolveBaseUrl({ envUrl: undefined, hostUri: '192.168.1.11:8081', os: 'android' }),
    ).toBe('http://192.168.1.11:3001');
  });

  it('adds the scheme when a configured URL omits it', () => {
    expect(
      resolveBaseUrl({ envUrl: '192.168.1.5:3001', hostUri: undefined, os: 'android' }),
    ).toBe('http://192.168.1.5:3001');
  });

  it('keeps an https URL untouched', () => {
    expect(
      resolveBaseUrl({ envUrl: 'https://api.example.com/', hostUri: undefined, os: 'web' }),
    ).toBe('https://api.example.com');
  });

  it('ignores a blank configured URL rather than sending the app nowhere', () => {
    expect(resolveBaseUrl({ envUrl: '   ', hostUri: undefined, os: 'android' })).toBe(
      'http://10.0.2.2:3001',
    );
  });

  it('uses the dev server host on every platform, not only Android', () => {
    expect(resolveBaseUrl({ envUrl: undefined, hostUri: '192.168.1.11:8081', os: 'ios' })).toBe(
      'http://192.168.1.11:3001',
    );
  });

  it('falls back to the Android emulator gateway for the host machine', () => {
    expect(resolveBaseUrl({ envUrl: undefined, hostUri: undefined, os: 'android' })).toBe(
      'http://10.0.2.2:3001',
    );
  });

  it('falls back to localhost on platforms that share the loopback interface', () => {
    expect(resolveBaseUrl({ envUrl: undefined, hostUri: undefined, os: 'ios' })).toBe(
      'http://localhost:3001',
    );
    expect(resolveBaseUrl({ envUrl: undefined, hostUri: undefined, os: 'web' })).toBe(
      'http://localhost:3001',
    );
  });

  it('ignores a hostUri without a usable host', () => {
    expect(resolveBaseUrl({ envUrl: undefined, hostUri: ':8081', os: 'ios' })).toBe(
      'http://localhost:3001',
    );
  });
});
