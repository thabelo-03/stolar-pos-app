import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '../../components/themed-text';
import { ThemedView } from '../../components/themed-view';
import { useThemeColor } from '../../hooks/use-theme-color';
import { API_BASE_URL } from './api';
interface InventoryItem {
  _id?: string;
  id?: string;
  name: string;
  barcode?: string;
  quantity: number | string;
  price?: number | string;
  costPrice?: number | string;
}

export default function InventoryScreen() {
  const router = useRouter();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const textColor = useThemeColor({}, 'text');
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(false);

  const fetchInventory = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/products`);
      const data = await response.json();
      if (response.ok) {
        setInventory(data);
      }
    } catch (error) {
      console.log('Error fetching inventory:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchInventory();
  };

  const filteredInventory = useMemo(() => {
    return inventory.filter((item) => 
      (item.name && item.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.barcode && item.barcode.toString().includes(searchQuery))
    );
  }, [inventory, searchQuery]);

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

  const handleItemPress = (item: InventoryItem) => {
    const itemId = item._id || item.id;
    if (!itemId) {
      Alert.alert('Error', 'Item ID is missing');
      return;
    }

    Alert.alert(
      'Manage Item',
      `Choose an action for ${item.name}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Edit', 
          onPress: () => router.push({
            pathname: '/(tabs)/add-stock',
            params: { id: itemId, name: item.name, quantity: item.quantity, barcode: item.barcode, price: item.price, costPrice: item.costPrice, mode: 'edit' }
          }) 
        },
        { 
          text: 'Delete', 
          style: 'destructive', 
          onPress: () => deleteItem(itemId) 
        },
      ]
    );
  };

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    setSearchQuery(data);
    setIsScanning(false);
  };

  const handleSeedData = async () => {
    Alert.alert(
      'Seed Database',
      'Add dummy inventory items?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add Data',
          onPress: async () => {
            setLoading(true);
            const dummyItems = [
              { name: 'Milk 1L', quantity: 20, barcode: '8801', price: 2.50, costPrice: 1.80 ,category: 'General'},
              { name: 'Whole Wheat Bread', quantity: 15, barcode: '8802', price: 3.00, costPrice: 2.10, category: 'General' },
              { name: 'Large Eggs (12)', quantity: 30, barcode: '8803', price: 4.50, costPrice: 3.50, category: 'General' },
              { name: 'Salted Butter', quantity: 3, barcode: '8804', price: 5.00, costPrice: 3.80, category: 'General' },
              { name: 'Cheddar Cheese', quantity: 8, barcode: '8805', price: 6.50, costPrice: 4.50, category: 'General' },
              { name: 'Red Apples', quantity: 50, barcode: '8806', price: 0.80, costPrice: 0.40, category: 'Fruits' },
              { name: 'Bananas', quantity: 4, barcode: '8807', price: 0.60, costPrice: 0.30 ,category: 'General'},
              { name: 'Orange Juice', quantity: 12, barcode: '8808', price: 4.00, costPrice: 2.50, category: 'General' },
              { name: 'Corn Flakes', quantity: 10, barcode: '8809', price: 3.50, costPrice: 2.20, category: 'Medicine' },
              { name: 'Coffee Beans', quantity: 25, barcode: '8810', price: 12.00, costPrice: 8.00, category: 'General' },
            ];

            let count = 0;
            for (const item of dummyItems) {
              try {
                await fetch(`${API_BASE_URL}/products/add`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(item),
                });
                count++;
              } catch (e) {}
            }
            
            setLoading(false);
            Alert.alert('Success', `Added ${count} items`);
            fetchInventory();
          }
        }
      ]
    );
  };

  const handleDeleteAll = async () => {
    if (inventory.length === 0) {
      Alert.alert('Info', 'Inventory is already empty.');
      return;
    }

    Alert.alert(
      'Delete All Inventory',
      'Are you sure you want to delete ALL items? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            let count = 0;
            for (const item of inventory) {
              const id = item._id || item.id;
              if (id) {
                try {
                  await fetch(`${API_BASE_URL}/products/${id}`, { method: 'DELETE' });
                  count++;
                } catch (e) {}
              }
            }
            setLoading(false);
            Alert.alert('Success', `Deleted ${count} items`);
            fetchInventory();
          }
        }
      ]
    );
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="title">Inventory</ThemedText>
        <View style={{ flexDirection: 'row', gap: 15 }}>
          <TouchableOpacity onPress={handleDeleteAll}>
            <Ionicons name="trash-outline" size={28} color="#ef4444" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSeedData}>
            <Ionicons name="cloud-upload-outline" size={28} color="#1e40af" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/(tabs)/add-stock')}>
            <Ionicons name="add-circle" size={28} color="#1e40af" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#888" style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { color: textColor }]}
          placeholder="Search by name or barcode"
          placeholderTextColor="#888"
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
          <Ionicons name="barcode-outline" size={24} color={textColor} />
        </TouchableOpacity>
      </View>

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

      {loading ? (
        <ActivityIndicator size="large" color={textColor} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={filteredInventory}
          keyExtractor={(item) => item._id || item.id || Math.random().toString()}
          renderItem={({ item }) => {
            const isLowStock = Number(item.quantity) < 5;
            const price = Number(item.price || 0);
            const cost = Number(item.costPrice || 0);
            const margin = price > 0 ? ((price - cost) / price) * 100 : 0;

            return (
              <TouchableOpacity onPress={() => handleItemPress(item)}>
                <ThemedView style={styles.itemCard}>
                  <View>
                    <ThemedText type="defaultSemiBold">{item.name}</ThemedText>
                    <ThemedText style={styles.barcodeText}>
                      {item.barcode ? `Barcode: ${item.barcode}` : 'No Barcode'} • ${price.toFixed(2)}
                    </ThemedText>
                    <Text style={[styles.marginText, { color: margin >= 0 ? '#10b981' : '#ef4444' }]}>
                      Margin: {margin.toFixed(1)}%
                    </Text>
                    {isLowStock && (
                      <Text style={styles.lowStockText}>⚠️ Low Stock</Text>
                    )}
                  </View>
                  <View style={styles.qtyContainer}>
                    <ThemedText type="title" style={{ fontSize: 18, color: isLowStock ? '#ef4444' : undefined }}>{item.quantity}</ThemedText>
                    <ThemedText style={styles.qtyLabel}>Qty</ThemedText>
                  </View>
                </ThemedView>
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <ThemedText style={styles.emptyText}>No inventory items found.</ThemedText>
          }
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  list: { gap: 12, paddingBottom: 20 },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 20,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 16 },
  itemCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
  },
  barcodeText: { fontSize: 12, opacity: 0.6, marginTop: 4 },
  qtyContainer: { alignItems: 'center', minWidth: 50 },
  qtyLabel: { fontSize: 10, opacity: 0.6 },
  emptyText: { textAlign: 'center', marginTop: 50, opacity: 0.5 },
  camera: { flex: 1 },
  cameraOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  closeButton: { position: 'absolute', top: 50, right: 20, padding: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 },
  scanFrame: { width: 250, height: 250, borderWidth: 2, borderColor: 'white', backgroundColor: 'transparent' },
  scanText: { color: 'white', marginTop: 20, fontSize: 18, fontWeight: 'bold' },
  lowStockText: { color: '#ef4444', fontSize: 12, fontWeight: 'bold', marginTop: 4 },
  marginText: { fontSize: 12, marginTop: 2, fontWeight: '600' },
});