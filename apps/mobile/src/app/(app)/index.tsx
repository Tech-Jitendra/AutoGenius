import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
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
        style={({ pressed }) => [styles.button, (pressed || pending) && styles.buttonPressed]}
        onPress={onSignOut}
        disabled={pending}
        accessibilityRole="button"
      >
        {pending ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign out</Text>}
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
    minWidth: 160,
    alignItems: 'center',
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
