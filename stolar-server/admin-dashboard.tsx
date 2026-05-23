import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    RefreshControl,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { API_BASE_URL } from '../app/config';

interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
  subscriptionStatus: string;
  subscriptionExpiry?: string;
  shopCount?: number;
}

export default function AdminDashboard() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [monthsToAdd, setMonthsToAdd] = useState('1');
  const [planType, setPlanType] = useState<'standard' | 'premium'>('standard');
  const [activating, setActivating] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/users`);
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      } else {
        Alert.alert("Error", "Failed to fetch users");
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Network error fetching users");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleActivateUser = async () => {
    if (!selectedUser) return;
    
    setActivating(true);
    try {
      const response = await fetch(`${API_BASE_URL}/admin/activate-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUser._id,
          months: parseInt(monthsToAdd),
          planType: planType // Send selected plan type
        })
      });

      const data = await response.json();
      if (data.success) {
        Alert.alert("Success", `Activated ${selectedUser.name} for ${monthsToAdd} month(s).`);
        setSelectedUser(null);
        setMonthsToAdd('1');
        setPlanType('standard');
        fetchUsers(); // Refresh list
      } else {
        Alert.alert("Error", data.message || "Activation failed");
      }
    } catch (error) {
      Alert.alert("Error", "Network error");
    } finally {
      setActivating(false);
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.clear();
    router.replace('/');
  };

  const renderUserItem = ({ item }: { item: User }) => {
    const isExpired = item.subscriptionExpiry 
      ? new Date(item.subscriptionExpiry) < new Date() 
      : true;

    // Don't show activation for admins, usually
    const canActivate = item.role !== 'admin';
    const isPremium = (item.shopCount || 0) >= 2;

    return (
      <View style={styles.userCard}>
        <View style={styles.userInfo}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.userName}>{item.name}</Text>
            {isPremium && (
              <View style={{ backgroundColor: '#f59e0b', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}><Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>PREMIUM</Text></View>
            )}
          </View>
          <Text style={styles.userEmail}>{item.email}</Text>
          <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Shops: {item.shopCount || 0}</Text>
          <View style={styles.badges}>
            <View style={[styles.badge, { backgroundColor: '#e0f2fe' }]}>
              <Text style={[styles.badgeText, { color: '#0284c7' }]}>{item.role.toUpperCase()}</Text>
            </View>
            {item.role !== 'admin' && (
              <View style={[styles.badge, { backgroundColor: isExpired ? '#fee2e2' : '#dcfce7' }]}>
                <Text style={[styles.badgeText, { color: isExpired ? '#dc2626' : '#16a34a' }]}>
                  {isExpired ? 'EXPIRED' : 'ACTIVE'}
                </Text>
              </View>
            )}
          </View>
          {item.subscriptionExpiry && (
            <Text style={styles.expiryText}>
              Expires: {new Date(item.subscriptionExpiry).toDateString()}
            </Text>
          )}
        </View>

        {canActivate && (
          <TouchableOpacity 
            style={styles.activateBtn}
            onPress={() => {
              setSelectedUser(item);
              setPlanType((item.shopCount || 0) >= 2 ? 'premium' : 'standard');
            }}
          >
            <Ionicons name="flash" size={20} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Admin Dashboard</Text>
        <TouchableOpacity onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={28} color="#ef4444" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#1e40af" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item._id}
          renderItem={renderUserItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchUsers(); }} />
          }
          ListEmptyComponent={<Text style={styles.emptyText}>No users found.</Text>}
        />
      )}

      {/* ACTIVATION MODAL */}
      <Modal
        visible={!!selectedUser}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedUser(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Activate Subscription</Text>
            <Text style={styles.modalSubtitle}>
              Manually extend subscription for {selectedUser?.name} (Cash Payment).
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Months to Add:</Text>
              <TextInput
                style={styles.input}
                value={monthsToAdd}
                onChangeText={setMonthsToAdd}
                keyboardType="numeric"
                placeholder="1"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Plan Type:</Text>
              <View style={styles.planSelector}>
                <TouchableOpacity 
                  style={[styles.planOption, planType === 'standard' && styles.planOptionActive]} 
                  onPress={() => setPlanType('standard')}
                >
                  <Text style={[styles.planText, planType === 'standard' && styles.planTextActive]}>Standard (R150)</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.planOption, planType === 'premium' && styles.planOptionActive]} 
                  onPress={() => setPlanType('premium')}
                >
                  <Text style={[styles.planText, planType === 'premium' && styles.planTextActive]}>Premium (R400)</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => setSelectedUser(null)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.modalBtn, styles.confirmBtn]}
                onPress={handleActivateUser}
                disabled={activating}
              >
                {activating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.confirmBtnText}>Activate</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#1e293b' },
  listContent: { padding: 16 },
  emptyText: { textAlign: 'center', marginTop: 50, color: '#94a3b8' },
  
  userCard: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  userInfo: { flex: 1 },
  userName: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  userEmail: { fontSize: 14, color: '#64748b', marginBottom: 8 },
  badges: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  badgeText: { fontSize: 12, fontWeight: 'bold' },
  expiryText: { fontSize: 12, color: '#94a3b8' },

  activateBtn: { backgroundColor: '#1e40af', width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginLeft: 12 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContainer: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 340 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b', marginBottom: 8 },
  modalSubtitle: { fontSize: 14, color: '#64748b', marginBottom: 20 },
  
  inputGroup: { marginBottom: 24 },
  label: { fontSize: 14, fontWeight: '600', color: '#1e293b', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 12, fontSize: 16, backgroundColor: '#f8fafc' },
  
  planSelector: { flexDirection: 'row', gap: 10 },
  planOption: { flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1', alignItems: 'center', backgroundColor: '#fff' },
  planOptionActive: { backgroundColor: '#eff6ff', borderColor: '#1e40af' },
  planText: { color: '#64748b', fontWeight: '600' },
  planTextActive: { color: '#1e40af', fontWeight: 'bold' },

  modalActions: { flexDirection: 'row', gap: 12 },
  modalBtn: { flex: 1, padding: 14, borderRadius: 8, alignItems: 'center' },
  cancelBtn: { backgroundColor: '#f1f5f9' },
  cancelBtnText: { color: '#64748b', fontWeight: 'bold' },
  confirmBtn: { backgroundColor: '#1e40af' },
  confirmBtnText: { color: '#fff', fontWeight: 'bold' }
});