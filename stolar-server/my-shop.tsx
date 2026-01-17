import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
  TextInput
} from 'react-native';
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

  useEffect(() => {
    fetchShopDetails();
  }, []);

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
      const response = await fetch(`${API_BASE_URL}/shops/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setModalVisible(false);
        setShop(null);
        Alert.alert("Success", "You have left the shop.");
        router.replace('/(cashier)'); // Redirect to home or request screen
      } else {
        Alert.alert("Error", data.message || "Failed to leave shop");
      }
    } catch (error) {
      Alert.alert("Error", "Network error occurred.");
    } finally {
      setProcessing(false);
    }
  };

  const handleJoinShop = async () => {
    if (!branchCode.trim()) {
      Alert.alert("Error", "Please enter a branch code");
      return;
    }

    setProcessing(true);
    try {
      const userId = await AsyncStorage.getItem('userId');
      const response = await fetch(`${API_BASE_URL}/shops/request-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branchCode, userId }),
      });

      const data = await response.json();
      
      if (response.ok) {
        Alert.alert("Success", "Request sent! Waiting for manager approval.");
        setBranchCode('');
        fetchShopDetails(); // Refresh to show pending state
      } else {
        Alert.alert("Error", data.message || "Failed to send request");
      }
    } catch (error) {
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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1e40af" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Shop</Text>
      </View>

      <View style={styles.content}>
        {shop ? (
          <>
            <View style={styles.card}>
              <Ionicons name="storefront" size={48} color="#1e40af" style={styles.icon} />
              <Text style={styles.shopName}>{shop.name}</Text>
              <Text style={styles.shopDetail}>{shop.location}</Text>
              <Text style={styles.shopDetail}>Code: {shop.branchCode}</Text>
              {shop.manager && (
                <Text style={styles.managerText}>Manager: {shop.manager.name}</Text>
              )}
            </View>

            <TouchableOpacity 
              style={styles.leaveButton} 
              onPress={() => setModalVisible(true)}
            >
              <Text style={styles.leaveButtonText}>Leave Shop</Text>
            </TouchableOpacity>
          </>
        ) : pendingRequest ? (
          <View style={styles.statusContainer}>
            <View style={styles.statusCard}>
              <View style={styles.statusHeader}>
                <Ionicons name="time" size={28} color="#fff" />
                <Text style={styles.statusTitle}>Request Pending</Text>
              </View>
              
              <View style={styles.statusBody}>
                <Text style={styles.statusDescription}>
                  Your request to join this shop is waiting for manager approval.
                </Text>
                
                <View style={styles.statusRow}>
                  <Text style={styles.statusLabel}>Shop Name</Text>
                  <Text style={styles.statusValue}>{pendingRequest.shop.name}</Text>
                </View>
                
                <View style={styles.statusRow}>
                  <Text style={styles.statusLabel}>Branch Code</Text>
                  <Text style={styles.statusValue}>{pendingRequest.shop.branchCode}</Text>
                </View>
              </View>

              <TouchableOpacity 
                style={styles.cancelButton} 
                onPress={handleCancelRequest}
                disabled={processing}
              >
                {processing ? <ActivityIndicator color="#ef4444" /> : <Text style={styles.cancelButtonText}>Cancel Request</Text>}
              </TouchableOpacity>
            </View>
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
              onPress={handleJoinShop}
              disabled={processing}
            >
              {processing ? <ActivityIndicator color="#fff" /> : <Text style={styles.linkButtonText}>Send Request</Text>}
            </TouchableOpacity>
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
            <Ionicons name="warning-outline" size={40} color="#ef4444" />
            <Text style={styles.modalTitle}>Leave Shop?</Text>
            <Text style={styles.modalText}>
              Are you sure you want to leave {shop?.name}? You will lose access to this shop's sales and inventory.
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
                  <Text style={styles.confirmBtnText}>Yes, Leave</Text>
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
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1e293b' },
  content: { flex: 1, padding: 20 },
  card: { backgroundColor: '#fff', padding: 24, borderRadius: 16, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2, marginBottom: 30 },
  icon: { marginBottom: 16 },
  shopName: { fontSize: 22, fontWeight: 'bold', color: '#1e293b', marginBottom: 8 },
  shopDetail: { fontSize: 16, color: '#64748b', marginBottom: 4 },
  managerText: { fontSize: 14, color: '#94a3b8', marginTop: 12 },
  leaveButton: { backgroundColor: '#fee2e2', padding: 16, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#fecaca' },
  leaveButtonText: { color: '#ef4444', fontWeight: 'bold', fontSize: 16 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#64748b', marginTop: 16, marginBottom: 24 },
  linkButton: { backgroundColor: '#1e40af', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  linkButtonText: { color: '#fff', fontWeight: 'bold' },
  input: { backgroundColor: '#fff', width: '80%', padding: 15, borderRadius: 8, marginBottom: 15, borderWidth: 1, borderColor: '#cbd5e1' },
  
  // Status Card Styles
  statusContainer: { flex: 1, justifyContent: 'center', padding: 10 },
  statusCard: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', shadowColor: '#f59e0b', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 5 },
  statusHeader: { backgroundColor: '#f59e0b', padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  statusTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  statusBody: { padding: 24 },
  statusDescription: { color: '#64748b', textAlign: 'center', marginBottom: 24, fontSize: 15, lineHeight: 22 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 8 },
  statusLabel: { color: '#94a3b8', fontSize: 14, fontWeight: '600' },
  statusValue: { color: '#1e293b', fontSize: 16, fontWeight: 'bold' },
  cancelButton: { margin: 20, marginTop: 0, padding: 16, borderRadius: 12, backgroundColor: '#fef2f2', alignItems: 'center', borderWidth: 1, borderColor: '#fee2e2' },
  cancelButtonText: { color: '#ef4444', fontWeight: 'bold', fontSize: 16 },
  
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
  confirmBtnText: { color: '#fff', fontWeight: 'bold' }
});