import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Use your actual computer IP
const API_BASE = 'http://192.168.54.12:5000/api';

export default function Dashboard() {
  const { role } = useLocalSearchParams();
  const [staff, setStaff] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // If Admin, fetch staff members
      if (role === 'admin') {
        const res = await fetch(`${API_BASE}/users`);
        const data = await res.json();
        setStaff(data);
      }

      // If Manager, fetch products to see stock levels
      if (role === 'manager' || role === 'admin') {
        const res = await fetch(`${API_BASE}/products`);
        const data = await res.json();
        setProducts(data);
      }
    } catch (error) {
      console.error("Fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  // --- COMPONENT: ADMIN VIEW ---
 // --- COMPONENT: ADMIN VIEW ---
  const AdminUI = () => (
    <View>
      <View style={[styles.statCard, { backgroundColor: '#1e3a8a' }]}>
        <Text style={styles.statLabel}>Total Staff Registered</Text>
        {/* WE USE THE STATE LENGTH HERE */}
        <Text style={styles.statValue}>{staff.length} Users</Text> 
      </View>
      
      <View style={[styles.statCard, { backgroundColor: '#334155', marginTop: 10 }]}>
        <Text style={styles.statLabel}>Active Shops</Text>
        <Text style={styles.statValue}>0 Shops</Text>
      </View>

      <Text style={styles.sectionTitle}>Admin Controls</Text>
      
      <TouchableOpacity style={styles.menuItem}>
        <Ionicons name="people" size={24} color="#1e40af" />
        <Text style={styles.menuText}>Manage Staff List</Text>
      </TouchableOpacity>
      
      {/* Optional: Show a mini list of users */}
      {staff.map((user: any) => (
        <View key={user._id} style={{ padding: 10, borderBottomWidth: 1, borderColor: '#eee' }}>
          <Text style={{ fontWeight: 'bold' }}>{user.name}</Text>
          <Text style={{ color: 'gray' }}>{user.role}</Text>
        </View>
      ))}
    </View>
  );

  // --- COMPONENT: MANAGER VIEW ---
  const ManagerUI = () => {
    // Logic to count low stock
    const lowStockCount = products.filter((p: any) => p.stockQuantity <= 5).length;

    return (
      <View>
        <View style={[styles.statCard, { backgroundColor: '#1e40af' }]}>
          <Text style={styles.statLabel}>Total Inventory Items</Text>
          <Text style={styles.statValue}>{products.length} Products</Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: '#dc2626', marginTop: 10 }]}>
          <Text style={styles.statLabel}>Items Needing Restock</Text>
          <Text style={styles.statValue}>{lowStockCount} Low</Text>
        </View>

        <Text style={styles.sectionTitle}>Inventory Actions</Text>
        <TouchableOpacity style={styles.menuItem}>
          <Ionicons name="cube" size={24} color="#1e40af" />
          <Text style={styles.menuText}>View All {products.length} Items</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // --- COMPONENT: CASHIER VIEW --- (Static for now until we build Sales logic)
  const CashierUI = () => (
    <View>
      <TouchableOpacity style={styles.posButton}>
        <Ionicons name="barcode-outline" size={40} color="white" />
        <Text style={styles.posButtonText}>START NEW SALE</Text>
      </TouchableOpacity>
      <View style={styles.statCardLight}>
        <Text style={styles.statLabelDark}>My Sales Today</Text>
        <Text style={styles.statValueDark}>$0.00</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingCenter}>
        <ActivityIndicator size="large" color="#1e40af" />
        <Text style={{ marginTop: 10 }}>Syncing with MongoDB...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.welcomeTxt}>Welcome Back,</Text>
        <Text style={styles.roleTxt}>{role?.toString().toUpperCase()}</Text>
        <TouchableOpacity onPress={fetchDashboardData} style={styles.refreshBtn}>
            <Ionicons name="refresh" size={20} color="white" />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {role === 'admin' && <AdminUI />}
        {role === 'manager' && <ManagerUI />}
        {role === 'cashier' && <CashierUI />}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { backgroundColor: '#1e40af', padding: 30, paddingTop: 60, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, position: 'relative' },
  refreshBtn: { position: 'absolute', right: 30, top: 65 },
  welcomeTxt: { color: '#bfdbfe', fontSize: 16 },
  roleTxt: { color: 'white', fontSize: 24, fontWeight: 'bold' },
  content: { padding: 20 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e3a8a', marginBottom: 15, marginTop: 20 },
  statCard: { padding: 20, borderRadius: 20, marginBottom: 10, elevation: 5 },
  statLabel: { color: '#bfdbfe', fontSize: 14 },
  statValue: { color: 'white', fontSize: 32, fontWeight: 'bold' },
  statCardLight: { padding: 20, borderRadius: 20, backgroundColor: 'white', borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 10 },
  statLabelDark: { color: '#64748b' },
  statValueDark: { color: '#1e40af', fontSize: 28, fontWeight: 'bold' },
  menuItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', padding: 18, borderRadius: 15, marginBottom: 12, elevation: 2 },
  menuText: { fontSize: 16, color: '#1e293b', fontWeight: 'bold' },
  qtyText: { fontWeight: 'bold', color: '#1e40af' },
  posButton: { backgroundColor: '#10b981', padding: 30, borderRadius: 20, alignItems: 'center', marginBottom: 20, elevation: 4 },
  posButtonText: { color: 'white', fontWeight: 'bold', fontSize: 18, marginTop: 10 },
  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' }
});