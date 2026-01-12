import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function ProfitLoss() {
  const [date, setDate] = useState(new Date());
  const [show, setShow] = useState(false);

  const onChange = (event: any, selectedDate?: Date) => {
    setShow(Platform.OS === 'ios');
    if (selectedDate) setDate(selectedDate);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profit & Loss Analysis</Text>
      </View>

      <View style={styles.filterSection}>
        <Text style={styles.label}>Filter by Date:</Text>
        <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShow(true)}>
          <Ionicons name="calendar" size={20} color="#1e40af" />
          <Text style={styles.dateText}>{date.toDateString()}</Text>
        </TouchableOpacity>
      </View>

      {show && (
        <DateTimePicker
          value={date}
          mode="date"
          display="default"
          onChange={onChange}
        />
      )}

      {/* Financial Summary Cards */}
      <View style={styles.reportContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Revenue</Text>
          <Text style={[styles.statValue, { color: '#1e40af' }]}>$1,250.00</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Expenses</Text>
          <Text style={[styles.statValue, { color: '#ef4444' }]}>$450.00</Text>
        </View>
        <View style={[styles.statCard, styles.profitCard]}>
          <Text style={styles.profitLabel}>Net Profit</Text>
          <Text style={styles.profitValue}>$800.00</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { backgroundColor: '#1e40af', padding: 25, paddingTop: 60 },
  headerTitle: { color: 'white', fontSize: 22, fontWeight: 'bold' },
  filterSection: { padding: 20, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  label: { color: '#64748b', marginBottom: 10, fontWeight: 'bold' },
  datePickerBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eff6ff', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#bfdbfe' },
  dateText: { marginLeft: 10, fontSize: 16, color: '#1e40af', fontWeight: 'bold' },
  reportContainer: { padding: 20 },
  statCard: { backgroundColor: 'white', padding: 20, borderRadius: 15, marginBottom: 15, elevation: 2 },
  statLabel: { color: '#64748b', fontSize: 14 },
  statValue: { fontSize: 24, fontWeight: 'bold', marginTop: 5 },
  profitCard: { backgroundColor: '#10b981' },
  profitLabel: { color: '#ecfdf5', fontSize: 14 },
  profitValue: { color: 'white', fontSize: 28, fontWeight: 'bold', marginTop: 5 }
});