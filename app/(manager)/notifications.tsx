import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
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

  // Automatically mark all as read after viewing for 2 seconds
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
    >
      <View style={styles.row}>
        <View style={[styles.iconBox, { backgroundColor: item.type === 'link_request' ? '#e0f2fe' : '#f0fdf4' }]}>
            <Ionicons name={item.type === 'link_request' ? 'link' : 'notifications'} size={24} color={item.type === 'link_request' ? '#0284c7' : '#16a34a'} />
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <TouchableOpacity onPress={clearAllNotifications} style={styles.clearButton}>
          <Ionicons name="trash-outline" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
            <ActivityIndicator size="large" color="#1e40af" />
        </View>
      ) : (
        <FlatList
            data={notifications}
            keyExtractor={(item) => item._id}
            renderItem={renderItem}
            contentContainerStyle={{ padding: 16 }}
            refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1e40af']} />
            }
            ListEmptyComponent={
                <View style={styles.center}>
                    <Ionicons name="notifications-off-outline" size={48} color="#cbd5e1" />
                    <Text style={styles.emptyText}>No new notifications</Text>
                </View>
            }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    backgroundColor: '#1e3a8a',
    padding: 25,
    paddingTop: 60,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  backButton: { marginRight: 15 },
  headerTitle: { color: 'white', fontSize: 22, fontWeight: 'bold' },
  clearButton: { marginLeft: 'auto', padding: 5 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50 },
  card: { backgroundColor: 'white', padding: 16, borderRadius: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  unreadCard: { borderLeftWidth: 4, borderLeftColor: '#1e40af', backgroundColor: '#eff6ff' },
  row: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  content: { flex: 1 },
  message: { fontSize: 14, color: '#334155', marginBottom: 4, lineHeight: 20 },
  boldText: { fontWeight: 'bold', color: '#1e293b' },
  date: { fontSize: 12, color: '#94a3b8' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444', marginLeft: 8 },
  emptyText: { textAlign: 'center', color: '#94a3b8', marginTop: 10, fontSize: 16 }
});