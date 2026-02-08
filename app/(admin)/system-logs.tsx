import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

export default function SystemLogs() {
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      <View style={styles.header}>
        <Text style={styles.title}>System Logs</Text>
        <Text style={styles.subtitle}>Recent server activity</Text>
      </View>

      <View style={styles.content}>
        <Ionicons name="server-outline" size={64} color="#cbd5e1" style={{ marginBottom: 20 }} />
        <Text style={styles.placeholderText}>
          Logging service not connected.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: '#1e3a8a',
    padding: 25,
    paddingTop: 60,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    elevation: 5, // Android shadow
    shadowColor: '#000', // iOS shadow
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  title: {
    color: 'white',
    fontSize: 26,
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#bfdbfe',
    fontSize: 14,
    marginTop: 5,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: '500',
  },
});