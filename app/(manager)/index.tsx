import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { API_BASE_URL } from '../config';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Ionicons } from '@expo/vector-icons'; // Import Ionicons

interface Shop {
  _id: string;
  name: string;
  location: string;
  branchCode: string;
}

const ManagerIndex = () => {
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchShops = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/shops`);
        if (!response.ok) {
          throw new Error('Failed to fetch shops');
        }
        const data = await response.json();
        setShops(data);
      } catch (e) {
        if (e instanceof Error) {
            setError(e.message);
        } else {
            setError('An unknown error occurred');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchShops();
  }, []);

  const handleShopPress = (shop: Shop) => {
    router.push({
      pathname: '/(manager)/operations-hub',
      params: { shop: JSON.stringify(shop) },
    });
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" />
        <ThemedText>Loading shops...</ThemedText>
      </ThemedView>
    );
  }

  if (error) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText style={styles.errorText}>Error: {error}</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText style={styles.title}>Your Shops</ThemedText>
      <FlatList
        data={shops}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.shopItem} onPress={() => handleShopPress(item)}>
            <Ionicons name="storefront-outline" size={24} color="#fff" style={styles.shopIcon} />
            <View>
              <ThemedText style={styles.shopName}>{item.name}</ThemedText>
              <ThemedText style={styles.shopLocation}>{item.location}</ThemedText>
            </View>
          </TouchableOpacity>
        )}
        ListFooterComponent={() => (
          <TouchableOpacity
            style={styles.registerShopButton}
            onPress={() => router.push('/(manager)/register-shop')}
          >
            <Ionicons name="add-circle-outline" size={24} color="#1e40af" />
            <Text style={styles.registerShopButtonText}>Register Another Shop</Text>
          </TouchableOpacity>
        )}
      />
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f1f5f9', // Light gray background for the entire screen
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#1e40af', // Darker blue for title
  },
  shopItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e40af', // Blue background for shop cards
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  shopIcon: {
    marginRight: 15,
  },
  shopName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff', // White text for shop name
  },
  shopLocation: {
    fontSize: 14,
    color: '#bfdbfe', // Lighter blue for location
  },
  errorText: {
    color: 'red',
    fontSize: 16,
  },
  registerShopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e0f2fe', // Light blue background for the button
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#1e40af',
  },
  registerShopButtonText: {
    marginLeft: 10,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e40af', // Darker blue text
  },
});

export default ManagerIndex;

