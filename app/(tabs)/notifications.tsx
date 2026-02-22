import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedView } from '../../components/themed-view';
import { API_BASE_URL } from '../config';

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
        <View style={[styles.iconBox, { backgroundColor: item.type === 'link_request' ? '#e0f2fe' : '#fef3c7' }]}>
           <Ionicons name={item.type === 'link_request' ? 'link' : 'notifications'} size={24} color={item.type === 'link_request' ? '#0284c7' : '#d97706'} />
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
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#1e40af" style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchNotifications(); }} />
          }
          ListEmptyComponent={<Text style={styles.emptyText}>No new notifications</Text>}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    backgroundColor: '#1e40af',
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  backButton: { marginRight: 15 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: 'white' },
  list: { padding: 20 },
  card: { backgroundColor: 'white', padding: 16, borderRadius: 12, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  unreadCard: { borderLeftWidth: 4, borderLeftColor: '#1e40af', backgroundColor: '#eff6ff' },
  row: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  content: { flex: 1 },
  message: { fontSize: 14, color: '#333', marginBottom: 4 },
  boldText: { fontWeight: 'bold', color: '#1e293b' },
  date: { fontSize: 12, color: '#94a3b8' },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#1e40af', marginLeft: 8 },
  emptyText: { textAlign: 'center', color: '#94a3b8', marginTop: 50 }
});