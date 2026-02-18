import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
    // Map: { "10/24": 500, "10/25": 120 }
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
    setSales(data); // Store raw data for the list (Newest first is default from API usually)
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
        <View style={[styles.summaryCard, { backgroundColor: '#10b981' }]}>
           <Ionicons name="cash-outline" size={24} color="white" />
           <View>
             <Text style={styles.summaryLabel}>Total Revenue</Text>
             <Text style={styles.summaryValue}>${stats.totalRevenue.toFixed(2)}</Text>
           </View>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: '#3b82f6' }]}>
           <Ionicons name="receipt-outline" size={24} color="white" />
           <View>
             <Text style={styles.summaryLabel}>Transactions</Text>
             <Text style={styles.summaryValue}>{stats.totalCount}</Text>
           </View>
        </View>
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
            yAxisLabel="$"
            chartConfig={chartConfig}
            bezier
            style={styles.chart}
          />
        ) : (
          <View style={styles.noChartData}>
            <Text style={{ color: '#94a3b8' }}>Not enough data for chart</Text>
          </View>
        )}
      </View>

      <Text style={[styles.sectionTitle, { marginLeft: 24, marginTop: 10 }]}>Recent Transactions</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Blue Header Background */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={styles.iconButton}>
            <Ionicons name="log-out-outline" size={24} color="white" />
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>Sales Reports</Text>
        <Text style={styles.subtitle}>Overview & Analytics</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1e3a8a" />
        </View>
      ) : (
        <FlatList
          data={sales}
          keyExtractor={(item) => item._id}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={{ paddingBottom: 50 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1e3a8a']} />
          }
          renderItem={({ item }) => (
            <View style={styles.saleCard}>
              <View style={styles.iconBox}>
                <Ionicons name="cart" size={20} color="#3b82f6" />
              </View>
              <View style={styles.saleInfo}>
                <Text style={styles.saleTotal}>${item.total.toFixed(2)}</Text>
                <Text style={styles.saleItems}>{item.items.length} items sold</Text>
              </View>
              <Text style={styles.saleDate}>
                {new Date(item.date).toLocaleDateString()}
              </Text>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.center}>
               <Text style={{color: '#94a3b8', marginTop: 40}}>No transactions found.</Text>
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
  color: (opacity = 1) => `rgba(30, 58, 138, ${opacity})`, // Dark Blue Lines
  labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`, // Grey Labels
  style: { borderRadius: 16 },
  propsForDots: {
    r: '4',
    strokeWidth: '2',
    stroke: '#3b82f6',
  },
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header
  header: {
    backgroundColor: '#1e3a8a',
    paddingHorizontal: 24,
    paddingTop: 50,
    paddingBottom: 30,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 0, // Reduced elevation so cards sit on top
    zIndex: 0,    // Reduced zIndex so cards sit on top
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  iconButton: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
  },
  title: { fontSize: 28, fontWeight: '800', color: 'white' },
  subtitle: { fontSize: 14, color: '#bfdbfe', marginTop: 4 },

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
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: {width: 0, height: 2}
  },
  summaryLabel: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '600', marginLeft: 8 },
  summaryValue: { color: 'white', fontSize: 18, fontWeight: 'bold', marginLeft: 8 },

  // Chart
  chartWrapper: {
    backgroundColor: 'white',
    marginHorizontal: 24,
    borderRadius: 20,
    padding: 16,
    elevation: 2,
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1e293b', marginBottom: 12 },
  chart: { borderRadius: 16 },
  noChartData: { height: 100, justifyContent: 'center', alignItems: 'center' },

  // List Item
  saleCard: {
    backgroundColor: 'white',
    marginHorizontal: 24,
    marginBottom: 12,
    padding: 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    elevation: 1,
  },
  iconBox: {
    width: 40, height: 40,
    backgroundColor: '#eff6ff',
    borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 12,
  },
  saleInfo: { flex: 1 },
  saleTotal: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
  saleItems: { fontSize: 13, color: '#64748b' },
  saleDate: { fontSize: 12, color: '#94a3b8', fontWeight: '500' },
});