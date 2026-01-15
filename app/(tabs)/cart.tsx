import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { API_BASE_URL } from './api';

export default function CartScreen() {
  const router = useRouter();
  const { barcode } = useLocalSearchParams();
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);

  useEffect(() => {
    const fetchAllProducts = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/products`);
        if (response.ok) {
          const data = await response.json();
          setAllProducts(data);
        }
      } catch (error) {}
    };
    fetchAllProducts();
  }, []);

  useEffect(() => {
    const fetchProduct = async () => {
      if (barcode && typeof barcode === 'string') {
        try {
          const response = await fetch(`${API_BASE_URL}/products/${barcode}`);
          if (response.ok) {
            const product = await response.json();
            setCartItems(prevItems => {
              const existingItem = prevItems.find(item => item.barcode === barcode);
              if (existingItem) {
                return prevItems.map(item =>
                  item.id === existingItem.id
                    ? { ...item, quantity: item.quantity + 1 }
                    : item
                );
              } else {
                const newItem = {
                  id: product._id || Date.now().toString(),
                  name: product.name,
                  price: Number(product.price),
                  quantity: 1,
                  barcode: product.barcode,
                };
                return [...prevItems, newItem];
              }
            });
          } else {
            Alert.alert('Product Not Found', `No product found with barcode: ${barcode}`);
          }
        } catch (error) {
          Alert.alert('Error', 'Failed to fetch product details');
        }
      }
    };
    fetchProduct();
  }, [barcode]);

  useEffect(() => {
    const newTotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    setTotal(newTotal);
  }, [cartItems]);

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    if (text.trim().length > 0) {
      const filtered = allProducts.filter(p => 
        p.name.toLowerCase().includes(text.toLowerCase())
      );
      setSearchResults(filtered.slice(0, 5));
    } else {
      setSearchResults([]);
    }
  };

  const addItemToCart = (product: any) => {
    setCartItems(prevItems => {
      const existingItem = prevItems.find(item => item.id === product._id);
      if (existingItem) {
        return prevItems.map(item => item.id === existingItem.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prevItems, { id: product._id, name: product.name, price: Number(product.price), quantity: 1, barcode: product.barcode }];
    });
    setSearchQuery('');
    setSearchResults([]);
  };

  const updateQuantity = (itemId: string, amount: number) => {
    setCartItems(currentItems =>
      currentItems
        .map(item =>
          item.id === itemId
            ? { ...item, quantity: item.quantity + amount }
            : item
        )
        .filter(item => item.quantity > 0) // Remove item if quantity is 0
    );
  };

  const handleCheckout = async () => {
    if (cartItems.length === 0) {
      Alert.alert('Empty Cart', 'Please add items before checking out.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cartItems,
          total: total,
          paymentMethod,
          date: new Date().toISOString(),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert('Success', 'Transaction completed!', [
          { text: 'OK', onPress: () => router.replace('/(tabs)/home') }
        ]);
      } else {
        Alert.alert('Error', data.message || 'Transaction failed');
      }
    } catch (error) {
      Alert.alert('Error', 'Could not connect to server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.title}>Shopping Cart</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#64748b" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search to add item..."
          value={searchQuery}
          onChangeText={handleSearch}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); }}>
            <Ionicons name="close-circle" size={20} color="#64748b" />
          </TouchableOpacity>
        )}

        {searchResults.length > 0 && (
          <View style={styles.dropdown}>
            {searchResults.map((item) => (
              <TouchableOpacity key={item._id} style={styles.dropdownItem} onPress={() => addItemToCart(item)}>
                <View>
                  <Text style={styles.dropdownName}>{item.name}</Text>
                  <Text style={styles.dropdownPrice}>${Number(item.price).toFixed(2)}</Text>
                </View>
                <Ionicons name="add-circle" size={24} color="#1e40af" />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <FlatList
        data={cartItems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.itemCard}>
            <View style={styles.itemDetails}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemPrice}>${item.price.toFixed(2)} each</Text>
            </View>
            <View style={styles.quantityControl}>
              <TouchableOpacity onPress={() => updateQuantity(item.id, -1)} style={styles.controlButton}>
                <Ionicons name="remove-circle" size={28} color="#64748b" />
              </TouchableOpacity>
              <Text style={styles.quantityText}>{item.quantity}</Text>
              <TouchableOpacity onPress={() => updateQuantity(item.id, 1)} style={styles.controlButton}>
                <Ionicons name="add-circle" size={28} color="#1e40af" />
              </TouchableOpacity>
            </View>
            <Text style={styles.totalItemPrice}>${(item.price * item.quantity).toFixed(2)}</Text>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>Cart is empty. Scan items to add them.</Text>
        }
      />

      <View style={styles.footer}>
        <View style={styles.paymentSection}>
          <Text style={styles.paymentTitle}>Payment Method</Text>
          <View style={styles.paymentOptions}>
            {['Cash', 'Card', 'Mobile'].map((method) => (
              <TouchableOpacity
                key={method}
                style={[styles.paymentOption, paymentMethod === method && styles.paymentOptionActive]}
                onPress={() => setPaymentMethod(method)}
              >
                <Text style={[styles.paymentText, paymentMethod === method && styles.paymentTextActive]}>
                  {method}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>${total.toFixed(2)}</Text>
        </View>
        
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={[styles.button, styles.scanButton]} 
            onPress={() => router.back()}
          >
            <Ionicons name="scan" size={20} color="#1e40af" />
            <Text style={styles.scanButtonText}>Scan More</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.button, styles.checkoutButton, loading && { opacity: 0.7 }]} 
            onPress={handleCheckout}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Text style={styles.checkoutButtonText}>Checkout</Text>
                <Ionicons name="arrow-forward" size={20} color="white" />
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  title: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
  backButton: { padding: 4 },
  list: { padding: 20 },
  itemCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', padding: 16, borderRadius: 12, marginBottom: 12, elevation: 2 },
  itemDetails: { flex: 1 },
  itemName: { fontSize: 16, fontWeight: '600', color: '#1e293b' },
  itemPrice: { fontSize: 14, color: '#64748b', marginTop: 4 },
  quantityControl: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 10 },
  controlButton: {},
  quantityText: { fontSize: 18, fontWeight: 'bold', minWidth: 25, textAlign: 'center' },
  totalItemPrice: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyText: { textAlign: 'center', marginTop: 50, color: '#94a3b8' },
  footer: { padding: 20, backgroundColor: 'white', borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  totalLabel: { fontSize: 18, color: '#64748b' },
  totalValue: { fontSize: 24, fontWeight: 'bold', color: '#1e293b' },
  actionButtons: { flexDirection: 'row', gap: 12 },
  button: { flex: 1, padding: 16, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  scanButton: { backgroundColor: '#eff6ff' },
  scanButtonText: { color: '#1e40af', fontWeight: '600' },
  checkoutButton: { backgroundColor: '#1e40af' },
  checkoutButtonText: { color: 'white', fontWeight: '600' },
  paymentSection: { marginBottom: 20 },
  paymentTitle: { fontSize: 14, fontWeight: '600', color: '#64748b', marginBottom: 10 },
  paymentOptions: { flexDirection: 'row', gap: 10 },
  paymentOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  paymentOptionActive: { backgroundColor: '#eff6ff', borderColor: '#1e40af' },
  paymentText: { color: '#64748b', fontWeight: '500' },
  paymentTextActive: { color: '#1e40af', fontWeight: 'bold' },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    margin: 20,
    marginBottom: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    zIndex: 100,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 16, color: '#1e293b' },
  dropdown: {
    position: 'absolute',
    top: '100%',
    marginTop: 4,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderRadius: 12,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  dropdownName: { fontSize: 16, fontWeight: '600', color: '#1e293b' },
  dropdownPrice: { fontSize: 14, color: '#64748b' },
});