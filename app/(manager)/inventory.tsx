import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import * as Print from 'expo-print';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, StatusBar } from 'react-native';

import { ThemedText } from '../../components/themed-text';
import { useThemeColor } from '../../hooks/use-theme-color';
import { API_BASE_URL } from '../config';

interface InventoryItem {
  _id?: string;
  id?: string;
  name: string;
  barcode?: string;
  quantity: number | string;
  stockQuantity?: number;
  price?: number | string;
  costPrice?: number | string;
  category?: string;
}

export default function ManagerInventoryScreen() {
  const router = useRouter();
  const { shopId: rawShopId } = useLocalSearchParams();
  const shopId = Array.isArray(rawShopId) ? rawShopId[0] : rawShopId;
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'low' | 'out'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'quantity' | 'margin' | 'profit'>('name');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const textColor = useThemeColor({}, 'text');
  const [currency, setCurrency] = useState<'USD' | 'ZAR'>('ZAR');
  const [rates, setRates] = useState({ ZAR: 19.2 });
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(false);
  
  const [bulkModalVisible, setBulkModalVisible] = useState(false);
  const [bulkMode, setBulkMode] = useState<'fixed' | 'percent'>('percent');
  const [bulkValue, setBulkValue] = useState('');
  
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [productHistory, setProductHistory] = useState<any[]>([]);
  const [selectedHistoryItemName, setSelectedHistoryItemName] = useState('');
  const [manageModalVisible, setManageModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);

  // Scroll to top
  const flatListRef = useRef<FlatList>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Transfer State
  const [transferModalVisible, setTransferModalVisible] = useState(false);
  const [transferItem, setTransferItem] = useState<InventoryItem | null>(null);
  const [transferQty, setTransferQty] = useState('');
  const [targetShopId, setTargetShopId] = useState('');
  const [availableShops, setAvailableShops] = useState<any[]>([]);

  const fetchInventory = async () => {
    if (!shopId) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/products?shopId=${shopId}`);
      const data = await response.json();
      if (response.ok) {
        const mappedData = data.map((item: any) => ({
          ...item,
          quantity: item.stockQuantity !== undefined ? item.stockQuantity : (item.quantity || 0)
        }));
        setInventory(mappedData);
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
    }, [shopId])
  );

  useEffect(() => {
    if (shopId) {
      fetch(`${API_BASE_URL}/shops/rates/${shopId}`)
        .then(res => res.json())
        .then(data => {
          if (data.rates) setRates(data.rates);
        })
        .catch(e => console.log("Rates fetch error", e));
    }
  }, [shopId]);

  const convert = (amount: number) => {
    if (currency === 'ZAR') return amount * (rates.ZAR || 19.2);
    return amount;
  };

  const symbol = currency === 'USD' ? '$' : 'R';

  const onRefresh = () => {
    setRefreshing(true);
    fetchInventory();
  };

  const categories = useMemo(() => {
    const unique = Array.from(new Set(inventory.map(i => i.category || 'General')));
    return ['All', ...unique.sort()];
  }, [inventory]);

  const filteredInventory = useMemo(() => {
    let data = [...inventory];

    if (selectedCategory !== 'All') {
      data = data.filter(i => (i.category || 'General') === selectedCategory);
    }

    if (filter === 'low') data = data.filter(i => Number(i.quantity) > 0 && Number(i.quantity) < 5);
    if (filter === 'out') data = data.filter(i => Number(i.quantity) === 0);

    if (searchQuery) {
      const lower = searchQuery.toLowerCase();
      data = data.filter(item => (item.name && item.name.toLowerCase().includes(lower)) || (item.barcode !== undefined && item.barcode !== null && item.barcode.toString().includes(lower)));
    }

    data.sort((a, b) => {
      let valA: number | string = 0;
      let valB: number | string = 0;

      if (sortBy === 'price') {
        valA = Number(a.price) || 0;
        valB = Number(b.price) || 0;
      } else if (sortBy === 'quantity') {
        valA = Number(a.quantity) || 0;
        valB = Number(b.quantity) || 0;
      } else if (sortBy === 'margin') {
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
      } else {
        valA = (a.name || '').toString().toLowerCase();
        valB = (b.name || '').toString().toLowerCase();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return data;
  }, [inventory, filter, searchQuery, sortBy, sortOrder, selectedCategory]);

  const deleteItem = async (id: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/products/${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setInventory((prev) => prev.filter((item) => (item._id || item.id) !== id));
        Alert.alert('Success', 'Item deleted successfully');
      } else {
        Alert.alert('Error', 'Failed to delete item');
      }
    } catch (error) {
      Alert.alert('Error', 'Could not connect to server');
    }
  };

  const confirmDelete = (item: InventoryItem) => {
    const itemId = item._id || item.id;
    if (!itemId) return;

    Alert.alert(
      "Confirm Delete",
      `Are you sure you want to delete "${item.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => deleteItem(itemId) }
      ]
    );
  };

  const stats = useMemo(() => {
    const totalItems = inventory.length;
    const totalValue = inventory.reduce((acc, item) => acc + (convert(Number(item.price || 0)) * Number(item.quantity || 0)), 0);
    const lowStock = inventory.filter(i => Number(i.quantity) < 5).length;
    return { totalItems, totalValue, lowStock };
  }, [inventory, currency, rates]);

  const getStockStatus = (qty: number) => {
    if (qty === 0) return { label: 'Out of Stock', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', border: '#fca5a5' };
    if (qty < 5) return { label: 'Low Stock', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', border: '#fcd34d' };
    return { label: 'In Stock', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', border: '#a7f3d0' };
  };

  const handleEdit = (item: InventoryItem) => {
    const itemId = item._id || item.id;
    router.push({
      pathname: '/(manager)/add-stock',
      params: { 
        id: itemId, 
        name: item.name, 
        quantity: String(item.quantity), 
        barcode: (item.barcode !== undefined && item.barcode !== null) ? String(item.barcode) : '', 
        price: item.price ? String(item.price) : '', 
        costPrice: item.costPrice ? String(item.costPrice) : '', 
        mode: 'edit', 
        shopId 
      }
    });
  };

  const fetchShops = async () => {
    const userId = await AsyncStorage.getItem('userId');
    if (userId) {
        try {
            const res = await fetch(`${API_BASE_URL}/shops?managerId=${userId}`);
            const data = await res.json();
            if (Array.isArray(data)) {
                setAvailableShops(data.filter((s: any) => s._id !== shopId));
            }
        } catch (e) {}
    }
  };

  const handleItemPress = (item: InventoryItem) => {
    setSelectedItem(item);
    setManageModalVisible(true);
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
        id: item._id || item.id,
        costPrice: newCost.toFixed(2)
      };
    });

    try {
      setLoading(true);
      const userId = await AsyncStorage.getItem('userId');
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
  };

  const handleViewHistory = async (item: InventoryItem) => {
    const itemId = item._id || item.id;
    if (!itemId) return;
    
    setSelectedHistoryItemName(item.name);
    setProductHistory([]);
    setHistoryModalVisible(true);

    try {
      const response = await fetch(`${API_BASE_URL}/logs/product/${itemId}`);
      const data = await response.json();
      if (Array.isArray(data)) setProductHistory(data);
    } catch (e) { console.log("Error fetching history", e); }
  };

  const handleRestore = (logItem: any) => {
    Alert.alert(
      "Confirm Restore",
      "This will revert the product details (Price, Stock, Name) to the state before this change. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Restore", 
          onPress: async () => {
            try {
              const userId = await AsyncStorage.getItem('userId');
              const response = await fetch(`${API_BASE_URL}/products/${logItem.relatedId}/restore`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ logId: logItem._id, userId })
              });
              const data = await response.json();
              if (response.ok) {
                Alert.alert("Success", "Product restored.");
                setHistoryModalVisible(false);
                fetchInventory();
              } else {
                Alert.alert("Error", data.message || "Failed to restore.");
              }
            } catch (e) { Alert.alert("Error", "Network error."); }
          }
        }
      ]
    );
  };

  const submitTransfer = async () => {
    if (!transferItem || !targetShopId || !transferQty || !shopId) {
        Alert.alert("Error", "Please select a shop and enter quantity.");
        return;
    }

    const qty = Number(transferQty);
    const currentStock = Number(transferItem.stockQuantity !== undefined ? transferItem.stockQuantity : transferItem.quantity);
    
    if (isNaN(qty) || qty <= 0) {
        Alert.alert("Error", "Invalid quantity.");
        return;
    }
    if (qty > currentStock) {
        Alert.alert("Error", `Insufficient stock. Max transfer: ${currentStock}`);
        return;
    }

    setLoading(true);
    try {
        const userId = await AsyncStorage.getItem('userId');
        const response = await fetch(`${API_BASE_URL}/products/transfer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sourceShopId: shopId, targetShopId, productId: transferItem._id || transferItem.id, quantity: qty, userId })
        });
        const data = await response.json();
        if (response.ok) {
            Alert.alert("Success", data.message);
            setTransferModalVisible(false);
            fetchInventory();
        } else {
            Alert.alert("Error", data.message || "Transfer failed");
        }
    } catch (e) {
        Alert.alert("Error", "Network error");
    } finally {
        setLoading(false);
    }
  };

  const handleExportPDF = async () => {
    const totalStock = filteredInventory.reduce((acc, item) => acc + (Number(item.quantity) || 0), 0);
    const html = `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Outfit:wght@400;600;800&display=swap" rel="stylesheet">
          <style>
            body { 
              font-family: 'Inter', -apple-system, sans-serif; 
              padding: 24px; 
              color: #1e293b;
              background-color: #ffffff;
              margin: 0;
            }
            .header-banner {
              background: linear-gradient(135deg, #0284c7 0%, #0ea5e9 100%);
              border-radius: 16px;
              padding: 24px;
              color: #ffffff;
              margin-bottom: 24px;
              box-shadow: 0 4px 12px rgba(14, 165, 233, 0.15);
            }
            .header-title {
              font-family: 'Outfit', sans-serif;
              font-size: 22px;
              font-weight: 800;
              margin: 0;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .header-subtitle {
              font-size: 13px;
              color: rgba(255, 255, 255, 0.85);
              margin-top: 6px;
              font-weight: 500;
            }
            
            /* KPI Cards Grid */
            .kpi-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 16px;
              margin-bottom: 28px;
            }
            .kpi-card {
              border: 1px solid #e0f2fe;
              border-radius: 14px;
              padding: 16px;
              background-color: #faf5ff;
              text-align: center;
            }
            .kpi-label {
              font-size: 10px;
              font-weight: 700;
              color: #0ea5e9;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 6px;
            }
            .kpi-value {
              font-size: 18px;
              font-weight: 800;
              color: #0c4a6e;
            }
            .kpi-highlight {
              background-color: #f0f9ff;
              border-color: #bae6fd;
            }
            .kpi-highlight .kpi-label {
              color: #0ea5e9;
            }
            .kpi-highlight .kpi-value {
              color: #5b21b6;
            }
            
            /* Table Styling */
            table { 
              width: 100%; 
              border-collapse: collapse; 
              font-size: 12px;
              margin-top: 20px;
            }
            th { 
              background-color: #f8fafc; 
              color: #475569; 
              font-weight: 700; 
              text-transform: uppercase;
              letter-spacing: 0.5px;
              font-size: 11px;
              border-bottom: 2px solid #cbd5e1;
              padding: 12px 10px;
            }
            td { 
              border-bottom: 1px solid #f1f5f9; 
              padding: 12px 10px; 
              color: #334155;
            }
            tr:nth-child(even) td { 
              background-color: #fafbfb; 
            }
            .low-stock {
              background-color: #fef3c7;
              color: #d97706;
              font-weight: 700;
              padding: 2px 6px;
              border-radius: 4px;
              font-size: 10px;
              display: inline-block;
              margin-left: 6px;
            }
            .out-of-stock {
              background-color: #fee2e2;
              color: #dc2626;
              font-weight: 700;
              padding: 2px 6px;
              border-radius: 4px;
              font-size: 10px;
              display: inline-block;
              margin-left: 6px;
            }
            .total-row td { 
              font-weight: bold; 
              background-color: #f8fafc !important; 
              border-top: 2px solid #cbd5e1;
              border-bottom: 2px solid #94a3b8;
              color: #0f172a;
              font-size: 13px;
              padding: 14px 10px;
            }
            
            .footer { 
              margin-top: 48px; 
              text-align: center; 
              font-size: 10px; 
              color: #94a3b8; 
              border-top: 1px solid #f1f5f9;
              padding-top: 16px;
              font-weight: 500;
            }
          </style>
        </head>
        <body>
          <div class="header-banner">
            <h1 class="header-title">Inventory Valuation Report</h1>
            <div class="header-subtitle">Generated on ${new Date().toLocaleString()} • Manager Workspace</div>
          </div>
          
          <div class="kpi-grid">
            <div class="kpi-card">
              <div class="kpi-label">Unique Products</div>
              <div class="kpi-value">${stats.totalItems} Items</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Total Stock Count</div>
              <div class="kpi-value">${totalStock} Units</div>
            </div>
            <div class="kpi-card kpi-highlight">
              <div class="kpi-label">Total Valuation (Retail)</div>
              <div class="kpi-value">${symbol}${stats.totalValue.toFixed(2)}</div>
            </div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th style="text-align: left;">Item Name</th>
                <th style="text-align: left;">Barcode</th>
                <th style="text-align: right; width: 80px;">Stock</th>
                <th style="text-align: right; width: 100px;">Price</th>
                <th style="text-align: right; width: 120px;">Total Value</th>
              </tr>
            </thead>
            <tbody>
              ${filteredInventory.map(item => {
                const qty = Number(item.quantity) || 0;
                const price = convert(Number(item.price || 0));
                const value = price * qty;

                let stockStatusHtml = '';
                if (qty === 0) {
                  stockStatusHtml = '<span class="out-of-stock">OUT</span>';
                } else if (qty <= 5) {
                  stockStatusHtml = '<span class="low-stock">LOW</span>';
                }

                return `
                  <tr>
                    <td style="font-weight: 600; color: #0f172a;">
                      ${item.name}
                      ${stockStatusHtml}
                    </td>
                    <td style="font-family: monospace; color: #64748b;">${item.barcode || '-'}</td>
                    <td style="text-align: right; font-weight: 700; color: #1e293b;">${qty}</td>
                    <td style="text-align: right; font-family: monospace; color: #475569;">${symbol}${price.toFixed(2)}</td>
                    <td style="text-align: right; font-weight: 700; font-family: monospace; color: #0f172a;">${symbol}${value.toFixed(2)}</td>
                  </tr>
                `;
              }).join('')}
              <tr class="total-row">
                <td colspan="2" style="text-transform: uppercase; letter-spacing: 0.5px;">Grand Total Valuation</td>
                <td style="text-align: right; font-weight: 800;">${totalStock} Units</td>
                <td></td>
                <td style="text-align: right; color: #0ea5e9; font-size: 14px; font-weight: 800;">${symbol}${stats.totalValue.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
          
          <div class="footer">
            Stolar POS System • Automated Inventory Valuation Summary Audit
          </div>
        </body>
      </html>
    `;

    try {
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (error) {
      Alert.alert('Error', 'Failed to generate PDF');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      {/* Header with LinearGradient */}
      <LinearGradient
        colors={['#0284c7', '#0ea5e9', '#38bdf8']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.topRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={20} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Inventory Hub</Text>
          
          <View style={{ flexDirection: 'row' }}>
            <TouchableOpacity style={[styles.headerIconBtn, { marginRight: 10 }]} onPress={handleExportPDF}>
              <Ionicons name="share-outline" size={20} color="white" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.headerIconBtn, { marginRight: 10 }]} 
              onPress={() => {
                if (shopId && typeof shopId === 'string') {
                  router.push({ pathname: '/stock-take', params: { shopId } });
                } else {
                  router.push({ pathname: '/stock-take' });
                }
              }}
            >
              <Ionicons name="clipboard-outline" size={20} color="white" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerIconBtn} onPress={() => router.push({ pathname: '/(manager)/add-stock', params: { shopId } })}>
              <Ionicons name="add" size={22} color="white" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.totalItems}</Text>
            <Text style={styles.statLabel}>Items</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{symbol}{stats.totalValue.toFixed(0)}</Text>
            <Text style={styles.statLabel}>Value</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: stats.lowStock > 0 ? '#fca5a5' : 'white' }]}>{stats.lowStock}</Text>
            <Text style={styles.statLabel}>Low Stock</Text>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#0ea5e9" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or barcode..."
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
          }}>
            <MaterialCommunityIcons name="barcode-scan" size={22} color="#0ea5e9" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Category Filter */}
      <View style={{ marginTop: 15, height: 42 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
          {categories.map(cat => (
            <TouchableOpacity 
              key={cat} 
              style={[styles.filterChip, selectedCategory === cat && styles.activeFilterChip]} 
              onPress={() => setSelectedCategory(cat)}
            >
              <Text style={[styles.filterText, selectedCategory === cat && styles.activeFilterText]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Filters */}
      <View style={[styles.filterContainer, { marginTop: 10 }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: 10, paddingRight: 20}}>
          <TouchableOpacity 
            style={styles.filterChip} 
            onPress={() => setCurrency(prev => prev === 'USD' ? 'ZAR' : 'USD')}
          >
            <Text style={[styles.filterText, { color: '#0ea5e9' }]}>{currency}</Text>
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
            style={[styles.filterChip, { borderColor: '#10b981' }]} 
            onPress={() => setBulkModalVisible(true)}
          >
            <Text style={[styles.filterText, { color: '#10b981' }]}>Bulk Cost Update</Text>
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
            <Ionicons name={sortOrder === 'asc' ? "arrow-up" : "arrow-down"} size={16} color="#64748b" />
          </TouchableOpacity>
        </ScrollView>
      </View>

      <Modal visible={isScanning} animationType="slide" onRequestClose={() => setIsScanning(false)}>
        <CameraView style={styles.camera} facing="back" onBarcodeScanned={handleBarcodeScanned} barcodeScannerSettings={{ barcodeTypes: ["qr", "ean13", "code128"] }}>
          <View style={styles.cameraOverlay}>
            <TouchableOpacity style={styles.closeButton} onPress={() => setIsScanning(false)}>
              <Ionicons name="close" size={30} color="white" />
            </TouchableOpacity>
            <View style={styles.scanFrame} />
            <Text style={styles.scanText}>Scanning...</Text>
          </View>
        </CameraView>
      </Modal>

      {loading ? (
        <ActivityIndicator size="large" color="#0ea5e9" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          ref={flatListRef}
          data={filteredInventory}
          keyExtractor={(item) => item._id || item.id || Math.random().toString()}
          onScroll={(e) => setShowScrollTop(e.nativeEvent.contentOffset.y > 300)}
          scrollEventThrottle={16}
          renderItem={({ item }) => {
            const qty = Number(item.quantity) || 0;
            const status = getStockStatus(qty);
            const rawPrice = Number(item.price || 0);
            const rawCost = Number(item.costPrice || 0);
            const price = convert(rawPrice);
            const cost = convert(rawCost);
            const margin = rawPrice > 0 ? ((rawPrice - rawCost) / rawPrice) * 100 : 0;
            const profit = price - cost;

            const hasWeight = /[0-9]+(\.[0-9]+)?\s*(kg|g|l|ml)$/i.test(item.name.trim());
            const displayName = item.name.replace(/([0-9]+(\.[0-9]+)?)\s*(kg|g|l|ml)$/i, (match: string, num: string, decimal: string, unit: string) => {
              return `${num}${unit.toUpperCase()}`;
            });

            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.iconBox}>
                    <MaterialCommunityIcons name="cube-outline" size={22} color="#0ea5e9" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{displayName}</Text>
                    {!hasWeight && (
                      <Text style={{ fontSize: 10, color: '#f59e0b', fontWeight: '600', marginBottom: 2 }}>⚠️ Missing Weight/Volume (e.g. 1kg, 1L)</Text>
                    )}
                    <Text style={styles.itemBarcode}>{item.barcode || 'No Barcode'}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: status.bg, borderColor: status.border }]}>
                    <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                  </View>
                </View>

                {/* Business Intelligence Visual Margin Meter */}
                <View style={styles.marginMeterContainer}>
                  <View style={styles.marginMeterLabelRow}>
                    <Text style={styles.marginMeterLabel}>Profit Margin</Text>
                    <Text style={[styles.marginMeterValue, { color: margin > 30 ? '#10b981' : margin >= 15 ? '#f59e0b' : '#ef4444' }]}>
                      {margin.toFixed(0)}%
                    </Text>
                  </View>
                  <View style={styles.marginMeterTrack}>
                    <View style={[styles.marginMeterBar, { 
                      width: `${Math.min(Math.max(margin, 0), 100)}%`, 
                      backgroundColor: margin > 30 ? '#10b981' : margin >= 15 ? '#f59e0b' : '#ef4444' 
                    }]} />
                  </View>
                </View>

                <View style={styles.cardDivider} />

                <View style={styles.cardFooter}>
                  <View>
                    <Text style={styles.priceLabel}>Price / Cost</Text>
                    <Text style={styles.priceValue}>{symbol}{price.toFixed(2)} <Text style={styles.costText}>({symbol}{cost.toFixed(2)})</Text></Text>
                  </View>
                  <View>
                    <Text style={styles.priceLabel}>Stock</Text>
                    <Text style={[styles.priceValue, { color: status.color }]}>{qty}</Text>
                  </View>
                  <View>
                    <Text style={styles.priceLabel}>Profit</Text>
                    <Text style={[styles.priceValue, { color: profit >= 0 ? '#10b981' : '#ef4444' }]}>
                      {symbol}{profit.toFixed(2)}
                    </Text>
                  </View>
                  
                  <View style={styles.actions}>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => handleViewHistory(item)}>
                      <MaterialCommunityIcons name="history" size={20} color="#64748b" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => handleItemPress(item)}>
                      <MaterialCommunityIcons name="dots-horizontal" size={20} color="#64748b" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          }}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0ea5e9" />}
          ListEmptyComponent={
            <ThemedText style={styles.emptyText}>No inventory items found.</ThemedText>
          }
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
              placeholderTextColor="#94a3b8"
              keyboardType="numeric"
              value={bulkValue}
              onChangeText={setBulkValue}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setBulkModalVisible(false)}>
                <Text style={styles.btnText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={{ flex: 1, borderRadius: 12, overflow: 'hidden' }} onPress={handleBulkUpdate}>
                <LinearGradient
                  colors={['#0284c7', '#0ea5e9']}
                  style={{ padding: 14, alignItems: 'center', justifyContent: 'center' }}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={{ fontWeight: '800', color: 'white' }}>Update All</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Manage Item Modal */}
      <Modal visible={manageModalVisible} transparent animationType="fade" onRequestClose={() => setManageModalVisible(false)}>
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setManageModalVisible(false)}
        >
          <View style={styles.modalContainer} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { marginBottom: 0, textAlign: 'left' }]}>Manage Item</Text>
              <TouchableOpacity onPress={() => setManageModalVisible(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>
            
            {selectedItem && (
              <View style={{marginBottom: 20, alignItems: 'center'}}>
                <Text style={{fontSize: 18, fontWeight: '800', color: '#0f172a'}}>{selectedItem.name}</Text>
                <Text style={{fontSize: 14, color: '#64748b', fontWeight: '500', marginTop: 4}}>{selectedItem.barcode || 'No Barcode'}</Text>
              </View>
            )}

            <View style={{gap: 12}}>
              <TouchableOpacity 
                style={styles.actionOption} 
                onPress={() => {
                  setManageModalVisible(false);
                  if (selectedItem) {
                    setTransferItem(selectedItem);
                    setTransferQty('');
                    setTargetShopId('');
                    setTransferModalVisible(true);
                    fetchShops();
                  }
                }}
              >
                <View style={[styles.actionIcon, {backgroundColor: '#e0f2fe'}]}>
                  <MaterialCommunityIcons name="truck-delivery-outline" size={22} color="#0284c7" />
                </View>
                <View style={{flex: 1}}>
                  <Text style={styles.actionTitle}>Transfer Stock</Text>
                  <Text style={styles.actionSub}>Move items to another shop</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.actionOption} 
                onPress={() => {
                  setManageModalVisible(false);
                  if (selectedItem) handleEdit(selectedItem);
                }}
              >
                <View style={[styles.actionIcon, {backgroundColor: '#f0fdf4'}]}>
                  <MaterialCommunityIcons name="pencil-outline" size={22} color="#16a34a" />
                </View>
                <View style={{flex: 1}}>
                  <Text style={styles.actionTitle}>Edit Details</Text>
                  <Text style={styles.actionSub}>Update price, cost, or name</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.actionOption} 
                onPress={() => {
                  setManageModalVisible(false);
                  if (selectedItem) confirmDelete(selectedItem);
                }}
              >
                <View style={[styles.actionIcon, {backgroundColor: '#fef2f2'}]}>
                  <MaterialCommunityIcons name="trash-can-outline" size={22} color="#dc2626" />
                </View>
                <View style={{flex: 1}}>
                  <Text style={[styles.actionTitle, {color: '#dc2626'}]}>Delete Item</Text>
                  <Text style={styles.actionSub}>Remove permanently</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* History Modal */}
      <Modal visible={historyModalVisible} transparent animationType="fade" onRequestClose={() => setHistoryModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { maxHeight: '80%', maxWidth: 360, width: '90%' }]}>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16}}>
              <Text style={[styles.modalTitle, { textAlign: 'left', flex: 1, marginRight: 10 }]} numberOfLines={1}>History: {selectedHistoryItemName}</Text>
              <TouchableOpacity onPress={() => setHistoryModalVisible(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={productHistory}
              keyExtractor={(item) => item._id}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={<Text style={styles.emptyText}>No history found.</Text>}
              renderItem={({ item }) => (
                <View style={styles.historyItem}>
                  <View style={styles.historyHeader}>
                    <Text style={styles.historyUser}>{item.userName || 'Unknown User'}</Text>
                    <Text style={styles.historyDate}>{new Date(item.timestamp).toLocaleDateString()} {new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</Text>
                  </View>
                  <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 4}}>
                    <Text style={styles.historyAction}>{item.action}</Text>
                    {item.previousState && (
                      <TouchableOpacity onPress={() => handleRestore(item)} style={styles.restoreBtn}>
                        <Text style={styles.restoreText}>Restore</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={styles.historyDetails}>{item.details}</Text>
                </View>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Transfer Modal */}
      <Modal visible={transferModalVisible} transparent animationType="fade" onRequestClose={() => setTransferModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Transfer Stock</Text>
            <Text style={styles.modalSubtitle}>Moving: {transferItem?.name}</Text>

            <Text style={styles.label}>Quantity to Transfer</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Enter Qty"
              placeholderTextColor="#94a3b8"
              keyboardType="numeric"
              value={transferQty}
              onChangeText={setTransferQty}
            />

            <Text style={styles.label}>Destination Shop</Text>
            <ScrollView style={{ maxHeight: 150, marginBottom: 20 }} showsVerticalScrollIndicator={false}>
                {availableShops.length === 0 ? (
                    <Text style={{ textAlign: 'center', color: '#94a3b8', padding: 10 }}>No other shops available.</Text>
                ) : (
                    availableShops.map(shop => (
                        <TouchableOpacity 
                            key={shop._id} 
                            style={[styles.shopOption, targetShopId === shop._id && styles.shopOptionActive]}
                            onPress={() => setTargetShopId(shop._id)}
                        >
                            <Ionicons name="storefront-outline" size={18} color={targetShopId === shop._id ? '#0ea5e9' : '#64748b'} />
                            <Text style={[styles.shopOptionText, targetShopId === shop._id && styles.shopOptionTextActive]}>{shop.name}</Text>
                            {targetShopId === shop._id && <Ionicons name="checkmark-circle" size={18} color="#0ea5e9" style={{marginLeft: 'auto'}} />}
                        </TouchableOpacity>
                    ))
                )}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setTransferModalVisible(false)}>
                <Text style={styles.btnText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={{ flex: 1, borderRadius: 12, overflow: 'hidden' }} onPress={submitTransfer}>
                <LinearGradient
                  colors={['#0284c7', '#0ea5e9']}
                  style={{ padding: 14, alignItems: 'center', justifyContent: 'center' }}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={{ fontWeight: '800', color: 'white' }}>Transfer</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f9ff' },
  header: {
    paddingTop: 50,
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  backButton: { 
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: 'white' },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  statsRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    backgroundColor: 'rgba(255,255,255,0.12)', 
    borderRadius: 18, 
    padding: 16, 
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  statItem: { alignItems: 'center', flex: 1 },
  statValue: { color: 'white', fontSize: 18, fontWeight: '800' },
  statLabel: { color: 'rgba(255,255,255,0.65)', fontSize: 11, marginTop: 4, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)' },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 52,
    shadowColor: '#0ea5e9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1.5,
    borderColor: '#e9e3ff',
  },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, fontSize: 16, color: '#0f172a', height: '100%', fontWeight: '600' },

  filterContainer: { flexDirection: 'row', paddingHorizontal: 20, marginTop: 15, gap: 10 },
  filterChip: { 
    paddingVertical: 10, 
    paddingHorizontal: 18, 
    borderRadius: 22, 
    backgroundColor: 'white', 
    borderWidth: 1.5, 
    borderColor: '#cbd5e1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  activeFilterChip: { backgroundColor: '#0ea5e9', borderColor: '#0ea5e9' },
  filterText: { color: '#64748b', fontWeight: '700', fontSize: 13 },
  activeFilterText: { color: 'white' },
  verticalDivider: { width: 1, height: '100%', backgroundColor: '#cbd5e1', marginHorizontal: 5 },

  listContent: { padding: 20, gap: 15, paddingBottom: 40 },
  card: { 
    backgroundColor: 'white', 
    borderRadius: 20, 
    padding: 16, 
    shadowColor: '#0ea5e9', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.05, 
    shadowRadius: 10, 
    elevation: 3,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#f3e8ff', justifyContent: 'center', alignItems: 'center' },
  itemName: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  itemBarcode: { fontSize: 12, color: '#94a3b8', fontWeight: '600', marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1 },
  statusText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  
  marginMeterContainer: {
    marginTop: 15,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  marginMeterLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  marginMeterLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  marginMeterValue: {
    fontSize: 13,
    fontWeight: '800'
  },
  marginMeterTrack: {
    height: 6,
    backgroundColor: '#e2e8f0',
    borderRadius: 3,
    overflow: 'hidden'
  },
  marginMeterBar: {
    height: '100%',
    borderRadius: 3
  },

  cardDivider: { height: 1, backgroundColor: '#cbd5e1', marginVertical: 12 },
  
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceLabel: { fontSize: 11, color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  priceValue: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  costText: { fontSize: 12, color: '#94a3b8', fontWeight: '500' },
  
  actions: { flexDirection: 'row', gap: 10 },
  actionBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
  
  emptyText: { textAlign: 'center', marginTop: 50, color: '#94a3b8', fontWeight: '600' },
  camera: { flex: 1 },
  cameraOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  closeButton: { position: 'absolute', top: 50, right: 20, padding: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 },
  scanFrame: { width: 250, height: 250, borderWidth: 2, borderColor: 'white', backgroundColor: 'transparent' },
  scanText: { color: 'white', marginTop: 20, fontSize: 18, fontWeight: 'bold' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.65)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContainer: { backgroundColor: 'white', borderRadius: 24, padding: 24, width: '100%', maxWidth: 360, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 10 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a', marginBottom: 6, textAlign: 'center' },
  modalSubtitle: { fontSize: 13, color: '#64748b', marginBottom: 20, textAlign: 'center', fontWeight: '500' },
  label: { fontSize: 12, color: '#475569', marginBottom: 8, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  tabRow: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 12, padding: 4, marginBottom: 20 },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  activeTabBtn: { backgroundColor: 'white', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 3, elevation: 1 },
  tabText: { fontSize: 13, fontWeight: '700', color: '#64748b' },
  activeTabText: { color: '#0ea5e9' },
  modalInput: { borderWidth: 1.5, borderColor: '#cbd5e1', borderRadius: 12, padding: 14, fontSize: 16, marginBottom: 20, textAlign: 'center', backgroundColor: '#f8fafc', color: '#0f172a', fontWeight: '700' },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cancelBtn: { backgroundColor: '#f1f5f9' },
  btnText: { fontWeight: '800', color: '#475569', fontSize: 15 },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    width: '100%',
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  actionSub: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
    marginTop: 2,
  },

  historyItem: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  historyUser: { fontWeight: '800', color: '#0f172a', fontSize: 14 },
  historyDate: { color: '#94a3b8', fontSize: 12, fontWeight: '500' },
  historyAction: { fontSize: 12, color: '#0ea5e9', fontWeight: '800', marginBottom: 2 },
  historyDetails: { fontSize: 13, color: '#475569', fontWeight: '500' },
  restoreBtn: { backgroundColor: '#f3e8ff', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#d8b4fe' },
  restoreText: { fontSize: 11, color: '#0ea5e9', fontWeight: '800' },
  shopOption: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#cbd5e1', marginBottom: 8, backgroundColor: '#f8fafc' },
  shopOptionActive: { borderColor: '#0ea5e9', backgroundColor: '#f0f9ff' },
  shopOptionText: { marginLeft: 10, fontSize: 14, color: '#64748b', fontWeight: '600' },
  shopOptionTextActive: { color: '#0ea5e9', fontWeight: '800' },
  scrollTopButton: {
    position: 'absolute',
    bottom: 40,
    right: 20,
    backgroundColor: '#0ea5e9',
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#0ea5e9', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10,
  },
});
