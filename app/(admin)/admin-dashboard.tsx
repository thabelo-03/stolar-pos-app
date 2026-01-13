import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const API_BASE = 'http://192.168.54.12:5000/api';

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState({ users: 0, products: 0, sales: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In a real app, you'd fetch combined stats here
    setLoading(false);
  }, []);

  const StatCard = ({ title, value, icon, color }) => (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <View>
        <Text style={styles.statTitle}>{title}</Text>
        <Text style={styles.statValue}>{value}</Text>
      </View>
      <Ionicons name={icon} size={30} color={color} />
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerSubtitle}>System Overview</Text>
        <Text style={styles.headerTitle}>Stolar Master Console</Text>
      </View>

      <View style={styles.content}>
        {/* Quick Stats Row */}
        <View style={styles.statsRow}>
          <StatCard title="Revenue" value="$1,240" icon="cash-outline" color="#10b981" />
          <StatCard title="Staff" value="3" icon="people-outline" color="#3b82f6" />
        </View>

        <Text style={styles.sectionLabel}>System Controls</Text>
        
        {/* Navigation Grid */}
        <View style={styles.grid}>
          <TouchableOpacity 
            style={styles.gridItem} 
            onPress={() => router.push('/(admin)/manage-staff')}
          >
            <View style={[styles.iconBox, { backgroundColor: '#eff6ff' }]}>
              <Ionicons name="people" size={28} color="#1e40af" />
            </View>
            <Text style={styles.gridText}>Manage Staff</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.gridItem}>
            <View style={[styles.iconBox, { backgroundColor: '#ecfdf5' }]}>
              <Ionicons name="cart" size={28} color="#059669" />
            </View>
            <Text style={styles.gridText}>All Products</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.gridItem}>
            <View style={[styles.iconBox, { backgroundColor: '#fff7ed' }]}>
              <Ionicons name="stats-chart" size={28} color="#ea580c" />
            </View>
            <Text style={styles.gridText}>Sales Reports</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.gridItem}>
            <View style={[styles.iconBox, { backgroundColor: '#f5f3ff' }]}>
              <Ionicons name="settings" size={28} color="#7c3aed" />
            </View>
            <Text style={styles.gridText}>System Logs</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionLabel}>Recent Activity</Text>
        <View style={styles.activityCard}>
          <Text style={styles.activityText}>🟢 Server Status: Online</Text>
          <Text style={styles.activityText}>👤 New Staff Registered: Thabelo</Text>
          <Text style={styles.activityText}>📦 Stock Alert: Maize Flour Low</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { backgroundColor: '#1e3a8a', padding: 25, paddingTop: 60, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerSubtitle: { color: '#93c5fd', fontSize: 14 },
  headerTitle: { color: 'white', fontSize: 24, fontWeight: 'bold' },
  content: { padding: 20 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  statCard: { backgroundColor: 'white', width: '48%', padding: 15, borderRadius: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderLeftWidth: 5, elevation: 3 },
  statTitle: { color: '#64748b', fontSize: 12 },
  statValue: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
  sectionLabel: { fontSize: 16, fontWeight: 'bold', color: '#1e3a8a', marginVertical: 15 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  gridItem: { backgroundColor: 'white', width: '48%', padding: 20, borderRadius: 20, alignItems: 'center', marginBottom: 15, elevation: 2 },
  iconBox: { padding: 12, borderRadius: 15, marginBottom: 10 },
  gridText: { fontWeight: 'bold', color: '#1e293b', fontSize: 13 },
  activityCard: { backgroundColor: 'white', padding: 20, borderRadius: 20, elevation: 2 },
  activityText: { color: '#475569', fontSize: 14, marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 5 }
});