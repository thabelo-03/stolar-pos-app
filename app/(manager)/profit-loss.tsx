import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { API_BASE_URL } from '../config';

export default function ProfitLoss() {
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [endDate, setEndDate] = useState(new Date());
  const [show, setShow] = useState(false);
  const [pickerMode, setPickerMode] = useState<'start' | 'end'>('start');
  const [loading, setLoading] = useState(true);
  const [shops, setShops] = useState<any[]>([]);
  const [selectedShopId, setSelectedShopId] = useState<string>('all');
  const [summary, setSummary] = useState({ revenue: 0, cogs: 0, profit: 0, margin: 0 });
  const [tableData, setTableData] = useState<any[]>([]);
  const [chartData, setChartData] = useState({
    labels: ["No Data"],
    datasets: [{ data: [0] }]
  });

  useEffect(() => {
    fetchData();
  }, [startDate, endDate, selectedShopId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const userId = await AsyncStorage.getItem('userId');
      if (!userId) return;

      // 1. Get Shops managed by user
      const shopsRes = await fetch(`${API_BASE_URL}/shops?managerId=${userId}`);
      const shops = await shopsRes.json();
      setShops(Array.isArray(shops) ? shops : []);

      // Determine which shops to filter by
      const shopIds = selectedShopId === 'all' 
        ? (Array.isArray(shops) ? shops.map((s: any) => s._id) : [])
        : [selectedShopId];

      // 2. Get Products (for cost lookup fallback)
      const productsRes = await fetch(`${API_BASE_URL}/products`);
      const products = await productsRes.json();
      const costMap = new Map();
      if (Array.isArray(products)) {
        products.forEach((p: any) => {
          if (p.barcode) costMap.set(p.barcode, Number(p.costPrice || 0));
        });
      }

      // 3. Get Sales
      const salesRes = await fetch(`${API_BASE_URL}/sales`);
      const allSales = await salesRes.json();

      // 4. Filter & Process
      if (Array.isArray(allSales)) {
        const start = new Date(startDate); start.setHours(0,0,0,0);
        const end = new Date(endDate); end.setHours(23,59,59,999);

        const filteredSales = allSales.filter((s: any) => {
          const d = new Date(s.date);
          return shopIds.includes(s.shopId) && 
                 d >= start && 
                 d <= end &&
                 !s.refunded;
        });

        // Group by Day
        const dailyStats: {[key: string]: { revenue: number, cogs: number }} = {};

        filteredSales.forEach((sale: any) => {
          const d = new Date(sale.date);
          const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          
          if (!dailyStats[dayKey]) dailyStats[dayKey] = { revenue: 0, cogs: 0 };

          const revenue = Number(sale.totalUSD || sale.total || 0);
          let cogs = 0;

          if (Array.isArray(sale.items)) {
            sale.items.forEach((item: any) => {
              const qty = Number(item.quantity || 0);
              const unitCost = item.costPrice !== undefined ? Number(item.costPrice) : (costMap.get(item.barcode) || 0);
              cogs += unitCost * qty;
            });
          }

          dailyStats[dayKey].revenue += revenue;
          dailyStats[dayKey].cogs += cogs;
        });

        // Convert to Array
        const report = Object.keys(dailyStats).map(dayKey => {
          const { revenue, cogs } = dailyStats[dayKey];
          const profit = revenue - cogs;
          const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
          const [y, m, d] = dayKey.split('-').map(Number);
          return {
            day: dayKey,
            date: new Date(y, m - 1, d).toLocaleDateString(),
            revenue,
            cogs,
            profit,
            margin
          };
        }).sort((a, b) => b.day.localeCompare(a.day)); // Descending date

        setTableData(report);

        // Prepare Chart Data (Ascending)
        const chartReport = [...report].sort((a, b) => a.day.localeCompare(b.day));
        if (chartReport.length > 0) {
            const labels = chartReport.map(item => {
                const [y, m, d] = item.day.split('-');
                return `${d}/${m}`;
            });
            const data = chartReport.map(item => item.profit);
            
            // Simple label sampling if too many points
            const finalLabels = labels.map((l, i) => {
                if (labels.length <= 7) return l;
                return i % Math.ceil(labels.length / 6) === 0 ? l : '';
            });

            setChartData({ labels: finalLabels, datasets: [{ data }] });
        } else {
             setChartData({ labels: ["No Data"], datasets: [{ data: [0] }] });
        }

        // Summary
        const totalRev = report.reduce((acc, curr) => acc + curr.revenue, 0);
        const totalCogs = report.reduce((acc, curr) => acc + curr.cogs, 0);
        const totalProfit = totalRev - totalCogs;
        const totalMargin = totalRev > 0 ? (totalProfit / totalRev) * 100 : 0;

        setSummary({
          revenue: totalRev,
          cogs: totalCogs,
          profit: totalProfit,
          margin: totalMargin
        });
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

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
    } else {
      setShow(false);
    }
  };

  const renderHeader = () => (
    <View style={styles.tableHeader}>
      <Text style={[styles.headerCell, { flex: 2 }]}>Date</Text>
      <Text style={styles.headerCell}>Rev</Text>
      <Text style={styles.headerCell}>Cost</Text>
      <Text style={styles.headerCell}>Profit</Text>
    </View>
  );

  const renderItem = ({ item }: any) => (
    <View style={styles.tableRow}>
      <Text style={[styles.cell, { flex: 2, color: '#64748b' }]}>{item.date}</Text>
      <Text style={styles.cell}>${item.revenue.toFixed(0)}</Text>
      <Text style={styles.cell}>${item.cogs.toFixed(0)}</Text>
      <Text style={[styles.cell, { color: item.profit >= 0 ? '#16a34a' : '#dc2626', fontWeight: 'bold' }]}>
        ${item.profit.toFixed(0)}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profit & Loss Analysis</Text>
      </View>

      {/* Shop Selector */}
      <View style={styles.shopFilterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 20 }}>
          <TouchableOpacity 
            style={[styles.filterChip, selectedShopId === 'all' && styles.activeFilterChip]} 
            onPress={() => setSelectedShopId('all')}
          >
            <Text style={[styles.filterText, selectedShopId === 'all' && styles.activeFilterText]}>All Shops</Text>
          </TouchableOpacity>
          {shops.map(shop => (
            <TouchableOpacity 
                key={shop._id}
                style={[styles.filterChip, selectedShopId === shop._id && styles.activeFilterChip]} 
                onPress={() => setSelectedShopId(shop._id)}
            >
                <Text style={[styles.filterText, selectedShopId === shop._id && styles.activeFilterText]}>{shop.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.filterSection}>
        <Text style={styles.label}>Period:</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity style={styles.datePickerBtn} onPress={() => { setPickerMode('start'); setShow(true); }}>
            <Text style={styles.dateText}>{startDate.toLocaleDateString()}</Text>
          </TouchableOpacity>
          <Text style={{ color: '#64748b' }}>-</Text>
          <TouchableOpacity style={styles.datePickerBtn} onPress={() => { setPickerMode('end'); setShow(true); }}>
            <Text style={styles.dateText}>{endDate.toLocaleDateString()}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {show && (
        <DateTimePicker
          value={pickerMode === 'start' ? startDate : endDate}
          mode="date"
          display="default"
          onChange={onChange}
        />
      )}

      {loading ? (
        <ActivityIndicator size="large" color="#1e40af" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={tableData}
          keyExtractor={(item) => item.day}
          ListHeaderComponent={
            <>
              {/* Financial Summary Cards */}
              <View style={styles.reportContainer}>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>Revenue</Text>
                  <Text style={[styles.statValue, { color: '#1e40af' }]}>${summary.revenue.toFixed(2)}</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>Expenses (COGS)</Text>
                  <Text style={[styles.statValue, { color: '#ef4444' }]}>${summary.cogs.toFixed(2)}</Text>
                </View>
                <View style={[styles.statCard, styles.profitCard]}>
                  <Text style={styles.profitLabel}>Net Profit</Text>
                  <Text style={styles.profitValue}>${summary.profit.toFixed(2)}</Text>
                  <Text style={styles.marginText}>Margin: {summary.margin.toFixed(1)}%</Text>
                </View>
              </View>
              
              {/* Chart */}
              <View style={styles.chartCard}>
                <Text style={styles.sectionTitle}>Profit Trend</Text>
                <LineChart
                  data={chartData}
                  width={Dimensions.get("window").width - 40}
                  height={220}
                  yAxisLabel="$"
                  yAxisSuffix=""
                  yAxisInterval={1}
                  chartConfig={{
                    backgroundColor: "#ffffff",
                    backgroundGradientFrom: "#ffffff",
                    backgroundGradientTo: "#ffffff",
                    decimalPlaces: 0,
                    color: (opacity = 1) => `rgba(22, 163, 74, ${opacity})`,
                    labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`,
                    style: { borderRadius: 16 },
                    propsForDots: { r: "4", strokeWidth: "2", stroke: "#16a34a" }
                  }}
                  bezier
                  style={{ marginVertical: 8, borderRadius: 16 }}
                />
              </View>

              <Text style={styles.sectionTitle}>Daily Breakdown</Text>
              {renderHeader()}
            </>
          }
          renderItem={renderItem}
          ListEmptyComponent={<Text style={styles.emptyText}>No sales data for this month.</Text>}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { backgroundColor: '#1e40af', padding: 25, paddingTop: 60, paddingBottom: 20 },
  headerTitle: { color: 'white', fontSize: 22, fontWeight: 'bold' },
  filterSection: { padding: 20, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { color: '#64748b', fontWeight: 'bold', fontSize: 16 },
  datePickerBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eff6ff', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: '#bfdbfe' },
  dateText: { fontSize: 14, color: '#1e40af', fontWeight: 'bold' },
  reportContainer: { padding: 20 },
  statCard: { backgroundColor: 'white', padding: 20, borderRadius: 15, marginBottom: 15, elevation: 2 },
  statLabel: { color: '#64748b', fontSize: 14 },
  statValue: { fontSize: 24, fontWeight: 'bold', marginTop: 5 },
  profitCard: { backgroundColor: '#10b981' },
  profitLabel: { color: '#ecfdf5', fontSize: 14 },
  profitValue: { color: 'white', fontSize: 28, fontWeight: 'bold', marginTop: 5 },
  marginText: { color: '#ecfdf5', marginTop: 5, fontWeight: '600' },
  chartCard: { backgroundColor: 'white', marginHorizontal: 20, borderRadius: 16, padding: 15, marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginLeft: 20, marginBottom: 10 },
  tableHeader: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#e2e8f0', marginHorizontal: 20, borderTopLeftRadius: 10, borderTopRightRadius: 10 },
  headerCell: { flex: 1, fontWeight: 'bold', color: '#475569', fontSize: 14 },
  tableRow: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 15, backgroundColor: 'white', marginHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  cell: { flex: 1, fontSize: 14, color: '#1e293b' },
  emptyText: { textAlign: 'center', marginTop: 30, color: '#94a3b8' },
  
  shopFilterContainer: { backgroundColor: '#1e40af', paddingBottom: 20 },
  filterChip: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  activeFilterChip: { backgroundColor: 'white', borderColor: 'white' },
  filterText: { color: '#bfdbfe', fontWeight: '600', fontSize: 13 },
  activeFilterText: { color: '#1e40af', fontWeight: 'bold' },
});