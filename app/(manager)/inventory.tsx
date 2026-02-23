import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Print from 'expo-print';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '../../components/themed-text';
import { ThemedView } from '../../components/themed-view';
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
  const [currency, setCurrency] = useState<'USD' | 'ZAR'>('USD');
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
    if (qty === 0) return { label: 'Out of Stock', color: '#ef4444', bg: '#fee2e2' };
    if (qty < 5) return { label: 'Low Stock', color: '#f59e0b', bg: '#fef3c7' };
    return { label: 'In Stock', color: '#10b981', bg: '#d1fae5' };
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
                // Filter out current shop
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

    // Prepare updates based on filtered inventory
    const updates = filteredInventory.map(item => {
      let newCost = 0;
      if (bulkMode === 'fixed') {
        newCost = val;
      } else {
        // Percentage of selling price (e.g. 70 means 70% of price)
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
                <th style="text-align: right;">Value</th>
              </tr>
            </thead>
            <tbody>
              ${filteredInventory.map(item => {
                const qty = Number(item.quantity) || 0;
                const price = convert(Number(item.price || 0));
                const value = price * qty;
                return `
                  <tr>
                    <td>${item.name}</td>
                    <td>${item.barcode || '-'}</td>
                    <td style="text-align: right;">${qty}</td>
                    <td style="text-align: right;">${symbol}${price.toFixed(2)}</td>
                    <td style="text-align: right;">${symbol}${value.toFixed(2)}</td>
                  </tr>
                `;
              }).join('')}
              <tr class="total-row">
                <td colspan="2">TOTAL</td>
                <td style="text-align: right;">${stats.totalItems} items</td>
                <td></td>
                <td style="text-align: right;">${symbol}${stats.totalValue.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
          
          <div class="footer">
            Stolar POS System
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
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.topRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Manager Inventory</Text>
          
          <View style={{ flexDirection: 'row' }}>
            <TouchableOpacity style={[styles.addButton, { marginRight: 10 }]} onPress={handleExportPDF}>
              <Ionicons name="share-outline" size={24} color="#1e40af" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.addButton, { marginRight: 10 }]} 
              onPress={() => {
                // Ensure shopId is a safe string and navigate
                if (shopId && typeof shopId === 'string') {
                  router.push({ pathname: '/stock-take', params: { shopId } });
                } else {
                  router.push({ pathname: '/stock-take' });
                }
              }}
            >
              <Ionicons name="clipboard-outline" size={24} color="#1e40af" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.addButton} onPress={() => router.push({ pathname: '/(manager)/add-stock', params: { shopId } })}>
              <Ionicons name="add" size={24} color="#1e40af" />
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
          <Ionicons name="search" size={20} color="#64748b" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or barcode"
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
            <MaterialCommunityIcons name="barcode-scan" size={24} color="#64748b" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Category Filter */}
      <View style={{ marginTop: 15, height: 40 }}>
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
            <Text style={[styles.filterText, { color: '#1e40af' }]}>{currency}</Text>
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
        <ActivityIndicator size="large" color={textColor} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={filteredInventory}
          keyExtractor={(item) => item._id || item.id || Math.random().toString()}
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
            const displayName = item.name.replace(/([0-9]+(\.[0-9]+)?)\s*(kg|g|l|ml)$/i, (match, num, decimal, unit) => {
              return `${num}${unit.toUpperCase()}`;
            });

            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.iconBox}>
                    <MaterialCommunityIcons name="cube-outline" size={24} color="#1e40af" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{displayName}</Text>
                    {!hasWeight && (
                      <Text style={{ fontSize: 10, color: '#f59e0b', marginBottom: 2 }}>⚠️ Missing Weight/Volume (e.g. 1kg, 1L)</Text>
                    )}
                    <Text style={styles.itemBarcode}>{item.barcode || 'No Barcode'}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                    <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
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
                      {symbol}{profit.toFixed(2)} <Text style={{fontSize: 11, fontWeight: 'normal'}}>({margin.toFixed(0)}%)</Text>
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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={textColor} />}
          ListEmptyComponent={
            <ThemedText style={styles.emptyText}>No inventory items found.</ThemedText>
          }
        />
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
              <TouchableOpacity onPress={() => setManageModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            
            {selectedItem && (
              <View style={{marginBottom: 20, alignItems: 'center'}}>
                <Text style={{fontSize: 18, fontWeight: 'bold', color: '#1e293b'}}>{selectedItem.name}</Text>
                <Text style={{fontSize: 14, color: '#64748b'}}>{selectedItem.barcode || 'No Barcode'}</Text>
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
                  <MaterialCommunityIcons name="truck-delivery-outline" size={24} color="#0284c7" />
                </View>
                <View style={{flex: 1}}>
                  <Text style={styles.actionTitle}>Transfer Stock</Text>
                  <Text style={styles.actionSub}>Move items to another shop</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.actionOption} 
                onPress={() => {
                  setManageModalVisible(false);
                  if (selectedItem) handleEdit(selectedItem);
                }}
              >
                <View style={[styles.actionIcon, {backgroundColor: '#f0fdf4'}]}>
                  <MaterialCommunityIcons name="pencil-outline" size={24} color="#16a34a" />
                </View>
                <View style={{flex: 1}}>
                  <Text style={styles.actionTitle}>Edit Details</Text>
                  <Text style={styles.actionSub}>Update price, cost, or name</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.actionOption} 
                onPress={() => {
                  setManageModalVisible(false);
                  if (selectedItem) confirmDelete(selectedItem);
                }}
              >
                <View style={[styles.actionIcon, {backgroundColor: '#fef2f2'}]}>
                  <MaterialCommunityIcons name="trash-can-outline" size={24} color="#dc2626" />
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
          <View style={[styles.modalContainer, { maxHeight: '80%' }]}>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15}}>
              <Text style={styles.modalTitle}>History: {selectedHistoryItemName}</Text>
              <TouchableOpacity onPress={() => setHistoryModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={productHistory}
              keyExtractor={(item) => item._id}
              ListEmptyComponent={<Text style={styles.emptyText}>No history found.</Text>}
              renderItem={({ item }) => (
                <View style={styles.historyItem}>
                  <View style={styles.historyHeader}>
                    <Text style={styles.historyUser}>{item.userName || 'Unknown User'}</Text>
                    <Text style={styles.historyDate}>{new Date(item.timestamp).toLocaleDateString()} {new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</Text>
                  </View>
                  <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
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
              keyboardType="numeric"
              value={transferQty}
              onChangeText={setTransferQty}
            />

            <Text style={styles.label}>Destination Shop</Text>
            <ScrollView style={{ maxHeight: 150, marginBottom: 20 }}>
                {availableShops.length === 0 ? (
                    <Text style={{ textAlign: 'center', color: '#94a3b8', padding: 10 }}>No other shops available.</Text>
                ) : (
                    availableShops.map(shop => (
                        <TouchableOpacity 
                            key={shop._id} 
                            style={[styles.shopOption, targetShopId === shop._id && styles.shopOptionActive]}
                            onPress={() => setTargetShopId(shop._id)}
                        >
                            <Ionicons name="storefront-outline" size={18} color={targetShopId === shop._id ? '#1e40af' : '#64748b'} />
                            <Text style={[styles.shopOptionText, targetShopId === shop._id && styles.shopOptionTextActive]}>{shop.name}</Text>
                            {targetShopId === shop._id && <Ionicons name="checkmark-circle" size={18} color="#1e40af" style={{marginLeft: 'auto'}} />}
                        </TouchableOpacity>
                    ))
                )}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setTransferModalVisible(false)}>
                <Text style={styles.btnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.confirmBtn]} onPress={submitTransfer}>
                <Text style={[styles.btnText, {color: 'white'}]}>Transfer</Text>
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
    backgroundColor: '#1e3a8a',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  backButton: { padding: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: 'white' },
  addButton: { padding: 8, backgroundColor: 'white', borderRadius: 12 },

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
  costText: { fontSize: 12, color: '#94a3b8', fontWeight: 'normal' },
  
  actions: { flexDirection: 'row', gap: 10 },
  actionBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
  
  emptyText: { textAlign: 'center', marginTop: 50, color: '#94a3b8' },
  camera: { flex: 1 },
  cameraOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  closeButton: { position: 'absolute', top: 50, right: 20, padding: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 },
  scanFrame: { width: 250, height: 250, borderWidth: 2, borderColor: 'white', backgroundColor: 'transparent' },
  scanText: { color: 'white', marginTop: 20, fontSize: 18, fontWeight: 'bold' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContainer: { backgroundColor: 'white', borderRadius: 16, padding: 20, width: '100%', maxWidth: 350 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginBottom: 5, textAlign: 'center' },
  modalSubtitle: { fontSize: 14, color: '#64748b', marginBottom: 20, textAlign: 'center' },
  label: { fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 8 },
  tabRow: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 8, padding: 4, marginBottom: 20 },
  tabBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
  activeTabBtn: { backgroundColor: 'white', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 2, elevation: 1 },
  tabText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  activeTabText: { color: '#1e40af' },
  modalInput: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 20, textAlign: 'center' },
  modalActions: { flexDirection: 'row', gap: 10 },
  modalBtn: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center' },
  cancelBtn: { backgroundColor: '#f1f5f9' },
  confirmBtn: { backgroundColor: '#1e40af' },
  btnText: { fontWeight: 'bold' },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    width: '100%',
  },
  actionOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
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
    fontWeight: '600',
    color: '#1e293b',
  },
  actionSub: {
    fontSize: 12,
    color: '#64748b',
  },

  historyItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  historyUser: { fontWeight: 'bold', color: '#1e293b', fontSize: 14 },
  historyDate: { color: '#94a3b8', fontSize: 12 },
  historyAction: { fontSize: 12, color: '#1e40af', fontWeight: '600', marginBottom: 2 },
  historyDetails: { fontSize: 13, color: '#475569' },
  restoreBtn: { backgroundColor: '#f0f9ff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#bae6fd' },
  restoreText: { fontSize: 10, color: '#0284c7', fontWeight: 'bold' },
  shopOption: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 8, backgroundColor: '#f8fafc' },
  shopOptionActive: { borderColor: '#1e40af', backgroundColor: '#eff6ff' },
  shopOptionText: { marginLeft: 10, fontSize: 14, color: '#64748b', fontWeight: '500' },
  shopOptionTextActive: { color: '#1e40af', fontWeight: 'bold' },
});
