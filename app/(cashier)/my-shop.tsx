import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
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
  const insets = useSafeAreaInsets(); // Use hook directly
  const [modalType, setModalType] = useState<'leave' | 'switch'>('leave');
  const [recentShops, setRecentShops] = useState<any[]>([]);
  
  // Manager Shop Selection State
  const [shops, setShops] = useState<any[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [shopSelectionVisible, setShopSelectionVisible] = useState(false);

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

      // 1. Get User to find their shopId
      const userRes = await fetch(`${API_BASE_URL}/users/${userId}`);
      const user = await userRes.json();

      if (user.shopId) {
        // 2. Get Shop details
        const shopRes = await fetch(`${API_BASE_URL}/shops/${user.shopId}`);
        if (shopRes.ok) {
          const shopData = await shopRes.json();
          setShop(shopData);
          setPendingRequest(null);
          saveToRecent({ name: shopData.name, branchCode: shopData.branchCode });
        }
      } else {
        setShop(null);
        // 3. Check if they have a pending request
        const reqRes = await fetch(`${API_BASE_URL}/shops/cashier-request/${userId}`);
        if (reqRes.ok) {
          const reqData = await reqRes.json();
          // reqData will be null if no request exists
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
        setModalVisible(false);
        setShop(null);
        Alert.alert("Success", modalType === 'switch' ? "Disconnected. Enter new branch code." : "You have left the shop.");
        router.replace('/(cashier)/my-shop'); // Stay on this screen to show Join options
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
    // Ensure we have the latest shops before deciding
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
        setShops(currentShops); // Update state if we fetched fresh
        setShopSelectionVisible(true);
    } else {
        setModalType('switch');
        setModalVisible(true);
    }
  };

  const handleSelectShop = async (selectedShop: any) => {
    await AsyncStorage.setItem('shopId', selectedShop._id);
    setShopSelectionVisible(false);
    Alert.alert("Success", `Switched to ${selectedShop.name}`);
    fetchShopDetails(); // Refresh current screen
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1e40af" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Text style={styles.title}>My Shop</Text>
        <Text style={styles.subtitle}>Branch Information</Text>
      </View>

      <View style={styles.content}>
        {shop ? (
          <>
            <View style={styles.card}>
              <Ionicons name="storefront" size={48} color="#1e40af" style={styles.icon} />
              <Text style={styles.shopName}>{shop.name}</Text>
              <Text style={styles.shopDetail}>{shop.location}</Text>
              <Text style={styles.shopDetail}>Code: {shop.branchCode}</Text>
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
                    <View style={styles.actionIconCircle}><Ionicons name="clipboard" size={28} color="#1e40af" /></View>
                    <Text style={styles.quickActionText}>Stock Take</Text>
                </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={styles.switchButton} 
              onPress={handleSwitchPress} // Now defined
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
            <Ionicons name="time-outline" size={64} color="#f59e0b" />
            <Text style={styles.emptyText}>Request Pending</Text>
            <Text style={styles.shopDetail}>Shop: {pendingRequest.shop.name}</Text>
            <Text style={[styles.shopDetail, { marginBottom: 24 }]}>Code: {pendingRequest.shop.branchCode}</Text>
            
            <TouchableOpacity 
              style={[styles.leaveButton, { width: '100%' }]} 
              onPress={handleCancelRequest}
              disabled={processing}
            >
              {processing ? <ActivityIndicator color="#ef4444" /> : <Text style={styles.leaveButtonText}>Cancel Request</Text>}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="alert-circle-outline" size={64} color="#94a3b8" />
            <Text style={styles.emptyText}>You are not linked to any shop.</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Enter Branch Code (e.g. STLR-1234)"
              value={branchCode}
              onChangeText={setBranchCode}
              autoCapitalize="characters"
            />

            <TouchableOpacity 
              style={styles.linkButton}
              onPress={() => handleJoinShop()}
              disabled={processing}
            >
              {processing ? <ActivityIndicator color="#fff" /> : <Text style={styles.linkButtonText}>Send Request</Text>}
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
                    <Ionicons name="copy-outline" size={20} color="#1e40af" />
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
            <Ionicons name={modalType === 'switch' ? "swap-horizontal" : "warning-outline"} size={40} color={modalType === 'switch' ? "#1e40af" : "#ef4444"} />
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
                <Text style={styles.modalTitle}>Select Shop</Text>
                <Text style={{textAlign: 'center', color: '#64748b', marginBottom: 20}}>Choose a shop to manage.</Text>
                
                <FlatList
                    data={shops}
                    keyExtractor={(item) => item._id}
                    renderItem={({ item }) => (
                        <TouchableOpacity style={styles.shopSelectionItem} onPress={() => handleSelectShop(item)}>
                            <Ionicons name="storefront" size={20} color="#1e40af" style={{marginRight: 10}} />
                            <Text style={styles.shopSelectionText}>{item.name}</Text>
                            <Ionicons name="chevron-forward" size={20} color="#cbd5e1" style={{marginLeft: 'auto'}} />
                        </TouchableOpacity>
                    )}
                    style={{maxHeight: 300, width: '100%'}}
                />

                <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn, {marginTop: 15, width: '100%'}]} onPress={() => setShopSelectionVisible(false)}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
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
                <Text style={styles.modalTitle}>Select Shop</Text>
                <Text style={{textAlign: 'center', color: '#64748b', marginBottom: 20}}>Choose a shop to manage.</Text>
                
                <FlatList
                    data={shops}
                    keyExtractor={(item) => item._id}
                    renderItem={({ item }) => (
                        <TouchableOpacity style={styles.shopSelectionItem} onPress={() => handleSelectShop(item)}>
                            <Ionicons name="storefront" size={20} color="#1e40af" style={{marginRight: 10}} />
                            <Text style={styles.shopSelectionText}>{item.name}</Text>
                            <Ionicons name="chevron-forward" size={20} color="#cbd5e1" style={{marginLeft: 'auto'}} />
                        </TouchableOpacity>
                    )}
                    style={{maxHeight: 300, width: '100%'}}
                />

                <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn, {marginTop: 15, width: '100%'}]} onPress={() => setShopSelectionVisible(false)}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
            </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    backgroundColor: '#1e3a8a',
    padding: 25,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  title: {
    color: 'white',
    fontSize: 26,
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#93c5fd',
    fontSize: 14,
  },
  content: { flex: 1, padding: 20, justifyContent: 'center' },
  card: { backgroundColor: '#fff', padding: 24, borderRadius: 16, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2, marginBottom: 30 },
  icon: { marginBottom: 16 },
  shopName: { fontSize: 22, fontWeight: 'bold', color: '#1e293b', marginBottom: 8 },
  shopDetail: { fontSize: 16, color: '#64748b', marginBottom: 4 },
  managerText: { fontSize: 14, color: '#94a3b8', marginTop: 12 },
  switchButton: { backgroundColor: '#e0f2fe', padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#bae6fd' },
  switchButtonText: { color: '#0284c7', fontWeight: 'bold', fontSize: 16 },
  leaveButton: { backgroundColor: '#fee2e2', padding: 16, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#fecaca' },
  leaveButtonText: { color: '#ef4444', fontWeight: 'bold', fontSize: 16 },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#64748b', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1, marginTop: 10 },
  quickActionsRow: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 15,
  },
  quickActionCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionIconCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  quickActionText: { fontSize: 14, fontWeight: 'bold', color: '#1e293b' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 18, color: '#64748b', marginTop: 16, marginBottom: 24, textAlign: 'center' },
  linkButton: { backgroundColor: '#1e40af', paddingHorizontal: 24, paddingVertical: 16, borderRadius: 15, width: '100%', alignItems: 'center' },
  linkButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  input: { backgroundColor: '#fff', width: '100%', padding: 20, borderRadius: 15, marginBottom: 15, borderWidth: 1, borderColor: '#cbd5e1', fontSize: 16, textAlign: 'center' },
  
  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContainer: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 340, alignItems: 'center' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b', marginTop: 12, marginBottom: 8 },
  modalText: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  modalButtons: { flexDirection: 'row', width: '100%', gap: 12 },
  modalBtn: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  cancelBtn: { backgroundColor: '#f1f5f9' },
  cancelBtnText: { color: '#64748b', fontWeight: '600' },
  confirmBtn: { backgroundColor: '#ef4444' },
  confirmBtnText: { color: '#fff', fontWeight: 'bold' },
  
  recentSection: { width: '100%', marginTop: 30 },
  recentLabel: { fontSize: 12, fontWeight: 'bold', color: '#94a3b8', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 },
  recentItem: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    backgroundColor: '#fff', 
    padding: 16, 
    borderRadius: 16, 
    marginBottom: 10, 
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  recentName: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
  recentCode: { fontSize: 12, color: '#64748b', marginTop: 2 },
  shopSelectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  shopSelectionText: { fontSize: 16, fontWeight: '600', color: '#1e293b' },
});
