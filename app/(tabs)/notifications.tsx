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

interface Notification {
  _id: string;
  message: string;
  type: 'link_request' | 'system';
  isRead: boolean;
  createdAt: string;
  relatedId?: string;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const insets = useSafeAreaInsets();

  const fetchNotifications = async () => {
    try {
      const userId = await AsyncStorage.getItem('userId');
      if (!userId) return;

      const response = await fetch(`${API_BASE_URL}/notifications/${userId}`);
      if (response.ok) {
        const data = await response.json();
        setNotifications(data);
      }
    } catch (error) {
      console.error("Failed to fetch notifications", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const markAsRead = async (id: string) => {
    try {
      setNotifications(prev => 
        prev.map(n => n._id === id ? { ...n, isRead: true } : n)
      );
      await fetch(`${API_BASE_URL}/notifications/${id}/read`, { method: 'PUT' });
    } catch (error) {
      console.error("Error marking as read", error);
    }
  };

  const renderItem = ({ item }: { item: Notification }) => (
    <TouchableOpacity 
      style={[styles.card, !item.isRead && styles.unreadCard]} 
      onPress={() => markAsRead(item._id)}
    >
      <View style={styles.row}>
        <View style={[styles.iconBox, { backgroundColor: item.type === 'link_request' ? 'rgba(6, 182, 212, 0.12)' : 'rgba(245, 158, 11, 0.12)' }]}>
           <Ionicons name={item.type === 'link_request' ? 'link' : 'notifications'} size={24} color={item.type === 'link_request' ? '#06b6d4' : '#f59e0b'} />
        </View>
        <View style={styles.content}>
          <Text style={[styles.message, !item.isRead && styles.boldText]}>
            {item.message}
          </Text>
          <Text style={styles.date}>
            {new Date(item.createdAt).toLocaleDateString()} • {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
        {!item.isRead && <View style={styles.dot} />}
      </View>
    </TouchableOpacity>
  );

  return (
    <ThemedView style={styles.container}>
      <LinearGradient colors={['#0a0f1e', '#162444']} style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#f1f5f9" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
      </LinearGradient>

      {loading ? (
        <ActivityIndicator size="large" color="#06b6d4" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchNotifications(); }} tintColor="#06b6d4" />
          }
          ListEmptyComponent={<Text style={styles.emptyText}>No new notifications</Text>}
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
  card: { backgroundColor: Colors.dark.surface, borderColor: Colors.dark.border, borderWidth: 1, padding: 16, borderRadius: 12, marginBottom: 10 },
  unreadCard: { borderLeftWidth: 4, borderLeftColor: '#06b6d4', backgroundColor: 'rgba(6, 182, 212, 0.04)', borderColor: 'rgba(6, 182, 212, 0.15)' },
  row: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  content: { flex: 1 },
  message: { fontSize: 14, color: Colors.dark.textSecondary, marginBottom: 4 },
  boldText: { fontWeight: 'bold', color: Colors.dark.text },
  date: { fontSize: 12, color: Colors.dark.textMuted },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#06b6d4', marginLeft: 8 },
  emptyText: { textAlign: 'center', color: Colors.dark.textMuted, marginTop: 50 }
});