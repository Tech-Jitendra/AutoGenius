import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../auth/auth-context';

export default function HomeScreen() {
  const { user, signOut } = useAuth();
  const [pending, setPending] = useState(false);

  const onSignOut = async () => {
    setPending(true);
    try {
      await signOut();
    } finally {
      setPending(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome, {user?.name ?? 'driver'}</Text>
      <Text style={styles.email}>{user?.email}</Text>
      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        onPress={() => router.push('/vehicles')}
        accessibilityRole="button"
      >
        <Text style={styles.buttonText}>My vehicles</Text>
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.secondary, (pressed || pending) && styles.buttonPressed]}
        onPress={onSignOut}
        disabled={pending}
        accessibilityRole="button"
      >
        {pending ? <ActivityIndicator color="#1f6feb" /> : <Text style={styles.secondaryText}>Sign out</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  email: {
    marginTop: 8,
    fontSize: 14,
    color: '#555',
  },
  button: {
    marginTop: 32,
    backgroundColor: '#1f6feb',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    minWidth: 200,
    alignItems: 'center',
  },
  secondary: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#1f6feb',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    minWidth: 200,
    alignItems: 'center',
  },
  secondaryText: {
    color: '#1f6feb',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
