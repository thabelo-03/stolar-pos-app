import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { API_BASE_URL } from '../config';
import { useActiveShop } from './use-active-shop';
import { useProducts } from './use-products';
import { useRates } from './use-rates';

export default function StockTakeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { shopId: activeShopId, userId } = useActiveShop();
  const { shopId: paramShopId } = useLocalSearchParams();
  const shopId = paramShopId ? (Array.isArray(paramShopId) ? paramShopId[0] : paramShopId) : activeShopId;
  const { products, loading: productsLoading, fetchProducts } = useProducts();
  const { rates } = useRates();
  
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [submitting, setSubmiting] = useState(false);
  const [currency, setCurrency] = useState<'USD' | 'ZAR' | 'ZiG'>('USD');

  useEffect(() => {
    fetchProducts();
  }, []);

  const convert = (amount: number) => {
    if (currency === 'ZAR') return amount * rates.ZAR;
    if (currency === 'ZiG') return amount * rates.ZiG;
    return amount;
  };

  const symbol = currency === 'USD' ? '$' : currency === 'ZAR' ? 'R' : 'ZiG';

  const handleCountChange = (id: string, text: string) => {
    setCounts(prev => ({ ...prev, [id]: text }));
  };

  const filteredProducts = useMemo(() => {
    if (!searchQuery) return products;
    const lower = searchQuery.toLowerCase();
    return products.filter(p => 
      p.name.toLowerCase().includes(lower) || 
      (p.barcode && p.barcode.toString().includes(lower))
    );
  }, [products, searchQuery]);

  const calculateVariance = () => {
    let totalVarianceValue = 0;
    let itemsCounted = 0;

    Object.keys(counts).forEach(id => {
      const product = products.find(p => (p._id || p.id) === id);
      if (product) {
        const counted = parseFloat(counts[id]);
        if (!isNaN(counted)) {
          const current = Number(product.quantity) || 0;
          const diff = counted - current;
          const price = Number(product.price) || 0;
          totalVarianceValue += (diff * price);
          itemsCounted++;
        }
      }
    });

    return { totalVarianceValue, itemsCounted };
  };

  const { totalVarianceValue, itemsCounted } = calculateVariance();

  const handleSubmit = async () => {
    if (itemsCounted === 0) {
      Alert.alert("No Data", "Please enter counts for at least one item.");
      return;
    }

    Alert.alert(
      "Confirm Stock Take",
      `You are about to update stock for ${itemsCounted} items.\n\nNet Variance Value: ${symbol} ${convert(totalVarianceValue).toFixed(2)}`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Submit & Update", 
          onPress: async () => {
            setSubmiting(true);
            try {
              const updates = Object.keys(counts).map(id => ({
                id,
                quantity: parseFloat(counts[id])
              })).filter(u => !isNaN(u.quantity));

              const response = await fetch(`${API_BASE_URL}/products/batch-update`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ updates, userId, shopId, type: 'stock-take' })
              });

              if (response.ok) {
                Alert.alert("Success", "Stock updated successfully.");
                router.back();
              } else {
                Alert.alert("Error", "Failed to update stock.");
              }
            } catch (e) {
              Alert.alert("Error", "Network error.");
            } finally {
              setSubmiting(false);
            }
          }
        }
      ]
    );
  };

  const renderItem = ({ item }: { item: any }) => {
    const id = item._id || item.id;
    const currentQty = Number(item.quantity) || 0;
    const countedVal = counts[id] || '';
    const countedNum = parseFloat(countedVal);
    const variance = !isNaN(countedNum) ? countedNum - currentQty : 0;
    const hasEntry = counts[id] !== undefined && counts[id] !== '';

    return (
      <View style={[styles.row, hasEntry && variance !== 0 && styles.rowChanged]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.barcode}>{item.barcode || 'No Barcode'}</Text>
          <Text style={styles.current}>Expected: {currentQty}</Text>
        </View>
        
        <View style={{ alignItems: 'flex-end' }}>
          <TextInput
            style={styles.input}
            placeholder="Count"
            keyboardType="numeric"
            value={countedVal}
            onChangeText={(text) => handleCountChange(id, text)}
          />
          {hasEntry && (
            <Text style={[styles.variance, { color: variance < 0 ? '#ef4444' : variance > 0 ? '#10b981' : '#94a3b8' }]}>
              {variance > 0 ? '+' : ''}{variance}
            </Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ThemedView style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <View style={styles.topRow}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Stock Take</Text>
            <TouchableOpacity 
                style={styles.currencyBtn} 
                onPress={() => setCurrency(prev => prev === 'USD' ? 'ZAR' : prev === 'ZAR' ? 'ZiG' : 'USD')}
            >
                <Text style={styles.currencyText}>{currency}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchBox}>
            <Ionicons name="search" size={20} color="#64748b" />
            <TextInput 
              style={styles.searchInput} 
              placeholder="Search item..." 
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        <View style={styles.summaryBar}>
          <View>
            <Text style={styles.summaryLabel}>Items Counted</Text>
            <Text style={styles.summaryValue}>{itemsCounted} / {products.length}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.summaryLabel}>Variance Value</Text>
            <Text style={[styles.summaryValue, { color: totalVarianceValue < 0 ? '#ef4444' : '#10b981' }]}>
              {symbol} {convert(totalVarianceValue).toFixed(2)}
            </Text>
          </View>
        </View>

        {productsLoading ? (
          <ActivityIndicator size="large" color="#1e40af" style={{ marginTop: 20 }} />
        ) : (
          <FlatList
            data={filteredProducts}
            keyExtractor={item => item._id || item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
          />
        )}

        <View style={[styles.footer, { paddingBottom: insets.bottom + 10 }]}>
          <TouchableOpacity 
            style={[styles.submitBtn, (itemsCounted === 0 || submitting) && { opacity: 0.6 }]} 
            onPress={handleSubmit}
            disabled={itemsCounted === 0 || submitting}
          >
            {submitting ? <ActivityIndicator color="white" /> : <Text style={styles.submitText}>Submit Stock Take</Text>}
          </TouchableOpacity>
        </View>
      </ThemedView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    backgroundColor: '#1e40af',
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  backButton: { padding: 5 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: 'white' },
  currencyBtn: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  currencyText: { color: 'white', fontWeight: 'bold', fontSize: 12 },
  
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderRadius: 10, paddingHorizontal: 10, height: 45 },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 16, color: '#1e293b' },

  summaryBar: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  summaryLabel: { fontSize: 12, color: '#64748b', marginBottom: 2 },
  summaryValue: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },

  list: { padding: 15, paddingBottom: 100 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', padding: 15, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#f1f5f9' },
  rowChanged: { borderColor: '#bae6fd', backgroundColor: '#f0f9ff' },
  name: { fontSize: 16, fontWeight: '600', color: '#1e293b', marginBottom: 2 },
  barcode: { fontSize: 12, color: '#94a3b8', marginBottom: 4 },
  current: { fontSize: 12, color: '#64748b' },
  
  input: { 
    borderWidth: 1, 
    borderColor: '#cbd5e1', 
    borderRadius: 8, 
    padding: 8, 
    width: 80, 
    textAlign: 'center', 
    fontSize: 16, 
    fontWeight: 'bold', 
    color: '#1e293b',
    backgroundColor: '#fff'
  },
  variance: { fontSize: 12, fontWeight: 'bold', marginTop: 4, textAlign: 'right' },

  footer: { 
    position: 'absolute', 
    bottom: 0, 
    left: 0, 
    right: 0, 
    backgroundColor: 'white', 
    padding: 20, 
    borderTopWidth: 1, 
    borderTopColor: '#e2e8f0' 
  },
  submitBtn: { backgroundColor: '#1e40af', padding: 16, borderRadius: 12, alignItems: 'center' },
  submitText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
});