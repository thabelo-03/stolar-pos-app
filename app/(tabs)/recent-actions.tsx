import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedView } from '../../components/themed-view';
import { API_BASE_URL } from '../config';
import { Colors } from '../../constants/theme';

export default function RecentActionsScreen() {
  const router = useRouter();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const insets = useSafeAreaInsets();

  const fetchLogs = async () => {
    try {
      const userId = await AsyncStorage.getItem('userId');
      if (userId) {
        const userRes = await fetch(`${API_BASE_URL}/users/${userId}`);
        const user = await userRes.json();
        if (user.shopId) {
          const response = await fetch(`${API_BASE_URL}/logs?shopId=${user.shopId}`);
          const data = await response.json();
          if (Array.isArray(data)) setLogs(data);
        }
      }
    } catch (error) {
      console.log('Error fetching logs:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchLogs();
  };

  return (
    <ThemedView style={styles.container}>
      <LinearGradient colors={['#0a0f1e', '#162444']} style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#f1f5f9" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Recent Actions</Text>
      </LinearGradient>

      {loading ? (
        <ActivityIndicator size="large" color="#06b6d4" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(item) => item._id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#06b6d4" />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.emptyText}>No recent actions recorded.</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.iconBox}>
                <Ionicons 
                  name={item.action === 'ADD_PRODUCT' ? "add-circle" : "cube"} 
                  size={24} 
                  color={item.action === 'ADD_PRODUCT' ? "#10b981" : "#06b6d4"} 
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.details}>{item.details}</Text>
                <Text style={styles.meta}>
                  {item.userName || 'Unknown'} • {new Date(item.timestamp).toLocaleString()}
                </Text>
              </View>
            </View>
          )}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.bg },
  header: {
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  backButton: { marginRight: 15, padding: 8, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 12 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.dark.text },
  list: { padding: 20, paddingBottom: 120 },
  card: { backgroundColor: Colors.dark.surface, borderColor: Colors.dark.border, borderWidth: 1, padding: 15, borderRadius: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.04)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  details: { fontSize: 14, fontWeight: '600', color: Colors.dark.text, marginBottom: 4 },
  meta: { fontSize: 12, color: Colors.dark.textSecondary },
  emptyText: { textAlign: 'center', marginTop: 50, color: Colors.dark.textMuted }
});