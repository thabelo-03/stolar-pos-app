import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_BASE_URL } from '../config';
import { Colors } from '../../constants/theme';
import { refreshActiveShopGlobal } from '../../hooks/use-active-shop';

interface Shop {
  _id: string;
  name: string;
  location: string;
  branchCode: string;
  manager?: {
    name: string;
    email: string;
  };
}

export default function MyShopScreen() {
  const [shop, setShop] = useState<Shop | null>(null);
  const [pendingRequest, setPendingRequest] = useState<{
    _id: string;
    shop: { name: string; branchCode: string };
    status: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [branchCode, setBranchCode] = useState('');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [modalType, setModalType] = useState<'leave' | 'switch'>('leave');
  const [recentShops, setRecentShops] = useState<any[]>([]);
  
  // Manager Shop Selection State
  const [shops, setShops] = useState<any[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [shopSelectionVisible, setShopSelectionVisible] = useState(false);
  const [lockoutVisible, setLockoutVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchShopDetails();
      loadRecentShops();
      fetchManagerShops();
    }, [])
  );

  const fetchManagerShops = async () => {
    const role = await AsyncStorage.getItem('userRole');
    const userId = await AsyncStorage.getItem('userId');
    setUserRole(role);
    if (role === 'manager' && userId) {
        try {
            const res = await fetch(`${API_BASE_URL}/shops?managerId=${userId}`);
            const data = await res.json();
            if (Array.isArray(data)) {
                setShops(data);
                // Auto-intercept: If manager has no shop selected in storage, show modal
                const currentShopId = await AsyncStorage.getItem('shopId');
                if (!currentShopId && data.length > 0) {
                    setShopSelectionVisible(true);
                }
            }
        } catch(e) {}
    }
  };

  const loadRecentShops = async () => {
    try {
      const stored = await AsyncStorage.getItem('recent_shops');
      if (stored) setRecentShops(JSON.parse(stored));
    } catch (e) {}
  };

  const saveToRecent = async (shopData: { name: string, branchCode: string }) => {
    try {
      const stored = await AsyncStorage.getItem('recent_shops');
      let list = stored ? JSON.parse(stored) : [];
      list = list.filter((s: any) => s.branchCode !== shopData.branchCode);
      list.unshift(shopData);
      if (list.length > 3) list = list.slice(0, 3);
      await AsyncStorage.setItem('recent_shops', JSON.stringify(list));
      setRecentShops(list);
    } catch (e) {}
  };

  const fetchShopDetails = async () => {
    try {
      const userId = await AsyncStorage.getItem('userId');
      if (!userId) return;

      // 1. Check AsyncStorage first (Manager selection or active session)
      let activeShopId = await AsyncStorage.getItem('shopId');

      if (!activeShopId) {
        // 2. Fallback: Get User to find their shopId (Cashier linked in DB)
        const userRes = await fetch(`${API_BASE_URL}/users/${userId}`);
        const user = await userRes.json();
        activeShopId = user.shopId;
      }

      if (activeShopId) {
        // 3. Get Shop details
        const shopRes = await fetch(`${API_BASE_URL}/shops/${activeShopId}`);
        if (shopRes.ok) {
          const shopData = await shopRes.json();
          setShop(shopData);
          setPendingRequest(null);
          saveToRecent({ name: shopData.name, branchCode: shopData.branchCode });

          // CHECK MANAGER SUBSCRIPTION
          if (shopData.manager && shopData.manager.subscriptionStatus === 'expired') {
            setLockoutVisible(true);
          }
        }
      } else {
        setShop(null);
        // 3. Check if they have a pending request
        const reqRes = await fetch(`${API_BASE_URL}/shops/cashier-request/${userId}`);
        if (reqRes.ok) {
          const reqData = await reqRes.json();
          setPendingRequest(reqData);
        }
      }
    } catch (error) {
      console.error("Error fetching shop:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveShop = async () => {
    setProcessing(true);
    try {
      const userId = await AsyncStorage.getItem('userId');
      if (!userId) {
        Alert.alert("Error", "Session expired. Please login again.");
        return;
      }

      const response = await fetch(`${API_BASE_URL}/shops/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.log("Leave Shop Response Error:", text);
        data = { message: "Invalid server response" };
      }

      if (response.ok) {
        await AsyncStorage.removeItem('shopId');
        await refreshActiveShopGlobal();
        setModalVisible(false);
        setShop(null);
        Alert.alert("Success", modalType === 'switch' ? "Disconnected. Enter new branch code." : "You have left the shop.");
        router.replace('/(cashier)/my-shop');
      } else {
        Alert.alert("Error", data.message || "Failed to leave shop");
      }
    } catch (error) {
      console.log("Leave Shop Error:", error);
      Alert.alert("Error", "Network error occurred.");
    } finally {
      setProcessing(false);
    }
  };

  const handleJoinShop = async (codeOverride?: string) => {
    const codeToUse = typeof codeOverride === 'string' ? codeOverride : branchCode;
    if (!codeToUse.trim()) {
      Alert.alert("Error", "Please enter a branch code");
      return;
    }

    setProcessing(true);
    try {
      const userId = await AsyncStorage.getItem('userId');
      if (!userId) {
        Alert.alert("Error", "Session expired. Please login again.");
        return;
      }

      const response = await fetch(`${API_BASE_URL}/shops/request-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          branchCode: codeToUse.trim().toUpperCase(), 
          cashierId: userId 
        }),
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.log("Join Shop Response Error:", text);
        data = { message: "Invalid server response" };
      }
      
      if (response.ok) {
        Alert.alert("Success", "Request sent! Waiting for manager approval.", [
          { text: "OK", onPress: () => router.replace('/') }
        ]);
        setBranchCode('');
      } else {
        Alert.alert("Error", data.message || "Failed to send request");
      }
    } catch (error) {
      console.log("Join Shop Error:", error);
      Alert.alert("Error", "Network error occurred.");
    } finally {
      setProcessing(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!pendingRequest) return;
    setProcessing(true);
    try {
      const response = await fetch(`${API_BASE_URL}/shops/requests/${pendingRequest._id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        Alert.alert("Success", "Request cancelled.");
        setPendingRequest(null);
      } else {
        Alert.alert("Error", "Failed to cancel request.");
      }
    } catch (error) {
      Alert.alert("Error", "Network error.");
    } finally {
      setProcessing(false);
    }
  };

  const handleSwitchPress = async () => {
    let currentShops = shops;
    if (userRole === 'manager' && currentShops.length === 0) {
        const userId = await AsyncStorage.getItem('userId');
        if (userId) {
             try {
                 const res = await fetch(`${API_BASE_URL}/shops?managerId=${userId}`);
                 const data = await res.json();
                 if (Array.isArray(data)) currentShops = data;
             } catch(e) {}
        }
    }

    if (userRole === 'manager' && currentShops.length > 0) {
        setShops(currentShops);
        setShopSelectionVisible(true);
    } else {
        setModalType('switch');
        setModalVisible(true);
    }
  };

  const handleSelectShop = async (selectedShop: any) => {
    await AsyncStorage.setItem('shopId', selectedShop._id);
    await refreshActiveShopGlobal();
    setShopSelectionVisible(false);
    Alert.alert("Success", `Switched to ${selectedShop.name}`);
    fetchShopDetails();
  };

  const handleLogout = async () => {
    await AsyncStorage.clear();
    router.replace('/(auth)/login');
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#06b6d4" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0a0f1e', '#162444']} style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Text style={styles.title}>My Shop</Text>
        <Text style={styles.subtitle}>Branch Information</Text>
      </LinearGradient>

      <View style={styles.content}>
        {shop ? (
          <>
            <View style={styles.card}>
              <View style={styles.storeIconWrapper}>
                <Ionicons name="storefront" size={42} color="#06b6d4" />
              </View>
              <Text style={styles.shopName}>{shop.name}</Text>
              <Text style={styles.shopDetail}>{shop.location}</Text>
              <Text style={styles.shopCodeBadge}>CODE: {shop.branchCode}</Text>
              {shop.manager && (shop.manager.name || shop.manager.email) ? (
                <Text style={styles.managerText}>Manager: {shop.manager.name}</Text>
              ) : (
                <Text style={styles.managerText}>Manager: N/A</Text>
              )}
            </View>

            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.quickActionsRow}>
                <TouchableOpacity 
                    style={styles.quickActionCard} 
                    onPress={() => router.push('/stock-take')}
                >
                    <View style={styles.actionIconCircle}>
                      <Ionicons name="clipboard" size={26} color="#06b6d4" />
                    </View>
                    <Text style={styles.quickActionText}>Stock Take</Text>
                </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={styles.switchButton} 
              onPress={handleSwitchPress}
            >
              <Text style={styles.switchButtonText}>Switch Shop</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.leaveButton} 
              onPress={() => { setModalType('leave'); setModalVisible(true); }}
            >
              <Text style={styles.leaveButtonText}>Leave Shop</Text>
            </TouchableOpacity>
          </>
        ) : pendingRequest ? (
          <View style={styles.emptyState}>
            <View style={styles.iconCirclePending}>
              <Ionicons name="time-outline" size={54} color="#f59e0b" />
            </View>
            <Text style={styles.emptyText}>Request Pending Approval</Text>
            <View style={styles.pendingCard}>
              <Text style={styles.pendingShopLabel}>Shop Name</Text>
              <Text style={styles.pendingShopVal}>{pendingRequest.shop.name}</Text>
              <Text style={styles.pendingShopLabel}>Branch Code</Text>
              <Text style={styles.pendingShopVal}>{pendingRequest.shop.branchCode}</Text>
            </View>
            
            <TouchableOpacity 
              style={[styles.leaveButton, { width: '100%', marginTop: 10 }]} 
              onPress={handleCancelRequest}
              disabled={processing}
            >
              {processing ? <ActivityIndicator color="#f43f5e" /> : <Text style={styles.leaveButtonText}>Cancel Request</Text>}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.iconCircleAlert}>
              <Ionicons name="alert-circle-outline" size={54} color="#64748b" />
            </View>
            <Text style={styles.emptyText}>You are not linked to any shop.</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Enter Branch Code (e.g. STLR-1234)"
              placeholderTextColor="#64748b"
              value={branchCode}
              onChangeText={setBranchCode}
              autoCapitalize="characters"
            />

            <TouchableOpacity 
              style={styles.linkButton}
              onPress={() => handleJoinShop()}
              disabled={processing}
            >
              {processing ? <ActivityIndicator color="#0a0f1e" /> : <Text style={styles.linkButtonText}>Send Request</Text>}
            </TouchableOpacity>

            {recentShops.length > 0 && (
              <View style={styles.recentSection}>
                <Text style={styles.recentLabel}>Recent Shops</Text>
                {recentShops.map((item, index) => (
                  <TouchableOpacity 
                    key={index} 
                    style={styles.recentItem} 
                    onPress={() => {
                      setBranchCode(item.branchCode);
                      Alert.alert(
                        "Join Shop",
                        `Send request to join ${item.name}?`,
                        [
                          { text: "Cancel", style: "cancel" },
                          { text: "Join", onPress: () => handleJoinShop(item.branchCode) }
                        ]
                      );
                    }}
                  >
                    <View>
                      <Text style={styles.recentName}>{item.name}</Text>
                      <Text style={styles.recentCode}>{item.branchCode}</Text>
                    </View>
                    <Ionicons name="copy-outline" size={20} color="#06b6d4" />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}
      </View>

      {/* CONFIRMATION MODAL */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={[styles.modalIconWrapper, { backgroundColor: modalType === 'switch' ? 'rgba(6, 182, 212, 0.15)' : 'rgba(244, 63, 94, 0.15)' }]}>
              <Ionicons 
                name={modalType === 'switch' ? "swap-horizontal" : "warning-outline"} 
                size={32} 
                color={modalType === 'switch' ? "#06b6d4" : "#f43f5e"} 
              />
            </View>
            <Text style={styles.modalTitle}>{modalType === 'switch' ? 'Switch Shop?' : 'Leave Shop?'}</Text>
            <Text style={styles.modalText}>
              {modalType === 'switch' 
                ? `To switch branches, you must disconnect from ${shop?.name} first. Continue?`
                : `Are you sure you want to leave ${shop?.name}? You will lose access to this shop's sales and inventory.`}
            </Text>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.cancelBtn]} 
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalBtn, styles.confirmBtn]} 
                onPress={handleLeaveShop}
                disabled={processing}
              >
                {processing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.confirmBtnText}>{modalType === 'switch' ? 'Yes, Switch' : 'Yes, Leave'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MANAGER SHOP SELECTION MODAL */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={shopSelectionVisible}
        onRequestClose={() => setShopSelectionVisible(false)}
      >
        <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
                <View style={styles.modalIconWrapper}>
                  <Ionicons name="storefront" size={32} color="#06b6d4" />
                </View>
                <Text style={styles.modalTitle}>Select Shop</Text>
                <Text style={styles.modalText}>Choose a shop to manage.</Text>
                
                <FlatList
                    data={shops}
                    keyExtractor={(item) => item._id}
                    renderItem={({ item }) => (
                        <TouchableOpacity style={styles.shopSelectionItem} onPress={() => handleSelectShop(item)}>
                            <Ionicons name="storefront" size={20} color="#06b6d4" style={{marginRight: 10}} />
                            <Text style={styles.shopSelectionText}>{item.name}</Text>
                            <Ionicons name="chevron-forward" size={20} color="#64748b" style={{marginLeft: 'auto'}} />
                        </TouchableOpacity>
                    )}
                    style={{maxHeight: 220, width: '100%'}}
                />

                <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn, {marginTop: 15, width: '100%'}]} onPress={() => setShopSelectionVisible(false)}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
            </View>
        </View>
      </Modal>

      {/* LOCKOUT MODAL */}
      <Modal visible={lockoutVisible} transparent={false} animationType="fade">
        <View style={[styles.modalOverlay, { backgroundColor: '#0a0f1e' }]}>
          <View style={styles.modalContainer}>
            <View style={[styles.modalIconWrapper, { backgroundColor: 'rgba(244, 63, 94, 0.15)', marginBottom: 20 }]}>
              <Ionicons name="lock-closed" size={48} color="#f43f5e" />
            </View>
            <Text style={[styles.modalTitle, { color: '#f43f5e' }]}>Access Denied</Text>
            <Text style={styles.modalText}>
              The Shop you are trying to access has not paid its subscription.
            </Text>
            <Text style={[styles.modalText, { fontWeight: 'bold', color: '#fff', marginTop: -10 }]}>
              Please contact your manager.
            </Text>
            <TouchableOpacity style={[styles.modalBtn, styles.confirmBtn, { width: '100%', marginTop: 15, paddingVertical: 15 }]} onPress={handleLogout}>
              <Text style={styles.confirmBtnText}>Log Out</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.dark.bg },
  header: {
    padding: 25,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  title: {
    color: Colors.dark.text,
    fontSize: 26,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  subtitle: {
    color: '#06b6d4',
    fontSize: 14,
    marginTop: 2,
  },
  content: { flex: 1, padding: 20, justifyContent: 'center' },
  card: { 
    backgroundColor: 'rgba(255, 255, 255, 0.05)', 
    padding: 24, 
    borderRadius: 20, 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: 'rgba(255, 255, 255, 0.08)', 
    marginBottom: 25 
  },
  storeIconWrapper: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  shopName: { fontSize: 22, fontWeight: 'bold', color: Colors.dark.text, marginBottom: 6 },
  shopDetail: { fontSize: 16, color: Colors.dark.textSecondary, marginBottom: 4 },
  shopCodeBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0a0f1e',
    backgroundColor: '#06b6d4',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
    marginTop: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  managerText: { fontSize: 14, color: '#94a3b8', marginTop: 12 },
  switchButton: { 
    backgroundColor: 'rgba(6, 182, 212, 0.12)', 
    padding: 16, 
    borderRadius: 16, 
    alignItems: 'center', 
    marginBottom: 12, 
    borderWidth: 1, 
    borderColor: 'rgba(6, 182, 212, 0.25)' 
  },
  switchButtonText: { color: '#06b6d4', fontWeight: 'bold', fontSize: 16 },
  leaveButton: { 
    backgroundColor: 'rgba(244, 63, 94, 0.12)', 
    padding: 16, 
    borderRadius: 16, 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: 'rgba(244, 63, 94, 0.25)' 
  },
  leaveButtonText: { color: '#f43f5e', fontWeight: 'bold', fontSize: 16 },
  sectionTitle: { 
    fontSize: 12, 
    fontWeight: 'bold', 
    color: Colors.dark.textSecondary, 
    marginBottom: 12, 
    textTransform: 'uppercase', 
    letterSpacing: 1.5, 
    marginTop: 10 
  },
  quickActionsRow: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 15,
  },
  quickActionCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  actionIconCircle: { 
    width: 50, 
    height: 50, 
    borderRadius: 25, 
    backgroundColor: 'rgba(6, 182, 212, 0.12)', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 10 
  },
  quickActionText: { fontSize: 14, fontWeight: 'bold', color: Colors.dark.text },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  iconCirclePending: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconCircleAlert: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyText: { fontSize: 18, fontWeight: 'bold', color: Colors.dark.text, marginTop: 10, marginBottom: 20, textAlign: 'center' },
  pendingCard: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 20,
  },
  pendingShopLabel: {
    fontSize: 12,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  pendingShopVal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginBottom: 16,
  },
  linkButton: { backgroundColor: '#06b6d4', paddingHorizontal: 24, paddingVertical: 16, borderRadius: 16, width: '100%', alignItems: 'center' },
  linkButtonText: { color: '#0a0f1e', fontWeight: 'bold', fontSize: 16 },
  input: { 
    backgroundColor: 'rgba(255, 255, 255, 0.04)', 
    width: '100%', 
    padding: 20, 
    borderRadius: 16, 
    marginBottom: 15, 
    borderWidth: 1, 
    borderColor: 'rgba(255, 255, 255, 0.08)', 
    fontSize: 16, 
    textAlign: 'center',
    color: '#fff'
  },
  
  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(5, 7, 14, 0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContainer: { 
    backgroundColor: '#111827', 
    borderRadius: 24, 
    padding: 24, 
    width: '100%', 
    maxWidth: 340, 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalIconWrapper: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.dark.text, marginTop: 6, marginBottom: 8 },
  modalText: { fontSize: 14, color: Colors.dark.textSecondary, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  modalButtons: { flexDirection: 'row', width: '100%', gap: 12 },
  modalBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cancelBtn: { backgroundColor: 'rgba(255, 255, 255, 0.08)' },
  cancelBtnText: { color: Colors.dark.textSecondary, fontWeight: '600' },
  confirmBtn: { backgroundColor: '#f43f5e' },
  confirmBtnText: { color: '#fff', fontWeight: 'bold' },
  
  recentSection: { width: '100%', marginTop: 30 },
  recentLabel: { fontSize: 12, fontWeight: 'bold', color: '#64748b', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 },
  recentItem: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    backgroundColor: 'rgba(255, 255, 255, 0.04)', 
    padding: 16, 
    borderRadius: 16, 
    marginBottom: 10, 
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  recentName: { fontSize: 16, fontWeight: 'bold', color: Colors.dark.text },
  recentCode: { fontSize: 12, color: Colors.dark.textSecondary, marginTop: 2 },
  shopSelectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    width: '100%',
  },
  shopSelectionText: { fontSize: 16, fontWeight: '600', color: Colors.dark.text },
});

