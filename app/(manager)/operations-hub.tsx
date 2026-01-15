import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Modal, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import CalendarView from '../../components/ui/CalendarView';

// Assume a type for your sales data for better type-checking
interface SalesData {
  totalRevenue: string;
  profit: string;
  dailySales: string;
  stockHealth: string;
  mostDemandedProduct: string;
}

export default function OperationHub() {
  const router = useRouter();
  const { branchCode, shopName } = useLocalSearchParams();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isCalendarVisible, setCalendarVisible] = useState(false);

  // Dummy data for now
  const salesData: SalesData = {
    totalRevenue: 'R250,000',
    profit: 'R50,000',
    dailySales: 'R5,000',
    stockHealth: '95%',
    mostDemandedProduct: 'Product X'
  };

  const handleDateSelect = (date: string) => {
    setSelectedDate(new Date(date));
    setCalendarVisible(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerSubtitle}>Operational Hub</Text>
          <Text style={styles.headerTitle}>{shopName}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{branchCode}</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Date Selector */}
        <View style={styles.dateSelector}>
          <Text style={styles.dateLabel}>Sales data for:</Text>
          <TouchableOpacity onPress={() => setCalendarVisible(true)}>
            <Text style={styles.dateText}>{selectedDate.toDateString()}</Text>
          </TouchableOpacity>
        </View>

        {/* Key Metrics */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Key Metrics</Text>
          <View style={styles.metricsGrid}>
            <View style={[styles.metricCard, {backgroundColor: '#e0f2fe'}]}>
              <Text style={styles.metricLabel}>Total Revenue</Text>
              <Text style={styles.metricValue}>{salesData.totalRevenue}</Text>
            </View>
            <View style={[styles.metricCard, {backgroundColor: '#dcfce7'}]}>
              <Text style={styles.metricLabel}>Profit</Text>
              <Text style={styles.metricValue}>{salesData.profit}</Text>
            </View>
            <View style={[styles.metricCard, {backgroundColor: '#fef3c7'}]}>
              <Text style={styles.metricLabel}>Daily Sales</Text>
              <Text style={styles.metricValue}>{salesData.dailySales}</Text>
            </View>
            <View style={[styles.metricCard, {backgroundColor: '#fce7f3'}]}>
              <Text style={styles.metricLabel}>Stock Health</Text>
              <Text style={styles.metricValue}>{salesData.stockHealth}</Text>
            </View>
          </View>
        </View>
        
        {/* Product on Demand */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Product on Demand</Text>
          <View style={styles.demandCard}>
            <MaterialCommunityIcons name="trophy-award" size={28} color="#f59e0b" />
            <Text style={styles.demandText}>{salesData.mostDemandedProduct}</Text>
          </View>
        </View>
      </ScrollView>

      <CalendarView
        visible={isCalendarVisible}
        onClose={() => setCalendarVisible(false)}
        onSelectDate={handleDateSelect}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { backgroundColor: '#1e40af', padding: 25, paddingTop: 50, flexDirection: 'row', alignItems: 'center' },
  backButton: { marginRight: 20 },
  headerSubtitle: { color: '#bfdbfe', fontSize: 12, textTransform: 'uppercase' },
  headerTitle: { color: 'white', fontSize: 22, fontWeight: 'bold' },
  badge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 5, marginTop: 5, alignSelf: 'flex-start' },
  badgeText: { color: 'white', fontSize: 12, fontWeight: 'bold' },
  content: { padding: 20 },
  dateSelector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  dateLabel: { fontSize: 16, color: '#475569' },
  dateText: { fontSize: 16, fontWeight: 'bold', color: '#1e40af' },
  section: { marginBottom: 25 },
  sectionLabel: { fontSize: 16, fontWeight: 'bold', color: '#1e3a8a', marginBottom: 15 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  metricCard: { width: '48%', padding: 15, borderRadius: 10, marginBottom: 15, elevation: 1 },
  metricLabel: { color: '#374151', fontSize: 14 },
  metricValue: { color: '#1f2937', fontSize: 22, fontWeight: 'bold', marginTop: 5 },
  demandCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', padding: 20, borderRadius: 10, elevation: 2 },
  demandText: { marginLeft: 15, fontSize: 18, fontWeight: 'bold', color: '#334155' }
});