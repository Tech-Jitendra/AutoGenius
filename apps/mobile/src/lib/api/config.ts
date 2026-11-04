import Constants from 'expo-constants';
import { Platform } from 'react-native';

const API_DEV_PORT = 3001;

interface BaseUrlInput {
  /** EXPO_PUBLIC_API_URL, inlined by Metro at build time. */
  envUrl: string | undefined;
  /** Constants.expoConfig?.hostUri, e.g. `192.168.1.11:8081`. */
  hostUri: string | undefined;
  os: string;
}

/**
 * An explicit URL always wins. Otherwise a build served by `expo start` uses the
 * machine hosting Metro, because `localhost` inside a phone or an emulator is
 * that device, not the development machine. The last resort reaches the host
 * through `10.0.2.2` on the Android emulator and directly elsewhere.
 */
export function resolveBaseUrl({ envUrl, hostUri, os }: BaseUrlInput): string {
  const configured = envUrl?.trim();
  // A value typed without a scheme would otherwise fail inside fetch().
  const fromEnv =
    configured && !/^https?:\/\//i.test(configured)
      ? `http://${configured}`
      : configured;
  const devHost = hostUri?.split(':')[0];
  const candidate =
    fromEnv ||
    (devHost ? `http://${devHost}:${API_DEV_PORT}` : undefined) ||
    (os === 'android' ? 'http://10.0.2.2:3001' : 'http://localhost:3001');
  return candidate.replace(/\/+$/, '');
}

export const API_BASE_URL: string = resolveBaseUrl({
  envUrl: process.env.EXPO_PUBLIC_API_URL,
  hostUri: Constants.expoConfig?.hostUri,
  os: Platform.OS,
});
