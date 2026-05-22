import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_BASE_URL } from '../config';

interface Notification {
  _id: string;
  message: string;
  type: 'link_request' | 'system';
  isRead: boolean;
  createdAt: string;
  relatedId?: string;
}

export default function ManagerNotifications() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('userId').then((id) => {
      if (id) {
        setUserId(id);
        fetchNotifications(id);
      } else {
        setLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    if (userId && notifications.some(n => !n.isRead)) {
      const timer = setTimeout(() => {
        markAllAsRead();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [userId, notifications]);

  const fetchNotifications = async (id: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/notifications/${id}`);
      const data = await response.json();
      setNotifications(data);
    } catch (error) {
      console.error("Failed to fetch notifications", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    if (userId) {
      setRefreshing(true);
      fetchNotifications(userId);
    }
  };

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

  const markAllAsRead = async () => {
    if (!userId) return;
    try {
      await fetch(`${API_BASE_URL}/notifications/read-all/${userId}`, { method: 'PUT' });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (error) {
      console.error("Error marking all as read", error);
    }
  };

  const clearAllNotifications = () => {
    if (!userId) return;
    Alert.alert("Clear All", "Are you sure you want to delete all notifications?", [
      { text: "Cancel", style: "cancel" },
      { 
        text: "Clear", 
        style: "destructive", 
        onPress: async () => {
          try {
            await fetch(`${API_BASE_URL}/notifications/clear-all/${userId}`, { method: 'DELETE' });
            setNotifications([]);
          } catch (e) {
            Alert.alert("Error", "Failed to clear notifications");
          }
        }
      }
    ]);
  };

  const renderItem = ({ item }: { item: Notification }) => (
    <TouchableOpacity 
      style={[styles.card, !item.isRead && styles.unreadCard]} 
      onPress={() => markAsRead(item._id)}
      activeOpacity={0.8}
    >
      <View style={styles.row}>
        <View style={[styles.iconBox, { backgroundColor: item.type === 'link_request' ? '#f5f3ff' : '#ecfdf5' }]}>
            <Ionicons 
              name={item.type === 'link_request' ? 'link' : 'notifications'} 
              size={20} 
              color={item.type === 'link_request' ? '#7c3aed' : '#10b981'} 
            />
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
    <View style={styles.container}>
      <LinearGradient colors={['#4f46e5', '#7c3aed', '#9333ea']} style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <TouchableOpacity onPress={clearAllNotifications} style={styles.clearButton}>
          <Ionicons name="trash-outline" size={24} color="white" />
        </TouchableOpacity>
      </LinearGradient>

      {loading ? (
        <View style={styles.center}>
            <ActivityIndicator size="large" color="#7c3aed" />
        </View>
      ) : (
        <FlatList
            data={notifications}
            keyExtractor={(item) => item._id}
            renderItem={renderItem}
            contentContainerStyle={{ padding: 16 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#7c3aed']} />
            }
            ListEmptyComponent={
                <View style={styles.emptyContainer}>
                    <Ionicons name="notifications-off-outline" size={48} color="#94a3b8" />
                    <Text style={styles.emptyText}>No new notifications</Text>
                </View>
            }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f3ff' },
  header: {
    padding: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: { padding: 4 },
  headerTitle: { color: 'white', fontSize: 20, fontWeight: 'bold', letterSpacing: 0.5 },
  clearButton: { padding: 4 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 },
  card: { 
    backgroundColor: 'white', 
    padding: 16, 
    borderRadius: 20, 
    marginBottom: 12, 
    shadowColor: '#4f46e5', 
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05, 
    shadowRadius: 12, 
    elevation: 3 
  },
  unreadCard: { 
    borderLeftWidth: 4, 
    borderLeftColor: '#7c3aed', 
    backgroundColor: 'rgba(124, 58, 237, 0.03)' 
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  content: { flex: 1 },
  message: { fontSize: 14, color: '#475569', marginBottom: 4, lineHeight: 20 },
  boldText: { fontWeight: 'bold', color: '#0f172a' },
  date: { fontSize: 12, color: '#94a3b8' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#f43f5e', marginLeft: 8 },
  emptyText: { textAlign: 'center', color: '#94a3b8', marginTop: 12, fontSize: 16, fontWeight: '500' }
});