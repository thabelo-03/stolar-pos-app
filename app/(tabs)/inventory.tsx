import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { API_BASE_URL } from './api';

interface InventoryItem {
  _id: string;
  name: string;
  barcode: string;
  quantity: number;
  price: number;
}

export default function CashierInventoryScreen() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const textColor = useThemeColor({}, 'text');

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
          setInventory(data);
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

  useEffect(() => {
    fetchInventory();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchInventory();
  };

  const filteredInventory = inventory.filter((item) => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.barcode && item.barcode.includes(searchQuery))
  );

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>Shop Inventory</ThemedText>
      
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#888" style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { color: textColor }]}
          placeholder="Search products..."
          placeholderTextColor="#888"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#1e40af" />
      ) : (
        <FlatList
          data={filteredInventory}
          keyExtractor={(item) => item._id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => (
            <View style={styles.itemCard}>
              <View>
                <ThemedText type="defaultSemiBold">{item.name}</ThemedText>
                <ThemedText style={styles.barcode}>{item.barcode}</ThemedText>
              </View>
              <View style={styles.rightInfo}>
                <Text style={styles.qty}>{item.quantity} in stock</Text>
                <Text style={styles.price}>${item.price?.toFixed(2)}</Text>
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No products found in this shop.</Text>}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60 },
  title: { marginBottom: 20 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(150, 150, 150, 0.1)', borderRadius: 10, paddingHorizontal: 12, marginBottom: 20 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 16 },
  itemCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: 'rgba(150, 150, 150, 0.1)', borderRadius: 12, marginBottom: 10 },
  barcode: { fontSize: 12, opacity: 0.6 },
  rightInfo: { alignItems: 'flex-end' },
  qty: { fontWeight: 'bold', color: '#1e40af' },
  price: { fontSize: 12, opacity: 0.8 },
  empty: { textAlign: 'center', marginTop: 50, opacity: 0.5 },
});