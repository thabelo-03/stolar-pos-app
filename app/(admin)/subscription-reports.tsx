import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { BarChart } from 'react-native-chart-kit';
import { API_BASE_URL } from '../config';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface PaymentRecord {
  _id: string;
  managerId: string;
  managerName: string;
  managerEmail: string;
  amount: number;
  months: number;
  paymentMethod: string;
  date: string;
  isSeed?: boolean;
  details?: string;
}

interface ChartPoint { label: string; value: number; }

// ─── KPI Hero Card ────────────────────────────────────────────────────────────
const HeroKpi = ({
  label, value, sub, accent, icon, loading,
}: {
  label: string; value: string; sub?: string; accent: string; icon: any; loading: boolean;
}) => {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 1800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={[styles.heroKpi, { borderColor: accent + '30' }]}>
      <Animated.View style={[styles.heroGlow, { backgroundColor: accent + '15', transform: [{ scale: pulse }] }]} />
      <View style={[styles.heroIconBox, { backgroundColor: accent + '20', borderColor: accent + '35' }]}>
        <Ionicons name={icon} size={20} color={accent} />
      </View>
      <Text style={styles.heroLabel}>{label}</Text>
      {loading ? (
        <ActivityIndicator color={accent} style={{ marginTop: 8 }} />
      ) : (
        <>
          <Text style={[styles.heroValue, { color: accent }]}>{value}</Text>
          {sub && <Text style={styles.heroSub}>{sub}</Text>}
        </>
      )}
    </View>
  );
};

export default function SubscriptionReports() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [filteredPayments, setFilteredPayments] = useState<PaymentRecord[]>([]);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [stats, setStats] = useState({ totalCollected: 0, activeMRR: 0, count: 0, momGrowth: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSubscriptionData = async () => {
    try {
      if (!refreshing) setLoading(true);

      const [historyRes, usersRes] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/payment-history`),
        fetch(`${API_BASE_URL}/users`),
      ]);
      const historyData = await historyRes.json();
      const usersData = await usersRes.json();
      const rawPayments: PaymentRecord[] = Array.isArray(historyData?.history) ? historyData.history : [];
      const safeUsers: any[] = Array.isArray(usersData) ? usersData : [];

      // MRR
      const activeMRR = safeUsers.reduce((acc: number, user: any) => {
        if (user.role !== 'manager') return acc;
        const expired = user.subscriptionExpiry ? new Date(user.subscriptionExpiry) < new Date() : false;
        if (expired) return acc;
        return acc + ((user.shopCount || 0) >= 2 ? 400 : 150);
      }, 0);

      // Month-over-month comparison
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

      const thisMonthTotal = rawPayments
        .filter(p => new Date(p.date) >= thisMonthStart)
        .reduce((s, p) => s + p.amount, 0);
      const lastMonthTotal = rawPayments
        .filter(p => new Date(p.date) >= lastMonthStart && new Date(p.date) <= lastMonthEnd)
        .reduce((s, p) => s + p.amount, 0);
      const momGrowth = lastMonthTotal === 0 ? 0 : Math.round(((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100);

      // Chart: group by month (last 6)
      const monthMap: Record<string, number> = {};
      [...rawPayments]
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .forEach(p => {
          const d = new Date(p.date);
          const key = d.toLocaleString('default', { month: 'short' });
          monthMap[key] = (monthMap[key] || 0) + p.amount;
        });
      const points = Object.keys(monthMap).map(k => ({ label: k, value: monthMap[k] })).slice(-6);
      setChartData(points);

      const totalCollected = rawPayments.reduce((s, p) => s + (p.amount || 0), 0);
      setPayments(rawPayments);
      setFilteredPayments(rawPayments);
      setStats({ totalCollected, activeMRR, count: rawPayments.length, momGrowth });
    } catch {
      Alert.alert('Error', 'Could not fetch subscription reports.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchSubscriptionData(); }, []);

  useEffect(() => {
    if (!searchTerm.trim()) { setFilteredPayments(payments); return; }
    const q = searchTerm.toLowerCase();
    setFilteredPayments(payments.filter(p =>
      p.managerName?.toLowerCase().includes(q) ||
      p.managerEmail?.toLowerCase().includes(q) ||
      p.details?.toLowerCase().includes(q)
    ));
  }, [searchTerm, payments]);

  const onRefresh = useCallback(() => { setRefreshing(true); fetchSubscriptionData(); }, []);

  const handleExportPDF = async () => {
    const html = `
      <html><head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
        <style>
          body { font-family: 'Inter', sans-serif; padding: 24px; color: #1e293b; background: #fff; margin: 0; }
          .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-radius: 16px; padding: 24px; color: #fff; margin-bottom: 24px; }
          .header h1 { font-size: 20px; font-weight: 800; margin: 0; text-transform: uppercase; letter-spacing: 1px; }
          .header p { font-size: 12px; color: rgba(255,255,255,0.6); margin-top: 6px; }
          .kpi-row { display: flex; gap: 12px; margin-bottom: 24px; }
          .kpi { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; text-align: center; }
          .kpi-label { font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
          .kpi-value { font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 20px; }
          th { background: #f8fafc; color: #475569; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; font-size: 9px; border-bottom: 2px solid #cbd5e1; padding: 10px 8px; text-align: left; }
          td { border-bottom: 1px solid #f1f5f9; padding: 10px 8px; color: #334155; }
          tr:nth-child(even) td { background: #fafbfb; }
          .amount { font-weight: 700; color: #10b981; }
          .footer { margin-top: 40px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 16px; }
        </style>
      </head><body>
        <div class="header">
          <h1>Platform Subscription Earnings</h1>
          <p>Generated ${new Date().toLocaleString()}</p>
        </div>
        <div class="kpi-row">
          <div class="kpi"><div class="kpi-label">Total Collected</div><div class="kpi-value">R${stats.totalCollected.toFixed(2)}</div></div>
          <div class="kpi"><div class="kpi-label">Active MRR</div><div class="kpi-value">R${stats.activeMRR.toFixed(2)}</div></div>
          <div class="kpi"><div class="kpi-label">Transactions</div><div class="kpi-value">${stats.count}</div></div>
        </div>
        <table>
          <thead><tr><th>Date</th><th>Manager</th><th>Email</th><th>Plan</th><th>Duration</th><th style="text-align:right">Amount</th></tr></thead>
          <tbody>
            ${filteredPayments.map(item => {
              const d = item.date ? new Date(item.date) : null;
              const fd = d && !isNaN(d.getTime()) ? `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'N/A';
              return `<tr>
                <td style="color:#64748b">${fd}</td>
                <td style="font-weight:600">${item.managerName || 'N/A'}</td>
                <td>${item.managerEmail || 'N/A'}</td>
                <td>${item.details || 'Manual'}</td>
                <td>${item.months || 0}mo</td>
                <td style="text-align:right" class="amount">R${(item.amount || 0).toFixed(2)}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
        <div class="footer">Stolar POS Platform • Owner Executive Intelligence</div>
      </body></html>
    `;
    try {
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch { Alert.alert('Error', 'Failed to generate PDF'); }
  };

  const renderHeader = () => (
    <View>
      {/* KPI Hero Row */}
      <View style={styles.heroRow}>
        <HeroKpi label="Total Revenue" value={`R${stats.totalCollected.toFixed(0)}`} sub="all-time cash" accent="#10b981" icon="cash-outline" loading={loading} />
        <HeroKpi
          label="Monthly MRR"
          value={`R${stats.activeMRR}`}
          sub={stats.momGrowth !== 0 ? `${stats.momGrowth > 0 ? '+' : ''}${stats.momGrowth}% MoM` : 'no change'}
          accent="#3b82f6"
          icon="trending-up-outline"
          loading={loading}
        />
        <HeroKpi label="Transactions" value={`${stats.count}`} sub="payment records" accent="#f59e0b" icon="receipt-outline" loading={loading} />
      </View>

      {/* Bar Chart */}
      {chartData.length > 1 && (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>MONTHLY REVENUE BARS</Text>
            <Text style={styles.sectionSub}>Last {chartData.length} months</Text>
          </View>
          <View style={styles.chartCard}>
            <BarChart
              data={{
                labels: chartData.map(p => p.label),
                datasets: [{ data: chartData.map(p => p.value) }],
              }}
              width={SCREEN_WIDTH - 56}
              height={160}
              yAxisLabel="R"
              yAxisSuffix=""
              chartConfig={{
                backgroundColor: 'transparent',
                backgroundGradientFrom: '#111827',
                backgroundGradientTo: '#111827',
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
                labelColor: () => '#334155',
                barPercentage: 0.6,
                propsForBackgroundLines: { stroke: 'rgba(255,255,255,0.04)' },
              }}
              style={{ borderRadius: 12 }}
              showValuesOnTopOfBars={false}
            />
          </View>
        </>
      )}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>PAYMENT HISTORY</Text>
        <Text style={styles.sectionSub}>{filteredPayments.length} records</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ── Header ── */}
      <LinearGradient colors={['#0f172a', '#111827']} style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color="#94a3b8" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Earnings Console</Text>
            <Text style={styles.headerSub}>Subscription revenue & MRR</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity onPress={handleExportPDF} style={styles.backBtn}>
              <Ionicons name="document-text-outline" size={20} color="#94a3b8" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={16} color="#475569" />
          <TextInput
            placeholder="Search by manager name or email..."
            placeholderTextColor="#334155"
            style={styles.searchInput}
            value={searchTerm}
            onChangeText={setSearchTerm}
            autoCapitalize="none"
          />
          {searchTerm.length > 0 && (
            <TouchableOpacity onPress={() => setSearchTerm('')}>
              <Ionicons name="close-circle" size={16} color="#475569" />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#3b82f6" /></View>
      ) : (
        <FlatList
          data={filteredPayments}
          keyExtractor={item => item._id}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" colors={['#3b82f6']} />}
          renderItem={({ item }) => {
            const isPremium = item.details?.toLowerCase().includes('premium');
            return (
              <View style={styles.paymentCard}>
                <View style={[styles.paymentIcon, { backgroundColor: isPremium ? 'rgba(245,158,11,0.15)' : 'rgba(59,130,246,0.15)' }]}>
                  <Ionicons name="card-outline" size={18} color={isPremium ? '#f59e0b' : '#3b82f6'} />
                </View>
                <View style={styles.paymentInfo}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.paymentName}>{item.managerName || 'Platform Manager'}</Text>
                    {isPremium && (
                      <View style={styles.premiumBadge}>
                        <Text style={styles.premiumBadgeText}>PRO</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.paymentEmail}>{item.managerEmail || 'N/A'}</Text>
                  <Text style={styles.paymentDetail}>{item.details || 'Subscription Payment'} · {item.months}mo</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.paymentAmount}>+R{item.amount.toFixed(0)}</Text>
                  <Text style={styles.paymentDate}>{new Date(item.date).toLocaleDateString()}</Text>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={{ color: '#334155', fontWeight: '600' }}>No payment records found.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0f1e' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },

  // Header
  header: { paddingHorizontal: 16, paddingBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  backBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, marginRight: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  headerTitle: { color: '#f1f5f9', fontSize: 20, fontWeight: '800' },
  headerSub: { color: '#475569', fontSize: 12, marginTop: 2 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, paddingHorizontal: 12, height: 44, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  searchInput: { flex: 1, color: '#94a3b8', marginLeft: 8, fontSize: 14 },

  // Hero KPI
  heroRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  heroKpi: { flex: 1, backgroundColor: '#111827', borderRadius: 16, padding: 14, borderWidth: 1, alignItems: 'center', overflow: 'hidden', position: 'relative' },
  heroGlow: { position: 'absolute', top: -20, right: -20, width: 70, height: 70, borderRadius: 35 },
  heroIconBox: { width: 38, height: 38, borderRadius: 10, borderWidth: 1, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  heroLabel: { color: '#334155', fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' },
  heroValue: { fontSize: 18, fontWeight: '800', marginTop: 4, textAlign: 'center' },
  heroSub: { color: '#475569', fontSize: 9, fontWeight: '600', marginTop: 2, textAlign: 'center' },

  // Section headers
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 4 },
  sectionTitle: { color: '#334155', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  sectionSub: { color: '#1e293b', fontSize: 10, fontWeight: '600' },

  // Chart
  chartCard: { backgroundColor: '#111827', borderRadius: 16, padding: 12, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },

  // Payment Card
  paymentCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111827', borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  paymentIcon: { width: 40, height: 40, borderRadius: 11, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  paymentInfo: { flex: 1 },
  paymentName: { color: '#e2e8f0', fontSize: 13, fontWeight: '700' },
  paymentEmail: { color: '#475569', fontSize: 11, marginTop: 1 },
  paymentDetail: { color: '#334155', fontSize: 10, fontWeight: '600', marginTop: 2 },
  paymentAmount: { color: '#10b981', fontSize: 15, fontWeight: '800' },
  paymentDate: { color: '#334155', fontSize: 9, fontWeight: '600', marginTop: 2 },
  premiumBadge: { backgroundColor: 'rgba(245,158,11,0.15)', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5 },
  premiumBadgeText: { color: '#f59e0b', fontSize: 8, fontWeight: '800', letterSpacing: 0.3 },
});
