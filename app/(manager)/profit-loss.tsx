import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BarChart } from 'react-native-chart-kit';
import { API_BASE_URL } from '../config';

export default function ProfitLoss() {
  const router = useRouter();
  const [startDate, setStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 6)));
  const [endDate, setEndDate] = useState(new Date());
  const [show, setShow] = useState(false);
  const [pickerMode, setPickerMode] = useState<'start' | 'end'>('start');
  const [loading, setLoading] = useState(false);
  const [shops, setShops] = useState<any[]>([]);
  const [selectedShop, setSelectedShop] = useState<string>('all');
  const [currency, setCurrency] = useState<'USD' | 'ZAR' | 'ZiG'>('USD');
  const [rates, setRates] = useState({ ZAR: 19.2, ZiG: 26.5 });
  const [rawSales, setRawSales] = useState<any[]>([]);
  const [stats, setStats] = useState({
    revenue: 0,
    cogs: 0,
    profit: 0
  });
  const [chartData, setChartData] = useState({
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    datasets: [{ data: [0, 0, 0, 0, 0, 0, 0] }]
  });
  const [chartView, setChartView] = useState<'profit' | 'revenue'>('profit');
  const [managerId, setManagerId] = useState<string | null>(null);

  const onChange = (event: any, selectedDate?: Date) => {
    setShow(Platform.OS === 'ios');
    if (selectedDate) {
      if (pickerMode === 'start') {
        setStartDate(selectedDate);
        if (selectedDate > endDate) setEndDate(selectedDate);
      } else {
        setEndDate(selectedDate);
        if (selectedDate < startDate) setStartDate(selectedDate);
      }
    }
  };

  const openPicker = (mode: 'start' | 'end') => {
    setPickerMode(mode);
    setShow(true);
  };

  useEffect(() => {
    const loadShops = async () => {
      const userId = await AsyncStorage.getItem('userId');
      if (userId) {
        setManagerId(userId);
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
    const fetchRates = async () => {
      try {
        const url = (selectedShop && selectedShop !== 'all') ? `${API_BASE_URL}/shops/rates/${selectedShop}` : `${API_BASE_URL}/shops/rates`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data.rates) setRates(data.rates);
        }
      } catch (e) {}
    };
    fetchRates();
  }, [selectedShop]);

  const convert = (amount: number) => {
    if (currency === 'ZAR') return amount * rates.ZAR;
    if (currency === 'ZiG') return amount * rates.ZiG;
    return amount;
  };

  const symbol = currency === 'USD' ? '$' : currency === 'ZAR' ? 'R' : 'ZiG';

  useEffect(() => {
    fetchProfitData();
  }, [startDate, endDate, selectedShop, shops, managerId]); // Re-fetch when date, shop selection, or shop list changes

  const fetchProfitData = async () => {
    if (selectedShop === 'all' && !managerId) return;

    setLoading(true);
    try {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);

      let url = `${API_BASE_URL}/sales/recent?startDate=${start.toISOString()}&endDate=${end.toISOString()}&limit=2000`;
      
      if (selectedShop !== 'all') {
        url += `&shopId=${selectedShop}`;
      } else if (managerId) {
        // If viewing all shops, filter by managerId to avoid fetching global data
        url += `&managerId=${managerId}`;
      }

      console.log(`[DEBUG] Fetching profit data: ${url}`);
      const response = await fetch(url);
      
      if (response.ok) {
        let sales = await response.json();
        console.log(`[DEBUG] Received ${sales.length} sales records`);
        // If 'all' is selected, filter sales to ensure they belong to this manager's shops
        if (selectedShop === 'all') {
          if (shops.length > 0) {
            const shopIds = new Set(shops.map(s => s._id.toString()));
            sales = sales.filter((s: any) => {
              const sId = s.shopId && (typeof s.shopId === 'object' ? s.shopId._id : s.shopId);
              return sId && shopIds.has(sId.toString());
            });
          } else {
            // If manager has no shops, force empty sales to prevent data leak
            sales = [];
          }
        }

        setRawSales(sales);
      }
    } catch (error) {
      console.error("Error fetching profit data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (rawSales.length >= 0 && !loading) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      
      const rangeSales = rawSales.filter((s: any) => {
        const d = new Date(s.date);
        return d >= start && d <= end;
      });

      calculateMetrics(rangeSales);
      prepareChartData(rawSales, start, end);
    }
  }, [rawSales, currency, rates, startDate, endDate, chartView, loading]);

  const calculateMetrics = (sales: any[]) => {
    let totalRevenue = 0;
    let totalCOGS = 0;

    sales.forEach(sale => {
      // Add to Revenue (using totalUSD or total)
      const saleTotal = convert(sale.totalUSD || sale.total || 0);
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
    
    let current = new Date(startDate);
    current.setHours(0,0,0,0);
    const end = new Date(endDate);
    end.setHours(23,59,59,999);

    while (current <= end) {
      const dayLabel = current.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      labels.push(dayLabel);

      const dayStart = new Date(current); dayStart.setHours(0,0,0,0);
      const dayEnd = new Date(current); dayEnd.setHours(23,59,59,999);

      // Calculate Value for this day
      let dailyValue = 0;
      const daySales = sales.filter((s: any) => {
        const saleDate = new Date(s.date);
        return saleDate >= dayStart && saleDate <= dayEnd;
      });

      daySales.forEach((sale: any) => {
        const revenue = convert(sale.totalUSD || sale.total || 0);
        
        if (chartView === 'revenue') {
          dailyValue += revenue;
        } else {
          let cogs = 0;
          if (Array.isArray(sale.items)) {
            sale.items.forEach((item: any) => cogs += (convert(Number(item.costPrice || 0)) * Number(item.quantity || 0)));
          }
          dailyValue += (revenue - cogs);
        }
      });

      dataPoints.push(Number(dailyValue.toFixed(2)));
      current.setDate(current.getDate() + 1);
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
        <TouchableOpacity 
            style={styles.currencySelector} 
            onPress={() => setCurrency(prev => prev === 'USD' ? 'ZAR' : prev === 'ZAR' ? 'ZiG' : 'USD')}
        >
            <Text style={styles.currencyText}>{currency}</Text>
        </TouchableOpacity>

        <View style={styles.dateRow}>
          <Text style={styles.label}>Date Range:</Text>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <TouchableOpacity style={styles.datePickerBtn} onPress={() => openPicker('start')}>
                <Text style={styles.dateText}>{startDate.toLocaleDateString(undefined, {month:'numeric', day:'numeric'})}</Text>
            </TouchableOpacity>
            <Text style={{marginHorizontal: 5, color: '#64748b'}}>-</Text>
            <TouchableOpacity style={styles.datePickerBtn} onPress={() => openPicker('end')}>
                <Text style={styles.dateText}>{endDate.toLocaleDateString(undefined, {month:'numeric', day:'numeric'})}</Text>
            </TouchableOpacity>
          </View>
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
          value={pickerMode === 'start' ? startDate : endDate}
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
              <View style={styles.chartHeader}>
                <Text style={styles.chartTitle}>{chartView === 'profit' ? 'Profit Trend' : 'Revenue Trend'}</Text>
                <View style={styles.toggleContainer}>
                  <TouchableOpacity 
                    style={[styles.toggleBtn, chartView === 'profit' && styles.toggleBtnActive]} 
                    onPress={() => setChartView('profit')}
                  >
                    <Text style={[styles.toggleText, chartView === 'profit' && styles.toggleTextActive]}>Profit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.toggleBtn, chartView === 'revenue' && styles.toggleBtnActive]} 
                    onPress={() => setChartView('revenue')}
                  >
                    <Text style={[styles.toggleText, chartView === 'revenue' && styles.toggleTextActive]}>Revenue</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <BarChart
                data={chartData}
                width={Math.max(Dimensions.get("window").width - 60, chartData.labels.length * 60)}
                height={250}
                yAxisLabel={symbol === '$' ? '$' : ''}
                yAxisSuffix=""
                chartConfig={{
                  backgroundColor: "#ffffff",
                  backgroundGradientFrom: "#ffffff",
                  backgroundGradientTo: "#ffffff",
                  decimalPlaces: 2,
                  color: (opacity = 1) => chartView === 'profit' ? `rgba(16, 185, 129, ${opacity})` : `rgba(37, 99, 235, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`,
                  barPercentage: 0.7,
                  propsForBackgroundLines: {
                    strokeWidth: 1,
                    stroke: "#f1f5f9",
                    strokeDasharray: "", // solid lines
                  },
                }}
                style={{ marginVertical: 8, borderRadius: 16, paddingRight: 40 }}
                showValuesOnTopOfBars={chartData.datasets[0].data.length < 15}
                fromZero
              />
              </ScrollView>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Total Revenue</Text>
              <Text style={[styles.statValue, { color: '#1e40af' }]}>{symbol} {stats.revenue.toFixed(2)}</Text>
            </View>
            
            <View style={styles.statCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Text style={styles.statLabel}>COGS (Cost of Goods)</Text>
                <Ionicons name="information-circle-outline" size={16} color="#64748b" />
              </View>
              <Text style={[styles.statValue, { color: '#ef4444' }]}>{symbol} {stats.cogs.toFixed(2)}</Text>
            </View>

            <View style={[styles.statCard, styles.profitCard]}>
              <Text style={styles.profitLabel}>Net Profit</Text>
              <Text style={styles.profitValue}>{symbol} {stats.profit.toFixed(2)}</Text>
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
  currencySelector: { alignSelf: 'flex-end', backgroundColor: '#e0f2fe', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginBottom: 10 },
  currencyText: { color: '#0284c7', fontWeight: 'bold', fontSize: 12 },
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
  chartCard: { backgroundColor: 'white', padding: 15, borderRadius: 15, marginBottom: 20, elevation: 2 },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  chartTitle: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
  statLabel: { color: '#64748b', fontSize: 14 },
  statValue: { fontSize: 24, fontWeight: 'bold', marginTop: 5 },
  profitCard: { backgroundColor: '#10b981' },
  profitLabel: { color: '#ecfdf5', fontSize: 14 },
  profitValue: { color: 'white', fontSize: 28, fontWeight: 'bold', marginTop: 5 },
  profitSubtext: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
  toggleContainer: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 8, padding: 2 },
  toggleBtn: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6 },
  toggleBtnActive: { backgroundColor: 'white', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 2, elevation: 1 },
  toggleText: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  toggleTextActive: { color: '#1e40af' },
});