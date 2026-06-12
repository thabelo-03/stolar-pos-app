import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Linking,
  Modal,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_BASE_URL } from '../config';

// ─── Types ────────────────────────────────────────────────────────────────────
interface User {
  _id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'cashier';
  status: 'active' | 'blocked';
  subscriptionStatus?: string;
  subscriptionExpiry?: string;
  shopCount?: number;
  createdAt?: string;
}

const API_ALL_USERS = `${API_BASE_URL}/users`;
const API_CASH_PAYERS = `${API_BASE_URL}/users/cash-payers`;

// ─── Role Config ──────────────────────────────────────────────────────────────
const ROLE_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  admin:   { color: '#3b82f6', bg: 'rgba(59,130,246,0.15)',  label: 'ADMIN' },
  manager: { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)',  label: 'MANAGER' },
  cashier: { color: '#10b981', bg: 'rgba(16,185,129,0.15)', label: 'CASHIER' },
};

// ─── Days Remaining Helper ────────────────────────────────────────────────────
const getDaysRemaining = (expiry?: string): number | null => {
  if (!expiry) return null;
  const diff = new Date(expiry).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

// ─── User Card Component ──────────────────────────────────────────────────────
const UserCard = ({
  item, onEmail, onActivate, onToggleBlock, onDelete,
}: {
  item: User;
  onEmail: () => void;
  onActivate: () => void;
  onToggleBlock: () => void;
  onDelete: () => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  const expandAnim = useRef(new Animated.Value(0)).current;
  const role = ROLE_CONFIG[item.role] || ROLE_CONFIG.cashier;
  const isBlocked = item.status === 'blocked';
  const daysLeft = getDaysRemaining(item.subscriptionExpiry);
  const isExpired = daysLeft !== null && daysLeft <= 0;
  const isPremium = (item.shopCount || 0) >= 2;

  const toggleExpand = () => {
    const toValue = expanded ? 0 : 1;
    setExpanded(!expanded);
    Animated.spring(expandAnim, { toValue, useNativeDriver: false, bounciness: 4 }).start();
  };

  const actionsHeight = expandAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 56] });

  return (
    <View style={[styles.userCard, isBlocked && styles.userCardBlocked]}>
      <TouchableOpacity onPress={toggleExpand} activeOpacity={0.85} style={styles.userCardMain}>
        {/* Avatar */}
        <View style={[styles.avatar, { backgroundColor: isBlocked ? 'rgba(239,68,68,0.15)' : role.bg, borderColor: isBlocked ? 'rgba(239,68,68,0.4)' : role.color + '40' }]}>
          <Text style={[styles.avatarText, { color: isBlocked ? '#ef4444' : role.color }]}>
            {item.name.charAt(0).toUpperCase()}
          </Text>
        </View>

        {/* Info */}
        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Text style={styles.userName} numberOfLines={1}>{item.name}</Text>
            {isPremium && (
              <View style={styles.premiumChip}>
                <Ionicons name="star" size={8} color="#f59e0b" />
                <Text style={styles.premiumChipText}>PRO</Text>
              </View>
            )}
            {isBlocked && (
              <View style={styles.blockedChip}>
                <Text style={styles.blockedChipText}>BLOCKED</Text>
              </View>
            )}
          </View>
          <Text style={styles.userEmail} numberOfLines={1}>{item.email}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <View style={[styles.roleChip, { backgroundColor: role.bg, borderColor: role.color + '40' }]}>
              <Text style={[styles.roleChipText, { color: role.color }]}>{role.label}</Text>
            </View>
            {item.role === 'manager' && daysLeft !== null && (
              <View style={[styles.expiryChip, { backgroundColor: isExpired ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)' }]}>
                <Ionicons name={isExpired ? 'warning-outline' : 'timer-outline'} size={10} color={isExpired ? '#ef4444' : '#10b981'} />
                <Text style={[styles.expiryChipText, { color: isExpired ? '#ef4444' : '#10b981' }]}>
                  {isExpired ? 'Expired' : `${daysLeft}d left`}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Expand arrow */}
        <Animated.View style={{ transform: [{ rotate: expandAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }] }}>
          <Ionicons name="chevron-down" size={18} color="#334155" />
        </Animated.View>
      </TouchableOpacity>

      {/* Expandable Actions */}
      <Animated.View style={[styles.actionsDrawer, { height: actionsHeight, overflow: 'hidden' }]}>
        <View style={styles.actionsRow}>
          <TouchableOpacity onPress={onEmail} style={[styles.actionBtn, { borderColor: 'rgba(59,130,246,0.3)' }]}>
            <Ionicons name="mail-outline" size={16} color="#3b82f6" />
            <Text style={[styles.actionBtnText, { color: '#3b82f6' }]}>Email</Text>
          </TouchableOpacity>

          {item.role === 'manager' && (
            <TouchableOpacity onPress={onActivate} style={[styles.actionBtn, { borderColor: 'rgba(16,185,129,0.3)' }]}>
              <Ionicons name="card-outline" size={16} color="#10b981" />
              <Text style={[styles.actionBtnText, { color: '#10b981' }]}>Activate</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={onToggleBlock} style={[styles.actionBtn, { borderColor: isBlocked ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)' }]}>
            <Ionicons name={isBlocked ? 'lock-open-outline' : 'ban-outline'} size={16} color={isBlocked ? '#10b981' : '#f59e0b'} />
            <Text style={[styles.actionBtnText, { color: isBlocked ? '#10b981' : '#f59e0b' }]}>
              {isBlocked ? 'Unblock' : 'Block'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onDelete} style={[styles.actionBtn, { borderColor: 'rgba(239,68,68,0.3)' }]}>
            <Ionicons name="trash-outline" size={16} color="#ef4444" />
            <Text style={[styles.actionBtnText, { color: '#ef4444' }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ManageUsers() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterMode, setFilterMode] = useState<'all' | 'expired' | 'cash'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Activation modal
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [monthsToAdd, setMonthsToAdd] = useState('1');
  const [planType, setPlanType] = useState<'standard' | 'premium'>('standard');
  const [activating, setActivating] = useState(false);

  // History modal
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [deletedHistory, setDeletedHistory] = useState<any[]>([]);
  const [historyView, setHistoryView] = useState<'active' | 'deleted'>('active');
  const [historyFilter, setHistoryFilter] = useState<'current' | 'last' | 'all'>('all');
  const [totalHistoryAmount, setTotalHistoryAmount] = useState(0);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Delete payment modal
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<any>(null);
  const [deleteReason, setDeleteReason] = useState('');

  const fetchUsers = async () => {
    try {
      if (!refreshing) setLoading(true);
      const url = filterMode === 'cash' ? API_CASH_PAYERS : API_ALL_USERS;
      const res = await fetch(url);
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch {
      Alert.alert('Connection Error', 'Could not fetch users list.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchUsers(); }, [filterMode]);
  const onRefresh = useCallback(() => { setRefreshing(true); fetchUsers(); }, [filterMode]);

  const handleToggleBlock = (user: User) => {
    const newStatus = user.status === 'blocked' ? 'active' : 'blocked';
    const action = newStatus === 'blocked' ? 'Block' : 'Unblock';
    Alert.alert(`${action} User`, `${action} ${user.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm', onPress: async () => {
          try {
            const res = await fetch(`${API_BASE_URL}/users/${user._id}/status`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: newStatus }),
            });
            if (res.ok) fetchUsers();
          } catch { Alert.alert('Error', 'Failed to update status'); }
        },
      },
    ]);
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert('Delete User', `Permanently remove ${name}? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await fetch(`${API_ALL_USERS}/${id}`, { method: 'DELETE' });
            setUsers(prev => prev.filter(u => u._id !== id));
          } catch { Alert.alert('Error', 'Could not delete user'); }
        },
      },
    ]);
  };

  const openActivationModal = (user?: User) => {
    if (user) { setSelectedUser(user); setPlanType((user.shopCount || 0) >= 2 ? 'premium' : 'standard'); }
    else { setSelectedUser(null); setPlanType('standard'); }
    setMonthsToAdd('1');
    setModalVisible(true);
  };

  const handleActivateUser = async () => {
    if (!selectedUser?._id) { Alert.alert('Error', 'Please select a user.'); return; }
    setActivating(true);
    try {
      const months = parseInt(monthsToAdd) || 1;
      const response = await fetch(`${API_BASE_URL}/admin/activate-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUser._id,
          managerName: selectedUser.name,
          managerEmail: selectedUser.email,
          months, planType, paymentMethod: 'cash',
        }),
      });
      const data = await response.json();
      if (data.success || response.ok) {
        Alert.alert('Success', `Activated ${selectedUser.name} for ${monthsToAdd} month(s).`);
        setModalVisible(false);
        fetchUsers();
        fetchPaymentHistory();
      } else {
        Alert.alert('Error', data.message || 'Activation failed');
      }
    } catch { Alert.alert('Error', 'Network error'); }
    finally { setActivating(false); }
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
        setPaymentHistory(Array.isArray(data.history) ? data.history : []);
        setTotalHistoryAmount(data.totalAmount || 0);
      }
    } catch (e) { console.log('History fetch error', e); }
    finally { setLoadingHistory(false); }
  };

  const fetchDeletedHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/payment-history/deleted`);
      if (res.ok) {
        const data = await res.json();
        setDeletedHistory(Array.isArray(data) ? data : []);
      }
    } catch { }
    finally { setLoadingHistory(false); }
  };

  useEffect(() => {
    if (historyModalVisible) {
      if (historyView === 'active') fetchPaymentHistory();
      else fetchDeletedHistory();
    }
  }, [historyModalVisible, historyFilter, historyView]);

  const confirmDeletePayment = async () => {
    if (!paymentToDelete || !deleteReason.trim()) {
      Alert.alert('Error', 'Please provide a reason for deletion.'); return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/admin/payment-history/${paymentToDelete._id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: deleteReason, adminName: 'Admin' }),
      });
      if (res.ok) {
        setDeleteModalVisible(false); setDeleteReason(''); setPaymentToDelete(null);
        fetchPaymentHistory();
      } else { Alert.alert('Error', 'Failed to delete payment record.'); }
    } catch { Alert.alert('Error', 'Network error.'); }
  };

  const handleExpireManagers = async () => {
    Alert.alert('Debug: Expire Managers', 'Set all managers to expired for testing?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Expire All', style: 'destructive', onPress: async () => {
          setLoading(true);
          try {
            const res = await fetch(`${API_BASE_URL}/test/expire-managers`, { method: 'POST' });
            const data = await res.json();
            Alert.alert('Success', data.message);
            fetchUsers();
          } catch { Alert.alert('Error', 'Failed to expire managers'); }
          finally { setLoading(false); }
        },
      },
    ]);
  };

  const getDisplayedUsers = () => {
    let result = users;
    if (filterMode === 'expired') {
      result = result.filter(u => u.role === 'manager' && (u.subscriptionExpiry ? new Date(u.subscriptionExpiry) < new Date() : false));
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    }
    return result;
  };

  const expiredManagers = users.filter(u => u.role === 'manager' && (u.subscriptionExpiry ? new Date(u.subscriptionExpiry) < new Date() : false));
  const getPlanPrice = () => {
    if (!selectedUser) return 100;
    const shopCount = selectedUser.shopCount || 1;
    const baseCost = shopCount * 100;
    return shopCount >= 3 ? baseCost * 0.7 : baseCost;
  };
  const planPrice = getPlanPrice();
  const totalPrice = planPrice * (parseInt(monthsToAdd) || 1);

  const displayedUsers = getDisplayedUsers();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ── Header ── */}
      <LinearGradient
        colors={['#0f172a', '#111827']}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color="#94a3b8" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Manage Users</Text>
            <Text style={styles.headerSub}>{users.length} total • {expiredManagers.length} expired</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity style={[styles.headerBtn, { borderColor: 'rgba(239,68,68,0.3)' }]} onPress={handleExpireManagers}>
              <Ionicons name="bug-outline" size={18} color="#f87171" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerBtn} onPress={() => setHistoryModalVisible(true)}>
              <Ionicons name="time-outline" size={18} color="#94a3b8" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.headerBtn, { borderColor: 'rgba(59,130,246,0.4)' }]} onPress={() => router.push('/(auth)/signup')}>
              <Ionicons name="add" size={18} color="#3b82f6" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={16} color="#475569" />
          <TextInput
            placeholder="Search by name or email..."
            placeholderTextColor="#334155"
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color="#475569" />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Tabs */}
        <View style={styles.filterTabs}>
          {(['all', 'expired', 'cash'] as const).map(mode => (
            <TouchableOpacity
              key={mode}
              style={[styles.filterTab, filterMode === mode && styles.filterTabActive]}
              onPress={() => setFilterMode(mode)}
            >
              <Text style={[styles.filterTabText, filterMode === mode && styles.filterTabTextActive]}>
                {mode === 'all' ? 'All Users' : mode === 'expired' ? `Expired (${expiredManagers.length})` : 'Cash Payers'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </LinearGradient>

      {/* ── List ── */}
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#3b82f6" /></View>
      ) : (
        <FlatList
          data={displayedUsers}
          keyExtractor={item => item._id}
          contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" colors={['#3b82f6']} />}
          renderItem={({ item }) => (
            <UserCard
              item={item}
              onEmail={() => Linking.openURL(`mailto:${item.email}`)}
              onActivate={() => openActivationModal(item)}
              onToggleBlock={() => handleToggleBlock(item)}
              onDelete={() => handleDelete(item._id, item.name)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="people-outline" size={48} color="#1e293b" style={{ marginBottom: 12 }} />
              <Text style={{ color: '#334155', fontWeight: '600' }}>No users found</Text>
            </View>
          }
        />
      )}

      {/* ── FAB ── */}
      <TouchableOpacity style={styles.fab} onPress={() => openActivationModal()}>
        <LinearGradient colors={['#3b82f6', '#1d4ed8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fabGradient}>
          <Ionicons name="cash-outline" size={20} color="white" />
          <Text style={styles.fabText}>Record Cash</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* ── ACTIVATION MODAL ── */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View style={[styles.modalIcon, { backgroundColor: 'rgba(59,130,246,0.15)' }]}>
                <Ionicons name="cash" size={22} color="#3b82f6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Record Cash Payment</Text>
                <Text style={styles.modalSub}>Activate manager subscription</Text>
              </View>
              <TouchableOpacity onPress={() => { setModalVisible(false); setSelectedUser(null); }}>
                <Ionicons name="close" size={22} color="#475569" />
              </TouchableOpacity>
            </View>

            {!selectedUser ? (
              <>
                <Text style={styles.modalSectionLabel}>SELECT EXPIRED MANAGER</Text>
                <FlatList
                  data={expiredManagers}
                  keyExtractor={i => i._id}
                  style={{ maxHeight: 220, marginBottom: 16 }}
                  renderItem={({ item }) => (
                    <TouchableOpacity style={styles.selectItem} onPress={() => {
                      setSelectedUser(item);
                      setPlanType((item.shopCount || 0) >= 2 ? 'premium' : 'standard');
                    }}>
                      <View style={[styles.selectAvatar, { backgroundColor: 'rgba(245,158,11,0.15)' }]}>
                        <Text style={{ color: '#f59e0b', fontWeight: '800', fontSize: 15 }}>{item.name.charAt(0)}</Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.selectName}>{item.name}</Text>
                        <Text style={styles.selectEmail}>{item.email}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color="#334155" />
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={<Text style={styles.emptyText}>No expired managers.</Text>}
                />
              </>
            ) : (
              <>
                {/* Selected user preview */}
                <View style={styles.selectedUserPreview}>
                  <View style={[styles.selectAvatar, { backgroundColor: 'rgba(245,158,11,0.15)' }]}>
                    <Text style={{ color: '#f59e0b', fontWeight: '800', fontSize: 15 }}>{selectedUser.name.charAt(0)}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.selectName}>{selectedUser.name}</Text>
                    <Text style={styles.selectEmail}>{selectedUser.email}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setSelectedUser(null)} style={styles.changeBtn}>
                    <Text style={styles.changeBtnText}>Change</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.modalSectionLabel}>PLAN DETAILS</Text>
                <View style={styles.planDetailsCard}>
                  <View style={styles.planDetailRow}>
                    <Text style={styles.planDetailLabel}>Active Shops:</Text>
                    <Text style={styles.planDetailValue}>{selectedUser.shopCount || 1}</Text>
                  </View>
                  <View style={styles.planDetailRow}>
                    <Text style={styles.planDetailLabel}>Rate Per Shop:</Text>
                    <Text style={styles.planDetailValue}>
                      R{(selectedUser.shopCount || 1) >= 3 ? '70.00' : '100.00'}/mo
                    </Text>
                  </View>
                  {(selectedUser.shopCount || 1) >= 3 && (
                    <View style={styles.discountBadge}>
                      <Ionicons name="gift-outline" size={12} color="#10b981" />
                      <Text style={styles.discountText}>30% Multi-Shop Discount Applied</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.modalSectionLabel}>MONTHS TO ADD</Text>
                <View style={styles.monthsRow}>
                  {['1', '3', '6', '12'].map(m => (
                    <TouchableOpacity
                      key={m}
                      style={[styles.monthBtn, monthsToAdd === m && styles.monthBtnActive]}
                      onPress={() => setMonthsToAdd(m)}
                    >
                      <Text style={[styles.monthBtnText, monthsToAdd === m && styles.monthBtnTextActive]}>{m}mo</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Price Preview */}
                <View style={styles.priceSummary}>
                  <Text style={styles.priceSummaryLabel}>TOTAL DUE</Text>
                  <Text style={styles.priceSummaryValue}>R {totalPrice.toFixed(2)}</Text>
                  <Text style={styles.priceSummarySub}>{parseInt(monthsToAdd) || 1}mo × R{planPrice}/mo</Text>
                </View>

                <TouchableOpacity
                  style={[styles.confirmBtn, activating && { opacity: 0.6 }]}
                  onPress={handleActivateUser}
                  disabled={activating}
                >
                  {activating ? <ActivityIndicator color="white" /> : (
                    <>
                      <Ionicons name="checkmark-circle-outline" size={18} color="white" />
                      <Text style={styles.confirmBtnText}>Confirm Activation</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ── DELETE PAYMENT MODAL ── */}
      <Modal visible={deleteModalVisible} transparent animationType="fade" onRequestClose={() => setDeleteModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxHeight: 320 }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Delete Payment Record</Text>
            <Text style={styles.modalSub}>Provide a reason — this will be logged for audit.</Text>
            <TextInput
              style={styles.reasonInput}
              placeholder="Reason (e.g. Duplicate entry)"
              placeholderTextColor="#334155"
              multiline
              numberOfLines={3}
              value={deleteReason}
              onChangeText={setDeleteReason}
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setDeleteModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={confirmDeletePayment}>
                <Text style={styles.deleteBtnText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── HISTORY MODAL ── */}
      <Modal visible={historyModalVisible} animationType="slide" onRequestClose={() => setHistoryModalVisible(false)}>
        <View style={[styles.historyContainer, { paddingTop: insets.top }]}>
          <View style={styles.historyHeader}>
            <Text style={styles.historyTitle}>Payment History</Text>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <TouchableOpacity onPress={() => historyView === 'active' ? fetchPaymentHistory() : fetchDeletedHistory()}>
                <Ionicons name="refresh-circle" size={28} color="#3b82f6" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setHistoryModalVisible(false)}>
                <Ionicons name="close-circle" size={28} color="#475569" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Tabs */}
          <View style={styles.historyTabRow}>
            {(['active', 'deleted'] as const).map(v => (
              <TouchableOpacity
                key={v}
                style={[styles.historyTab, historyView === v && styles.historyTabActive]}
                onPress={() => setHistoryView(v)}
              >
                <Text style={[styles.historyTabText, historyView === v && styles.historyTabTextActive]}>
                  {v === 'active' ? 'Active Records' : 'Deleted Logs'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {historyView === 'active' && (
            <View style={styles.historyFilterRow}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {(['current', 'last', 'all'] as const).map(f => (
                  <TouchableOpacity key={f} style={[styles.historyFilterBtn, historyFilter === f && styles.historyFilterBtnActive]} onPress={() => setHistoryFilter(f)}>
                    <Text style={[styles.historyFilterText, historyFilter === f && styles.historyFilterTextActive]}>
                      {f === 'current' ? 'This Month' : f === 'last' ? 'Last Month' : 'All'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View>
                <Text style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase' }}>TOTAL</Text>
                <Text style={{ fontSize: 17, fontWeight: '800', color: '#10b981' }}>R{totalHistoryAmount}</Text>
              </View>
            </View>
          )}

          {loadingHistory ? (
            <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 50 }} />
          ) : (
            <FlatList
              data={historyView === 'active' ? paymentHistory : deletedHistory}
              keyExtractor={(item, idx) => item._id || idx.toString()}
              contentContainerStyle={{ padding: 16 }}
              ListEmptyComponent={<Text style={styles.emptyText}>No payment records found.</Text>}
              renderItem={({ item }) => (
                <View style={styles.historyItem}>
                  <View style={[styles.historyItemIcon, { backgroundColor: historyView === 'active' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)' }]}>
                    <Ionicons name={historyView === 'active' ? 'cash' : 'trash'} size={18} color={historyView === 'active' ? '#10b981' : '#ef4444'} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    {historyView === 'active' ? (
                      <>
                        <Text style={styles.historyItemName}>{item.managerName || 'Unknown'}</Text>
                        <Text style={styles.historyItemSub}>{new Date(item.date).toLocaleDateString()} · {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                      </>
                    ) : (
                      <>
                        <Text style={styles.historyItemName} numberOfLines={2}>{item.details}</Text>
                        <Text style={styles.historyItemSub}>Deleted by {item.userName} · {new Date(item.timestamp).toLocaleDateString()}</Text>
                      </>
                    )}
                  </View>
                  {historyView === 'active' && (
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.historyItemAmount}>R{item.amount}</Text>
                      <TouchableOpacity onPress={() => { setPaymentToDelete(item); setDeleteModalVisible(true); }} style={{ marginTop: 4 }}>
                        <Ionicons name="trash-outline" size={14} color="#ef4444" />
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

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0f1e' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },

  // Header
  header: { paddingHorizontal: 16, paddingBottom: 16 },
  headerTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  backBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, marginRight: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  headerTitle: { color: '#f1f5f9', fontSize: 20, fontWeight: '800' },
  headerSub: { color: '#475569', fontSize: 12, marginTop: 2 },
  headerBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },

  // Search
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, paddingHorizontal: 12, height: 44, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  searchInput: { flex: 1, color: '#94a3b8', marginLeft: 8, fontSize: 14 },

  // Filter Tabs
  filterTabs: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 3 },
  filterTab: { flex: 1, paddingVertical: 7, alignItems: 'center', borderRadius: 8 },
  filterTabActive: { backgroundColor: '#1e293b' },
  filterTabText: { color: '#475569', fontSize: 12, fontWeight: '600' },
  filterTabTextActive: { color: '#94a3b8', fontWeight: '700' },

  // User Card
  userCard: { backgroundColor: '#111827', borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  userCardBlocked: { borderColor: 'rgba(239,68,68,0.2)', backgroundColor: '#12111a' },
  userCardMain: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  avatar: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  avatarText: { fontSize: 18, fontWeight: '800' },
  userName: { color: '#e2e8f0', fontSize: 14, fontWeight: '700', flex: 1 },
  userEmail: { color: '#475569', fontSize: 11, marginTop: 2 },

  // Chips
  roleChip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  roleChipText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },
  expiryChip: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  expiryChipText: { fontSize: 9, fontWeight: '700' },
  premiumChip: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: 'rgba(245,158,11,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  premiumChipText: { color: '#f59e0b', fontSize: 8, fontWeight: '800', letterSpacing: 0.3 },
  blockedChip: { backgroundColor: 'rgba(239,68,68,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  blockedChipText: { color: '#ef4444', fontSize: 8, fontWeight: '800', letterSpacing: 0.3 },

  // Action Drawer
  actionsDrawer: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)' },
  actionsRow: { flexDirection: 'row', padding: 10, gap: 8 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1 },
  actionBtnText: { fontSize: 11, fontWeight: '700' },

  // FAB
  fab: { position: 'absolute', bottom: 24, right: 20, borderRadius: 20, overflow: 'hidden', elevation: 8, shadowColor: '#3b82f6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8 },
  fabGradient: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 22, gap: 8 },
  fabText: { color: 'white', fontWeight: '800', fontSize: 14 },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#111827', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  modalHandle: { width: 40, height: 4, backgroundColor: '#1e293b', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  modalIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  modalTitle: { color: '#f1f5f9', fontSize: 16, fontWeight: '800' },
  modalSub: { color: '#475569', fontSize: 12, marginTop: 2 },
  modalSectionLabel: { color: '#334155', fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 8, marginTop: 4 },

  // Select list
  selectItem: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  selectAvatar: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  selectName: { color: '#e2e8f0', fontSize: 13, fontWeight: '700' },
  selectEmail: { color: '#475569', fontSize: 11, marginTop: 2 },
  selectedUserPreview: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: 'rgba(245,158,11,0.08)', borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(245,158,11,0.2)' },
  changeBtn: { backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  changeBtnText: { color: '#64748b', fontSize: 11, fontWeight: '700' },

  // Plan toggle
  planToggle: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  planOption: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  planOptionActive: { backgroundColor: 'rgba(59,130,246,0.15)', borderColor: 'rgba(59,130,246,0.4)' },
  planOptionText: { color: '#475569', fontSize: 12, fontWeight: '700' },
  planOptionTextActive: { color: '#3b82f6' },

  // Months
  monthsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  monthBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  monthBtnActive: { backgroundColor: 'rgba(16,185,129,0.15)', borderColor: 'rgba(16,185,129,0.4)' },
  monthBtnText: { color: '#475569', fontSize: 12, fontWeight: '700' },
  monthBtnTextActive: { color: '#10b981' },

  // Price summary
  priceSummary: { backgroundColor: 'rgba(16,185,129,0.08)', borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)' },
  priceSummaryLabel: { color: '#475569', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  priceSummaryValue: { color: '#10b981', fontSize: 28, fontWeight: '800', marginTop: 4 },
  priceSummarySub: { color: '#334155', fontSize: 11, marginTop: 2 },

  // Confirm / Cancel / Delete buttons
  confirmBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#3b82f6', borderRadius: 14, paddingVertical: 14 },
  confirmBtnText: { color: 'white', fontSize: 14, fontWeight: '800' },
  cancelBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  cancelBtnText: { color: '#64748b', fontWeight: '700' },
  deleteBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: 'rgba(239,68,68,0.15)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' },
  deleteBtnText: { color: '#ef4444', fontWeight: '700' },

  // Reason input
  reasonInput: { backgroundColor: 'rgba(255,255,255,0.05)', color: '#94a3b8', borderRadius: 10, padding: 12, fontSize: 14, height: 80, textAlignVertical: 'top', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', marginTop: 12 },

  // History modal
  historyContainer: { flex: 1, backgroundColor: '#0a0f1e' },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  historyTitle: { color: '#f1f5f9', fontSize: 18, fontWeight: '800' },
  historyTabRow: { flexDirection: 'row', padding: 12, gap: 8 },
  historyTab: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  historyTabActive: { backgroundColor: 'rgba(59,130,246,0.15)', borderColor: 'rgba(59,130,246,0.4)' },
  historyTabText: { color: '#475569', fontSize: 12, fontWeight: '700' },
  historyTabTextActive: { color: '#3b82f6' },
  historyFilterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12 },
  historyFilterBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  historyFilterBtnActive: { backgroundColor: 'rgba(16,185,129,0.15)', borderColor: 'rgba(16,185,129,0.3)' },
  historyFilterText: { color: '#475569', fontSize: 11, fontWeight: '700' },
  historyFilterTextActive: { color: '#10b981' },
  historyItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111827', borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  historyItemIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  historyItemName: { color: '#e2e8f0', fontSize: 13, fontWeight: '700' },
  historyItemSub: { color: '#475569', fontSize: 11, marginTop: 2 },
  historyItemAmount: { color: '#10b981', fontSize: 14, fontWeight: '800' },

  emptyText: { color: '#334155', textAlign: 'center', padding: 24, fontStyle: 'italic' },
  planDetailsCard: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 14,
    marginBottom: 16,
  },
  planDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  planDetailLabel: {
    color: '#94a3b8',
    fontSize: 13,
  },
  planDetailValue: {
    color: '#f1f5f9',
    fontSize: 13,
    fontWeight: '700',
  },
  discountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16,185,129,0.15)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 8,
    gap: 4,
  },
  discountText: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: '700',
  },
});
