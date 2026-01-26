import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Dimensions, FlatList, Platform, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LineChart } from 'react-native-chart-kit';

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
  const [viewMode, setViewMode] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [refreshing, setRefreshing] = useState(false);
  const [chartData, setChartData] = useState({
    labels: ["W1", "W2", "W3", "W4"],
    datasets: [{ data: [0, 0, 0, 0] }]
  });

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
  }, [allSales, date, viewMode]);

  const filterDataByDate = () => {
    let filtered: any[] = [];
    let chartLabels: string[] = [];
    let chartDataPoints: number[] = [];

    if (viewMode === 'daily') {
      const target = date.toDateString();
      filtered = allSales.filter(s => new Date(s.date).toDateString() === target);
      
      // Hourly Profit
      const hourlyProfit = new Array(24).fill(0);
      filtered.forEach((sale: any) => {
        const hour = new Date(sale.date).getHours();
        hourlyProfit[hour] += sale.profit;
      });
      chartLabels = ["8am", "12pm", "4pm", "8pm"];
      chartDataPoints = [8, 12, 16, 20].map(h => hourlyProfit[h]);

    } else if (viewMode === 'weekly') {
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      const startDate = new Date(date);
      startDate.setDate(date.getDate() - 6);
      startDate.setHours(0, 0, 0, 0);

      filtered = allSales.filter(s => {
        const d = new Date(s.date);
        return d >= startDate && d <= endDate;
      });

      // Daily Profit (Last 7 days)
      for (let i = 0; i < 7; i++) {
        const d = new Date(startDate);
        d.setDate(startDate.getDate() + i);
        chartLabels.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
        
        const dayStart = new Date(d); dayStart.setHours(0,0,0,0);
        const dayEnd = new Date(d); dayEnd.setHours(23,59,59,999);
        
        const dayProfit = filtered
          .filter((s: any) => {
            const sd = new Date(s.date);
            return sd >= dayStart && sd <= dayEnd;
          })
          .reduce((acc: number, curr: any) => acc + curr.profit, 0);
        chartDataPoints.push(dayProfit);
      }
    } else {
      // Monthly
      const targetMonth = date.getMonth();
      const targetYear = date.getFullYear();
      filtered = allSales.filter(s => {
        const d = new Date(s.date);
        return d.getMonth() === targetMonth && d.getFullYear() === targetYear;
      });

      // Weekly aggregation for month
      chartLabels = ["W1", "W2", "W3", "W4"];
      const weeklyProfits = [0, 0, 0, 0];
      filtered.forEach((s: any) => {
        const d = new Date(s.date).getDate();
        if (d <= 7) weeklyProfits[0] += s.profit;
        else if (d <= 14) weeklyProfits[1] += s.profit;
        else if (d <= 21) weeklyProfits[2] += s.profit;
        else weeklyProfits[3] += s.profit;
      });
      chartDataPoints = weeklyProfits;
    }

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

    setChartData({
      labels: chartLabels,
      datasets: [{ data: chartDataPoints }]
    });
  };

  const onChange = (event: any, selectedDate?: Date) => {
    setShowPicker(Platform.OS === 'ios');
    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
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
      setRefreshing(false);
    }
  };

  const renderHeader = () => (
    <View>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.topRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profit Report</Text>
          <View style={{ width: 40 }} />
        </View>
        
        <View style={styles.controlsRow}>
          <TouchableOpacity style={styles.dateSelector} onPress={() => setShowPicker(true)}>
            <Ionicons name="calendar" size={20} color="#1e40af" />
            <Text style={styles.dateText}>{date.toLocaleDateString()}</Text>
            <Ionicons name="chevron-down" size={16} color="#1e40af" />
          </TouchableOpacity>

          <View style={styles.viewToggle}>
            <TouchableOpacity style={[styles.toggleBtn, viewMode === 'daily' && styles.toggleBtnActive]} onPress={() => setViewMode('daily')}>
              <Text style={[styles.toggleText, viewMode === 'daily' && styles.toggleTextActive]}>Day</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.toggleBtn, viewMode === 'weekly' && styles.toggleBtnActive]} onPress={() => setViewMode('weekly')}>
              <Text style={[styles.toggleText, viewMode === 'weekly' && styles.toggleTextActive]}>Week</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.toggleBtn, viewMode === 'monthly' && styles.toggleBtnActive]} onPress={() => setViewMode('monthly')}>
              <Text style={[styles.toggleText, viewMode === 'monthly' && styles.toggleTextActive]}>Month</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {showPicker && (
        <DateTimePicker value={date} mode="date" display="default" onChange={onChange} />
      )}

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <View style={[styles.card, { backgroundColor: '#e0f2fe' }]}>
          <Text style={styles.cardLabel}>Revenue</Text>
          <Text style={[styles.cardValue, { color: '#0284c7' }]}>${reportData.revenue.toFixed(0)}</Text>
        </View>
        <View style={[styles.card, { backgroundColor: '#fee2e2' }]}>
          <Text style={styles.cardLabel}>COGS</Text>
          <Text style={[styles.cardValue, { color: '#dc2626' }]}>${reportData.cost.toFixed(0)}</Text>
        </View>
        <View style={[styles.card, { backgroundColor: '#dcfce7', width: '100%' }]}>
          <Text style={styles.cardLabel}>Net Profit</Text>
          <Text style={[styles.cardValue, { color: '#16a34a', fontSize: 28 }]}>${reportData.profit.toFixed(2)}</Text>
          <Text style={{ color: '#16a34a', fontWeight: '600', marginTop: 4 }}>Margin: {reportData.margin.toFixed(1)}%</Text>
        </View>
      </View>

      {/* Chart */}
      <View style={styles.chartCard}>
        <Text style={styles.sectionTitle}>Profit Trend</Text>
        <LineChart
          data={chartData}
          width={Dimensions.get("window").width - 60}
          height={180}
          yAxisLabel="$"
          yAxisSuffix=""
          chartConfig={{
            backgroundColor: "#ffffff",
            backgroundGradientFrom: "#ffffff",
            backgroundGradientTo: "#ffffff",
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(22, 163, 74, ${opacity})`, // Green for profit
            labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`,
            style: { borderRadius: 16 },
            propsForDots: { r: "4", strokeWidth: "2", stroke: "#16a34a" }
          }}
          bezier
          style={{ marginVertical: 8, borderRadius: 16 }}
        />
      </View>

      <Text style={[styles.sectionTitle, { marginTop: 20, marginBottom: 10, paddingHorizontal: 20 }]}>Sales Breakdown</Text>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={salesList}
        keyExtractor={(item) => item.id || item._id || Math.random().toString()}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <View style={styles.transactionCard}>
            <View style={styles.transLeft}>
              <View style={[styles.iconBox, { backgroundColor: item.profit >= 0 ? '#dcfce7' : '#fee2e2' }]}>
                <MaterialCommunityIcons name={item.profit >= 0 ? "trending-up" : "trending-down"} size={20} color={item.profit >= 0 ? "#16a34a" : "#dc2626"} />
              </View>
              <View>
                <Text style={styles.transAmount}>${(item.total || 0).toFixed(2)}</Text>
                <Text style={[styles.transProfit, { color: item.profit >= 0 ? '#16a34a' : '#dc2626' }]}>
                  Profit: ${item.profit.toFixed(2)}
                </Text>
              </View>
            </View>
            <Text style={styles.transTime}>
              {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        )}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    backgroundColor: '#1e40af',
    paddingTop: 50,
    paddingBottom: 60,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    marginBottom: -40,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  backButton: { padding: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: 'white' },
  
  controlsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 5 },
  dateSelector: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, gap: 8 },
  dateText: { color: '#1e40af', fontWeight: 'bold', fontSize: 13 },

  viewToggle: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, padding: 4 },
  toggleBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 16 },
  toggleBtnActive: { backgroundColor: 'white' },
  toggleText: { color: '#bfdbfe', fontWeight: '600', fontSize: 11 },
  toggleTextActive: { color: '#1e40af', fontWeight: 'bold' },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 20, marginBottom: 20 },
  card: { width: '48%', padding: 15, borderRadius: 16, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 3 },
  cardLabel: { fontSize: 12, fontWeight: '600', opacity: 0.7, marginBottom: 5 },
  cardValue: { fontSize: 20, fontWeight: 'bold' },
  
  chartCard: { backgroundColor: 'white', marginHorizontal: 20, borderRadius: 16, padding: 15, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1e293b', marginBottom: 10 },

  transactionCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', marginHorizontal: 20, marginBottom: 10, padding: 15, borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 3, elevation: 1 },
  transLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  transAmount: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
  transProfit: { fontSize: 12, fontWeight: '600' },
  transTime: { fontSize: 12, color: '#94a3b8', fontWeight: '500' },
});