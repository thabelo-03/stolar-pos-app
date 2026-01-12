import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Alert, Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const { width } = Dimensions.get('window');

export default function MultiRoleDashboard() {
  const { role } = useLocalSearchParams();
  const router = useRouter();

  // --- COMPONENT: FEATURE CARD ---
  const FeatureTile = ({ icon, title, subtitle, color, onPress }: any) => (
    <TouchableOpacity style={styles.tile} onPress={onPress}>
      <View style={[styles.iconCircle, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <Text style={styles.tileTitle}>{title}</Text>
      <Text style={styles.tileSub}>{subtitle}</Text>
    </TouchableOpacity>
  );

  // --- VIEW: CASHIER (Sales Focus) ---
  const CashierView = () => (
    <View style={styles.grid}>
      <TouchableOpacity style={styles.wideBtn} onPress={() => router.push('/scanner')}>
        <Ionicons name="barcode" size={30} color="white" />
        <Text style={styles.wideBtnText}>SELL / SCAN ITEM</Text>
      </TouchableOpacity>
      <FeatureTile icon="add-circle" title="Add Stock" subtitle="Quick Entry" color="#10b981" />
      <FeatureTile icon="calculator" title="Change" subtitle="Calculator" color="#f59e0b" />
      <FeatureTile icon="document-text" title="Daily Report" subtitle="My Sales" color="#6366f1" />
      <FeatureTile icon="cart" title="Selling" subtitle="Cart View" color="#ec4899" />
    </View>
  );

  // --- VIEW: MANAGER (Operations & Analysis) ---
  const ManagerView = () => (
    <View style={styles.grid}>
      <FeatureTile icon="layers" title="Stock Levels" subtitle="By Category" color="#1e40af" />
      <FeatureTile icon="trending-up" title="Profit/Loss" subtitle="Date Filter" color="#10b981" />
      <FeatureTile icon="file-tray-full" title="New Stock" subtitle="Recorded" color="#8b5cf6" />
      <FeatureTile icon="stats-chart" title="Demand" subtitle="Analysys" color="#f59e0b" />
      <FeatureTile icon="pricetag" title="Price Control" subtitle="Edit Prices" color="#ef4444" />
      <FeatureTile icon="notifications" title="Alerts" subtitle="View All" color="#06b6d4" />
    </View>
  );

  // --- VIEW: ADMINISTRATOR (System Control) ---
  const AdminView = () => (
    <View style={styles.grid}>
      <FeatureTile icon="business" title="Shops" subtitle="12 Locations" color="#1e40af" />
      <FeatureTile icon="people" title="Users" subtitle="45 Active" color="#1e40af" />
      <FeatureTile icon="card" title="Subscriptions" subtitle="Paid/Unpaid" color="#10b981" />
      <FeatureTile icon="lock-open" title="Permissions" subtitle="Block/Unblock" color="#ef4444" />
      <FeatureTile icon="mail" title="Contact" subtitle="Message Users" color="#6366f1" />
      <FeatureTile icon="refresh-circle" title="Server" subtitle="Restart" color="#f59e0b" onPress={() => Alert.alert("System", "Restarting Server...")} />
      <FeatureTile icon="settings" title="App Settings" subtitle="Updates" color="#64748b" />
      <FeatureTile icon="key" title="Passwords" subtitle="Reset User" color="#ec4899" />
    </View>
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.brand}>Stolar POS</Text>
          <TouchableOpacity style={styles.notifBtn}>
            <Ionicons name="notifications" size={22} color="white" />
          </TouchableOpacity>
        </View>
        <Text style={styles.roleLabel}>{role?.toString().toUpperCase()} DASHBOARD</Text>
      </View>

      <View style={styles.content}>
        {role === 'cashier' && <CashierView />}
        {role === 'manager' && <ManagerView />}
        {role === 'admin' && <AdminView />}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  header: { backgroundColor: '#1e40af', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 30, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { color: 'white', fontSize: 22, fontWeight: '900', letterSpacing: 1 },
  roleLabel: { color: '#bfdbfe', fontSize: 14, fontWeight: 'bold', marginTop: 10 },
  notifBtn: { backgroundColor: 'rgba(255,255,255,0.2)', padding: 8, borderRadius: 12 },
  content: { padding: 15 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  tile: { backgroundColor: 'white', width: width * 0.44, padding: 20, borderRadius: 24, marginBottom: 15, elevation: 3, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10 },
  iconCircle: { width: 50, height: 50, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  tileTitle: { fontSize: 15, fontWeight: 'bold', color: '#1e293b' },
  tileSub: { fontSize: 11, color: '#64748b', marginTop: 4 },
  wideBtn: { backgroundColor: '#10b981', width: '100%', padding: 25, borderRadius: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20, elevation: 4 },
  wideBtnText: { color: 'white', fontWeight: 'bold', fontSize: 18, marginLeft: 15 }
});