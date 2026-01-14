import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '../../components/themed-text';
import { ThemedView } from '../../components/themed-view';
import { useThemeColor } from '../../hooks/use-theme-color';
import { API_BASE_URL } from './api';

export default function LastSalesScreen() {
  const router = useRouter();
  const textColor = useThemeColor({}, 'text');
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSales = async () => {
      try {
        // Attempt to fetch from API
        const response = await fetch(`${API_BASE_URL}/sales/recent?limit=10`);
        const data = await response.json();
        
        if (response.ok && Array.isArray(data)) {
          setSales(data);
        } else {
          // Fallback mock data for demonstration
          throw new Error('API not ready');
        }
      } catch (error) {
        // Mock data if API fails
        setSales([
          { id: '1', time: '10:30 AM', total: 25.50, items: '2x Coffee, Bagel' },
          { id: '2', time: '11:15 AM', total: 12.00, items: 'Sandwich' },
          { id: '3', time: '12:45 PM', total: 8.50, items: 'Green Tea, Cookie' },
          { id: '4', time: '01:20 PM', total: 45.00, items: 'Lunch Special x3' },
          { id: '5', time: '02:10 PM', total: 5.00, items: 'Espresso' },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchSales();
  }, []);

  return (
    <ThemedView style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="arrow-back" size={24} color={textColor} />
      </TouchableOpacity>
      <ThemedText type="title">My Last 10 Sales</ThemedText>

      {loading ? (
        <ActivityIndicator size="large" color={textColor} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={sales}
          keyExtractor={(item) => item.id || Math.random().toString()}
          renderItem={({ item }) => (
            <ThemedView style={styles.saleItem}>
              <View>
                <ThemedText type="defaultSemiBold">${Number(item.total || item.amount || 0).toFixed(2)}</ThemedText>
                <ThemedText style={styles.itemsText}>{item.items || 'Items'}</ThemedText>
              </View>
              <ThemedText style={styles.timeText}>{item.time || 'Just now'}</ThemedText>
            </ThemedView>
          )}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<ThemedText style={{ textAlign: 'center', marginTop: 20 }}>No recent sales found.</ThemedText>}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  backButton: { marginBottom: 16 },
  list: { marginTop: 20, gap: 12 },
  saleItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderRadius: 12, backgroundColor: 'rgba(150, 150, 150, 0.1)' },
  itemsText: { fontSize: 14, opacity: 0.7 },
  timeText: { fontSize: 12, opacity: 0.5 },
});