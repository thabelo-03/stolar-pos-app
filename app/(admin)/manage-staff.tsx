import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Modal,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
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
  subscriptionStatus?: string;
  subscriptionExpiry?: string;
  shopCount?: number;
}

const API_ALL_USERS = `${API_BASE_URL}/users`;
const API_CASH_PAYERS = `${API_BASE_URL}/users/cash-payers`;

export default function ManageStaff() {
  const router = useRouter();
  const [staff, setStaff] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterMode, setFilterMode] = useState<'all' | 'expired' | 'cash'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null); // If null, manual entry mode
  const [monthsToAdd, setMonthsToAdd] = useState('1');
  const [planType, setPlanType] = useState<'standard' | 'premium'>('standard');
  const [activating, setActivating] = useState(false);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [deletedHistory, setDeletedHistory] = useState<any[]>([]);
  const [historyView, setHistoryView] = useState<'active' | 'deleted'>('active');
  const [historyFilter, setHistoryFilter] = useState<'current' | 'last' | 'all'>('all');
  const [totalHistoryAmount, setTotalHistoryAmount] = useState(0);
  
  // Delete Payment State
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<any>(null);
  const [deleteReason, setDeleteReason] = useState('');

  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchStaff = async () => {
    try {
      // Only show global loading on first load, not during refresh
      if (!refreshing) setLoading(true);
      
      // If 'expired', we fetch all and filter locally
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
                fetchStaff(); // Force refresh from server to ensure state is synced
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

  const openActivationModal = (user?: User) => {
    if (user) {
      setSelectedUser(user);
      setPlanType((user.shopCount || 0) >= 2 ? 'premium' : 'standard');
    } else {
      setSelectedUser(null);
      setPlanType('standard');
    }
    setMonthsToAdd('1');
    setModalVisible(true);
  };

  const handleActivateUser = async () => {
    let userId = selectedUser?._id;
    let userName = selectedUser?.name;
    let userEmail = selectedUser?.email;

    if (!userId) {
      Alert.alert("Error", "Please select a user.");
      return;
    }
    
    setActivating(true);
    try {
      const months = parseInt(monthsToAdd) || 1;
      
      console.log("Sending activation request:", { userId, userName, userEmail, planType });

      const response = await fetch(`${API_BASE_URL}/admin/activate-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId,
          managerName: userName,
          managerEmail: userEmail,
          months: months,
          planType: planType,
          paymentMethod: 'cash'
        })
      });

      const data = await response.json();
      if (data.success || response.ok) {
        Alert.alert("Success", `Activated ${userName} for ${monthsToAdd} month(s).`);
        if (data.historySaved === false) {
           Alert.alert("Warning", "User activated, but payment history record failed to save.");
        }
        setModalVisible(false);
        fetchStaff();
        // Refresh history immediately so it's ready when viewed
        fetchPaymentHistory(); 
      } else {
        Alert.alert("Error", data.message || "Activation failed");
      }
    } catch (error) {
      console.error("Activation Error:", error);
      Alert.alert("Error", "Network error");
    } finally {
      setActivating(false);
    }
  };

  const fetchPaymentHistory = async () => {
    setLoadingHistory(true);
    try {
      let query = '';
      const now = new Date();
      
      if (historyFilter === 'current') {
        const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
        query = `?startDate=${start}&endDate=${end}`;
      } else if (historyFilter === 'last') {
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
        const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();
        query = `?startDate=${start}&endDate=${end}`;
      }

      const res = await fetch(`${API_BASE_URL}/admin/payment-history${query}`);
      if (res.ok) {
        const data = await res.json();
        console.log("Payment history loaded:", data.history?.length);
        setPaymentHistory(Array.isArray(data.history) ? data.history : []);
        setTotalHistoryAmount(data.totalAmount || 0);
      }
    } catch (e) {
      console.log("History fetch error", e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const fetchDeletedHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/payment-history/deleted`);
      if (res.ok) {
        const data = await res.json();
        setDeletedHistory(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.log("Deleted history fetch error", e);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (historyModalVisible) {
      if (historyView === 'active') fetchPaymentHistory();
      else fetchDeletedHistory();
    }
  }, [historyModalVisible, historyFilter, historyView]);

  const confirmDeletePayment = async () => {
    if (!paymentToDelete || !deleteReason.trim()) {
      Alert.alert("Error", "Please provide a reason for deletion.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/admin/payment-history/${paymentToDelete._id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: deleteReason, adminName: 'Admin' })
      });

      if (res.ok) {
        setDeleteModalVisible(false);
        setDeleteReason('');
        setPaymentToDelete(null);
        fetchPaymentHistory(); // Refresh list
      } else {
        Alert.alert("Error", "Failed to delete payment record.");
      }
    } catch (e) {
      Alert.alert("Error", "Network error.");
    }
  };

  const handleSeedHistory = async () => {
    const managers = staff.filter(u => u.role === 'manager');
    if (managers.length === 0) {
        Alert.alert("Error", "No managers found to seed data for.");
        return;
    }

    Alert.alert(
        "Seed Data",
        "This will create 3 dummy cash payment records for random managers to populate the database fields. Continue?",
        [
            { text: "Cancel", style: "cancel" },
            { 
                text: "Seed", 
                onPress: async () => {
                    setLoadingHistory(true);
                    try {
                        const promises = [];
                        for(let i=0; i<3; i++) {
                            const mgr = managers[Math.floor(Math.random() * managers.length)];
                            const m = Math.floor(Math.random() * 3) + 1;
                            promises.push(
                                fetch(`${API_BASE_URL}/admin/activate-user`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        userId: mgr._id,
                                        managerName: mgr.name,
                                        managerEmail: mgr.email,
                                        months: m,
                                        amount: m * 10,
                                        paymentMethod: 'cash',
                                        isSeed: true
                                    })
                                })
                            );
                        }
                        await Promise.all(promises);
                        Alert.alert("Success", "Seeded 3 records.");
                        fetchPaymentHistory();
                    } catch (e) {
                        Alert.alert("Error", "Failed to seed data.");
                    } finally {
                        setLoadingHistory(false);
                    }
                }
            }
        ]
    );
  };

  const handleExpireManagers = async () => {
    Alert.alert(
      "Debug: Expire Managers",
      "This will set all managers' subscription status to 'expired' so you can test reactivation.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Expire All", 
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const res = await fetch(`${API_BASE_URL}/test/expire-managers`, { method: 'POST' });
              const data = await res.json();
              Alert.alert("Success", data.message);
              fetchStaff();
            } catch (e) {
              Alert.alert("Error", "Failed to expire managers");
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const getRoleColor = (role: string) => {
    switch(role) {
      case 'admin': return '#7c3aed'; // Purple
      case 'manager': return '#2563eb'; // Blue
      case 'cashier': return '#059669'; // Green
      default: return '#64748b'; // Grey
    }
  };

  const getDisplayedStaff = () => {
    let result = staff;

    if (filterMode === 'expired') {
      result = result.filter(u => {
        if (u.role !== 'manager') return false;
        // Fix: Default to false (Active) if expiry is missing, matching the badge logic
        return u.subscriptionExpiry ? new Date(u.subscriptionExpiry) < new Date() : false;
      });
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    }
    return result;
  };

  const renderUserItem = ({ item }: { item: User }) => {
    const isExpired = item.subscriptionExpiry 
      ? new Date(item.subscriptionExpiry) < new Date() 
      : false;
    const isPremium = (item.shopCount || 0) >= 2;

    return (
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
            {isPremium && (
              <View style={{ backgroundColor: '#f59e0b', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 8 }}>
                <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>PREMIUM</Text>
              </View>
            )}
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
             {item.role === 'manager' && (
                <Text style={[styles.expiryText, { color: isExpired ? '#ef4444' : '#10b981' }]}>
                  {isExpired ? ' • Expired' : ' • Active'}
                </Text>
             )}
          </View>
        </View>

      </View>

      {/* Action Buttons Row */}
      <View style={styles.actionRow}>
        <TouchableOpacity onPress={() => Linking.openURL(`mailto:${item.email}`)} style={styles.actionButton}>
          <Ionicons name="mail-outline" size={20} color="#64748b" />
          <Text style={styles.actionText}>Email</Text>
        </TouchableOpacity>

        {item.role === 'manager' && (
          <TouchableOpacity onPress={() => openActivationModal(item)} style={styles.actionButton}>
            <Ionicons name="card-outline" size={20} color="#10b981" />
            <Text style={[styles.actionText, { color: '#10b981' }]}>Activate</Text>
          </TouchableOpacity>
        )}

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
  };

  const displayedStaff = getDisplayedStaff();

  const expiredManagers = staff.filter(u => 
    u.role === 'manager' && 
    // Fix: Default to false (Active) if expiry is missing
    (u.subscriptionExpiry ? new Date(u.subscriptionExpiry) < new Date() : false)
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
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity 
              style={[styles.addButton, { backgroundColor: '#fee2e2' }]}
              onPress={handleExpireManagers}
            >
              <Ionicons name="bug" size={24} color="#ef4444" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.addButton}
              onPress={() => setHistoryModalVisible(true)}
            >
              <Ionicons name="time" size={24} color="#1e3a8a" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.addButton}
              onPress={() => router.push('/(auth)/signup')} // Navigate to create user
            >
              <Ionicons name="add" size={24} color="#1e3a8a" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#94a3b8" style={{ marginRight: 8 }} />
          <TextInput 
            placeholder="Search by name or email..." 
            placeholderTextColor="#94a3b8"
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
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
            style={[styles.filterTab, filterMode === 'expired' && styles.filterTabActive]}
            onPress={() => setFilterMode('expired')}
          >
            <Text style={[styles.filterText, filterMode === 'expired' && styles.filterTextActive]}>Expired</Text>
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
          data={displayedStaff}
          keyExtractor={(item) => item._id}
          renderItem={renderUserItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1e3a8a']} />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={{ color: '#94a3b8', marginTop: 50 }}>No users found matching criteria.</Text>
            </View>
          }
        />
      )}

      {/* Floating Action Button for Manual Cash Payment */}
      <TouchableOpacity style={styles.fab} onPress={() => openActivationModal()}>
        <Ionicons name="cash" size={24} color="white" />
        <Text style={styles.fabText}>Record Cash</Text>
      </TouchableOpacity>

      {/* ACTIVATION MODAL */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                <View style={{ padding: 8, backgroundColor: '#dcfce7', borderRadius: 20, marginRight: 10 }}>
                    <Ionicons name="cash" size={24} color="#16a34a" />
                </View>
                <View>
                    <Text style={styles.modalTitle}>Record Payment</Text>
                    <Text style={{ fontSize: 12, color: '#64748b' }}>Activate user via cash payment</Text>
                </View>
            </View>

            {!selectedUser ? (
              <>
                <Text style={styles.modalSubtitle}>Select an expired manager to activate:</Text>
                <FlatList
                  data={expiredManagers}
                  keyExtractor={item => item._id}
                  style={{ maxHeight: 200, marginBottom: 20 }}
                  renderItem={({ item }) => (
                    <TouchableOpacity style={styles.userSelectItem} onPress={() => setSelectedUser(item)}>
                      <View style={styles.userSelectAvatar}>
                        <Text style={styles.userSelectAvatarText}>{item.name.charAt(0).toUpperCase()}</Text>
                      </View>
                      <View>
                        <Text style={styles.userSelectName}>{item.name}</Text>
                        <Text style={styles.userSelectEmail}>{item.email}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color="#cbd5e1" style={{ marginLeft: 'auto' }} />
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={<Text style={{ color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', padding: 20 }}>No expired managers found.</Text>}
                />
                <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setModalVisible(false)}>
                  <Text style={styles.cancelBtnText}>Close</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.modalSubtitle}>Extend subscription for <Text style={{fontWeight: 'bold', color: '#1e293b'}}>{selectedUser.name}</Text></Text>
                
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
                  <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setSelectedUser(null)}>
                    <Text style={styles.cancelBtnText}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalBtn, styles.confirmBtn]} onPress={handleActivateUser} disabled={activating}>
                    {activating ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmBtnText}>Confirm</Text>}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* DELETE REASON MODAL */}
      <Modal
        visible={deleteModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Delete Payment Record</Text>
            <Text style={styles.modalSubtitle}>Please provide a reason for deleting this payment record. This will be logged.</Text>
            
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              placeholder="Reason (e.g. Mistake entry)"
              multiline
              value={deleteReason}
              onChangeText={setDeleteReason}
            />

            <View style={[styles.modalActions, { marginTop: 20 }]}>
              <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setDeleteModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#ef4444' }]} onPress={confirmDeletePayment}>
                <Text style={styles.confirmBtnText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* HISTORY MODAL */}
      <Modal
        visible={historyModalVisible}
        animationType="slide"
        onRequestClose={() => setHistoryModalVisible(false)}
      >
        <View style={styles.historyContainer}>
          <View style={styles.historyHeader}>
            <Text style={styles.historyTitle}>Payment History</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}>
              <TouchableOpacity onPress={() => historyView === 'active' ? fetchPaymentHistory() : fetchDeletedHistory()}>
                  <Ionicons name="refresh-circle" size={30} color="#1e40af" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setHistoryModalVisible(false)}>
                  <Ionicons name="close-circle" size={30} color="#64748b" />
              </TouchableOpacity>
            </View>
          </View>

          {/* TABS & FILTERS */}
          <View style={{ paddingHorizontal: 20, paddingBottom: 10, backgroundColor: '#fff' }}>
            {/* View Toggle */}
            <View style={{ flexDirection: 'row', marginBottom: 15, backgroundColor: '#f1f5f9', borderRadius: 8, padding: 4 }}>
              <TouchableOpacity 
                style={[styles.filterTab, historyView === 'active' && styles.filterTabActive]} 
                onPress={() => setHistoryView('active')}
              >
                <Text style={[styles.filterText, historyView === 'active' && styles.filterTextActive]}>Active Records</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.filterTab, historyView === 'deleted' && styles.filterTabActive]} 
                onPress={() => setHistoryView('deleted')}
              >
                <Text style={[styles.filterText, historyView === 'deleted' && styles.filterTextActive]}>Deleted Logs</Text>
              </TouchableOpacity>
            </View>

            {/* Date Filters (Only for Active View) */}
            {historyView === 'active' && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity onPress={() => setHistoryFilter('current')} style={[styles.dateFilterBtn, historyFilter === 'current' && styles.dateFilterBtnActive]}>
                    <Text style={[styles.dateFilterText, historyFilter === 'current' && styles.dateFilterTextActive]}>This Month</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setHistoryFilter('last')} style={[styles.dateFilterBtn, historyFilter === 'last' && styles.dateFilterBtnActive]}>
                    <Text style={[styles.dateFilterText, historyFilter === 'last' && styles.dateFilterTextActive]}>Last Month</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setHistoryFilter('all')} style={[styles.dateFilterBtn, historyFilter === 'all' && styles.dateFilterBtnActive]}>
                    <Text style={[styles.dateFilterText, historyFilter === 'all' && styles.dateFilterTextActive]}>All</Text>
                  </TouchableOpacity>
                </View>
                <View>
                  <Text style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Total</Text>
                  <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#16a34a' }}>R{totalHistoryAmount}</Text>
                </View>
              </View>
            )}
          </View>

          {loadingHistory ? (
            <ActivityIndicator size="large" color="#1e3a8a" style={{ marginTop: 50 }} />
          ) : (
            <FlatList
              data={historyView === 'active' ? paymentHistory : deletedHistory}
              keyExtractor={(item, index) => item._id || index.toString()}
              contentContainerStyle={{ padding: 20 }}
              ListEmptyComponent={<Text style={{ textAlign: 'center', color: '#94a3b8', marginTop: 20 }}>No payment records found.</Text>}
              renderItem={({ item }) => (
                <View style={styles.historyItem}>
                  <View style={[styles.historyIcon, historyView === 'deleted' && { backgroundColor: '#fee2e2' }]}>
                    <Ionicons name={historyView === 'active' ? "cash" : "trash"} size={20} color={historyView === 'active' ? "#16a34a" : "#ef4444"} />
                  </View>
                  
                  <View style={{ flex: 1 }}>
                    {historyView === 'active' ? (
                      <>
                        <Text style={styles.historyName}>{item.managerName || 'Unknown User'}</Text>
                        <Text style={styles.historyDate}>{new Date(item.date).toLocaleDateString()} • {new Date(item.date).toLocaleTimeString()}</Text>
                      </>
                    ) : (
                      <>
                        <Text style={styles.historyName} numberOfLines={2}>{item.details}</Text>
                        <Text style={styles.historyDate}>Deleted by {item.userName} • {new Date(item.timestamp).toLocaleDateString()}</Text>
                      </>
                    )}
                  </View>

                  {historyView === 'active' && (
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.historyAmount}>R{item.amount}</Text>
                      <TouchableOpacity 
                        onPress={() => {
                          setPaymentToDelete(item);
                          setDeleteModalVisible(true);
                        }}
                        style={{ marginTop: 4 }}
                      >
                        <Ionicons name="trash-outline" size={16} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
            />
          )}
        </View>
      </Modal>
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
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
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

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
  },
  searchInput: { flex: 1, color: 'white', fontSize: 16 },

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
  expiryText: { fontSize: 13, fontWeight: 'bold' },

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
  confirmBtnText: { color: '#fff', fontWeight: 'bold' },

  // User Selection List
  userSelectItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  userSelectAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  userSelectAvatarText: { color: '#1e40af', fontWeight: 'bold', fontSize: 16 },
  userSelectName: { fontSize: 14, fontWeight: 'bold', color: '#1e293b' },
  userSelectEmail: { fontSize: 12, color: '#64748b' },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    backgroundColor: '#1e40af',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 30,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  fabText: { color: 'white', fontWeight: 'bold', marginLeft: 8 },

  // History Modal
  historyContainer: { flex: 1, backgroundColor: '#f8fafc' },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#fff', paddingTop: 50 },
  historyTitle: { fontSize: 22, fontWeight: 'bold', color: '#1e293b' },
  historyItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  historyIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#dcfce7', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  historyName: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
  historyDate: { fontSize: 12, color: '#64748b' },
  historyAmount: { fontSize: 16, fontWeight: 'bold', color: '#16a34a' },
  historyMethod: { fontSize: 12, color: '#94a3b8', textTransform: 'capitalize' },
  
  dateFilterBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#f1f5f9' },
  dateFilterBtnActive: { backgroundColor: '#1e3a8a' },
  dateFilterText: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  dateFilterTextActive: { color: 'white' },
});