import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { API_BASE_URL } from '../config';

// Define User Interface
interface User {
  _id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'cashier';
  status: 'active' | 'blocked';
}

const API_ALL_USERS = `${API_BASE_URL}/users`;
const API_CASH_PAYERS = `${API_BASE_URL}/users/cash-payers`;

export default function ManageStaff() {
  const router = useRouter();
  const [staff, setStaff] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterMode, setFilterMode] = useState<'all' | 'cash'>('all'); // 'all' or 'cash'

  const fetchStaff = async () => {
    try {
      // Only show global loading on first load, not during refresh
      if (!refreshing) setLoading(true);
      
      const url = filterMode === 'cash' ? API_CASH_PAYERS : API_ALL_USERS;
      const res = await fetch(url);
      const data = await res.json();
      
      if (Array.isArray(data)) {
        setStaff(data);
      } else {
        setStaff([]);
      }
    } catch (e) {
      Alert.alert("Connection Error", "Could not fetch staff list.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, [filterMode]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchStaff();
  }, [filterMode]);

  const handleToggleBlock = async (user: User) => {
    const newStatus = user.status === 'blocked' ? 'active' : 'blocked';
    const action = newStatus === 'blocked' ? 'Block' : 'Unblock';

    Alert.alert(
      `${action} User`, 
      `Are you sure you want to ${action.toLowerCase()} ${user.name}?`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Confirm", 
          onPress: async () => {
            try {
              const res = await fetch(`${API_BASE_URL}/users/${user._id}/status`, { 
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
              });
              if (res.ok) {
                // Optimistic update
                setStaff(staff.map(u => u._id === user._id ? { ...u, status: newStatus } : u));
              }
            } catch (e) {
              Alert.alert("Error", "Failed to update status");
            }
          }
        }
      ]
    );
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert("Delete User", `Permanently remove ${name}? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      { 
        text: "Delete", 
        style: "destructive", 
        onPress: async () => {
          try {
            await fetch(`${API_ALL_USERS}/${id}`, { method: 'DELETE' });
            // Optimistic remove
            setStaff(staff.filter(u => u._id !== id));
          } catch (e) {
            Alert.alert("Error", "Could not delete user");
          }
        }
      }
    ]);
  };

  const getRoleColor = (role: string) => {
    switch(role) {
      case 'admin': return '#7c3aed'; // Purple
      case 'manager': return '#2563eb'; // Blue
      case 'cashier': return '#059669'; // Green
      default: return '#64748b'; // Grey
    }
  };

  const renderUserItem = ({ item }: { item: User }) => (
    <View style={[styles.card, item.status === 'blocked' && styles.cardBlocked]}>
      <View style={styles.cardContent}>
        
        {/* Avatar */}
        <View style={[styles.avatar, { backgroundColor: item.status === 'blocked' ? '#fee2e2' : '#eff6ff' }]}>
          <Text style={[styles.avatarText, { color: item.status === 'blocked' ? '#dc2626' : '#1e40af' }]}>
            {item.name.charAt(0).toUpperCase()}
          </Text>
        </View>

        {/* Info */}
        <View style={styles.infoContainer}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{item.name}</Text>
            {item.status === 'blocked' && (
              <View style={styles.blockedBadge}>
                <Text style={styles.blockedText}>BLOCKED</Text>
              </View>
            )}
          </View>
          
          <View style={styles.roleContainer}>
             <View style={[styles.roleDot, { backgroundColor: getRoleColor(item.role) }]} />
             <Text style={styles.roleText}>{item.role.charAt(0).toUpperCase() + item.role.slice(1)}</Text>
             <Text style={styles.emailText}> • {item.email}</Text>
          </View>
        </View>

      </View>

      {/* Action Buttons Row */}
      <View style={styles.actionRow}>
        <TouchableOpacity onPress={() => Linking.openURL(`mailto:${item.email}`)} style={styles.actionButton}>
          <Ionicons name="mail-outline" size={20} color="#64748b" />
          <Text style={styles.actionText}>Email</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => handleToggleBlock(item)} style={styles.actionButton}>
          <Ionicons 
            name={item.status === 'blocked' ? "lock-open-outline" : "ban-outline"} 
            size={20} 
            color={item.status === 'blocked' ? "#059669" : "#f59e0b"} 
          />
          <Text style={[styles.actionText, { color: item.status === 'blocked' ? "#059669" : "#f59e0b" }]}>
            {item.status === 'blocked' ? "Unblock" : "Block"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => handleDelete(item._id, item.name)} style={styles.actionButton}>
          <Ionicons name="trash-outline" size={20} color="#ef4444" />
          <Text style={[styles.actionText, { color: "#ef4444" }]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
             <Text style={styles.title}>Team Members</Text>
             <Text style={styles.subtitle}>{staff.length} Active Users</Text>
          </View>
          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => router.push('/(auth)/signup')} // Navigate to create user
          >
            <Ionicons name="add" size={24} color="#1e3a8a" />
          </TouchableOpacity>
        </View>

        {/* Filter Tabs */}
        <View style={styles.filterContainer}>
          <TouchableOpacity 
            style={[styles.filterTab, filterMode === 'all' && styles.filterTabActive]}
            onPress={() => setFilterMode('all')}
          >
            <Text style={[styles.filterText, filterMode === 'all' && styles.filterTextActive]}>All Staff</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.filterTab, filterMode === 'cash' && styles.filterTabActive]}
            onPress={() => setFilterMode('cash')}
          >
            <Text style={[styles.filterText, filterMode === 'cash' && styles.filterTextActive]}>Cash Payers</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1e3a8a" />
        </View>
      ) : (
        <FlatList
          data={staff}
          keyExtractor={(item) => item._id}
          renderItem={renderUserItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1e3a8a']} />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={{ color: '#94a3b8', marginTop: 50 }}>No users found.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  // Header
  header: {
    backgroundColor: '#1e3a8a',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 28, fontWeight: '800', color: 'white' },
  subtitle: { fontSize: 14, color: '#bfdbfe', marginTop: 4 },
  
  addButton: {
    backgroundColor: 'white',
    width: 44, height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5
  },

  // Filters
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 4,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
  },
  filterTabActive: { backgroundColor: 'white' },
  filterText: { color: '#bfdbfe', fontWeight: '600' },
  filterTextActive: { color: '#1e3a8a', fontWeight: 'bold' },

  // Card
  card: {
    backgroundColor: 'white',
    borderRadius: 20,
    marginBottom: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
  },
  cardBlocked: { opacity: 0.8, backgroundColor: '#f8fafc' },
  
  cardContent: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  avatar: {
    width: 50, height: 50, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 16,
  },
  avatarText: { fontSize: 20, fontWeight: 'bold' },
  
  infoContainer: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  blockedBadge: { backgroundColor: '#fee2e2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 8 },
  blockedText: { color: '#dc2626', fontSize: 10, fontWeight: 'bold' },

  roleContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  roleDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  roleText: { fontSize: 13, color: '#334155', fontWeight: '500' },
  emailText: { fontSize: 13, color: '#94a3b8' },

  // Action Row
  actionRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  actionText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
});