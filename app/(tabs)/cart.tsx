import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { API_BASE_URL } from './api';

// IMPORT OFFLINE TOOLS
import * as Network from 'expo-network';
import { OfflineService } from '../services/offlineService';

export default function CartScreen() {
  const router = useRouter();
  const { barcode } = useLocalSearchParams();
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [totalUSD, setTotalUSD] = useState(0);
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);

  // MULTI-CURRENCY STATE
  const [currency, setCurrency] = useState<'USD' | 'ZAR' | 'ZiG'>('USD');
  const [rates, setRates] = useState({ ZAR: 19.2, ZiG: 26.5 }); 

  // --- 1. FETCH LIVE RATES FROM DATABASE ---
  useEffect(() => {
    const fetchRates = async () => {
      try {
        // Fetch rates set by the manager for this specific shop/branch
        const response = await fetch(`${API_BASE_URL}/shops/rates`); 
        if (response.ok) {
          const data = await response.json();
          if (data.rates) {
            setRates(data.rates);
          }
        }
      } catch (error) {
        console.log("Using default fallback rates due to connectivity.");
      }
    };
    fetchRates();
  }, []);

  // --- 2. FETCH PRODUCTS ---
  useEffect(() => {
    const fetchAllProducts = async () => {
      try {
        const userId = await AsyncStorage.getItem('userId');
        if (!userId) return;

        const userRes = await fetch(`${API_BASE_URL}/users/${userId}`);
        const user = await userRes.json();

        if (user.shopId) {
          const response = await fetch(`${API_BASE_URL}/products?shopId=${user.shopId}`);
          if (response.ok) {
            setAllProducts(await response.json());
          }
        }
      } catch (error) {
        console.log("Working in offline product mode.");
      }
    };
    fetchAllProducts();
  }, []);

  // Update total whenever cart changes
  useEffect(() => {
    const newTotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    setTotalUSD(newTotal);
  }, [cartItems]);

  // --- 3. CONVERSION HELPERS ---
  const convert = (amountInUSD: number) => {
    if (currency === 'ZAR') return amountInUSD * rates.ZAR;
    if (currency === 'ZiG') return amountInUSD * rates.ZiG;
    return amountInUSD;
  };

  const symbol = () => {
    if (currency === 'ZAR') return 'R';
    if (currency === 'ZiG') return 'ZiG';
    return '$';
  };

  // --- 4. SEARCH & CART LOGIC ---
  const handleSearch = (text: string) => {
    setSearchQuery(text);
    if (text.trim().length > 0) {
      const filtered = allProducts.filter(p => 
        p.name.toLowerCase().includes(text.toLowerCase()) || 
        (p.barcode && p.barcode.includes(text))
      );
      setSearchResults(filtered.slice(0, 5));
    } else {
      setSearchResults([]);
    }
  };

  const addItemToCart = (product: any) => {
    setCartItems(prevItems => {
      const existing = prevItems.find(item => item.barcode === product.barcode);
      if (existing) {
        return prevItems.map(item =>
          item.barcode === existing.barcode ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prevItems, {
        id: product._id || Date.now().toString(),
        name: product.name,
        price: Number(product.price),
        quantity: 1,
        barcode: product.barcode,
      }];
    });
    setSearchQuery('');
    setSearchResults([]);
  };

  const updateQuantity = (itemId: string, amount: number) => {
    setCartItems(curr => curr.map(i => i.id === itemId ? { ...i, quantity: i.quantity + amount } : i).filter(i => i.quantity > 0));
  };

  // --- 5. CHECKOUT WITH OFFLINE + CURRENCY LOGIC ---
  const handleCheckout = async () => {
    if (cartItems.length === 0) return Alert.alert('Empty Cart', 'Add items first.');

    setLoading(true);
    const saleData = {
      items: cartItems,
      totalUSD: totalUSD,
      totalPaidLocal: convert(totalUSD),
      currencyUsed: currency,
      rateUsed: currency === 'USD' ? 1 : (rates as any)[currency],
      date: new Date().toISOString(),
      offlineId: `STLR-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    };

    try {
      const network = await Network.getNetworkStateAsync();
      if (network.isInternetReachable) {
        const response = await fetch(`${API_BASE_URL}/sales`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(saleData),
        });
        if (response.ok) {
          Alert.alert('Success', 'Transaction synced!');
          router.replace('/(tabs)/home');
          return;
        }
      }
      throw new Error('Offline');
    } catch (error) {
      const saved = await OfflineService.saveSaleLocally(saleData);
      if (saved) {
        Alert.alert('Saved Offline', 'Connection lost. Sale stored locally and will sync later.');
        router.replace('/(tabs)/home');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color="#1e293b" /></TouchableOpacity>
        <Text style={styles.title}>Stolar Cart</Text>
        <View style={styles.rateBadge}>
           <Text style={styles.rateText}>Rate: {currency === 'USD' ? '1.00' : (rates as any)[currency]}</Text>
        </View>
      </View>

      {/* CURRENCY SELECTOR */}
      <View style={styles.currencySelector}>
        {(['USD', 'ZAR', 'ZiG'] as const).map((curr) => (
          <TouchableOpacity 
            key={curr} 
            onPress={() => setCurrency(curr)}
            style={[styles.currBtn, currency === curr && styles.currBtnActive]}
          >
            <Text style={[styles.currBtnText, currency === curr && styles.currBtnTextActive]}>{curr}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* SEARCH */}
      <View style={{ zIndex: 2000 }}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={20} color="#64748b" />
          <TextInput 
            style={styles.input} 
            placeholder="Search items..." 
            value={searchQuery}
            onChangeText={handleSearch}
          />
        </View>
        {searchResults.length > 0 && (
          <View style={styles.dropdown}>
            {searchResults.map(p => (
              <TouchableOpacity key={p._id} style={styles.dropItem} onPress={() => addItemToCart(p)}>
                <View>
                  <Text style={styles.dropName}>{p.name}</Text>
                  <Text style={styles.dropSub}>{p.barcode}</Text>
                </View>
                <Text style={styles.dropPrice}>{symbol()} {convert(p.price).toFixed(2)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <FlatList
        data={cartItems}
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingHorizontal: 20 }}
        renderItem={({ item }) => (
          <View style={styles.cartItem}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemPrice}>{symbol()} {convert(item.price).toFixed(2)} each</Text>
            </View>
            <View style={styles.qtyBox}>
              <TouchableOpacity onPress={() => updateQuantity(item.id, -1)}><Ionicons name="remove-circle" size={32} color="#cbd5e1" /></TouchableOpacity>
              <Text style={styles.qtyText}>{item.quantity}</Text>
              <TouchableOpacity onPress={() => updateQuantity(item.id, 1)}><Ionicons name="add-circle" size={32} color="#1e40af" /></TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>Scan or search to add items.</Text>}
      />

      {/* FOOTER */}
      <View style={styles.footer}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Grand Total</Text>
          <Text style={styles.totalValue}>{symbol()} {convert(totalUSD).toFixed(2)}</Text>
        </View>

        <TouchableOpacity style={styles.payBtn} onPress={handleCheckout} disabled={loading}>
          {loading ? <ActivityIndicator color="white" /> : (
            <View style={styles.payBtnContent}>
                <Text style={styles.payText}>Complete Payment</Text>
                <Ionicons name="chevron-forward" size={20} color="white" />
            </View>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, backgroundColor: 'white' },
  title: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
  rateBadge: { backgroundColor: '#eff6ff', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 20, borderWidth: 1, borderColor: '#dbeafe' },
  rateText: { fontSize: 12, color: '#1e40af', fontWeight: 'bold' },
  
  currencySelector: { flexDirection: 'row', backgroundColor: 'white', paddingBottom: 15, paddingHorizontal: 20, gap: 10 },
  currBtn: { flex: 1, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
  currBtnActive: { backgroundColor: '#1e40af', borderColor: '#1e40af' },
  currBtnText: { fontWeight: 'bold', color: '#64748b', fontSize: 13 },
  currBtnTextActive: { color: 'white' },

  searchBox: { flexDirection: 'row', alignItems: 'center', margin: 20, padding: 12, backgroundColor: 'white', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  input: { flex: 1, marginLeft: 10, fontSize: 16, color: '#1e293b' },
  dropdown: { position: 'absolute', top: 75, left: 20, right: 20, backgroundColor: 'white', borderRadius: 12, elevation: 8, zIndex: 3000, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 },
  dropItem: { padding: 15, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dropName: { fontWeight: 'bold', color: '#1e293b' },
  dropSub: { fontSize: 11, color: '#94a3b8' },
  dropPrice: { color: '#1e40af', fontWeight: 'bold' },

  cartItem: { flexDirection: 'row', backgroundColor: 'white', padding: 16, borderRadius: 15, marginBottom: 12, alignItems: 'center', borderWidth: 1, borderColor: '#f1f5f9' },
  itemName: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  itemPrice: { color: '#64748b', fontSize: 13, marginTop: 2 },
  qtyBox: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  qtyText: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', minWidth: 20, textAlign: 'center' },

  footer: { padding: 25, backgroundColor: 'white', borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  totalLabel: { fontSize: 18, color: '#64748b', fontWeight: '600' },
  totalValue: { fontSize: 26, fontWeight: '900', color: '#1e293b' },
  payBtn: { backgroundColor: '#1e40af', padding: 18, borderRadius: 15, alignItems: 'center' },
  payBtnContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  payText: { color: 'white', fontSize: 17, fontWeight: 'bold' },
  emptyText: { textAlign: 'center', marginTop: 50, color: '#94a3b8', fontSize: 15 }
});