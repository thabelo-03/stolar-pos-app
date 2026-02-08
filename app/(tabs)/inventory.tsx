import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { API_BASE_URL } from './api';

interface InventoryItem {
  _id: string;
  name: string;
  barcode: string;
  quantity: number;
  price: number;
  costPrice?: number;
  category?: string;
  stockQuantity?: number;
}

export default function CashierInventoryScreen() {
  const router = useRouter();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'low' | 'out'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'quantity'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const textColor = useThemeColor({}, 'text');
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(false);
  
  // Password Protection State
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [password, setPassword] = useState('');
  const [verifying, setVerifying] = useState(false);
  const pendingAction = useRef<(() => void) | null>(null);

  const requestPassword = async (action: () => void) => {
    pendingAction.current = action;
    setPassword('');
    setVerifying(false);

    // Try Biometrics First
    const bioEnabled = await AsyncStorage.getItem('biometricEnabled');
    if (bioEnabled === 'true') {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (hasHardware && isEnrolled) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Manager Approval Required',
          fallbackLabel: 'Use Password',
        });
        if (result.success) return action();
      }
    }

    setPasswordVisible(true);
  };

  const handlePasswordSubmit = async () => {
    if (!password) return;
    setVerifying(true);
    try {
      const userId = await AsyncStorage.getItem('userId');
      const response = await fetch(`${API_BASE_URL}/auth/verify-manager`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cashierId: userId, password }),
      });
      
      const data = await response.json();
      if (response.ok && data.success) {
        setPasswordVisible(false);
        setTimeout(() => {
          pendingAction.current?.();
        }, 100);
      } else {
        Alert.alert("Error", data.message || "Incorrect Password");
      }
    } catch (e) {
      Alert.alert("Error", "Network error");
    } finally {
      setVerifying(false);
    }
  };

  const fetchInventory = async () => {
    try {
      const userId = await AsyncStorage.getItem('userId');
      if (!userId) return;

      const userRes = await fetch(`${API_BASE_URL}/users/${userId}`);
      const user = await userRes.json();
      
      if (user.shopId) {
        const response = await fetch(`${API_BASE_URL}/products?shopId=${user.shopId}`);
        const data = await response.json();
        if (response.ok) {
          const mappedData = data.map((item: any) => ({
            ...item,
            quantity: item.stockQuantity !== undefined ? item.stockQuantity : (item.quantity || 0)
          }));
          setInventory(mappedData);
        }
      } else {
        setInventory([]);
      }
    } catch (error) {
      console.log('Error fetching inventory:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchInventory();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchInventory();
  };

  const handleDelete = (id: string, name: string) => {
    requestPassword(() => {
      Alert.alert(
      "Delete Product",
      `Are you sure you want to delete "${name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            try {
              const response = await fetch(`${API_BASE_URL}/products/${id}`, { method: 'DELETE' });
              if (response.ok) {
                setInventory(prev => prev.filter(item => item._id !== id));
                Alert.alert("Success", "Product deleted.");
              } else {
                Alert.alert("Error", "Failed to delete product.");
              }
            } catch (e) {
              Alert.alert("Error", "Network error.");
            }
          }
        }
      ]
    );
    });
  };

  const handleEdit = (item: InventoryItem) => {
    requestPassword(() => {
      router.push({
        pathname: '/(tabs)/add-stock',
        params: {
          mode: 'edit',
          id: item._id,
          name: item.name,
          quantity: item.quantity !== undefined ? item.quantity.toString() : '',
          barcode: item.barcode || '',
          price: item.price !== undefined ? item.price.toString() : '',
          costPrice: item.costPrice?.toString() || '',
          category: item.category || ''
        }
      });
    });
  };

  const filteredInventory = useMemo(() => {
    let data = [...inventory];

    if (filter === 'low') data = data.filter(i => (Number(i.quantity) || 0) > 0 && (Number(i.quantity) || 0) < 5);
    if (filter === 'out') data = data.filter(i => (Number(i.quantity) || 0) === 0);

    if (searchQuery) {
      const lower = searchQuery.toLowerCase();
      data = data.filter(item => 
        (item.name && item.name.toLowerCase().includes(lower)) ||
        (item.barcode && String(item.barcode).toLowerCase().includes(lower))
      );
    }

    data.sort((a, b) => {
      let valA: any = a[sortBy];
      let valB: any = b[sortBy];

      if (sortBy === 'price' || sortBy === 'quantity') {
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
      } else {
        valA = (valA || '').toString().toLowerCase();
        valB = (valB || '').toString().toLowerCase();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return data;
  }, [inventory, filter, searchQuery, sortBy, sortOrder]);

  const stats = useMemo(() => {
    const totalItems = inventory.length;
    const totalValue = inventory.reduce((acc, item) => acc + ((Number(item.price) || 0) * (Number(item.quantity) || 0)), 0);
    const lowStock = inventory.filter(i => (Number(i.quantity) || 0) < 5).length;
    return { totalItems, totalValue, lowStock };
  }, [inventory]);

  const getStockStatus = (qty: number) => {
    if (qty === 0) return { label: 'Out of Stock', color: '#ef4444', bg: '#fee2e2' };
    if (qty < 5) return { label: 'Low Stock', color: '#f59e0b', bg: '#fef3c7' };
    return { label: 'In Stock', color: '#10b981', bg: '#d1fae5' };
  };

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    setSearchQuery(data);
    setIsScanning(false);
  };

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <Text style={[styles.headerTitle, { marginBottom: 0 }]}>Inventory</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/recent-actions')} style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: 8, borderRadius: 8 }}>
            <Ionicons name="time-outline" size={24} color="white" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.totalItems}</Text>
            <Text style={styles.statLabel}>Items</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>${stats.totalValue.toFixed(0)}</Text>
            <Text style={styles.statLabel}>Value</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: stats.lowStock > 0 ? '#fca5a5' : 'white' }]}>{stats.lowStock}</Text>
            <Text style={styles.statLabel}>Low Stock</Text>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#64748b" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search products..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <TouchableOpacity onPress={async () => {
            if (!permission?.granted) {
              const { granted } = await requestPermission();
              if (granted) setIsScanning(true);
            } else {
              setIsScanning(true);
            }
          }} style={{ marginRight: 8 }}>
            <MaterialCommunityIcons name="barcode-scan" size={24} color="#64748b" />
          </TouchableOpacity>
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: 10, paddingRight: 20}}>
          <TouchableOpacity 
            style={[styles.filterChip, filter === 'all' && styles.activeFilterChip]} 
            onPress={() => setFilter('all')}
          >
            <Text style={[styles.filterText, filter === 'all' && styles.activeFilterText]}>All</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.filterChip, filter === 'low' && styles.activeFilterChip]} 
            onPress={() => setFilter('low')}
          >
            <Text style={[styles.filterText, filter === 'low' && styles.activeFilterText]}>Low Stock</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.filterChip, filter === 'out' && styles.activeFilterChip]} 
            onPress={() => setFilter('out')}
          >
            <Text style={[styles.filterText, filter === 'out' && styles.activeFilterText]}>Out</Text>
          </TouchableOpacity>

          <View style={styles.verticalDivider} />

          <TouchableOpacity 
            style={styles.filterChip} 
            onPress={() => setSortBy(prev => prev === 'name' ? 'price' : prev === 'price' ? 'quantity' : 'name')}
          >
            <Text style={styles.filterText}>By: {sortBy.charAt(0).toUpperCase() + sortBy.slice(1)}</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.filterChip} 
            onPress={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
          >
            <Ionicons name={sortOrder === 'asc' ? "arrow-up" : "arrow-down"} size={16} color="#64748b" />
          </TouchableOpacity>
        </ScrollView>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#1e40af" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={filteredInventory}
          keyExtractor={(item) => item._id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={textColor} />}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const qty = Number(item.quantity) || 0;
            const status = getStockStatus(qty);
            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.iconBox}>
                    <MaterialCommunityIcons name="cube-outline" size={24} color="#1e40af" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemBarcode}>{item.barcode || 'No Barcode'}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                    <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                  </View>
                </View>

                <View style={styles.cardDivider} />

                <View style={styles.cardFooter}>
                  <View>
                    <Text style={styles.priceLabel}>Price</Text>
                    <Text style={styles.priceValue}>${(Number(item.price) || 0).toFixed(2)}</Text>
                  </View>
                  <View>
                    <Text style={styles.priceLabel}>Stock</Text>
                    <Text style={[styles.priceValue, { color: status.color }]}>{qty}</Text>
                  </View>
                  
                  <View style={styles.actions}>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => handleEdit(item)}>
                      <MaterialCommunityIcons name="pencil" size={20} color="#64748b" />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#fee2e2' }]} onPress={() => handleDelete(item._id, item.name)}>
                      <MaterialCommunityIcons name="delete" size={20} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={<Text style={styles.empty}>No products found.</Text>}
        />
      )}

      <Modal visible={isScanning} animationType="slide" onRequestClose={() => setIsScanning(false)}>
        <CameraView style={styles.camera} facing="back" onBarcodeScanned={handleBarcodeScanned}>
          <View style={styles.cameraOverlay}>
            <TouchableOpacity style={styles.closeButton} onPress={() => setIsScanning(false)}>
              <Ionicons name="close" size={30} color="white" />
            </TouchableOpacity>
            <View style={styles.scanFrame} />
            <Text style={styles.scanText}>Scanning...</Text>
          </View>
        </CameraView>
      </Modal>

      {/* Password Modal */}
      <Modal visible={passwordVisible} transparent animationType="fade" onRequestClose={() => setPasswordVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.passwordContainer}>
            <Text style={styles.passwordTitle}>Manager Password</Text>
            <TextInput 
              style={styles.passwordInput} 
              secureTextEntry 
              placeholder="Enter Password"
              value={password}
              onChangeText={setPassword}
              autoFocus
              keyboardType="numeric"
            />
            <TouchableOpacity style={{ alignSelf: 'center', marginBottom: 15 }} onPress={() => requestPassword(pendingAction.current!)}>
               <Ionicons name="finger-print" size={32} color="#1e40af" />
            </TouchableOpacity>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setPasswordVisible(false)}><Text style={styles.btnText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={handlePasswordSubmit} disabled={verifying}>
                {verifying ? <ActivityIndicator color="white" size="small" /> : <Text style={[styles.btnText, {color: 'white'}]}>Confirm</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    backgroundColor: '#1e40af',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: 'white', marginBottom: 20 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 16, padding: 15, marginBottom: 20 },
  statItem: { alignItems: 'center', flex: 1 },
  statValue: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  statLabel: { color: '#bfdbfe', fontSize: 12, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)' },
  
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, fontSize: 16, color: '#1e293b', height: '100%' },

  filterContainer: { flexDirection: 'row', paddingHorizontal: 20, marginTop: 15, gap: 10 },
  filterChip: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: 'white', borderWidth: 1, borderColor: '#e2e8f0' },
  activeFilterChip: { backgroundColor: '#1e40af', borderColor: '#1e40af' },
  filterText: { color: '#64748b', fontWeight: '600', fontSize: 13 },
  activeFilterText: { color: 'white' },
  verticalDivider: { width: 1, height: '100%', backgroundColor: '#cbd5e1', marginHorizontal: 5 },

  listContent: { padding: 20, gap: 15, paddingBottom: 40 },
  card: { backgroundColor: 'white', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center' },
  itemName: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
  itemBarcode: { fontSize: 12, color: '#94a3b8' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusText: { fontSize: 10, fontWeight: 'bold' },
  
  cardDivider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 12 },
  
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceLabel: { fontSize: 11, color: '#94a3b8', marginBottom: 2 },
  priceValue: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
  
  actions: { flexDirection: 'row', gap: 10 },
  actionBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
  
  empty: { textAlign: 'center', marginTop: 50, color: '#94a3b8' },

  camera: { flex: 1 },
  cameraOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  closeButton: { position: 'absolute', top: 50, right: 20, padding: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 },
  scanFrame: { width: 250, height: 250, borderWidth: 2, borderColor: 'white', backgroundColor: 'transparent' },
  scanText: { color: 'white', marginTop: 20, fontSize: 18, fontWeight: 'bold' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  passwordContainer: { backgroundColor: 'white', padding: 20, borderRadius: 12, width: '80%', maxWidth: 300 },
  passwordTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center', color: '#1e293b' },
  passwordInput: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 10, marginBottom: 20, fontSize: 16, textAlign: 'center' },
  modalButtons: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, padding: 12, backgroundColor: '#f1f5f9', borderRadius: 8, alignItems: 'center' },
  confirmBtn: { flex: 1, padding: 12, backgroundColor: '#1e40af', borderRadius: 8, alignItems: 'center' },
  btnText: { fontWeight: 'bold' },
});