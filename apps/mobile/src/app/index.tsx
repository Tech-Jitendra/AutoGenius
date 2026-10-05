import { StyleSheet, Text, View } from 'react-native';
import { APP_NAME, APP_TAGLINE } from '@autogenius/constants';

export default function Index() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{APP_NAME}</Text>
      <Text style={styles.tagline}>{APP_TAGLINE}</Text>
      <Text style={styles.note}>Foundation is up. Features arrive from Task 02.</Text>
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
    fontSize: 32,
    fontWeight: '700',
  },
  tagline: {
    marginTop: 8,
    fontSize: 16,
    textAlign: 'center',
    color: '#444',
  },
  note: {
    marginTop: 24,
    fontSize: 13,
    color: '#888',
  },
});
