import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import React, { useState, useEffect, useCallback } from 'react';
import { FlatList, Platform, RefreshControl, StyleSheet, TouchableOpacity, View, ActivityIndicator } from 'react-native';

import { ThemedText } from '../../components/themed-text';
import { ThemedView } from '../../components/themed-view';
import { useThemeColor } from '../../hooks/use-theme-color';
import { API_BASE_URL } from '../config';

interface Transaction {
  id: string;
  time: string;
  amount: number;
  items: string;
}

interface SummaryData {
  totalSales: number;
  numberOfTransactions: number;
  transactions: Transaction[];
}

export default function DailySummaryScreen() {
  const router = useRouter();
  const textColor = useThemeColor({}, 'text');
  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);

  const fetchSummary = useCallback(async (selectedDate: Date) => {
    setLoading(true);
    setError(null);
    try {
      const dateString = selectedDate.toISOString().split('T')[0]; // YYYY-MM-DD
      const response = await fetch(`${API_BASE_URL}/sales/summary/${dateString}`);
      if (!response.ok) {
        throw new Error('Failed to fetch summary data');
      }
      const data = await response.json();
      setSummaryData(data);
    } catch (e) {
        if (e instanceof Error) {
            setError(e.message);
        } else {
            setError('An unknown error occurred');
        }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary(date);
  }, [date, fetchSummary]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchSummary(date).finally(() => setRefreshing(false));
  }, [date, fetchSummary]);

  const onChange = (event: any, selectedDate?: Date) => {
    setShowPicker(Platform.OS === 'ios');
    if (selectedDate) {
      setDate(selectedDate);
    }
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

      {loading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
          <ThemedText>Loading summary...</ThemedText>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <ThemedText style={styles.errorText}>Error: {error}</ThemedText>
        </View>
      ) : summaryData ? (
        <>
          <ThemedView style={styles.statsContainer}>
            <ThemedView style={styles.statItem}>
              <ThemedText type="subtitle">Total Sales</ThemedText>
              <ThemedText type="defaultSemiBold">${summaryData.totalSales.toFixed(2)}</ThemedText>
            </ThemedView>
            
            <ThemedView style={styles.statItem}>
              <ThemedText type="subtitle">Transactions</ThemedText>
              <ThemedText type="defaultSemiBold">{summaryData.numberOfTransactions}</ThemedText>
            </ThemedView>
          </ThemedView>

          <ThemedText type="subtitle" style={styles.sectionTitle}>Transactions</ThemedText>

          <FlatList
            data={summaryData.transactions}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <ThemedView style={styles.transactionItem}>
                <View>
                  <ThemedText type="defaultSemiBold">${item.amount.toFixed(2)}</ThemedText>
                  <ThemedText style={styles.itemText}>{item.items}</ThemedText>
                </View>
                <ThemedText style={styles.timeText}>{item.time}</ThemedText>
              </ThemedView>
            )}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            ListEmptyComponent={<ThemedText style={styles.centered}>No transactions for this day.</ThemedText>}
          />
        </>
      ) : null}
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
    flexShrink: 1,
  },
  centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center'
  },
  errorText: {
      color: 'red'
  }
});
