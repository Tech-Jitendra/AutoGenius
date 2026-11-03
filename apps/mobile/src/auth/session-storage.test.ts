import * as SecureStore from 'expo-secure-store';
import { clearSession, loadSession, saveSession } from './session-storage';
import type { Session } from './types';

const mockStore = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockStore.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockStore.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockStore.delete(key);
  }),
}));

const session: Session = {
  accessToken: 'access-1',
  refreshToken: 'refresh-1',
  user: {
    id: 'u1',
    name: 'Jitendra',
    email: 'a@b.com',
    phone: null,
    createdAt: '2026-10-05T00:00:00.000Z',
    updatedAt: '2026-10-05T00:00:00.000Z',
  },
};

describe('session storage', () => {
  beforeEach(() => {
    mockStore.clear();
    jest.clearAllMocks();
  });

  it('round-trips a session through SecureStore', async () => {
    await saveSession(session);
    expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(1);
    await expect(loadSession()).resolves.toEqual(session);
  });

  it('returns null when nothing is stored', async () => {
    await expect(loadSession()).resolves.toBeNull();
  });

  it('returns null for corrupt JSON instead of throwing', async () => {
    mockStore.set('autogenius.session', '{not json');
    await expect(loadSession()).resolves.toBeNull();
  });

  it('returns null when the stored shape is not a session', async () => {
    mockStore.set('autogenius.session', JSON.stringify({ accessToken: 'only-access' }));
    await expect(loadSession()).resolves.toBeNull();
  });

  it('clears the stored session (logout state)', async () => {
    await saveSession(session);
    await clearSession();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledTimes(1);
    await expect(loadSession()).resolves.toBeNull();
  });
});
