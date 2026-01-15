import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '../../components/themed-text';
import { ThemedView } from '../../components/themed-view';
import { useThemeColor } from '../../hooks/use-theme-color';
import { API_BASE_URL } from './api';

export default function ProfitReportScreen() {
  const router = useRouter();
  const textColor = useThemeColor({}, 'text');
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState({
    revenue: 0,
    cost: 0,
    profit: 0,
    margin: 0,
    salesCount: 0
  });
  const [salesList, setSalesList] = useState<any[]>([]);
  const [allSales, setAllSales] = useState<any[]>([]);
  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (allSales.length > 0) {
      filterDataByDate();
    } else {
      setSalesList([]);
      setReportData({ revenue: 0, cost: 0, profit: 0, margin: 0, salesCount: 0 });
    }
  }, [allSales, date]);

  const filterDataByDate = () => {
    const filtered = allSales.filter(sale => {
      const saleDate = new Date(sale.date);
      return saleDate.getMonth() === date.getMonth() &&
             saleDate.getFullYear() === date.getFullYear();
    });

    let totalRevenue = 0;
    let totalCost = 0;

    filtered.forEach(sale => {
      totalRevenue += (sale.total || sale.amount || 0);
      totalCost += sale.cost;
    });

    setSalesList(filtered);
    setReportData({
      revenue: totalRevenue,
      cost: totalCost,
      profit: totalRevenue - totalCost,
      margin: totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0,
      salesCount: filtered.length
    });
  };

  const onChange = (event: any, selectedDate?: Date) => {
    setShowPicker(Platform.OS === 'ios');
    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  const fetchData = async () => {
    try {
      // 1. Fetch Inventory to get Cost Prices
      const invResponse = await fetch(`${API_BASE_URL}/products`);
      const inventoryData = await invResponse.json();
      
      // Create a map for quick lookup: barcode -> costPrice
      const costMap = new Map();
      if (Array.isArray(inventoryData)) {
        inventoryData.forEach((item: any) => {
          if (item.barcode) {
            costMap.set(item.barcode, Number(item.costPrice || 0));
          }
        });
      }

      // 2. Fetch Sales History
      const salesResponse = await fetch(`${API_BASE_URL}/sales`);
      const salesData = await salesResponse.json();

      if (Array.isArray(salesData)) {
        const processedSales = salesData.map((sale: any) => {
          let saleCost = 0;
          const saleRevenue = Number(sale.total || sale.amount || 0);

          // Calculate cost for items in this sale
          if (Array.isArray(sale.items)) {
            sale.items.forEach((item: any) => {
              const qty = Number(item.quantity || 1);
              // Try to find cost by barcode, default to 0 if not found
              const unitCost = costMap.get(item.barcode) || 0;
              saleCost += unitCost * qty;
            });
          }

          return {
            ...sale,
            cost: saleCost,
            profit: saleRevenue - saleCost
          };
        });

        // Sort by date descending
        processedSales.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        setAllSales(processedSales);
      }
    } catch (error) {
      console.log('Error calculating profit:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={textColor} />
        </TouchableOpacity>
        <ThemedText type="title">Profit Report</ThemedText>
      </View>

      <View style={styles.filterContainer}>
        <TouchableOpacity style={styles.dateButton} onPress={() => setShowPicker(true)}>
          <Ionicons name="calendar-outline" size={20} color={textColor} />
          <ThemedText style={styles.dateText}>
            {date.toLocaleDateString('default', { month: 'long', year: 'numeric' })}
          </ThemedText>
          <Ionicons name="chevron-down" size={16} color={textColor} />
        </TouchableOpacity>
      </View>

      {showPicker && (
        <DateTimePicker
          value={date}
          mode="date"
          display="default"
          onChange={onChange}
        />
      )}

      {loading ? (
        <ActivityIndicator size="large" color={textColor} style={{ marginTop: 20 }} />
      ) : (
        <>
          <View style={styles.statsGrid}>
            <View style={[styles.card, { backgroundColor: '#e0f2fe' }]}>
              <ThemedText style={styles.cardLabel}>Revenue</ThemedText>
              <ThemedText style={[styles.cardValue, { color: '#0284c7' }]}>${reportData.revenue.toFixed(2)}</ThemedText>
            </View>
            <View style={[styles.card, { backgroundColor: '#fee2e2' }]}>
              <ThemedText style={styles.cardLabel}>COGS</ThemedText>
              <ThemedText style={[styles.cardValue, { color: '#dc2626' }]}>${reportData.cost.toFixed(2)}</ThemedText>
            </View>
            <View style={[styles.card, { backgroundColor: '#dcfce7', width: '100%' }]}>
              <ThemedText style={styles.cardLabel}>Net Profit</ThemedText>
              <ThemedText style={[styles.cardValue, { color: '#16a34a', fontSize: 24 }]}>${reportData.profit.toFixed(2)}</ThemedText>
              <ThemedText style={{ color: '#16a34a', fontWeight: '600' }}>Margin: {reportData.margin.toFixed(1)}%</ThemedText>
            </View>
          </View>

          <ThemedText type="subtitle" style={styles.sectionTitle}>Sales Breakdown</ThemedText>
          
          <FlatList
            data={salesList}
            keyExtractor={(item) => item.id || item._id || Math.random().toString()}
            contentContainerStyle={{ gap: 10, paddingBottom: 20 }}
            renderItem={({ item }) => (
              <View style={styles.saleItem}>
                <View>
                  <ThemedText type="defaultSemiBold">Sale #{item.id?.slice(-4) || '---'}</ThemedText>
                  <ThemedText style={{ fontSize: 12, opacity: 0.6 }}>{new Date(item.date).toLocaleDateString()}</ThemedText>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <ThemedText>+${(item.total || 0).toFixed(2)}</ThemedText>
                  <ThemedText style={{ color: item.profit >= 0 ? '#16a34a' : '#dc2626', fontWeight: 'bold', fontSize: 12 }}>
                    Profit: ${item.profit.toFixed(2)}
                  </ThemedText>
                </View>
              </View>
            )}
          />
        </>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 15 },
  backButton: { padding: 5 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  card: { width: '48%', padding: 15, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardLabel: { fontSize: 14, fontWeight: '600', opacity: 0.7, marginBottom: 5 },
  cardValue: { fontSize: 18, fontWeight: 'bold' },
  sectionTitle: { marginBottom: 10 },
  saleItem: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, backgroundColor: 'rgba(150,150,150,0.1)', borderRadius: 10 },
  filterContainer: { marginBottom: 15 },
  dateButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(150,150,150,0.1)', padding: 10, borderRadius: 8, alignSelf: 'flex-start' },
  dateText: { marginHorizontal: 8, fontWeight: '600' },
});