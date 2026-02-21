import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { API_BASE_URL } from '../config';

// --- Types for robustness ---
interface ActivityItem {
  _id: string;
  type: 'sale' | 'user';
  date: Date;
  title: string;
  subtitle: string;
  amount?: number;
}

interface DashboardStats {
  users: number;
  products: number;
  sales: number;
}

// --- Helper Component (Defined outside to prevent re-renders) ---
const StatCard = ({ title, value, icon, gradientColors, loading }: any) => (
  <View style={styles.statCard}>
    <LinearGradient colors={gradientColors} style={styles.gradient}>
      <View style={styles.statContent}>
        <View style={styles.iconContainer}>
          <Ionicons name={icon} size={24} color="white" />
        </View>
        <View>
          <Text style={styles.statTitle}>{title}</Text>
          {loading ? (
            <ActivityIndicator size="small" color="white" style={{ alignSelf: 'flex-start' }} />
          ) : (
            <Text style={styles.statValue}>{value}</Text>
          )}
        </View>
      </View>
    </LinearGradient>
  </View>
);

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>({ users: 0, products: 0, sales: 0 });
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      // Don't set loading=true if we are just refreshing (keeps UI smooth)
      if (!refreshing) setLoading(true);

      const [usersRes, productsRes, salesRes, recentSalesRes, recentUsersRes] = await Promise.all([
        fetch(`${API_BASE_URL}/users`),
        fetch(`${API_BASE_URL}/products`),
        fetch(`${API_BASE_URL}/sales/recent`), // Get all sales for total calc
        fetch(`${API_BASE_URL}/sales/recent?limit=5`), // Get last 5 for activity feed
        fetch(`${API_BASE_URL}/users?limit=5`), // Get last 5 users
      ]);

      const usersData = await usersRes.json();
      const productsData = await productsRes.json();
      const salesData = await salesRes.json();
      const recentSalesData = await recentSalesRes.json();
      const recentUsersData = await recentUsersRes.json();

      // Safe Data Handling
      const safeUsers = Array.isArray(usersData) ? usersData : [];
      const safeProducts = Array.isArray(productsData) ? productsData : [];
      const safeSales = Array.isArray(salesData) ? salesData : [];
      const safeRecentSales = Array.isArray(recentSalesData) ? recentSalesData : [];
      const safeRecentUsers = Array.isArray(recentUsersData) ? recentUsersData : [];

      // 1. Calculate System Revenue (MRR) based on Manager Plans
      const totalRevenue = safeUsers.reduce((acc: number, user: any) => {
        if (user.role === 'manager') {
          const count = user.shopCount || 0;
          // Premium (2+ shops) = R400, Standard = R150
          return acc + (count >= 2 ? 400 : 150);
        }
        return acc;
      }, 0);

      // 2. Process Recent Activity (Combine Sales & Users)
      const usersActivity = safeRecentUsers.map((user: any) => ({
        _id: user._id,
        type: 'user',
        date: new Date(user.createdAt || Date.now()),
        title: `New User: ${user.name}`,
        subtitle: `Role: ${user.role} • ${user.email}`,
      }));

      // Combine and Sort by newest first
      const combined = [...usersActivity]
        .sort((a, b) => b.date.getTime() - a.date.getTime())
        .slice(0, 10); // Keep only top 10

      setStats({
        users: safeUsers.length,
        products: safeProducts.length,
        sales: totalRevenue,
      });
      setRecentActivity(combined as ActivityItem[]);

    } catch (error) {
      console.error('Failed to fetch admin stats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshing]);

  // Initial Fetch
  useEffect(() => {
    fetchStats();
  }, []);

  // Pull to Refresh Handler
  const onRefresh = () => {
    setRefreshing(true);
    fetchStats();
  };

  const handleLogout = async () => {
    await AsyncStorage.clear();
    router.replace('/(auth)/login');
  };

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1e3a8a']} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSubtitle}>System Overview</Text>
          <Text style={styles.headerTitle}>Master Console</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={styles.headerIcon}>
             <Ionicons name="shield-checkmark" size={28} color="#60a5fa" />
          </View>
          <TouchableOpacity onPress={handleLogout} style={[styles.headerIcon, { backgroundColor: 'rgba(239, 68, 68, 0.2)' }]}>
             <Ionicons name="log-out-outline" size={28} color="#fca5a5" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.content}>
        
        {/* Quick Stats Grid */}
        <View style={styles.statsContainer}>
          <View style={styles.statsRow}>
            <StatCard 
              title="Monthly Revenue" 
              value={`R${stats.sales.toFixed(2)}`} 
              icon="cash-outline" 
              gradientColors={['#059669', '#10b981']} // Green
              loading={loading}
            />
            <StatCard 
              title="Total Users" 
              value={stats.users} 
              icon="people-outline" 
              gradientColors={['#2563eb', '#3b82f6']} // Blue
              loading={loading}
            />
          </View>
          <View style={styles.statsRow}>
             <StatCard 
              title="Inventory" 
              value={stats.products} 
              icon="cube-outline" 
              gradientColors={['#d97706', '#f59e0b']} // Orange
              loading={loading}
            />
             <StatCard 
              title="System Health" 
              value="100%" 
              icon="pulse-outline" 
              gradientColors={['#7c3aed', '#8b5cf6']} // Purple
              loading={loading}
            />
          </View>
        </View>

        <Text style={styles.sectionLabel}>Management Tools</Text>
        
        {/* Navigation Grid */}
        <View style={styles.grid}>
          <TouchableOpacity 
            style={styles.gridItem} 
            onPress={() => router.push('/(admin)/manage-staff')}
          >
            <View style={[styles.iconBox, { backgroundColor: '#eff6ff' }]}>
              <Ionicons name="people" size={28} color="#1e40af" />
            </View>
            <Text style={styles.gridText}>Staff List</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.gridItem}
            onPress={() => router.push('/(admin)/all-products')}
          >
            <View style={[styles.iconBox, { backgroundColor: '#ecfdf5' }]}>
              <Ionicons name="cart" size={28} color="#059669" />
            </View>
            <Text style={styles.gridText}>Products</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.gridItem}
            onPress={() => router.push('/(admin)/sales-reports')}
          >
            <View style={[styles.iconBox, { backgroundColor: '#fff7ed' }]}>
              <Ionicons name="stats-chart" size={28} color="#ea580c" />
            </View>
            <Text style={styles.gridText}>Reports</Text>
          </TouchableOpacity>
        
          <TouchableOpacity 
            style={styles.gridItem}
            onPress={() => router.push('/(admin)/system-logs')}
          >
            <View style={[styles.iconBox, { backgroundColor: '#f5f3ff' }]}>
              <Ionicons name="terminal" size={28} color="#7c3aed" />
            </View>
            <Text style={styles.gridText}>System Logs</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Activity Feed */}
        <Text style={styles.sectionLabel}>Live Feed</Text>
        <View style={styles.activityCard}>
          {loading && !refreshing ? (
            <ActivityIndicator color="#1e3a8a" style={{ padding: 20 }} />
          ) : recentActivity.length === 0 ? (
            <Text style={styles.emptyText}>No recent activity found.</Text>
          ) : (
            recentActivity.map((activity) => (
              <View key={activity._id} style={styles.activityItem}>
                <View style={[
                  styles.activityIcon, 
                  { backgroundColor: activity.type === 'sale' ? '#ecfdf5' : '#eff6ff' }
                ]}>
                  <Ionicons 
                    name={activity.type === 'sale' ? "receipt" : "person-add"} 
                    size={20} 
                    color={activity.type === 'sale' ? "#10b981" : "#3b82f6"} 
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.activityTitleText}>{activity.title}</Text>
                  <Text style={styles.activitySubtitle}>{activity.subtitle}</Text>
                </View>
                <Text style={styles.activityDate}>
                  {activity.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={{ height: 40 }} /> 
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  
  // Header
  header: { 
    backgroundColor: '#1e3a8a', 
    padding: 24, 
    paddingTop: 60, 
    borderBottomLeftRadius: 32, 
    borderBottomRightRadius: 32,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  headerSubtitle: { color: '#93c5fd', fontSize: 14, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  headerTitle: { color: 'white', fontSize: 26, fontWeight: '800', marginTop: 4 },
  headerIcon: { backgroundColor: 'rgba(255,255,255,0.1)', padding: 10, borderRadius: 16 },

  content: { padding: 20 },

  // Stats
  statsContainer: { marginBottom: 24 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  statCard: { width: '48%', borderRadius: 20, overflow: 'hidden', elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4 },
  gradient: { padding: 16, height: 110, justifyContent: 'center' },
  statContent: { flexDirection: 'column', height: '100%', justifyContent: 'space-between' },
  iconContainer: { 
    width: 40, height: 40, borderRadius: 12, 
    backgroundColor: 'rgba(255, 255, 255, 0.2)', 
    justifyContent: 'center', alignItems: 'center', marginBottom: 8 
  },
  statTitle: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '500' },
  statValue: { color: 'white', fontSize: 22, fontWeight: 'bold' },

  sectionLabel: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginBottom: 16, marginLeft: 4 },

  // Navigation Grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 24 },
  gridItem: { 
    backgroundColor: 'white', width: '48%', padding: 16, borderRadius: 20, 
    alignItems: 'center', marginBottom: 16, 
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }
  },
  iconBox: { padding: 14, borderRadius: 16, marginBottom: 12 },
  gridText: { fontWeight: '700', color: '#334155', fontSize: 14 },

  // Activity Feed
  activityCard: { backgroundColor: 'white', padding: 20, borderRadius: 24, elevation: 2 },
  activityItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 16 },
  activityIcon: { padding: 10, borderRadius: 12 },
  activityTitleText: { color: '#1e293b', fontSize: 15, fontWeight: '600' },
  activitySubtitle: { color: '#64748b', fontSize: 13, marginTop: 2 },
  activityDate: { fontSize: 12, color: '#94a3b8', fontWeight: '500' },
  emptyText: { textAlign: 'center', color: '#94a3b8', fontStyle: 'italic', padding: 10 }
});