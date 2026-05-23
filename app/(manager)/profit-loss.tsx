import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BarChart } from 'react-native-chart-kit';
import { API_BASE_URL } from '../config';

export default function ProfitLoss() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [startDate, setStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 6)));
  const [endDate, setEndDate] = useState(new Date());
  const [show, setShow] = useState(false);
  const [pickerMode, setPickerMode] = useState<'start' | 'end'>('start');
  const [loading, setLoading] = useState(false);
  const [shops, setShops] = useState<any[]>([]);
  const [selectedShop, setSelectedShop] = useState<string>('all');
  const [currency, setCurrency] = useState<'USD' | 'ZAR' | 'ZiG'>('ZAR');
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
          
          // Convert cost price to the selected currency to ensure consistency in calculations
          totalCOGS += convert(costPrice) * quantity;
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
      <LinearGradient 
        colors={['#0284c7', '#0ea5e9', '#38bdf8']} 
        start={{ x: 0, y: 0 }} 
        end={{ x: 1, y: 1 }} 
        style={[styles.header, { paddingTop: insets.top + 15 }]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profit & Loss Analysis</Text>
      </LinearGradient>

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
            <Text style={{marginHorizontal: 8, color: '#94a3b8'}}>-</Text>
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
          <ActivityIndicator size="large" color="#0ea5e9" style={{ marginTop: 40 }} />
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
                  color: (opacity = 1) => chartView === 'profit' ? `rgba(16, 185, 129, ${opacity})` : `rgba(14, 165, 233, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(71, 85, 105, ${opacity})`,
                  barPercentage: 0.7,
                  propsForBackgroundLines: {
                    strokeWidth: 1,
                    stroke: "#f0f9ff",
                    strokeDasharray: "", // solid lines
                  },
                }}
                style={{ marginVertical: 8, borderRadius: 16, paddingRight: 40 }}
                showValuesOnTopOfBars={chartData.datasets[0].data.length < 15}
                fromZero
              />
              </ScrollView>
            </View>

            <View
              style={styles.unifiedCard}
            >
              {/* Performance Indicator Header */}
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.cardSubtitle}>NET PERFORMANCE</Text>
                  <Text style={[styles.mainProfitValue, { color: stats.profit >= 0 ? '#10b981' : '#f43f5e' }]}>
                    {symbol} {stats.profit.toFixed(2)}
                  </Text>
                </View>
                <View style={[
                  styles.marginBadge, 
                  { backgroundColor: stats.profit >= 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(244, 63, 94, 0.12)' }
                ]}>
                  <Text style={[
                    styles.marginBadgeText, 
                    { color: stats.profit >= 0 ? '#10b981' : '#f43f5e' }
                  ]}>
                    {(stats.revenue > 0 ? (stats.profit / stats.revenue) * 100 : 0).toFixed(1)}% Margin
                  </Text>
                </View>
              </View>

              {/* Cost Ratio Progress Bar */}
              <View style={styles.progressContainer}>
                <View style={styles.progressLabels}>
                  <Text style={styles.progressLabelText}>Cost of Sales Ratio</Text>
                  <Text style={styles.progressValueText}>
                    {(stats.revenue > 0 ? (stats.cogs / stats.revenue) * 100 : 0).toFixed(0)}%
                  </Text>
                </View>
                <View style={styles.progressBarTrack}>
                  <View style={[
                    styles.progressBarFill, 
                    { 
                      width: `${Math.min(100, Math.max(0, stats.revenue > 0 ? (stats.cogs / stats.revenue) * 100 : 0))}%`,
                      backgroundColor: '#f43f5e'
                    }
                  ]} />
                </View>
              </View>

              <View style={styles.cardDivider} />

              {/* Columns for Revenue & COGS */}
              <View style={styles.gridRow}>
                {/* Gross Revenue */}
                <View style={styles.gridCol}>
                  <View style={styles.colHeader}>
                    <View style={[styles.miniIconBox, { backgroundColor: 'rgba(14, 165, 233, 0.15)' }]}>
                      <Ionicons name="trending-up" size={12} color="#0ea5e9" />
                    </View>
                    <Text style={styles.colLabel}>GROSS REVENUE</Text>
                  </View>
                  <Text style={[styles.colValue, { color: '#0ea5e9' }]}>
                    {symbol} {stats.revenue.toFixed(2)}
                  </Text>
                </View>

                {/* COGS */}
                <View style={styles.gridCol}>
                  <View style={styles.colHeader}>
                    <View style={[styles.miniIconBox, { backgroundColor: 'rgba(244, 63, 94, 0.15)' }]}>
                      <Ionicons name="trending-down" size={12} color="#f43f5e" />
                    </View>
                    <Text style={styles.colLabel}>TOTAL COGS</Text>
                  </View>
                  <Text style={[styles.colValue, { color: '#334155' }]}>
                    {symbol} {stats.cogs.toFixed(2)}
                  </Text>
                </View>
              </View>

              {/* Actionable performance status summary */}
              <View style={styles.cardFooter}>
                <Ionicons 
                  name={stats.profit >= 0 ? "checkmark-circle" : "alert-circle"} 
                  size={16} 
                  color={stats.profit >= 0 ? '#10b981' : '#f43f5e'} 
                />
                <Text style={styles.footerText}>
                  {stats.profit >= 0 
                    ? "Operating profitably. High margins detected." 
                    : "Expenses exceed revenue. Review stock cost prices."}
                </Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f9ff' },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: { padding: 8, backgroundColor: 'rgba(255, 255, 255, 0.2)', borderRadius: 12, marginRight: 15 },
  headerTitle: { color: 'white', fontSize: 20, fontWeight: 'bold', letterSpacing: 0.5 },
  filterSection: { padding: 20, backgroundColor: 'white', borderBottomLeftRadius: 24, borderBottomRightRadius: 24, shadowColor: '#0284c7', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 12, elevation: 2, marginBottom: 10 },
  currencySelector: { alignSelf: 'flex-end', backgroundColor: '#f0f9ff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: '#bae6fd', marginBottom: 10 },
  currencyText: { color: '#0ea5e9', fontWeight: 'bold', fontSize: 12 },
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 },
  label: { color: '#475569', fontWeight: 'bold', fontSize: 14 },
  datePickerBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f9ff', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: '#bae6fd' },
  dateText: { fontSize: 14, color: '#0ea5e9', fontWeight: 'bold' },
  shopFilterContainer: { flexDirection: 'row', marginTop: 5 },
  shopChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f0f9ff', marginRight: 10, borderWidth: 1, borderColor: '#bae6fd' },
  activeShopChip: { backgroundColor: '#0ea5e9', borderColor: '#0ea5e9' },
  shopChipText: { color: '#0ea5e9', fontWeight: '600', fontSize: 13 },
  activeShopChipText: { color: 'white' },
  reportContainer: { padding: 20, gap: 15 },
  unifiedCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#bae6fd',
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
    marginBottom: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  cardSubtitle: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  mainProfitValue: {
    fontSize: 28,
    fontWeight: '800',
    marginTop: 2,
  },
  marginBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  marginBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabelText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
  progressValueText: {
    color: '#334155',
    fontSize: 11,
    fontWeight: '700',
  },
  progressBarTrack: {
    height: 5,
    backgroundColor: '#e2e8f0',
    borderRadius: 2.5,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2.5,
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 4,
    opacity: 1,
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 8,
  },
  gridCol: {
    flex: 1,
  },
  colHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  miniIconBox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colLabel: {
    color: '#94a3b8',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  colValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    backgroundColor: 'rgba(14, 165, 233, 0.05)',
    padding: 8,
    borderRadius: 10,
  },
  footerText: {
    color: '#475569',
    fontSize: 10,
    fontWeight: '500',
    flex: 1,
  },
  chartCard: { backgroundColor: 'white', padding: 15, borderRadius: 20, shadowColor: '#0284c7', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 16, elevation: 4 },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  chartTitle: { fontSize: 16, fontWeight: 'bold', color: '#0f172a' },
  statLabel: { color: '#475569', fontSize: 14, fontWeight: '600' },
  statValue: { fontSize: 24, fontWeight: 'bold', marginTop: 5 },
  toggleContainer: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 8, padding: 2 },
  toggleBtn: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6 },
  toggleBtnActive: { backgroundColor: 'white', shadowColor: '#0284c7', shadowOpacity: 0.1, shadowRadius: 2, elevation: 1 },
  toggleText: { fontSize: 12, color: '#475569', fontWeight: '600' },
  toggleTextActive: { color: '#0ea5e9' },
});