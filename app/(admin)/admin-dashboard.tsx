import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_BASE_URL } from '../config';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Types ───────────────────────────────────────────────────────────────────
interface DashboardStats {
  users: number;
  shops: number;
  estimatedMRR: number;
  totalCashEarnings: number;
  activeManagers: number;
  expiredManagers: number;
}

interface ActivityItem {
  _id: string;
  type: 'sale' | 'user';
  date: Date;
  title: string;
  subtitle: string;
  amount?: number;
}

// ─── KPI Card Component ───────────────────────────────────────────────────────
const KpiCard = ({
  title, value, icon, accent, loading, sub
}: {
  title: string; value: string; icon: any; accent: string; loading: boolean; sub?: string;
}) => {
  const glowAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.4, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={[styles.kpiCard, { borderColor: accent + '30' }]}>
      <Animated.View style={[styles.kpiAccentBar, { backgroundColor: accent, opacity: glowAnim }]} />
      <View style={[styles.kpiIconRing, { backgroundColor: accent + '20', borderColor: accent + '40' }]}>
        <Ionicons name={icon} size={18} color={accent} />
      </View>
      <Text style={styles.kpiTitle}>{title}</Text>
      {loading ? (
        <ActivityIndicator size="small" color={accent} style={{ marginTop: 6 }} />
      ) : (
        <Text style={[styles.kpiValue, { color: accent }]}>{value}</Text>
      )}
      {sub && !loading && <Text style={styles.kpiSub}>{sub}</Text>}
    </View>
  );
};

// ─── Nav Tile Component ───────────────────────────────────────────────────────
const NavTile = ({
  label, icon, accent, onPress, badge
}: {
  label: string; icon: any; accent: string; onPress: () => void; badge?: string;
}) => (
  <TouchableOpacity style={styles.navTile} onPress={onPress} activeOpacity={0.75}>
    <View style={[styles.navIconBox, { backgroundColor: accent + '18', borderColor: accent + '35' }]}>
      <Ionicons name={icon} size={22} color={accent} />
    </View>
    {badge && (
      <View style={[styles.navBadge, { backgroundColor: accent }]}>
        <Text style={styles.navBadgeText}>{badge}</Text>
      </View>
    )}
    <Text style={styles.navTileLabel}>{label}</Text>
  </TouchableOpacity>
);

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [stats, setStats] = useState<DashboardStats>({
    users: 0, shops: 0, estimatedMRR: 0,
    totalCashEarnings: 0, activeManagers: 0, expiredManagers: 0,
  });
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [chartPoints, setChartPoints] = useState<{ label: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [clock, setClock] = useState('');

  // Live clock
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const fetchStats = useCallback(async (isRefreshing = false) => {
    try {
      if (!isRefreshing) setLoading(true);
      const [usersRes, shopsRes, historyRes] = await Promise.all([
        fetch(`${API_BASE_URL}/users`),
        fetch(`${API_BASE_URL}/shops`),
        fetch(`${API_BASE_URL}/admin/payment-history`),
      ]);

      const usersData = await usersRes.json();
      const shopsData = await shopsRes.json();
      const historyData = await historyRes.json();

      const safeUsers: any[] = Array.isArray(usersData) ? usersData : [];
      const safeShops: any[] = Array.isArray(shopsData) ? shopsData : [];
      const rawPayments: any[] = Array.isArray(historyData?.history) ? historyData.history : [];
      const totalCashRevenue = historyData?.totalAmount || 0;

      // MRR & manager health
      let mrr = 0;
      let activeManagers = 0;
      let expiredManagers = 0;
      safeUsers.forEach((user: any) => {
        if (user.role === 'manager') {
          const isExpired = user.subscriptionExpiry
            ? new Date(user.subscriptionExpiry) < new Date()
            : false;
          if (isExpired) {
            expiredManagers++;
          } else {
            activeManagers++;
            const count = user.shopCount || 0;
            mrr += count >= 2 ? 400 : 150;
          }
        }
      });

      // Chart: group payments by day (last 7)
      const dailyMap: Record<string, number> = {};
      [...rawPayments]
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .forEach(p => {
          const d = new Date(p.date);
          const key = `${d.getDate()}/${d.getMonth() + 1}`;
          dailyMap[key] = (dailyMap[key] || 0) + p.amount;
        });
      const points = Object.keys(dailyMap)
        .map(k => ({ label: k, value: dailyMap[k] }))
        .slice(-6);
      setChartPoints(points);

      // Recent users as activity
      const recentUsers = [...safeUsers]
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        .slice(0, 8)
        .map((user: any) => ({
          _id: user._id,
          type: 'user' as const,
          date: new Date(user.createdAt || Date.now()),
          title: user.name,
          subtitle: `${user.role.charAt(0).toUpperCase() + user.role.slice(1)} • ${user.email}`,
        }));

      setRecentActivity(recentUsers);
      setStats({ users: safeUsers.length, shops: safeShops.length, estimatedMRR: mrr, totalCashEarnings: totalCashRevenue, activeManagers, expiredManagers });
    } catch (e) {
      console.error('Admin dashboard fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, []);

  const onRefresh = () => { setRefreshing(true); fetchStats(true); };

  const handleLogout = async () => {
    await AsyncStorage.clear();
    router.replace('/(auth)/login');
  };

  const healthPct = stats.users > 0
    ? Math.round((stats.activeManagers / Math.max(stats.activeManagers + stats.expiredManagers, 1)) * 100)
    : 100;

  const getRoleInitialColor = (subtitle: string) => {
    if (subtitle.startsWith('Admin')) return '#3b82f6';
    if (subtitle.startsWith('Manager')) return '#f59e0b';
    return '#10b981';
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerEyebrow}>MASTER CONSOLE</Text>
          <Text style={styles.headerTitle}>System Overview</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <Text style={styles.clockText}>{clock}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={styles.headerChip}>
              <View style={styles.onlineDot} />
              <Text style={styles.headerChipText}>ADMIN</Text>
            </View>
            <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
              <Ionicons name="log-out-outline" size={18} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#3b82f6"
            colors={['#3b82f6']}
          />
        }
      >
        {/* ── KPI Strip ── */}
        <View style={styles.kpiRow}>
          <KpiCard title="Platform Revenue" value={`R${stats.totalCashEarnings.toFixed(0)}`} icon="cash-outline" accent="#10b981" loading={loading} sub="all-time cash" />
          <KpiCard title="Monthly MRR" value={`R${stats.estimatedMRR}`} icon="trending-up-outline" accent="#3b82f6" loading={loading} sub="active subs" />
        </View>
        <View style={styles.kpiRow}>
          <KpiCard title="Platform Users" value={`${stats.users}`} icon="people-outline" accent="#06b6d4" loading={loading} sub={`${stats.shops} shops`} />
          <KpiCard title="Expired Mgrs" value={`${stats.expiredManagers}`} icon="alert-circle-outline" accent={stats.expiredManagers > 0 ? '#f59e0b' : '#10b981'} loading={loading} sub={`${stats.activeManagers} active`} />
        </View>

        {/* ── Platform Health Bar ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>PLATFORM HEALTH</Text>
          <Text style={[styles.sectionBadge, { color: healthPct >= 80 ? '#10b981' : '#f59e0b' }]}>
            {healthPct}% Active
          </Text>
        </View>
        <View style={styles.healthCard}>
          <View style={styles.healthBarBg}>
            <LinearGradient
              colors={healthPct >= 80 ? ['#10b981', '#059669'] : ['#f59e0b', '#d97706']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={[styles.healthBarFill, { width: `${healthPct}%` as any }]}
            />
          </View>
          <View style={styles.healthMeta}>
            <View style={styles.healthMetaItem}>
              <View style={[styles.healthDot, { backgroundColor: '#10b981' }]} />
              <Text style={styles.healthMetaText}>{stats.activeManagers} Active Managers</Text>
            </View>
            <View style={styles.healthMetaItem}>
              <View style={[styles.healthDot, { backgroundColor: '#f59e0b' }]} />
              <Text style={styles.healthMetaText}>{stats.expiredManagers} Expired</Text>
            </View>
            <View style={styles.healthMetaItem}>
              <View style={[styles.healthDot, { backgroundColor: '#06b6d4' }]} />
              <Text style={styles.healthMetaText}>{stats.shops} Shops</Text>
            </View>
          </View>
        </View>

        {/* ── Revenue Chart ── */}
        {chartPoints.length > 1 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>REVENUE CASH FLOWS</Text>
              <Text style={styles.sectionBadge}>Last {chartPoints.length} points</Text>
            </View>
            <View style={styles.chartCard}>
              <LineChart
                data={{
                  labels: chartPoints.map(p => p.label),
                  datasets: [{ data: chartPoints.map(p => p.value), color: () => '#3b82f6', strokeWidth: 2 }],
                }}
                width={SCREEN_WIDTH - 56}
                height={150}
                yAxisLabel="R"
                withDots={true}
                withInnerLines={false}
                withOuterLines={false}
                withShadow={false}
                chartConfig={{
                  backgroundColor: 'transparent',
                  backgroundGradientFrom: '#111827',
                  backgroundGradientTo: '#111827',
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
                  labelColor: () => '#64748b',
                  propsForDots: { r: '4', strokeWidth: '2', stroke: '#60a5fa' },
                }}
                bezier
                style={{ borderRadius: 12, marginTop: 4 }}
              />
            </View>
          </>
        )}

        {/* ── Nav Grid ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>MANAGEMENT TOOLS</Text>
        </View>
        <View style={styles.navGrid}>
          <NavTile
            label="Manage Users" icon="people" accent="#3b82f6"
            badge={stats.expiredManagers > 0 ? `${stats.expiredManagers}` : undefined}
            onPress={() => router.push('/(admin)/manage-users')}
          />
          <NavTile label="Shops" icon="storefront" accent="#10b981" onPress={() => router.push('/(admin)/shops')} />
          <NavTile label="Subscriptions" icon="bar-chart" accent="#f59e0b" onPress={() => router.push('/(admin)/subscription-reports')} />
          <NavTile label="System Logs" icon="terminal" accent="#06b6d4" onPress={() => router.push('/(admin)/system-logs')} />
          <NavTile label="All Products" icon="cube-outline" accent="#8b5cf6" onPress={() => router.push('/(admin)/all-products')} />
        </View>

        {/* ── Recent Activity ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>RECENT REGISTRATIONS</Text>
          <Text style={styles.sectionBadge}>{recentActivity.length} entries</Text>
        </View>
        <View style={styles.activityCard}>
          {loading && !refreshing ? (
            <ActivityIndicator color="#3b82f6" style={{ padding: 24 }} />
          ) : recentActivity.length === 0 ? (
            <Text style={styles.emptyText}>No recent activity.</Text>
          ) : (
            recentActivity.map((item, idx) => {
              const roleColor = getRoleInitialColor(item.subtitle);
              return (
                <View
                  key={item._id}
                  style={[styles.activityRow, idx === recentActivity.length - 1 && { borderBottomWidth: 0 }]}
                >
                  <View style={[styles.activityAvatar, { backgroundColor: roleColor + '20', borderColor: roleColor + '40' }]}>
                    <Text style={[styles.activityAvatarText, { color: roleColor }]}>
                      {item.title.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.activityName}>{item.title}</Text>
                    <Text style={styles.activitySub}>{item.subtitle}</Text>
                  </View>
                  <Text style={styles.activityTime}>
                    {item.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              );
            })
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0f1e' },

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  headerEyebrow: { color: '#3b82f6', fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  headerTitle: { color: '#f1f5f9', fontSize: 22, fontWeight: '800', marginTop: 2 },
  clockText: { color: '#64748b', fontSize: 12, fontFamily: 'monospace', fontWeight: '600' },
  headerChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(59,130,246,0.12)', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(59,130,246,0.25)',
  },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' },
  headerChipText: { color: '#93c5fd', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  logoutBtn: {
    backgroundColor: 'rgba(239,68,68,0.12)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)',
    padding: 7, borderRadius: 10,
  },

  scroll: { paddingHorizontal: 20, paddingTop: 20 },

  // KPI Cards
  kpiRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  kpiCard: {
    flex: 1, backgroundColor: '#111827', borderRadius: 16, padding: 14,
    borderWidth: 1, overflow: 'hidden', position: 'relative',
  },
  kpiAccentBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, borderRadius: 2 },
  kpiIconRing: {
    width: 36, height: 36, borderRadius: 10, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center', marginBottom: 10,
  },
  kpiTitle: { color: '#64748b', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  kpiValue: { fontSize: 22, fontWeight: '800', marginTop: 4, letterSpacing: -0.5 },
  kpiSub: { color: '#475569', fontSize: 10, fontWeight: '500', marginTop: 2 },

  // Section headers
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 8 },
  sectionTitle: { color: '#475569', fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  sectionBadge: { color: '#64748b', fontSize: 11, fontWeight: '600' },

  // Health bar
  healthCard: { backgroundColor: '#111827', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  healthBarBg: { height: 8, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden', marginBottom: 14 },
  healthBarFill: { height: '100%', borderRadius: 4 },
  healthMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  healthMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  healthDot: { width: 6, height: 6, borderRadius: 3 },
  healthMetaText: { color: '#64748b', fontSize: 11, fontWeight: '600' },

  // Chart
  chartCard: { backgroundColor: '#111827', borderRadius: 16, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },

  // Nav Grid
  navGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  navTile: {
    backgroundColor: '#111827', borderRadius: 16, padding: 14, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    flexBasis: (SCREEN_WIDTH - 62) / 3,
    flexGrow: 1,
    alignItems: 'center', position: 'relative',
  },
  navIconBox: {
    width: 44, height: 44, borderRadius: 12, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center', marginBottom: 8,
  },
  navTileLabel: { color: '#94a3b8', fontSize: 10, fontWeight: '700', textAlign: 'center', letterSpacing: 0.2 },
  navBadge: {
    position: 'absolute', top: 8, right: 8,
    minWidth: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 4,
  },
  navBadgeText: { color: 'white', fontSize: 9, fontWeight: '800' },

  // Activity Feed
  activityCard: { backgroundColor: '#111827', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  activityRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  activityAvatar: {
    width: 38, height: 38, borderRadius: 10, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center',
  },
  activityAvatarText: { fontSize: 15, fontWeight: '800' },
  activityName: { color: '#e2e8f0', fontSize: 13, fontWeight: '700' },
  activitySub: { color: '#475569', fontSize: 11, marginTop: 2 },
  activityTime: { color: '#334155', fontSize: 10, fontFamily: 'monospace', fontWeight: '600' },

  emptyText: { color: '#475569', textAlign: 'center', padding: 24, fontStyle: 'italic' },
});