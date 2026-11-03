import { ActivityIndicator, StyleSheet, View } from 'react-native';

// The root AuthGuard redirects to /(app) or /(auth)/login based on session
// state; this screen only renders the brief moment before that decision.
export default function Index() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
