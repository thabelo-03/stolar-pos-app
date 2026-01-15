import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { API_BASE_URL } from './api';

export default function CartScreen() {
  const router = useRouter();
  const { barcode } = useLocalSearchParams();
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('Cash');

  useEffect(() => {
    if (barcode && typeof barcode === 'string') {
      // This logic adds a scanned item to the cart.
      // For a persistent cart across navigation, a global state manager (like Zustand or React Context)
      // is recommended, as this screen's state is lost when navigating away.
      setCartItems(prevItems => {
        const existingItem = prevItems.find(item => item.barcode === barcode);

        if (existingItem) {
          // If item exists, increase its quantity
          return prevItems.map(item =>
            item.id === existingItem.id
              ? { ...item, quantity: item.quantity + 1 }
              : item
          );
        } else {
          // If item is new, add it to the cart
          const newItem = {
            id: Date.now().toString(),
            name: `Product ${barcode}`,
            price: 19.99, // Simulated price
            quantity: 1,
            barcode: barcode,
          };
          return [...prevItems, newItem];
        }
      });
    }
  }, [barcode]);

  useEffect(() => {
    const newTotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    setTotal(newTotal);
  }, [cartItems]);

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
});