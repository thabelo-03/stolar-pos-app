import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { FlatList, Platform, RefreshControl, StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '../../components/themed-text';
import { ThemedView } from '../../components/themed-view';
import { useThemeColor } from '../../hooks/use-theme-color';

export default function DailySummaryScreen() {
  const router = useRouter();
  const textColor = useThemeColor({}, 'text');
  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const onChange = (event: any, selectedDate?: Date) => {
    setShowPicker(Platform.OS === 'ios');
    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    // TODO: Fetch updated data from API here
    setTimeout(() => setRefreshing(false), 1500);
  };

  const recentTransactions = [
    { id: '1', time: '10:23 AM', amount: 24.50, items: 'Coffee, Bagel' },
    { id: '2', time: '11:05 AM', amount: 12.00, items: 'Sandwich' },
    { id: '3', time: '11:45 AM', amount: 8.75, items: 'Tea, Cookie' },
    { id: '4', time: '12:30 PM', amount: 15.50, items: 'Salad, Water' },
  ];

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
          <ThemedText type="defaultSemiBold">$0.00</ThemedText>
        </ThemedView>
        
        <ThemedView style={styles.statItem}>
          <ThemedText type="subtitle">Transactions</ThemedText>
          <ThemedText type="defaultSemiBold">0</ThemedText>
        </ThemedView>
      </ThemedView>

      <ThemedText type="subtitle" style={styles.sectionTitle}>Recent Transactions</ThemedText>

      <FlatList
        data={recentTransactions}
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