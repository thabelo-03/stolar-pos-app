import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '../../components/themed-text';
import { ThemedView } from '../../components/themed-view';
import { useThemeColor } from '../../hooks/use-theme-color';
import { API_BASE_URL } from '../(auth)/api';

export default function InventoryScreen() {
  const router = useRouter();
  const [inventory, setInventory] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const textColor = useThemeColor({}, 'text');

  const fetchInventory = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/inventory`);
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

  const filteredInventory = inventory.filter((item: any) => 
    (item.name && item.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (item.barcode && item.barcode.toString().includes(searchQuery))
  );

  const deleteItem = async (id: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/inventory/${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setInventory((prev: any[]) => prev.filter((item) => (item._id || item.id) !== id));
        Alert.alert('Success', 'Item deleted successfully');
      } else {
        Alert.alert('Error', 'Failed to delete item');
      }
    } catch (error) {
      Alert.alert('Error', 'Could not connect to server');
    }
  };

  const handleItemPress = (item: any) => {
    Alert.alert(
      'Manage Item',
      `Choose an action for ${item.name}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Edit', 
          onPress: () => router.push({
            pathname: '/(tabs)/add-stock',
            params: { id: item._id || item.id, name: item.name, quantity: item.quantity, mode: 'edit' }
          }) 
        },
        { 
          text: 'Delete', 
          style: 'destructive', 
          onPress: () => deleteItem(item._id || item.id) 
        },
      ]
    );
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="title">Inventory</ThemedText>
        <TouchableOpacity onPress={() => router.push('/(tabs)/add-stock')}>
          <Ionicons name="add-circle" size={28} color="#1e40af" />
        </TouchableOpacity>
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
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={textColor} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={filteredInventory}
          keyExtractor={(item: any) => item._id || item.id || Math.random().toString()}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => handleItemPress(item)}>
              <ThemedView style={styles.itemCard}>
              <View>
                <ThemedText type="defaultSemiBold">{item.name}</ThemedText>
                <ThemedText style={styles.barcodeText}>
                  {item.barcode ? `Barcode: ${item.barcode}` : 'No Barcode'}
                </ThemedText>
              </View>
              <View style={styles.qtyContainer}>
                <ThemedText type="title" style={{ fontSize: 18 }}>{item.quantity}</ThemedText>
                <ThemedText style={styles.qtyLabel}>Qty</ThemedText>
              </View>
              </ThemedView>
            </TouchableOpacity>
          )}
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
});