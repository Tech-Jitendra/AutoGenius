import { Redirect, Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '../auth/auth-context';
import { getAuthRedirect } from '../auth/navigation-guard';
import { queryClient } from '../lib/query-client';

function AuthGuard() {
  const { status } = useAuth();
  const segments = useSegments();

  if (status === 'loading') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const redirect = getAuthRedirect(segments, status);
  if (redirect) return <Redirect href={redirect} />;

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="auto" />
    </>
  );
}

/** The next person to sign in on this device must not see the previous cache. */
function ClearCacheWhenSignedOut() {
  const { status } = useAuth();
  useEffect(() => {
    if (status === 'unauthenticated') queryClient.clear();
  }, [status]);
  return null;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ClearCacheWhenSignedOut />
        <AuthGuard />
      </AuthProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
