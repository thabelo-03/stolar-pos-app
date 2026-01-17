import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

// Define the Notification Type based on your Mongoose Schema
interface Notification {
  _id: string;
  message: string;
  type: 'link_request' | 'system';
  isRead: boolean;
  createdAt: string;
  relatedId?: string;
}

interface NotificationsProps {
  userId: string; // Pass the logged-in user's ID
}

const Notifications: React.FC<NotificationsProps> = ({ userId }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Replace with your actual API URL
  const API_URL = 'http://localhost:5000/api'; 

  const fetchNotifications = async () => {
    try {
      const response = await fetch(`${API_URL}/notifications/${userId}`);
      const data = await response.json();
      setNotifications(data);
    } catch (error) {
      console.error("Failed to fetch notifications", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (userId) fetchNotifications();
  }, [userId]);

  const markAsRead = async (id: string) => {
    try {
      // Optimistic update: Update UI immediately
      setNotifications(prev => 
        prev.map(n => n._id === id ? { ...n, isRead: true } : n)
      );
      
      // Call API
      await fetch(`${API_URL}/notifications/${id}/read`, {
        method: 'PUT'
      });
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
        <Text style={styles.icon}>{item.type === 'link_request' ? '🔗' : '🔔'}</Text>
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

  if (loading) return <ActivityIndicator size="large" color="#007AFF" />;

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Notifications</Text>
      <FlatList
        data={notifications}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchNotifications(); }} />
        }
        ListEmptyComponent={<Text style={styles.emptyText}>No new notifications</Text>}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f5f5f5' },
  header: { fontSize: 20, fontWeight: 'bold', marginBottom: 16, color: '#333' },
  card: { backgroundColor: 'white', padding: 16, borderRadius: 12, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  unreadCard: { borderLeftWidth: 4, borderLeftColor: '#007AFF', backgroundColor: '#eef7ff' },
  row: { flexDirection: 'row', alignItems: 'center' },
  icon: { fontSize: 24, marginRight: 12 },
  content: { flex: 1 },
  message: { fontSize: 14, color: '#333', marginBottom: 4 },
  boldText: { fontWeight: 'bold', color: '#000' },
  date: { fontSize: 12, color: '#888' },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#007AFF', marginLeft: 8 },
  emptyText: { textAlign: 'center', color: '#888', marginTop: 20 }
});

export default Notifications;