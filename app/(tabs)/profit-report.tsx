import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Dimensions, FlatList, Platform, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LineChart } from 'react-native-chart-kit';

import { ThemedView } from '../../components/themed-view';
import { useThemeColor } from '../../hooks/use-theme-color';
import { API_BASE_URL } from './api';
import { useActiveShop } from './use-active-shop';
import { useSales } from './use-sales';
import { useProducts } from './use-products';
import { useRates } from './use-rates';

export default function ProfitReportScreen() {
  const router = useRouter();
  const textColor = useThemeColor({}, 'text');
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
  
  const flatListRef = useRef<FlatList>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const [chartData, setChartData] = useState({
    labels: ["W1", "W2", "W3", "W4"],
    datasets: [{ data: [0, 0, 0, 0] }]
  });

  const [currency, setCurrency] = useState<'USD' | 'ZAR' | 'ZiG'>('USD');

  const { shopId, loading: shopLoading } = useActiveShop();
  const { loading: salesLoading, fetchSales } = useSales();
  const { fetchProducts } = useProducts();
  const { rates } = useRates();

  const convert = (amount: number) => {
    if (currency === 'ZAR') return amount * rates.ZAR;
    if (currency === 'ZiG') return amount * rates.ZiG;
    return amount;
  };

  const symbol = currency === 'USD' ? '$' : currency === 'ZAR' ? 'R' : 'ZiG';

  useEffect(() => {
    if (!shopLoading) {
      fetchData();
    }
  }, [shopLoading, shopId]);

  useEffect(() => {
    if (allSales.length > 0) {
      filterDataByDate();
    } else {
      setSalesList([]);
      setReportData({ revenue: 0, cost: 0, profit: 0, margin: 0, salesCount: 0 });
    }
  }, [allSales, date, viewMode, currency, rates]);

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
        hourlyProfit[hour] += convert(sale.profit);
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
          .reduce((acc: number, curr: any) => acc + convert(curr.profit), 0);
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
        const p = convert(s.profit);
        if (d <= 7) weeklyProfits[0] += p;
        else if (d <= 14) weeklyProfits[1] += p;
        else if (d <= 21) weeklyProfits[2] += p;
        else weeklyProfits[3] += p;
      });
      chartDataPoints = weeklyProfits;
    }

    let totalRevenue = 0;
    let totalCost = 0;

    filtered.forEach(sale => {
      totalRevenue += convert(sale.total || sale.amount || 0);
      totalCost += convert(sale.cost);
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
      const inventoryData = await fetchProducts();
      
      // Create a map for quick lookup: barcode -> costPrice
      const costMap = new Map();
      if (Array.isArray(inventoryData)) {
        inventoryData.forEach((item: any) => {
          if (item.barcode) {
            costMap.set(item.barcode, Number(item.costPrice || 0));
          }
        });
      }

      // 2. Fetch Sales History using Hook
      const salesData = await fetchSales({ endpoint: 'all' });

      if (Array.isArray(salesData)) {
        const processedSales = salesData.map((sale: any) => {
          let saleCost = 0;
          const saleRevenue = Number(sale.total || sale.amount || 0);

          // Calculate cost for items in this sale
          if (Array.isArray(sale.items)) {
            sale.items.forEach((item: any) => {
              const qty = Number(item.quantity || 1);
              // Use saved cost price if available AND > 0, otherwise lookup current inventory cost
              let unitCost = Number(item.costPrice || 0);
              if (unitCost === 0) unitCost = costMap.get(item.barcode) || 0;
              
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
      setRefreshing(false);
    }
  };

  const generatePDF = async () => {
    const html = `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; color: #333; }
            h1 { color: #1e40af; text-align: center; margin-bottom: 5px; }
            .subtitle { text-align: center; color: #666; margin-bottom: 30px; }
            .stats-container { display: flex; justify-content: space-between; margin-bottom: 30px; background-color: #f8fafc; padding: 15px; border-radius: 8px; }
            .stat-box { text-align: center; width: 24%; }
            .stat-label { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
            .stat-value { font-size: 14px; font-weight: bold; color: #1e293b; margin-top: 5px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th { text-align: left; padding: 8px; background-color: #f1f5f9; color: #475569; }
            td { padding: 8px; border-bottom: 1px solid #e2e8f0; }
            .amount { font-weight: bold; text-align: right; }
            .positive { color: #16a34a; }
            .negative { color: #dc2626; }
            .footer { margin-top: 40px; text-align: center; font-size: 10px; color: #94a3b8; }
          </style>
        </head>
        <body>
          <h1>Profit Report</h1>
          <div class="subtitle">${viewMode.toUpperCase()} • ${date.toLocaleDateString()}</div>

          <div class="stats-container">
            <div class="stat-box">
              <div class="stat-label">Revenue</div>
              <div class="stat-value">${symbol} ${reportData.revenue.toFixed(2)}</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">COGS</div>
              <div class="stat-value" style="color: #dc2626;">${symbol} ${reportData.cost.toFixed(2)}</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">Profit</div>
              <div class="stat-value" style="color: #16a34a;">${symbol} ${reportData.profit.toFixed(2)}</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">Margin</div>
              <div class="stat-value">${reportData.margin.toFixed(1)}%</div>
            </div>
          </div>

          <h3>Sales Breakdown</h3>
          <table>
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Items</th>
                <th style="text-align: right;">Rev</th>
                <th style="text-align: right;">Cost</th>
                <th style="text-align: right;">Profit</th>
                <th style="text-align: right;">Margin</th>
              </tr>
            </thead>
            <tbody>
              ${salesList.map(item => {
                const rev = convert(item.total || item.amount || 0);
                const cost = convert(item.cost || 0);
                const margin = rev > 0 ? ((rev - cost) / rev) * 100 : 0;
                return `
                <tr>
                  <td>${new Date(item.date).toLocaleDateString([], {month: 'short', day: 'numeric'})} ${new Date(item.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                  <td>${Array.isArray(item.items) ? item.items.length : 1} items</td>
                  <td class="amount">${symbol} ${rev.toFixed(2)}</td>
                  <td class="amount">${symbol} ${cost.toFixed(2)}</td>
                  <td class="amount ${item.profit >= 0 ? 'positive' : 'negative'}">${symbol} ${convert(item.profit || 0).toFixed(2)}</td>
                  <td class="amount" style="color: ${margin >= 20 ? '#16a34a' : margin > 0 ? '#d97706' : '#dc2626'};">${margin.toFixed(1)}%</td>
                </tr>
              `}).join('')}
            </tbody>
          </table>

          <div class="footer">Generated by Stolar POS</div>
        </body>
      </html>
    `;

    try {
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (error) {
      console.error(error);
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
          <TouchableOpacity onPress={generatePDF} style={styles.backButton}>
            <Ionicons name="print-outline" size={24} color="white" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.controlsRow}>
          <TouchableOpacity 
            style={styles.currencySelector} 
            onPress={() => setCurrency(prev => prev === 'USD' ? 'ZAR' : prev === 'ZAR' ? 'ZiG' : 'USD')}
          >
            <Text style={styles.dateText}>{currency}</Text>
          </TouchableOpacity>

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
          <Text style={[styles.cardValue, { color: '#0284c7' }]}>{symbol} {reportData.revenue.toFixed(0)}</Text>
        </View>
        <View style={[styles.card, { backgroundColor: '#fee2e2' }]}>
          <Text style={styles.cardLabel}>COGS</Text>
          <Text style={[styles.cardValue, { color: '#dc2626' }]}>{symbol} {reportData.cost.toFixed(0)}</Text>
        </View>
        <View style={[styles.card, { backgroundColor: '#dcfce7', width: '100%' }]}>
          <Text style={styles.cardLabel}>Net Profit</Text>
          <Text style={[styles.cardValue, { color: '#16a34a', fontSize: 28 }]}>{symbol} {reportData.profit.toFixed(2)}</Text>
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
          yAxisLabel={symbol === '$' ? '$' : ''}
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
        ref={flatListRef}
        data={salesList}
        keyExtractor={(item) => item.id || item._id || Math.random().toString()}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <View style={styles.transactionCard}>
            <View style={styles.transLeft}>
              <View style={[styles.iconBox, { backgroundColor: item.profit >= 0 ? '#dcfce7' : '#fee2e2' }]}>
                <MaterialCommunityIcons name={item.profit >= 0 ? "trending-up" : "trending-down"} size={20} color={item.profit >= 0 ? "#16a34a" : "#dc2626"} />
              </View>
              <View>
                <Text style={styles.transAmount}>{symbol} {convert(item.total || 0).toFixed(2)}</Text>
                <Text style={[styles.transProfit, { color: item.profit >= 0 ? '#16a34a' : '#dc2626' }]}>
                  Profit: {symbol} {convert(item.profit).toFixed(2)}
                </Text>
              </View>
            </View>
            <Text style={styles.transTime}>
              {new Date(item.date).toLocaleDateString([], { month: 'short', day: 'numeric' })} {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        )}
        onScroll={(e) => setShowScrollTop(e.nativeEvent.contentOffset.y > 300)}
        scrollEventThrottle={16}
      />

      {showScrollTop && (
        <TouchableOpacity 
          style={styles.scrollTopButton} 
          onPress={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })}
        >
          <Ionicons name="arrow-up" size={24} color="white" />
        </TouchableOpacity>
      )}
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
  currencySelector: { backgroundColor: 'white', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, marginRight: 8 },

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
  scrollTopButton: {
    position: 'absolute',
    bottom: 110,
    right: 20,
    backgroundColor: '#1e40af',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84,
  },
});