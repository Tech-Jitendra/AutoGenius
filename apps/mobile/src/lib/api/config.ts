import { Platform } from 'react-native';

function defaultBaseUrl(): string {
  // 10.0.2.2 reaches the host machine from the Android emulator.
  // if (Platform.OS === 'android') return 'http://10.0.2.2:3001';
  return 'http://localhost:3001';
}

export const API_BASE_URL: string = (
  process.env.EXPO_PUBLIC_API_URL ?? defaultBaseUrl()
).replace(/\/+$/, '');
