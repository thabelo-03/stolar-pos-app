import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as LocalAuthentication from 'expo-local-authentication';
import { LinearGradient } from 'expo-linear-gradient';
import * as Print from 'expo-print';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { API_BASE_URL } from '../config';
import { useActiveShop } from '../../hooks/use-active-shop';
import { useProducts } from '../../hooks/use-products';
import { useRates } from '../../hooks/use-rates';

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

type SortOption = 'name' | 'price' | 'quantity' | 'margin' | 'profit';

export default function CashierInventoryScreen() {
  const router = useRouter();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'low' | 'out'>('all');
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [currency, setCurrency] = useState<'USD' | 'ZAR' | 'ZiG'>('ZAR');
  const textColor = useThemeColor({}, 'text');
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(false);
  const insets = useSafeAreaInsets();
  
  const [bulkModalVisible, setBulkModalVisible] = useState(false);
  const [bulkMode, setBulkMode] = useState<'fixed' | 'percent'>('percent');
  const [bulkValue, setBulkValue] = useState('');
  
  const flatListRef = useRef<FlatList>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Password Protection State
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [password, setPassword] = useState('');
  const [verifying, setVerifying] = useState(false);
  const pendingAction = useRef<(() => void) | null>(null);

  const { shopId, userId, userRole } = useActiveShop();
  const { fetchProducts, loading: productsLoading } = useProducts();
  const { rates } = useRates();

  const convert = (amount: number) => {
    if (currency === 'ZAR') return amount * rates.ZAR;
    if (currency === 'ZiG') return amount * rates.ZiG;
    return amount;
  };

  const symbol = currency === 'USD' ? '$' : currency === 'ZAR' ? 'R' : 'ZiG';

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
      const cashierId = await AsyncStorage.getItem('userId');
      const response = await fetch(`${API_BASE_URL}/auth/verify-manager`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cashierId, password }),
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
      const data = await fetchProducts();
      const mappedData = data.map((item: any) => ({
        ...item,
        quantity: item.stockQuantity !== undefined ? item.stockQuantity : (item.quantity || 0)
      }));
      setInventory(mappedData);
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
    }, [fetchProducts])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchInventory();
  };

  const handleDelete = (id: string, name: string) => {
    const action = () => {
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
    };

    if (userRole === 'manager') {
      action();
    } else {
      requestPassword(action);
    }
  };

  const handleEdit = (item: InventoryItem) => {
    const action = () => {
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
    };

    if (userRole === 'manager') {
      action();
    } else {
      requestPassword(action);
    }
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
      let valA: number | string = 0;
      let valB: number | string = 0;

      if (sortBy === 'margin') {
        const priceA = Number(a.price) || 0;
        const costA = Number(a.costPrice) || 0;
        valA = priceA > 0 ? ((priceA - costA) / priceA) * 100 : 0;

        const priceB = Number(b.price) || 0;
        const costB = Number(b.costPrice) || 0;
        valB = priceB > 0 ? ((priceB - costB) / priceB) * 100 : 0;
      } else if (sortBy === 'profit') {
        const priceA = Number(a.price) || 0;
        const costA = Number(a.costPrice) || 0;
        valA = priceA - costA;

        const priceB = Number(b.price) || 0;
        const costB = Number(b.costPrice) || 0;
        valB = priceB - costB;
      } else if (sortBy === 'price' || sortBy === 'quantity') {
        valA = Number(a[sortBy as keyof InventoryItem]) || 0;
        valB = Number(b[sortBy as keyof InventoryItem]) || 0;
      } else {
        valA = (a.name || '').toString().toLowerCase();
        valB = (b.name || '').toString().toLowerCase();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return data;
  }, [inventory, filter, searchQuery, sortBy, sortOrder]);

  const stats = useMemo(() => {
    const totalItems = inventory.length;
    const totalValue = inventory.reduce((acc, item) => acc + (convert(Number(item.price) || 0) * (Number(item.quantity) || 0)), 0);
    const lowStock = inventory.filter(i => (Number(i.quantity) || 0) < 5).length;
    return { totalItems, totalValue, lowStock };
  }, [inventory, currency, rates]);

  const getStockStatus = (qty: number) => {
    if (qty === 0) return { label: 'Out of Stock', color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.12)', border: 'rgba(244, 63, 94, 0.2)' };
    if (qty < 5) return { label: 'Low Stock', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.12)', border: 'rgba(251, 191, 36, 0.2)' };
    return { label: 'In Stock', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.2)' };
  };

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    setSearchQuery(data);
    setIsScanning(false);
  };

  const handleBulkUpdate = async () => {
    if (!bulkValue) {
      Alert.alert("Error", "Please enter a value");
      return;
    }

    const val = parseFloat(bulkValue);
    if (isNaN(val) || val < 0) {
      Alert.alert("Error", "Invalid value");
      return;
    }

    const updates = filteredInventory.map(item => {
      let newCost = 0;
      if (bulkMode === 'fixed') {
        newCost = val;
      } else {
        const price = Number(item.price) || 0;
        newCost = price * (val / 100);
      }
      return {
        id: item._id,
        costPrice: newCost.toFixed(2)
      };
    });

    requestPassword(async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_BASE_URL}/products/batch-update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates, userId, shopId })
        });
        const data = await response.json();
        if (response.ok) {
          Alert.alert("Success", data.message);
          setBulkModalVisible(false);
          setBulkValue('');
          fetchInventory();
        } else {
          Alert.alert("Error", data.message || "Failed to update");
        }
      } catch (e) {
        Alert.alert("Error", "Network error");
      } finally {
        setLoading(false);
      }
    });
  };

  const handleExportPDF = async () => {
    const html = `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; }
            h1 { text-align: center; color: #1e3a8a; margin-bottom: 10px; }
            .subtitle { text-align: center; color: #666; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f1f5f9; color: #1e3a8a; font-weight: bold; }
            tr:nth-child(even) { background-color: #f9fafb; }
            .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #94a3b8; }
            .total-row { font-weight: bold; background-color: #e2e8f0; }
          </style>
        </head>
        <body>
          <h1>Inventory Report</h1>
          <div class="subtitle">Generated on ${new Date().toLocaleString()}</div>
          
          <table>
            <thead>
              <tr>
                <th>Item Name</th>
                <th>Barcode</th>
                <th style="text-align: right;">Stock</th>
                <th style="text-align: right;">Price</th>
              </tr>
            </thead>
            <tbody>
              ${filteredInventory.map(item => {
                const qty = Number(item.quantity) || 0;
                const price = convert(Number(item.price || 0));
                return `<tr><td>${item.name}</td><td>${item.barcode || '-'}</td><td style="text-align: right;">${qty}</td><td style="text-align: right;">${symbol}${price.toFixed(2)}</td></tr>`;
              }).join('')}
            </tbody>
          </table>
          <div class="footer">Stolar POS System</div>
        </body>
      </html>
    `;
    try {
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (error) { Alert.alert('Error', 'Failed to generate PDF'); }
  };

  const renderInventoryItem = useCallback(({ item }: { item: InventoryItem }) => {
    const qty = Number(item.quantity) || 0;
    const status = getStockStatus(qty);
    const price = convert(Number(item.price) || 0);
    const cost = Number(item.costPrice) || 0;
    const margin = price > 0 ? ((price - cost) / price) * 100 : 0;
    const hasWeight = /[0-9]+(\.[0-9]+)?\s*(kg|g|l|ml)$/i.test(item.name.trim());
    const displayName = item.name.replace(/([0-9]+(\.[0-9]+)?)\s*(kg|g|l|ml)$/i, (match, num, decimal, unit) => {
      return `${num}${unit.toUpperCase()}`;
    });

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.iconBox}>
            <MaterialCommunityIcons name="cube-outline" size={22} color="#06b6d4" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.itemName}>{displayName}</Text>
            {!hasWeight && (
              <Text style={{ fontSize: 10, color: '#fbbf24', marginBottom: 2, fontWeight: '600' }}>⚠️ Missing Weight/Volume (e.g. 1kg, 1L)</Text>
            )}
            <Text style={styles.itemBarcode}>{item.barcode || 'No Barcode'}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: status.bg, borderColor: status.border }]}>
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>
        

        <View style={styles.cardDivider} />

        <View style={styles.cardFooter}>
          <View>
            <Text style={styles.priceLabel}>Price</Text>
            <Text style={styles.priceValue}>{symbol} {price.toFixed(2)}</Text>
          </View>
          <View>
            <Text style={styles.priceLabel}>Stock</Text>
            <Text style={[styles.priceValue, { color: status.color }]}>{qty}</Text>
          </View>
          <View>
            <Text style={styles.priceLabel}>Margin</Text>
            <Text style={[styles.priceValue, { color: '#10b981' }]}>
              {margin.toFixed(0)}%
            </Text>
          </View>
          
          <View style={styles.actions}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => handleEdit(item)}>
              <MaterialCommunityIcons name="pencil" size={18} color="#94a3b8" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]} onPress={() => handleDelete(item._id, item.name)}>
              <MaterialCommunityIcons name="delete" size={18} color="#f43f5e" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }, [currency, rates]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <LinearGradient colors={['#0a0f1e', '#0f172a']} style={StyleSheet.absoluteFillObject} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <Text style={styles.headerTitle}>Inventory</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity onPress={handleExportPDF} style={styles.iconButton}>
              <Ionicons name="share-outline" size={20} color="white" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/(tabs)/profit-report')} style={styles.iconButton}>
              <Ionicons name="trending-up" size={20} color="white" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/stock-take')} style={styles.iconButton}>
              <Ionicons name="clipboard-outline" size={20} color="white" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/(tabs)/recent-actions')} style={styles.iconButton}>
              <Ionicons name="time-outline" size={20} color="white" />
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.totalItems}</Text>
            <Text style={styles.statLabel}>Items</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{symbol} {stats.totalValue.toFixed(0)}</Text>
            <Text style={styles.statLabel}>Value</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: stats.lowStock > 0 ? '#f43f5e' : 'white' }]}>{stats.lowStock}</Text>
            <Text style={styles.statLabel}>Low Stock</Text>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#94a3b8" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search products..."
            placeholderTextColor="#64748b"
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
            <MaterialCommunityIcons name="barcode-scan" size={22} color="#94a3b8" />
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
            style={styles.filterChip} 
            onPress={() => setCurrency(prev => prev === 'USD' ? 'ZAR' : prev === 'ZAR' ? 'ZiG' : 'USD')}
          >
            <Text style={[styles.filterText, { color: '#06b6d4' }]}>{currency}</Text>
          </TouchableOpacity>

          <View style={styles.verticalDivider} />

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
            onPress={() => setSortBy(prev => prev === 'name' ? 'price' : prev === 'price' ? 'quantity' : prev === 'quantity' ? 'margin' : prev === 'margin' ? 'profit' : 'name')}
          >
            <Text style={styles.filterText}>By: {sortBy.charAt(0).toUpperCase() + sortBy.slice(1)}</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.filterChip} 
            onPress={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
          >
            <Ionicons name={sortOrder === 'asc' ? "arrow-up" : "arrow-down"} size={16} color="#94a3b8" />
          </TouchableOpacity>
        </ScrollView>
      </View>

      {loading || productsLoading ? (
        <ActivityIndicator size="large" color="#06b6d4" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          ref={flatListRef}
          data={filteredInventory}
          keyExtractor={(item) => item._id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f1f5f9" />}
          contentContainerStyle={styles.listContent}
          renderItem={renderInventoryItem}
          ListEmptyComponent={<Text style={styles.empty}>No products found.</Text>}
          onScroll={(e) => setShowScrollTop(e.nativeEvent.contentOffset.y > 300)}
          scrollEventThrottle={16}
        />
      )}

      {showScrollTop && (
        <TouchableOpacity 
          style={styles.scrollTopButton} 
          onPress={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })}
        >
          <Ionicons name="arrow-up" size={22} color="white" />
        </TouchableOpacity>
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
              placeholderTextColor="#64748b"
              value={password}
              onChangeText={setPassword}
              autoFocus
              keyboardType="default"
            />
            <TouchableOpacity style={{ alignSelf: 'center', marginBottom: 15 }} onPress={() => requestPassword(pendingAction.current!)}>
               <Ionicons name="finger-print" size={36} color="#06b6d4" />
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

      {/* Bulk Update Modal */}
      <Modal visible={bulkModalVisible} transparent animationType="fade" onRequestClose={() => setBulkModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Bulk Update Cost Price</Text>
            <Text style={styles.modalSubtitle}>Applying to {filteredInventory.length} items</Text>

            <View style={styles.tabRow}>
              <TouchableOpacity 
                style={[styles.tabBtn, bulkMode === 'percent' && styles.activeTabBtn]} 
                onPress={() => setBulkMode('percent')}
              >
                <Text style={[styles.tabText, bulkMode === 'percent' && styles.activeTabText]}>% of Price</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.tabBtn, bulkMode === 'fixed' && styles.activeTabBtn]} 
                onPress={() => setBulkMode('fixed')}
              >
                <Text style={[styles.tabText, bulkMode === 'fixed' && styles.activeTabText]}>Fixed Amount</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.modalInput}
              placeholder={bulkMode === 'percent' ? "e.g. 70 (for 70% of price)" : "e.g. 50.00"}
              placeholderTextColor="#64748b"
              keyboardType="numeric"
              value={bulkValue}
              onChangeText={setBulkValue}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setBulkModalVisible(false)}>
                <Text style={styles.btnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.confirmBtn]} onPress={handleBulkUpdate}>
                <Text style={[styles.btnText, {color: 'white'}]}>Update All</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0f1e' },
  header: {
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: 'white' },
  iconButton: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)'
  },
  statsRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    backgroundColor: 'rgba(255,255,255,0.05)', 
    borderRadius: 20, 
    padding: 16, 
    marginVertical: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)'
  },
  statItem: { alignItems: 'center', flex: 1 },
  statValue: { color: 'white', fontSize: 18, fontWeight: '800' },
  statLabel: { color: '#94a3b8', fontSize: 11, marginTop: 4, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
  
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 52,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, fontSize: 16, color: '#ffffff', height: '100%', fontWeight: '600' },

  filterContainer: { flexDirection: 'row', paddingHorizontal: 20, marginTop: 10, gap: 10 },
  filterChip: { 
    paddingVertical: 8, 
    paddingHorizontal: 16, 
    borderRadius: 20, 
    backgroundColor: 'rgba(255,255,255,0.05)', 
    borderWidth: 1.5, 
    borderColor: 'rgba(255,255,255,0.08)' 
  },
  activeFilterChip: { backgroundColor: '#2563eb', borderColor: '#3b82f6' },
  filterText: { color: '#94a3b8', fontWeight: '700', fontSize: 13 },
  activeFilterText: { color: 'white' },
  verticalDivider: { width: 1, height: '100%', backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: 5 },

  listContent: { padding: 20, gap: 15, paddingBottom: 120 },
  card: { 
    backgroundColor: 'rgba(255,255,255,0.04)', 
    borderRadius: 20, 
    padding: 18, 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 3
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: { 
    width: 42, 
    height: 42, 
    borderRadius: 12, 
    backgroundColor: 'rgba(6, 182, 212, 0.12)', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  itemName: { fontSize: 16, fontWeight: '800', color: '#f1f5f9' },
  itemBarcode: { fontSize: 12, color: '#94a3b8', fontWeight: '500', marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1 },
  statusText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  
  cardDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 14 },
  
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceLabel: { fontSize: 11, color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  priceValue: { fontSize: 16, fontWeight: '800', color: '#f1f5f9' },
  
  actions: { flexDirection: 'row', gap: 10 },
  actionBtn: { 
    width: 38, 
    height: 38, 
    borderRadius: 12, 
    backgroundColor: 'rgba(255,255,255,0.05)', 
    justifyContent: 'center', 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)'
  },
  deleteBtn: {
    backgroundColor: 'rgba(244, 63, 94, 0.08)',
    borderColor: 'rgba(244, 63, 94, 0.15)'
  },
  
  empty: { textAlign: 'center', marginTop: 50, color: '#64748b', fontWeight: '600' },

  camera: { flex: 1 },
  cameraOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  closeButton: { position: 'absolute', top: 50, right: 20, padding: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 },
  scanFrame: { width: 250, height: 250, borderWidth: 2, borderColor: 'white', backgroundColor: 'transparent' },
  scanText: { color: 'white', marginTop: 20, fontSize: 18, fontWeight: 'bold' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(5, 8, 16, 0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  passwordContainer: { 
    backgroundColor: '#0f172a', 
    padding: 24, 
    borderRadius: 24, 
    width: '85%', 
    maxWidth: 320, 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.08)' 
  },
  passwordTitle: { fontSize: 18, fontWeight: '800', marginBottom: 15, textAlign: 'center', color: '#ffffff' },
  passwordInput: { 
    borderWidth: 1.5, 
    borderColor: 'rgba(255,255,255,0.08)', 
    backgroundColor: 'rgba(255,255,255,0.04)',
    color: 'white',
    borderRadius: 12, 
    padding: 12, 
    marginBottom: 20, 
    fontSize: 16, 
    textAlign: 'center',
    fontWeight: '700'
  },
  modalButtons: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, padding: 14, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  confirmBtn: { flex: 1, padding: 14, backgroundColor: '#2563eb', borderRadius: 12, alignItems: 'center' },
  btnText: { fontWeight: '800', color: '#94a3b8' },

  modalContainer: { 
    backgroundColor: '#0f172a', 
    borderRadius: 24, 
    padding: 24, 
    width: '90%', 
    maxWidth: 340, 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.08)' 
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#ffffff', marginBottom: 5, textAlign: 'center' },
  modalSubtitle: { fontSize: 14, color: '#94a3b8', marginBottom: 20, textAlign: 'center', fontWeight: '500' },
  tabRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 4, marginBottom: 20 },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  activeTabBtn: { backgroundColor: 'rgba(255,255,255,0.08)', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 2, elevation: 1 },
  tabText: { fontSize: 13, fontWeight: '700', color: '#94a3b8' },
  activeTabText: { color: '#06b6d4' },
  modalInput: { 
    borderWidth: 1.5, 
    borderColor: 'rgba(255,255,255,0.08)', 
    backgroundColor: 'rgba(255,255,255,0.04)',
    color: 'white',
    borderRadius: 12, 
    padding: 12, 
    fontSize: 16, 
    marginBottom: 20, 
    textAlign: 'center',
    fontWeight: '700'
  },
  modalActions: { flexDirection: 'row', gap: 10 },
  modalBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
  scrollTopButton: {
    position: 'absolute',
    bottom: 110,
    right: 20,
    backgroundColor: '#2563eb',
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#2563eb', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10,
  },
});