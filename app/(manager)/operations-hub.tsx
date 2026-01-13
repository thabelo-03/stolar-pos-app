import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function OperationsHub() {
  const { branchCode, shopName } = useLocalSearchParams();

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.shopTitle}>{shopName || "Stolar Branch"}</Text>
        <Text style={styles.branchCode}>ID: {branchCode}</Text>
      </View>

      <View style={styles.pulseContainer}>
        <View style={styles.liveIndicator}>
          <View style={styles.greenDot} />
          <Text style={styles.liveText}>LIVE OPERATIONS FEED</Text>
        </View>

        {/* Remote Monitoring Cards */}
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Current Cashier</Text>
            <Text style={styles.statValue}>None Active</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Total Sales Today</Text>
            <Text style={styles.statValue}>$0.00</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Remote Inventory Status</Text>
        <TouchableOpacity style={styles.actionItem}>
          <Ionicons name="alert-circle" size={24} color="#dc2626" />
          <Text style={styles.actionText}>Critical Low Stock (0 Items)</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionItem}>
          <Ionicons name="receipt" size={24} color="#1e40af" />
          <Text style={styles.actionText}>View Recent Receipts</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  header: { backgroundColor: '#1e40af', padding: 30, paddingTop: 60, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  shopTitle: { color: 'white', fontSize: 24, fontWeight: 'bold' },
  branchCode: { color: '#93c5fd', fontSize: 16 },
  pulseContainer: { padding: 20 },
  liveIndicator: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  greenDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#10b981', marginRight: 10 },
  liveText: { fontWeight: 'bold', color: '#64748b', fontSize: 12 },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  statBox: { backgroundColor: 'white', width: '48%', padding: 15, borderRadius: 15, elevation: 2 },
  statLabel: { color: '#64748b', fontSize: 12 },
  statValue: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginTop: 5 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e3a8a', marginVertical: 15 },
  actionItem: { backgroundColor: 'white', padding: 20, borderRadius: 15, flexDirection: 'row', alignItems: 'center', marginBottom: 10, elevation: 1 },
  actionText: { marginLeft: 15, fontSize: 16, color: '#1e293b' }
});