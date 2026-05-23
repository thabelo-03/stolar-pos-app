import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  shops: number;
  estimatedMRR: number;
  totalCashEarnings: number;
}

// --- Helper Component (Defined outside to prevent re-renders) ---
const StatCard = ({ title, value, icon, gradientColors, loading }: any) => (
  <View style={styles.statCard}>
    <LinearGradient colors={gradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradient}>
      <View style={styles.statContent}>
        <View style={styles.iconContainer}>
          <Ionicons name={icon} size={20} color="white" />
        </View>
        <View>
          <Text style={styles.statTitle}>{title}</Text>
          {loading ? (
            <ActivityIndicator size="small" color="white" style={{ alignSelf: 'flex-start', marginTop: 4 }} />
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
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState<DashboardStats>({
    users: 0,
    shops: 0,
    estimatedMRR: 0,
    totalCashEarnings: 0
  });
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      if (!refreshing) setLoading(true);

      const [usersRes, shopsRes, historyRes, recentUsersRes] = await Promise.all([
        fetch(`${API_BASE_URL}/users`),
        fetch(`${API_BASE_URL}/shops`),
        fetch(`${API_BASE_URL}/admin/payment-history`),
        fetch(`${API_BASE_URL}/users?limit=5`),
      ]);

      const usersData = await usersRes.json();
      const shopsData = await shopsRes.json();
      const historyData = await historyRes.json();
      const recentUsersData = await recentUsersRes.json();

      const safeUsers = Array.isArray(usersData) ? usersData : [];
      const safeShops = Array.isArray(shopsData) ? shopsData : [];
      const safeRecentUsers = Array.isArray(recentUsersData) ? recentUsersData : [];
      const totalCashRevenue = historyData?.totalAmount || 0;

      // Calculate MRR from active manager subscriptions
      const mrr = safeUsers.reduce((acc: number, user: any) => {
        if (user.role === 'manager') {
          const isExpired = user.subscriptionExpiry 
            ? new Date(user.subscriptionExpiry) < new Date() 
            : false;
          if (isExpired) return acc;

          const count = user.shopCount || 0;
          return acc + (count >= 2 ? 400 : 150);
        }
        return acc;
      }, 0);

      const usersActivity = safeRecentUsers.map((user: any) => ({
        _id: user._id,
        type: 'user',
        date: new Date(user.createdAt || Date.now()),
        title: `New User: ${user.name}`,
        subtitle: `Role: ${user.role} • ${user.email}`,
      }));

      const combined = [...usersActivity]
        .sort((a, b) => b.date.getTime() - a.date.getTime())
        .slice(0, 10);

      setStats({
        users: safeUsers.length,
        shops: safeShops.length,
        estimatedMRR: mrr,
        totalCashEarnings: totalCashRevenue,
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
    <View style={styles.container}>
      <LinearGradient 
        colors={['#0284c7', '#0ea5e9', '#38bdf8']} 
        start={{ x: 0, y: 0 }} 
        end={{ x: 1, y: 1 }} 
        style={[styles.header, { paddingTop: insets.top + 15 }]}
      >
        <View>
          <Text style={styles.headerSubtitle}>System Overview</Text>
          <Text style={styles.headerTitle}>Master Console</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={styles.headerIcon}>
             <Ionicons name="shield-checkmark" size={24} color="#7dd3fc" />
          </View>
          <TouchableOpacity onPress={handleLogout} style={[styles.headerIcon, { backgroundColor: 'rgba(244, 63, 94, 0.2)' }]}>
             <Ionicons name="log-out-outline" size={24} color="#f43f5e" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0ea5e9']} tintColor="#0ea5e9" />
        }
      >
        {/* Quick Stats Grid */}
        <View style={styles.statsContainer}>
          <View style={styles.statsRow}>
            <StatCard 
              title="Total Cash Collected" 
              value={`R${stats.totalCashEarnings.toFixed(2)}`} 
              icon="cash-outline" 
              gradientColors={['#10b981', '#059669']} 
              loading={loading}
            />
            <StatCard 
              title="Active Monthly MRR" 
              value={`R${stats.estimatedMRR.toFixed(2)}`} 
              icon="stats-chart-outline" 
              gradientColors={['#0284c7', '#0ea5e9']} 
              loading={loading}
            />
          </View>
          <View style={styles.statsRow}>
             <StatCard 
               title="Registered Shops" 
               value={stats.shops} 
               icon="storefront-outline" 
               gradientColors={['#f59e0b', '#d97706']} 
               loading={loading}
             />
             <StatCard 
              title="Platform Users" 
              value={stats.users} 
              icon="people-outline" 
              gradientColors={['#0ea5e9', '#38bdf8']} 
              loading={loading}
            />
          </View>
        </View>

        <Text style={styles.sectionLabel}>Management Tools</Text>
        
        {/* Navigation Grid */}
        <View style={styles.grid}>
          <TouchableOpacity 
            style={styles.gridItem} 
            onPress={() => router.push('/(admin)/manage-users')}
          >
            <View style={[styles.iconBox, { backgroundColor: '#f0f9ff' }]}>
              <Ionicons name="people" size={24} color="#0ea5e9" />
            </View>
            <Text style={styles.gridText}>Manage Users</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.gridItem}
            onPress={() => router.push('/(admin)/shops')}
          >
            <View style={[styles.iconBox, { backgroundColor: '#ecfdf5' }]}>
              <Ionicons name="storefront" size={24} color="#10b981" />
            </View>
            <Text style={styles.gridText}>Shops</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.gridItem}
            onPress={() => router.push('/(admin)/subscription-reports')}
          >
            <View style={[styles.iconBox, { backgroundColor: '#fff7ed' }]}>
              <Ionicons name="bar-chart" size={24} color="#f59e0b" />
            </View>
            <Text style={styles.gridText}>Subscription Reports</Text>
          </TouchableOpacity>
        
          <TouchableOpacity 
            style={styles.gridItem}
            onPress={() => router.push('/(admin)/system-logs')}
          >
            <View style={[styles.iconBox, { backgroundColor: '#f0f9ff' }]}>
              <Ionicons name="terminal" size={24} color="#0ea5e9" />
            </View>
            <Text style={styles.gridText}>System Logs</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Activity Feed */}
        <Text style={styles.sectionLabel}>Live Feed</Text>
        <View style={styles.activityCard}>
          {loading && !refreshing ? (
            <ActivityIndicator color="#0ea5e9" style={{ padding: 20 }} />
          ) : recentActivity.length === 0 ? (
            <Text style={styles.emptyText}>No recent activity found.</Text>
          ) : (
            recentActivity.map((activity) => (
              <View key={activity._id} style={styles.activityItem}>
                <View style={[
                  styles.activityIcon, 
                  { backgroundColor: activity.type === 'sale' ? '#ecfdf5' : '#f0f9ff' }
                ]}>
                  <Ionicons 
                    name={activity.type === 'sale' ? "receipt" : "person-add"} 
                    size={18} 
                    color={activity.type === 'sale' ? "#10b981" : "#0ea5e9"} 
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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f9ff' },
  
  // Header
  header: { 
    paddingHorizontal: 20, 
    paddingBottom: 20, 
    borderBottomLeftRadius: 24, 
    borderBottomRightRadius: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  headerTitle: { color: 'white', fontSize: 22, fontWeight: 'bold', marginTop: 2, letterSpacing: 0.5 },
  headerIcon: { backgroundColor: 'rgba(255,255,255,0.2)', padding: 8, borderRadius: 12 },

  scrollContent: { padding: 20 },

  // Stats
  statsContainer: { marginBottom: 10 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  statCard: { width: '48%', borderRadius: 20, overflow: 'hidden', shadowColor: '#0284c7', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 4 },
  gradient: { padding: 16, height: 110, justifyContent: 'center' },
  statContent: { flexDirection: 'column', height: '100%', justifyContent: 'space-between' },
  iconContainer: { 
    width: 36, height: 36, borderRadius: 10, 
    backgroundColor: 'rgba(255, 255, 255, 0.2)', 
    justifyContent: 'center', alignItems: 'center', marginBottom: 4
  },
  statTitle: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '600' },
  statValue: { color: 'white', fontSize: 20, fontWeight: 'bold' },

  sectionLabel: { fontSize: 16, fontWeight: 'bold', color: '#475569', marginVertical: 14, marginLeft: 4 },

  // Navigation Grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 10 },
  gridItem: { 
    backgroundColor: 'white', width: '48%', padding: 16, borderRadius: 20, 
    alignItems: 'center', marginBottom: 16, 
    shadowColor: '#0284c7', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 16, elevation: 4
  },
  iconBox: { padding: 12, borderRadius: 14, marginBottom: 10 },
  gridText: { fontWeight: '700', color: '#475569', fontSize: 13 },

  // Activity Feed
  activityCard: { backgroundColor: 'white', padding: 20, borderRadius: 20, shadowColor: '#0284c7', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 16, elevation: 4 },
  activityItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f0f9ff', paddingBottom: 16 },
  activityIcon: { padding: 8, borderRadius: 10 },
  activityTitleText: { color: '#0f172a', fontSize: 14, fontWeight: '600' },
  activitySubtitle: { color: '#64748b', fontSize: 12, marginTop: 2 },
  activityDate: { fontSize: 11, color: '#94a3b8', fontWeight: '500' },
  emptyText: { textAlign: 'center', color: '#94a3b8', fontStyle: 'italic', padding: 10 }
});