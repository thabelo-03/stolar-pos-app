import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Dimensions, FlatList, Platform, RefreshControl, StyleSheet, TouchableOpacity, View } from 'react-native';
import { LineChart } from 'react-native-chart-kit';

import { ThemedText } from '../../components/themed-text';
import { ThemedView } from '../../components/themed-view';
import { useThemeColor } from '../../hooks/use-theme-color';
import { API_BASE_URL } from './api';

export default function DailySummaryScreen() {
  const router = useRouter();
  const textColor = useThemeColor({}, 'text');
  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  const [transactions, setTransactions] = useState<any[]>([]);
  const [totalSales, setTotalSales] = useState(0);
  const [transactionCount, setTransactionCount] = useState(0);
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
        // 1. Filter for selected date
        const selectedDateStr = date.toDateString();
        const daysSales = data.filter((s: any) => new Date(s.date).toDateString() === selectedDateStr);

        // 2. Calculate Totals
        const total = daysSales.reduce((sum: number, item: any) => sum + (item.total || item.amount || 0), 0);
        setTotalSales(total);
        setTransactionCount(daysSales.length);
        
        // 3. Update List (Newest first)
        setTransactions([...daysSales].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));

        // 4. Process Chart Data (Group by hour)
        const hourlyTotals = new Array(24).fill(0);
        daysSales.forEach((sale: any) => {
          const hour = new Date(sale.date).getHours();
          hourlyTotals[hour] += (sale.total || sale.amount || 0);
        });

        // Map specific hours to chart points (8am, 10am, 12pm, 2pm, 4pm, 6pm)
        const dataPoints = [8, 10, 12, 14, 16, 18].map(h => hourlyTotals[h]);
        
        setChartData({
          labels: ["8am", "10am", "12pm", "2pm", "4pm", "6pm"],
          datasets: [{ data: dataPoints }]
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
  }, [date]);

  const onRefresh = () => {
    fetchDailySales();
  };

  return (
    <ThemedView style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="arrow-back" size={24} color={textColor} />
      </TouchableOpacity>
      <ThemedText type="title">Daily Summary</ThemedText>
      
      <TouchableOpacity style={styles.dateSelector} onPress={() => setShowPicker(true)}>
        <Ionicons name="calendar" size={20} color="#888" />
        <ThemedText style={styles.dateText}>{date.toDateString()}</ThemedText>
      </TouchableOpacity>

      {showPicker && (
        <DateTimePicker
          value={date}
          mode="date"
          display="default"
          onChange={onChange}
        />
      )}

      <ThemedView style={styles.statsContainer}>
        <ThemedView style={styles.statItem}>
          <ThemedText type="subtitle">Total Sales</ThemedText>
          <ThemedText type="defaultSemiBold">${totalSales.toFixed(2)}</ThemedText>
        </ThemedView>
        
        <ThemedView style={styles.statItem}>
          <ThemedText type="subtitle">Transactions</ThemedText>
          <ThemedText type="defaultSemiBold">{transactionCount}</ThemedText>
        </ThemedView>
      </ThemedView>

      <ThemedText type="subtitle" style={styles.sectionTitle}>Sales Trend</ThemedText>
      <LineChart
        data={chartData}
        width={Dimensions.get("window").width - 40} // from react-native
        height={220}
        yAxisLabel="$"
        yAxisSuffix=""
        yAxisInterval={1} // optional, defaults to 1
        chartConfig={{
          backgroundColor: "#1e40af",
          backgroundGradientFrom: "#1e40af",
          backgroundGradientTo: "#60a5fa",
          decimalPlaces: 0, // optional, defaults to 2dp
          color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
          labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
          style: { borderRadius: 16 },
          propsForDots: { r: "6", strokeWidth: "2", stroke: "#ffa726" }
        }}
        bezier
        style={{ marginVertical: 8, borderRadius: 16 }}
      />

      <ThemedText type="subtitle" style={styles.sectionTitle}>Recent Transactions</ThemedText>

      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id || item._id || Math.random().toString()}
        renderItem={({ item }) => (
          <ThemedView style={styles.transactionItem}>
            <View>
              <ThemedText type="defaultSemiBold">${(item.total || item.amount || 0).toFixed(2)}</ThemedText>
              <ThemedText style={styles.itemText}>
                {Array.isArray(item.items) ? `${item.items.length} items` : (item.items || 'Sale')}
              </ThemedText>
            </View>
            <ThemedText style={styles.timeText}>
              {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </ThemedText>
          </ThemedView>
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
  container: {
    flex: 1,
    padding: 20,
  },
  backButton: {
    marginBottom: 16,
  },
  statsContainer: {
    marginTop: 20,
    gap: 16,
  },
  statItem: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 15,
    padding: 10,
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  dateText: {
    marginLeft: 8,
    fontWeight: '600',
  },
  sectionTitle: {
    marginTop: 30,
    marginBottom: 10,
  },
  listContent: {
    gap: 12,
    paddingBottom: 20,
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
  },
  timeText: {
    fontSize: 12,
    opacity: 0.6,
  },
  itemText: {
    fontSize: 14,
    opacity: 0.8,
  },
});