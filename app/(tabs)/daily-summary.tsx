import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Dimensions, FlatList, Platform, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LineChart } from 'react-native-chart-kit';

import { ThemedView } from '../../components/themed-view';
import { useThemeColor } from '../../hooks/use-theme-color';
import { API_BASE_URL } from './api';

export default function DailySummaryScreen() {
  const router = useRouter();
  const textColor = useThemeColor({}, 'text');
  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'daily' | 'weekly'>('daily');
  
  const [transactions, setTransactions] = useState<any[]>([]);
  const [totalSales, setTotalSales] = useState(0);
  const [transactionCount, setTransactionCount] = useState(0);
  const [avgTransaction, setAvgTransaction] = useState(0);
  const [paymentStats, setPaymentStats] = useState({ cash: 0, card: 0, other: 0 });
  const [topItems, setTopItems] = useState<any[]>([]);
  const [chartData, setChartData] = useState({
    labels: ["8am", "10am", "12pm", "2pm", "4pm", "6pm"],
    datasets: [{ data: [0, 0, 0, 0, 0, 0] }]
  });

  const onChange = (event: any, selectedDate?: Date) => {
    setShowPicker(Platform.OS === 'ios');
    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  const fetchDailySales = async () => {
    setRefreshing(true);
    try {
      // Fetch all sales (in a real app, you'd filter by date on the backend: ?date=YYYY-MM-DD)
      const response = await fetch(`${API_BASE_URL}/sales`);
      const data = await response.json();

      if (response.ok && Array.isArray(data)) {
        let daysSales = [];
        let chartLabels = [];
        let chartDataPoints = [];

        if (viewMode === 'daily') {
          // 1. Filter for selected date
          const selectedDateStr = date.toDateString();
          daysSales = data.filter((s: any) => new Date(s.date).toDateString() === selectedDateStr);

          // Hourly chart logic
          const hourlyTotals = new Array(24).fill(0);
          daysSales.forEach((sale: any) => {
            const hour = new Date(sale.date).getHours();
            hourlyTotals[hour] += (sale.total || sale.amount || 0);
          });
          chartLabels = ["8am", "10am", "12pm", "2pm", "4pm", "6pm"];
          chartDataPoints = [8, 10, 12, 14, 16, 18].map(h => hourlyTotals[h]);
        } else {
          // Weekly logic (Last 7 days ending on selected date)
          const endDate = new Date(date);
          endDate.setHours(23, 59, 59, 999);
          const startDate = new Date(date);
          startDate.setDate(date.getDate() - 6);
          startDate.setHours(0, 0, 0, 0);

          daysSales = data.filter((s: any) => {
            const d = new Date(s.date);
            return d >= startDate && d <= endDate;
          });

          // Daily totals for chart
          for (let i = 0; i < 7; i++) {
            const d = new Date(startDate);
            d.setDate(startDate.getDate() + i);
            chartLabels.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
            
            const dayStart = new Date(d); dayStart.setHours(0,0,0,0);
            const dayEnd = new Date(d); dayEnd.setHours(23,59,59,999);
            
            const daySum = daysSales
              .filter((s: any) => {
                const sd = new Date(s.date);
                return sd >= dayStart && sd <= dayEnd;
              })
              .reduce((acc: number, curr: any) => acc + (curr.total || curr.amount || 0), 0);
            chartDataPoints.push(daySum);
          }
        }

        // 2. Calculate Totals
        const total = daysSales.reduce((sum: number, item: any) => sum + (item.total || item.amount || 0), 0);
        setTotalSales(total);
        setTransactionCount(daysSales.length);
        setAvgTransaction(daysSales.length ? total / daysSales.length : 0);
        
        // 3. Payment Stats
        const pStats = { cash: 0, card: 0, other: 0 };
        daysSales.forEach((s: any) => {
            const method = (s.paymentMethod || 'cash').toLowerCase();
            const amt = s.total || s.amount || 0;
            if (method.includes('card')) pStats.card += amt;
            else if (method.includes('cash')) pStats.cash += amt;
            else pStats.other += amt;
        });
        setPaymentStats(pStats);

        // 4. Top Items
        const itemMap = new Map();
        daysSales.forEach((s: any) => {
            if (Array.isArray(s.items)) {
                s.items.forEach((i: any) => {
                    const current = itemMap.get(i.name) || 0;
                    itemMap.set(i.name, current + (i.quantity || 1));
                });
            }
        });
        const sortedItems = Array.from(itemMap.entries())
            .map(([name, qty]) => ({ name, qty }))
            .sort((a: any, b: any) => b.qty - a.qty)
            .slice(0, 3);
        setTopItems(sortedItems);

        // 5. Update List (Newest first)
        setTransactions([...daysSales].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));

        setChartData({
          labels: chartLabels,
          datasets: [{ data: chartDataPoints }]
        });
      }
    } catch (error) {
      console.log('Error fetching daily sales:', error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDailySales();
  }, [date, viewMode]);

  const onRefresh = () => {
    fetchDailySales();
  };

  const renderHeader = () => (
    <View>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.topRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{viewMode === 'daily' ? 'Daily Summary' : 'Weekly Summary'}</Text>
          <View style={{ width: 40 }} />
        </View>
        
        <View style={styles.controlsRow}>
          <TouchableOpacity style={styles.dateSelector} onPress={() => setShowPicker(true)}>
            <Ionicons name="calendar" size={20} color="#1e40af" />
            <Text style={styles.dateText}>{date.toLocaleDateString()}</Text>
            <Ionicons name="chevron-down" size={16} color="#1e40af" />
          </TouchableOpacity>

          <View style={styles.viewToggle}>
            <TouchableOpacity 
              style={[styles.toggleBtn, viewMode === 'daily' && styles.toggleBtnActive]} 
              onPress={() => setViewMode('daily')}
            >
              <Text style={[styles.toggleText, viewMode === 'daily' && styles.toggleTextActive]}>Day</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.toggleBtn, viewMode === 'weekly' && styles.toggleBtnActive]} 
              onPress={() => setViewMode('weekly')}
            >
              <Text style={[styles.toggleText, viewMode === 'weekly' && styles.toggleTextActive]}>Week</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {showPicker && (
        <DateTimePicker
          value={date}
          mode="date"
          display="default"
          onChange={onChange}
        />
      )}

      {/* Key Metrics */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Total Sales</Text>
          <Text style={styles.statValue}>${totalSales.toFixed(2)}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Count</Text>
          <Text style={styles.statValue}>{transactionCount}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Avg Value</Text>
          <Text style={styles.statValue}>${avgTransaction.toFixed(2)}</Text>
        </View>
      </View>

      {/* Chart */}
      <View style={styles.chartCard}>
        <Text style={styles.sectionTitle}>Sales Trend</Text>
        <LineChart
          data={chartData}
          width={Dimensions.get("window").width - 60}
          height={180}
          yAxisLabel="$"
          yAxisSuffix=""
          yAxisInterval={1}
          chartConfig={{
            backgroundColor: "#ffffff",
            backgroundGradientFrom: "#ffffff",
            backgroundGradientTo: "#ffffff",
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(30, 64, 175, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`,
            style: { borderRadius: 16 },
            propsForDots: { r: "4", strokeWidth: "2", stroke: "#f59e0b" }
          }}
          bezier
          style={{ marginVertical: 8, borderRadius: 16 }}
        />
      </View>

      {/* Payment Breakdown */}
      <View style={styles.rowContainer}>
        <View style={[styles.paymentCard, { backgroundColor: '#ecfdf5' }]}>
          <Ionicons name="cash-outline" size={20} color="#059669" />
          <Text style={[styles.paymentLabel, { color: '#059669' }]}>Cash</Text>
          <Text style={[styles.paymentValue, { color: '#047857' }]}>${paymentStats.cash.toFixed(0)}</Text>
        </View>
        <View style={[styles.paymentCard, { backgroundColor: '#eff6ff' }]}>
          <Ionicons name="card-outline" size={20} color="#2563eb" />
          <Text style={[styles.paymentLabel, { color: '#2563eb' }]}>Card</Text>
          <Text style={[styles.paymentValue, { color: '#1d4ed8' }]}>${paymentStats.card.toFixed(0)}</Text>
        </View>
        <View style={[styles.paymentCard, { backgroundColor: '#fefce8' }]}>
          <Ionicons name="wallet-outline" size={20} color="#ca8a04" />
          <Text style={[styles.paymentLabel, { color: '#ca8a04' }]}>Other</Text>
          <Text style={[styles.paymentValue, { color: '#a16207' }]}>${paymentStats.other.toFixed(0)}</Text>
        </View>
      </View>

      {/* Top Items */}
      {topItems.length > 0 && (
        <View style={styles.topItemsCard}>
          <Text style={styles.sectionTitle}>Top Selling Items</Text>
          {topItems.map((item, index) => (
            <View key={index} style={styles.topItemRow}>
              <View style={styles.rankBadge}><Text style={styles.rankText}>{index + 1}</Text></View>
              <Text style={styles.topItemName}>{item.name}</Text>
              <Text style={styles.topItemQty}>{item.qty} sold</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={[styles.sectionTitle, { marginTop: 20, marginBottom: 10 }]}>Recent Transactions</Text>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id || item._id || Math.random().toString()}
        ListHeaderComponent={renderHeader}
        renderItem={({ item }) => (
          <View style={styles.transactionCard}>
            <View style={styles.transLeft}>
              <View style={styles.iconBox}>
                <MaterialCommunityIcons name="receipt" size={20} color="#64748b" />
              </View>
              <View>
                <Text style={styles.transAmount}>${(item.total || item.amount || 0).toFixed(2)}</Text>
                <Text style={styles.transItems}>
                  {Array.isArray(item.items) ? `${item.items.length} items` : (item.items || 'Sale')}
                </Text>
              </View>
            </View>
            <Text style={styles.transTime}>
              {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    backgroundColor: '#1e40af',
    paddingTop: 50,
    paddingBottom: 60, // Extra space for overlapping cards
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    marginBottom: -40, // Pull up content
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  backButton: { padding: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: 'white' },
  
  controlsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 10 },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
  },
  dateText: { color: '#1e40af', fontWeight: 'bold', fontSize: 14 },

  viewToggle: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, padding: 4 },
  toggleBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16 },
  toggleBtnActive: { backgroundColor: 'white' },
  toggleText: { color: '#bfdbfe', fontWeight: '600', fontSize: 12 },
  toggleTextActive: { color: '#1e40af', fontWeight: 'bold' },

  statsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 20, gap: 10 },
  statCard: { flex: 1, backgroundColor: 'white', padding: 15, borderRadius: 16, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 3 },
  statLabel: { fontSize: 12, color: '#64748b', marginBottom: 4, fontWeight: '600' },
  statValue: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },

  chartCard: { backgroundColor: 'white', marginHorizontal: 20, borderRadius: 16, padding: 15, marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1e293b', marginBottom: 10 },

  rowContainer: { flexDirection: 'row', paddingHorizontal: 20, gap: 10, marginBottom: 20 },
  paymentCard: { flex: 1, padding: 12, borderRadius: 12, alignItems: 'center' },
  paymentLabel: { fontSize: 12, fontWeight: '600', marginTop: 4 },
  paymentValue: { fontSize: 14, fontWeight: 'bold', marginTop: 2 },

  topItemsCard: { backgroundColor: 'white', marginHorizontal: 20, borderRadius: 16, padding: 15, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  topItemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  rankBadge: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  rankText: { color: '#1e40af', fontWeight: 'bold', fontSize: 12 },
  topItemName: { flex: 1, fontSize: 14, color: '#334155', fontWeight: '500' },
  topItemQty: { fontSize: 12, color: '#64748b' },

  listContent: { paddingBottom: 40 },
  transactionCard: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    backgroundColor: 'white', 
    marginHorizontal: 20, 
    marginBottom: 10, 
    padding: 15, 
    borderRadius: 12,
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 3, elevation: 1
  },
  transLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
  transAmount: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
  transItems: { fontSize: 12, color: '#64748b' },
  transTime: { fontSize: 12, color: '#94a3b8', fontWeight: '500' },
});