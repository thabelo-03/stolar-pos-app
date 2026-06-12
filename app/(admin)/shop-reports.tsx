import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LineChart } from 'react-native-chart-kit';
import { API_BASE_URL } from '../config';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface Sale {
  _id: string;
  total: number;
  date: string;
  items: any[];
}

interface ActivityLog {
  _id: string;
  message: string;
  timestamp: string;
  level: string;
}

const LOG_LEVEL_CFG: Record<string, { color: string; label: string }> = {
  error:   { color: '#ef4444', label: 'ERR' },
  warning: { color: '#f59e0b', label: 'WRN' },
  info:    { color: '#38bdf8', label: 'INF' },
  success: { color: '#10b981', label: 'OK ' },
};

export default function ShopReports() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const shopId = params.shopId as string;
  const shopName = params.shopName as string;

  const [sales, setSales] = useState<Sale[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [managerInfo, setManagerInfo] = useState<any>(null);
  const [managerShops, setManagerShops] = useState<any[]>([]);
  const [selectedShopId, setSelectedShopId] = useState<string>('');
  const [stats, setStats] = useState({ totalRevenue: 0, totalCount: 0, avgSale: 0 });
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'sales' | 'activities'>('sales');

  const fetchData = async () => {
    try {
      if (!refreshing) setLoading(true);

      const shopRes = await fetch(`${API_BASE_URL}/shops/${shopId}`);
      const shopData = await shopRes.json();
      let managerId: string | null = null;
      if (shopData?.manager) {
        setManagerInfo(shopData.manager);
        managerId = shopData.manager._id || shopData.manager;
      }

      let shopsList = managerShops;
      if (managerId && managerShops.length === 0) {
        const shopsRes = await fetch(`${API_BASE_URL}/shops?managerId=${managerId}`);
        const shopsData = await shopsRes.json();
        if (Array.isArray(shopsData)) {
          setManagerShops(shopsData);
          shopsList = shopsData;
        }
      }

      let fetchedSales: Sale[] = [];
      let fetchedLogs: ActivityLog[] = [];

      if (selectedShopId === 'all') {
        const salesPromises = shopsList.map(s =>
          fetch(`${API_BASE_URL}/sales/recent?shopId=${s._id}&limit=50`).then(r => r.json()).catch(() => [])
        );
        const logsPromises = shopsList.map(s =>
          fetch(`${API_BASE_URL}/logs?shopId=${s._id}`).then(r => r.json()).catch(() => [])
        );
        const allSalesData = await Promise.all(salesPromises);
        const allLogsData = await Promise.all(logsPromises);
        fetchedSales = allSalesData.flat().filter(Boolean);
        fetchedSales.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        fetchedLogs = allLogsData.flat().filter(Boolean);
        fetchedLogs.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
      } else {
        const activeShopId = selectedShopId || shopId;
        const [salesRes, logsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/sales/recent?shopId=${activeShopId}&limit=100`),
          fetch(`${API_BASE_URL}/logs?shopId=${activeShopId}`),
        ]);
        const salesData = await salesRes.json();
        const logsData = await logsRes.json();
        fetchedSales = Array.isArray(salesData) ? salesData : [];
        fetchedLogs = Array.isArray(logsData) ? logsData : [];
      }

      setSales(fetchedSales);
      setLogs(fetchedLogs);

      const totalRev = fetchedSales.reduce((acc, curr) => acc + (curr.total || 0), 0);
      const avgSale = fetchedSales.length > 0 ? totalRev / fetchedSales.length : 0;
      setStats({ totalRevenue: totalRev, totalCount: fetchedSales.length, avgSale });

      const dailyMap: Record<string, number> = {};
      [...fetchedSales]
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .forEach(sale => {
          const d = new Date(sale.date);
          const label = `${d.getDate()}/${d.getMonth() + 1}`;
          dailyMap[label] = (dailyMap[label] || 0) + sale.total;
        });
      const points = Object.keys(dailyMap).map(k => ({ label: k, value: dailyMap[k] })).slice(-7);
      setChartData(points);
    } catch (e) {
      console.error('Shop reports error:', e);
      Alert.alert('Error', 'Could not fetch reports.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { if (shopId) setSelectedShopId(shopId); }, [shopId]);
  useEffect(() => { if (selectedShopId) fetchData(); }, [selectedShopId]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [selectedShopId, shopId, managerShops]);

  const handleExportPDF = async () => {
    const currentShopName = selectedShopId === 'all'
      ? 'Consolidated Manager Report (All Shops)'
      : (managerShops.find(s => s._id === selectedShopId)?.name || shopName);

    const html = `
      <html><head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
        <style>
          body { font-family: 'Inter', sans-serif; padding: 24px; color: #1e293b; background: #fff; margin: 0; }
          .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-radius: 16px; padding: 24px; color: #fff; margin-bottom: 24px; }
          .header h1 { font-size: 20px; font-weight: 800; margin: 0; text-transform: uppercase; }
          .header p { font-size: 12px; color: rgba(255,255,255,0.6); margin-top: 6px; }
          .kpi-row { display: flex; gap: 12px; margin-bottom: 24px; }
          .kpi { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; text-align: center; }
          .kpi-label { font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
          .kpi-value { font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 20px; }
          th { background: #f8fafc; color: #475569; font-weight: 700; text-transform: uppercase; font-size: 9px; border-bottom: 2px solid #cbd5e1; padding: 10px 8px; text-align: left; }
          td { border-bottom: 1px solid #f1f5f9; padding: 9px 8px; color: #334155; }
          tr:nth-child(even) td { background: #fafbfb; }
          .footer { margin-top: 40px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 16px; }
        </style>
      </head><body>
        <div class="header">
          <h1>${currentShopName}</h1>
          <p>Manager: ${managerInfo?.name || 'N/A'} (${managerInfo?.email || 'N/A'}) • Generated ${new Date().toLocaleString()}</p>
        </div>
        <div class="kpi-row">
          <div class="kpi"><div class="kpi-label">Total Revenue</div><div class="kpi-value">R${stats.totalRevenue.toFixed(2)}</div></div>
          <div class="kpi"><div class="kpi-label">Sales Count</div><div class="kpi-value">${stats.totalCount}</div></div>
          <div class="kpi"><div class="kpi-label">Avg. Sale</div><div class="kpi-value">R${stats.avgSale.toFixed(2)}</div></div>
        </div>
        <table>
          <thead><tr><th>Date & Time</th><th>Transaction ID</th><th>Items</th><th style="text-align:right">Total</th></tr></thead>
          <tbody>
            ${sales.map(item => {
              const d = item.date ? new Date(item.date) : null;
              const fd = d && !isNaN(d.getTime()) ? `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'N/A';
              return `<tr>
                <td>${fd}</td>
                <td style="color:#64748b;font-size:9px">${item._id || 'N/A'}</td>
                <td>${Array.isArray(item.items) ? item.items.length : 0} items</td>
                <td style="text-align:right;font-weight:700">R${(item.total || 0).toFixed(2)}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
        <div class="footer">Stolar POS Platform • Shop Audit Report</div>
      </body></html>
    `;
    try {
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch {
      Alert.alert('Error', 'Could not generate PDF');
    }
  };

  const renderHeader = () => (
    <View>
      {/* Manager Profile Card */}
      <View style={styles.managerCard}>
        <View style={styles.managerRow}>
          <View style={styles.managerAvatar}>
            <Text style={styles.managerAvatarText}>{managerInfo?.name ? managerInfo.name.charAt(0).toUpperCase() : '?'}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.managerLabel}>SHOP MANAGER</Text>
            <Text style={styles.managerName}>{managerInfo ? managerInfo.name : 'Loading...'}</Text>
            <Text style={styles.managerEmail}>{managerInfo ? managerInfo.email : 'N/A'}</Text>
          </View>
          <View style={[styles.subBadge, { backgroundColor: managerInfo?.subscriptionStatus === 'active' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', borderColor: managerInfo?.subscriptionStatus === 'active' ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)' }]}>
            <View style={[styles.subBadgeDot, { backgroundColor: managerInfo?.subscriptionStatus === 'active' ? '#10b981' : '#ef4444' }]} />
            <Text style={[styles.subBadgeText, { color: managerInfo?.subscriptionStatus === 'active' ? '#10b981' : '#ef4444' }]}>
              {managerInfo ? (managerInfo.subscriptionStatus || 'ACTIVE').toUpperCase() : 'ACTIVE'}
            </Text>
          </View>
        </View>

        <View style={styles.cardDivider} />

        <View style={styles.kpiRow}>
          <View style={styles.kpiItem}>
            <Text style={styles.kpiItemLabel}>TOTAL SALES</Text>
            <Text style={styles.kpiItemValue}>{stats.totalCount}</Text>
          </View>
          <View style={styles.kpiDivider} />
          <View style={styles.kpiItem}>
            <Text style={styles.kpiItemLabel}>REVENUE</Text>
            <Text style={[styles.kpiItemValue, { color: '#10b981' }]}>R{stats.totalRevenue.toFixed(0)}</Text>
          </View>
          <View style={styles.kpiDivider} />
          <View style={styles.kpiItem}>
            <Text style={styles.kpiItemLabel}>AVG SALE</Text>
            <Text style={[styles.kpiItemValue, { color: '#3b82f6' }]}>R{stats.avgSale.toFixed(0)}</Text>
          </View>
        </View>
      </View>

      {/* Shop Selector */}
      {managerShops.length > 1 && (
        <View style={styles.selectorSection}>
          <Text style={styles.selectorLabel}>VIEW SCOPE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', gap: 8, paddingVertical: 4 }}>
            <TouchableOpacity
              style={[styles.selectorChip, selectedShopId === 'all' && styles.selectorChipActive]}
              onPress={() => setSelectedShopId('all')}
            >
              <Ionicons name="albums-outline" size={12} color={selectedShopId === 'all' ? '#3b82f6' : '#475569'} />
              <Text style={[styles.selectorChipText, selectedShopId === 'all' && styles.selectorChipTextActive]}>All Shops</Text>
            </TouchableOpacity>
            {managerShops.map(s => (
              <TouchableOpacity
                key={s._id}
                style={[styles.selectorChip, selectedShopId === s._id && styles.selectorChipActive]}
                onPress={() => setSelectedShopId(s._id)}
              >
                <Ionicons name="storefront-outline" size={12} color={selectedShopId === s._id ? '#3b82f6' : '#475569'} />
                <Text style={[styles.selectorChipText, selectedShopId === s._id && styles.selectorChipTextActive]}>{s.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Sales Trend Chart */}
      {chartData.length > 1 && (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>SALES TREND</Text>
            <Text style={styles.sectionSub}>Last {chartData.length} days</Text>
          </View>
          <View style={styles.chartCard}>
            <LineChart
              data={{
                labels: chartData.map(d => d.label),
                datasets: [{ data: chartData.map(d => d.value), color: () => '#10b981', strokeWidth: 2 }],
              }}
              width={SCREEN_WIDTH - 48}
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
                color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
                labelColor: () => '#334155',
                propsForDots: { r: '4', strokeWidth: '2', stroke: '#34d399' },
              }}
              bezier
              style={{ borderRadius: 12, marginTop: 4 }}
            />
          </View>
        </>
      )}

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'sales' && styles.tabActive]}
          onPress={() => setActiveTab('sales')}
        >
          <Ionicons name="receipt-outline" size={14} color={activeTab === 'sales' ? '#10b981' : '#475569'} />
          <Text style={[styles.tabText, activeTab === 'sales' && styles.tabTextActive]}>Sales ({sales.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'activities' && styles.tabActive]}
          onPress={() => setActiveTab('activities')}
        >
          <Ionicons name="terminal-outline" size={14} color={activeTab === 'activities' ? '#06b6d4' : '#475569'} />
          <Text style={[styles.tabText, activeTab === 'activities' && styles.tabTextActive]}>Activity ({logs.length})</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ── Header ── */}
      <LinearGradient
        colors={['#0f172a', '#111827']}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color="#94a3b8" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>{shopName || 'Shop Reports'}</Text>
            <Text style={styles.headerSub}>Audit & Activity Diagnostics</Text>
          </View>
          <TouchableOpacity onPress={handleExportPDF} style={styles.backBtn}>
            <Ionicons name="document-text-outline" size={20} color="#94a3b8" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#10b981" /></View>
      ) : (
        <FlatList
          data={(activeTab === 'sales' ? sales : logs) as any[]}
          keyExtractor={item => item._id}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10b981" colors={['#10b981']} />}
          renderItem={({ item }: any) => {
            if (activeTab === 'sales') {
              const d = item.date ? new Date(item.date) : null;
              const fd = d && !isNaN(d.getTime())
                ? `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : 'N/A';
              return (
                <View style={styles.saleCard}>
                  <View style={styles.saleIconBox}>
                    <Ionicons name="receipt-outline" size={18} color="#10b981" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.saleAmount}>R{(item.total || 0).toFixed(2)}</Text>
                    <Text style={styles.saleItems}>{Array.isArray(item.items) ? item.items.length : 0} items sold</Text>
                  </View>
                  <Text style={styles.saleDate}>{fd}</Text>
                </View>
              );
            } else {
              const cfg = LOG_LEVEL_CFG[item.level] || LOG_LEVEL_CFG.info;
              const ts = item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'N/A';
              return (
                <View style={[styles.logLine, { borderLeftColor: cfg.color }]}>
                  <Text style={[styles.logTs, { color: cfg.color }]}>{cfg.label}</Text>
                  <Text style={styles.logTime}>{ts}</Text>
                  <Text style={styles.logMsg} numberOfLines={2}>{item.message || 'No message'}</Text>
                </View>
              );
            }
          }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="documents-outline" size={52} color="#1e293b" style={{ marginBottom: 12 }} />
              <Text style={styles.emptyText}>No {activeTab === 'sales' ? 'sales' : 'activity'} data available.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0f1e' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header
  header: { paddingHorizontal: 16, paddingBottom: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  backBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, marginRight: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  headerTitle: { color: '#f1f5f9', fontSize: 18, fontWeight: '800' },
  headerSub: { color: '#475569', fontSize: 12, marginTop: 2 },

  // Manager card
  managerCard: { backgroundColor: '#111827', borderRadius: 18, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  managerRow: { flexDirection: 'row', alignItems: 'center' },
  managerAvatar: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(245,158,11,0.15)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.35)', justifyContent: 'center', alignItems: 'center' },
  managerAvatarText: { color: '#f59e0b', fontSize: 18, fontWeight: '800' },
  managerLabel: { color: '#334155', fontSize: 9, fontWeight: '700', letterSpacing: 0.5, marginBottom: 2 },
  managerName: { color: '#e2e8f0', fontSize: 14, fontWeight: '700' },
  managerEmail: { color: '#475569', fontSize: 11, marginTop: 1 },
  subBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  subBadgeDot: { width: 5, height: 5, borderRadius: 3 },
  subBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },

  cardDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.04)', marginVertical: 12 },

  kpiRow: { flexDirection: 'row', justifyContent: 'space-between' },
  kpiItem: { flex: 1, alignItems: 'center' },
  kpiItemLabel: { color: '#334155', fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 },
  kpiItemValue: { color: '#f1f5f9', fontSize: 18, fontWeight: '800' },
  kpiDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.04)', marginHorizontal: 4 },

  // Shop selector
  selectorSection: { marginBottom: 14 },
  selectorLabel: { color: '#334155', fontSize: 9, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
  selectorChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: '#111827', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  selectorChipActive: { backgroundColor: 'rgba(59,130,246,0.15)', borderColor: 'rgba(59,130,246,0.4)' },
  selectorChipText: { color: '#475569', fontSize: 12, fontWeight: '700' },
  selectorChipTextActive: { color: '#3b82f6' },

  // Section headers
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { color: '#334155', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  sectionSub: { color: '#1e293b', fontSize: 10, fontWeight: '600' },

  // Chart
  chartCard: { backgroundColor: '#111827', borderRadius: 16, padding: 10, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },

  // Tab bar
  tabBar: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 3, marginBottom: 14 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: 10 },
  tabActive: { backgroundColor: '#1e293b' },
  tabText: { color: '#475569', fontSize: 12, fontWeight: '700' },
  tabTextActive: { color: '#94a3b8', fontWeight: '700' },

  // Sale card
  saleCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111827', borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  saleIconBox: { width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(16,185,129,0.15)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)', justifyContent: 'center', alignItems: 'center' },
  saleAmount: { color: '#10b981', fontSize: 15, fontWeight: '800' },
  saleItems: { color: '#475569', fontSize: 11, marginTop: 2 },
  saleDate: { color: '#334155', fontSize: 10, fontFamily: 'monospace', fontWeight: '600', textAlign: 'right' },

  // Log line (terminal style)
  logLine: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111827', borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12, marginBottom: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)', borderLeftWidth: 3 },
  logTs: { fontSize: 10, fontFamily: 'monospace', fontWeight: '800', width: 32 },
  logTime: { color: '#334155', fontSize: 9, fontFamily: 'monospace', width: 58 },
  logMsg: { flex: 1, color: '#64748b', fontSize: 11, fontFamily: 'monospace', marginLeft: 6 },

  // Empty
  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: '#334155', fontSize: 13, fontWeight: '600' },
});
