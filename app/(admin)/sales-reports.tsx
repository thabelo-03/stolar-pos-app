import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { API_BASE_URL } from '../config';

const API_SALES = `${API_BASE_URL}/sales/recent`;
const SCREEN_WIDTH = Dimensions.get('window').width;

// Define Types
interface Sale {
  _id: string;
  total: number;
  date: string; // ISO String
  items: any[];
}

interface ChartPoint {
  label: string;
  value: number;
}

export default function SalesReports() {
  const router = useRouter();
  const [sales, setSales] = useState<Sale[]>([]);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [stats, setStats] = useState({ totalRevenue: 0, totalCount: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSales = async () => {
    try {
      if (!refreshing) setLoading(true);
      const res = await fetch(API_SALES);
      const data = await res.json();
      
      if (Array.isArray(data)) {
        processData(data);
      }
    } catch (e) {
      console.error("Failed to fetch sales:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const processData = (data: Sale[]) => {
    // 1. Calculate Summary Stats
    const totalRev = data.reduce((sum, item) => sum + (item.total || 0), 0);
    setStats({
      totalRevenue: totalRev,
      totalCount: data.length
    });

    // 2. Prepare Chart Data (Group by Day)
    const dailyMap: Record<string, number> = {};
    
    // Sort oldest to newest for the chart
    const sortedForChart = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    sortedForChart.forEach(sale => {
      const date = new Date(sale.date);
      const dayLabel = `${date.getDate()}/${date.getMonth() + 1}`; // e.g. "24/10"
      
      if (dailyMap[dayLabel]) {
        dailyMap[dayLabel] += sale.total;
      } else {
        dailyMap[dayLabel] = sale.total;
      }
    });

    // Convert Map to Array and take last 7 days
    const chartPoints = Object.keys(dailyMap).map(key => ({
      label: key,
      value: dailyMap[key]
    })).slice(-7); // Last 7 days only

    setChartData(chartPoints);
    setSales(data); // Store raw data for the list
  };

  useEffect(() => {
    fetchSales();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchSales();
  }, []);

  const handleLogout = async () => {
    await AsyncStorage.clear();
    router.replace('/(auth)/login');
  };

  const renderHeader = () => (
    <View>
      {/* 1. Summary Cards */}
      <View style={styles.summaryContainer}>
        <LinearGradient
          colors={['#10b981', '#059669']}
          style={styles.summaryCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.summaryIconBox}>
            <Ionicons name="cash" size={20} color="white" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.summaryLabel}>Total Revenue</Text>
            <Text style={styles.summaryValue}>${stats.totalRevenue.toFixed(2)}</Text>
          </View>
        </LinearGradient>

        <LinearGradient
          colors={['#6366f1', '#0284c7']}
          style={styles.summaryCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.summaryIconBox}>
            <Ionicons name="receipt" size={20} color="white" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.summaryLabel}>Transactions</Text>
            <Text style={styles.summaryValue}>{stats.totalCount}</Text>
          </View>
        </LinearGradient>
      </View>

      {/* 2. Chart Section */}
      <View style={styles.chartWrapper}>
        <Text style={styles.sectionTitle}>Weekly Trend</Text>
        {chartData.length > 0 ? (
          <LineChart
            data={{
              labels: chartData.map(d => d.label),
              datasets: [{ data: chartData.map(d => d.value) }]
            }}
            width={SCREEN_WIDTH - 48} // Padding adjustments
            height={220}
            yAxisLabel="R"
            chartConfig={chartConfig}
            bezier
            style={styles.chart}
          />
        ) : (
          <View style={styles.noChartData}>
            <Text style={{ color: '#94a3b8', fontWeight: '600' }}>Not enough data for chart</Text>
          </View>
        )}
      </View>

      <Text style={[styles.sectionTitle, { marginLeft: 24, marginTop: 10, marginBottom: 12 }]}>Recent Transactions</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* Lavender Header Background */}
      <LinearGradient
        colors={['#0284c7', '#0ea5e9', '#38bdf8']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerTopRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
            <Ionicons name="arrow-back" size={20} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerCenterTitle}>Executive Hub</Text>
          <TouchableOpacity onPress={handleLogout} style={styles.iconButton}>
            <Ionicons name="log-out-outline" size={20} color="white" />
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>Sales Reports</Text>
        <Text style={styles.subtitle}>Overview & Live Business Intelligence</Text>
      </LinearGradient>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0ea5e9" />
        </View>
      ) : (
        <FlatList
          data={sales}
          keyExtractor={(item) => item._id}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={{ paddingBottom: 50 }}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh} 
              colors={['#0ea5e9']} 
              tintColor="#0ea5e9" 
            />
          }
          renderItem={({ item }) => (
            <View style={styles.saleCard}>
              <View style={styles.iconBox}>
                <Ionicons name="receipt-outline" size={20} color="#0ea5e9" />
              </View>
              <View style={styles.saleInfo}>
                <Text style={styles.saleTotal}>${item.total.toFixed(2)}</Text>
                <Text style={styles.saleItems}>{item.items.length} {item.items.length === 1 ? 'item' : 'items'} sold</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.saleDate}>
                  {new Date(item.date).toLocaleDateString()}
                </Text>
                <Text style={styles.saleTime}>
                  {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.center}>
               <Text style={{color: '#94a3b8', marginTop: 40, fontWeight: '600'}}>No transactions found.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

// Chart Configuration
const chartConfig = {
  backgroundColor: '#ffffff',
  backgroundGradientFrom: '#ffffff',
  backgroundGradientTo: '#ffffff',
  decimalPlaces: 0, 
  color: (opacity = 1) => `rgba(14, 165, 233, ${opacity})`, // Light Blue Lines
  labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`, // Grey Labels
  style: { borderRadius: 16 },
  propsForDots: {
    r: '5',
    strokeWidth: '2.5',
    stroke: '#38bdf8',
  },
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f9ff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header
  header: {
    paddingHorizontal: 24,
    paddingTop: 50,
    paddingBottom: 30,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    shadowColor: "#0ea5e9",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 0,
    zIndex: 0,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenterTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: { fontSize: 28, fontWeight: '800', color: 'white' },
  subtitle: { fontSize: 14, color: '#e9e3ff', marginTop: 4, fontWeight: '500' },

  // Summary Cards
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginTop: -25, // Overlap effect
    marginBottom: 20,
    zIndex: 10,     // Ensure cards are above header
    elevation: 10,  // Ensure cards are above header on Android
  },
  summaryCard: {
    width: '48%',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#0ea5e9',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
  },
  summaryIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  summaryLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryValue: { color: 'white', fontSize: 18, fontWeight: '800', marginTop: 2 },

  // Chart
  chartWrapper: {
    backgroundColor: 'white',
    marginHorizontal: 24,
    borderRadius: 24,
    padding: 16,
    shadowColor: '#0ea5e9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#e9e3ff',
    marginBottom: 20,
  },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', letterSpacing: 0.5 },
  chart: { borderRadius: 16, marginTop: 12 },
  noChartData: { height: 100, justifyContent: 'center', alignItems: 'center' },

  // List Item
  saleCard: {
    backgroundColor: 'white',
    marginHorizontal: 24,
    marginBottom: 12,
    padding: 16,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#0ea5e9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e9e3ff',
  },
  iconBox: {
    width: 42, height: 42,
    backgroundColor: '#f3e8ff',
    borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 14,
  },
  saleInfo: { flex: 1 },
  saleTotal: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  saleItems: { fontSize: 13, color: '#64748b', fontWeight: '500', marginTop: 2 },
  saleDate: { fontSize: 12, color: '#94a3b8', fontWeight: '700' },
  saleTime: { fontSize: 11, color: '#cbd5e1', fontWeight: '600', marginTop: 2 },
});