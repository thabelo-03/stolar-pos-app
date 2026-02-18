import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { API_BASE_URL } from '../config';

export default function ProfitLoss() {
  const router = useRouter();
  const [date, setDate] = useState(new Date());
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [shops, setShops] = useState<any[]>([]);
  const [selectedShop, setSelectedShop] = useState<string>('all');
  const [stats, setStats] = useState({
    revenue: 0,
    cogs: 0,
    profit: 0
  });
  const [chartData, setChartData] = useState({
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    datasets: [{ data: [0, 0, 0, 0, 0, 0, 0] }]
  });

  const onChange = (event: any, selectedDate?: Date) => {
    setShow(Platform.OS === 'ios');
    if (selectedDate) setDate(selectedDate);
  };

  useEffect(() => {
    const loadShops = async () => {
      const userId = await AsyncStorage.getItem('userId');
      if (userId) {
        const res = await fetch(`${API_BASE_URL}/shops?managerId=${userId}`);
        const data = await res.json();
        if (Array.isArray(data)) {
          setShops(data);
        }
      }
    };
    loadShops();
  }, []);

  useEffect(() => {
    fetchProfitData();
  }, [date, selectedShop, shops]); // Re-fetch when date, shop selection, or shop list changes

  const fetchProfitData = async () => {
    setLoading(true);
    try {
      // Fetch last 7 days to populate graph, then filter "today" for the cards
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);

      const startDate = new Date(date);
      startDate.setDate(startDate.getDate() - 6); // Go back 6 days (total 7 days)
      startDate.setHours(0, 0, 0, 0);

      let url = `${API_BASE_URL}/sales/recent?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}&limit=1000`;
      
      if (selectedShop !== 'all') {
        url += `&shopId=${selectedShop}`;
      }

      console.log(`[DEBUG] Fetching profit data: ${url}`);
      const response = await fetch(url);
      
      if (response.ok) {
        let sales = await response.json();
        console.log(`[DEBUG] Received ${sales.length} sales records`);
        // If 'all' is selected, filter sales to ensure they belong to this manager's shops
        if (selectedShop === 'all' && shops.length > 0) {
          const shopIds = new Set(shops.map(s => s._id.toString()));
          sales = sales.filter((s: any) => s.shopId && shopIds.has(s.shopId.toString()));
        }

        // 1. Calculate Metrics for the SELECTED DATE only
        const selectedDayStart = new Date(date); selectedDayStart.setHours(0,0,0,0);
        const selectedDayEnd = new Date(date); selectedDayEnd.setHours(23,59,59,999);
        
        const todaysSales = sales.filter((s: any) => {
          const d = new Date(s.date);
          return d >= selectedDayStart && d <= selectedDayEnd;
        });
        
        calculateMetrics(todaysSales);
        prepareChartData(sales, startDate, endDate);
      }
    } catch (error) {
      console.error("Error fetching profit data:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateMetrics = (sales: any[]) => {
    let totalRevenue = 0;
    let totalCOGS = 0;

    sales.forEach(sale => {
      // Add to Revenue (using totalUSD or total)
      const saleTotal = sale.totalUSD || sale.total || 0;
      totalRevenue += saleTotal;

      // Calculate COGS from items
      if (Array.isArray(sale.items)) {
        sale.items.forEach((item: any) => {
          const quantity = Number(item.quantity) || 0;
          const costPrice = Number(item.costPrice) || 0;
          
          if (costPrice === 0) console.log(`[DEBUG] Item ${item.name} has 0 cost price!`);
          
          totalCOGS += (costPrice * quantity);
        });
      }
    });

    console.log(`[DEBUG] Calculated: Revenue=${totalRevenue}, COGS=${totalCOGS}, Profit=${totalRevenue - totalCOGS}`);
    setStats({
      revenue: totalRevenue,
      cogs: totalCOGS,
      profit: totalRevenue - totalCOGS
    });
  };

  const prepareChartData = (sales: any[], startDate: Date, endDate: Date) => {
    const labels: string[] = [];
    const dataPoints: number[] = [];
    
    // Iterate through the last 7 days
    for (let i = 0; i < 7; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      
      const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short' });
      labels.push(dayLabel);

      const dayStart = new Date(d); dayStart.setHours(0,0,0,0);
      const dayEnd = new Date(d); dayEnd.setHours(23,59,59,999);

      // Calculate Profit for this day
      let dailyProfit = 0;
      const daySales = sales.filter((s: any) => {
        const saleDate = new Date(s.date);
        return saleDate >= dayStart && saleDate <= dayEnd;
      });

      daySales.forEach((sale: any) => {
        const revenue = sale.totalUSD || sale.total || 0;
        let cogs = 0;
        if (Array.isArray(sale.items)) {
          sale.items.forEach((item: any) => cogs += (Number(item.costPrice || 0) * Number(item.quantity || 0)));
        }
        dailyProfit += (revenue - cogs);
      });

      dataPoints.push(dailyProfit);
    }
    setChartData({ labels, datasets: [{ data: dataPoints }] });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profit & Loss Analysis</Text>
      </View>

      <View style={styles.filterSection}>
        <View style={styles.dateRow}>
          <Text style={styles.label}>Date:</Text>
          <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShow(true)}>
            <Ionicons name="calendar" size={20} color="#1e40af" />
            <Text style={styles.dateText}>{date.toDateString()}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.shopFilterContainer}>
          <TouchableOpacity 
            style={[styles.shopChip, selectedShop === 'all' && styles.activeShopChip]} 
            onPress={() => setSelectedShop('all')}
          >
            <Text style={[styles.shopChipText, selectedShop === 'all' && styles.activeShopChipText]}>All Shops</Text>
          </TouchableOpacity>
          {shops.map((shop) => (
            <TouchableOpacity 
              key={shop._id} 
              style={[styles.shopChip, selectedShop === shop._id && styles.activeShopChip]} 
              onPress={() => setSelectedShop(shop._id)}
            >
              <Text style={[styles.shopChipText, selectedShop === shop._id && styles.activeShopChipText]}>{shop.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {show && (
        <DateTimePicker
          value={date}
          mode="date"
          display="default"
          onChange={onChange}
        />
      )}

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {loading ? (
          <ActivityIndicator size="large" color="#1e40af" style={{ marginTop: 40 }} />
        ) : (
          <View style={styles.reportContainer}>
            
            {/* Profit Trend Chart */}
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>7-Day Profit Trend</Text>
              <LineChart
                data={chartData}
                width={Dimensions.get("window").width - 80} // Adjust for padding
                height={200}
                yAxisLabel="$"
                chartConfig={{
                  backgroundColor: "#ffffff",
                  backgroundGradientFrom: "#ffffff",
                  backgroundGradientTo: "#ffffff",
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`, // Green line
                  labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`,
                  style: { borderRadius: 16 },
                  propsForDots: { r: "4", strokeWidth: "2", stroke: "#059669" }
                }}
                bezier
                style={{ marginVertical: 8, borderRadius: 16 }}
              />
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Total Revenue</Text>
              <Text style={[styles.statValue, { color: '#1e40af' }]}>${stats.revenue.toFixed(2)}</Text>
            </View>
            
            <View style={styles.statCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Text style={styles.statLabel}>COGS (Cost of Goods)</Text>
                <Ionicons name="information-circle-outline" size={16} color="#64748b" />
              </View>
              <Text style={[styles.statValue, { color: '#ef4444' }]}>${stats.cogs.toFixed(2)}</Text>
            </View>

            <View style={[styles.statCard, styles.profitCard]}>
              <Text style={styles.profitLabel}>Net Profit</Text>
              <Text style={styles.profitValue}>${stats.profit.toFixed(2)}</Text>
              <Text style={styles.profitSubtext}>(Revenue - COGS)</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    backgroundColor: '#1e3a8a',
    padding: 25,
    paddingTop: 60,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: { marginRight: 15 },
  headerTitle: { color: 'white', fontSize: 22, fontWeight: 'bold' },
  filterSection: { padding: 20, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 },
  label: { color: '#64748b', fontWeight: 'bold', fontSize: 16 },
  datePickerBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eff6ff', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: '#bfdbfe' },
  dateText: { marginLeft: 8, fontSize: 14, color: '#1e40af', fontWeight: 'bold' },
  shopFilterContainer: { flexDirection: 'row' },
  shopChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f1f5f9', marginRight: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  activeShopChip: { backgroundColor: '#1e40af', borderColor: '#1e40af' },
  shopChipText: { color: '#64748b', fontWeight: '600', fontSize: 13 },
  activeShopChipText: { color: 'white' },
  reportContainer: { padding: 20 },
  statCard: { backgroundColor: 'white', padding: 20, borderRadius: 15, marginBottom: 15, elevation: 2 },
  chartCard: { backgroundColor: 'white', padding: 15, borderRadius: 15, marginBottom: 20, elevation: 2, alignItems: 'center' },
  chartTitle: { fontSize: 16, fontWeight: 'bold', color: '#1e293b', marginBottom: 10, alignSelf: 'flex-start' },
  statLabel: { color: '#64748b', fontSize: 14 },
  statValue: { fontSize: 24, fontWeight: 'bold', marginTop: 5 },
  profitCard: { backgroundColor: '#10b981' },
  profitLabel: { color: '#ecfdf5', fontSize: 14 },
  profitValue: { color: 'white', fontSize: 28, fontWeight: 'bold', marginTop: 5 },
  profitSubtext: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 }
});