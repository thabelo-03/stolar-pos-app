import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
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
  View
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
  const [stats, setStats] = useState({ totalRevenue: 0, totalCount: 0 });
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'sales' | 'activities'>('sales');

  const fetchData = async () => {
    try {
      if (!refreshing) setLoading(true);

      // Fetch shop details to get manager information
      const shopRes = await fetch(`${API_BASE_URL}/shops/${shopId}`);
      const shopData = await shopRes.json();
      let managerId = null;
      if (shopData && shopData.manager) {
        setManagerInfo(shopData.manager);
        managerId = shopData.manager._id || shopData.manager;
      }

      // Fetch all shops managed by this manager (for selector bar)
      let shopsList = managerShops;
      if (managerId && managerShops.length === 0) {
        const shopsRes = await fetch(`${API_BASE_URL}/shops?managerId=${managerId}`);
        const shopsData = await shopsRes.json();
        if (Array.isArray(shopsData)) {
          setManagerShops(shopsData);
          shopsList = shopsData;
        }
      }

      // Fetch sales and logs depending on selection
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
        const salesRes = await fetch(`${API_BASE_URL}/sales/recent?shopId=${activeShopId}&limit=100`);
        const salesData = await salesRes.json();
        fetchedSales = Array.isArray(salesData) ? salesData : [];

        const logsRes = await fetch(`${API_BASE_URL}/logs?shopId=${activeShopId}`);
        const logsData = await logsRes.json();
        fetchedLogs = Array.isArray(logsData) ? logsData : [];
      }

      setSales(fetchedSales);
      setLogs(fetchedLogs);

      // Calculate Stats
      const totalRev = fetchedSales.reduce((acc, curr) => acc + (curr.total || 0), 0);
      setStats({
        totalRevenue: totalRev,
        totalCount: fetchedSales.length
      });

      // Format Chart Data
      const dailyMap: Record<string, number> = {};
      const sortedSales = [...fetchedSales].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      sortedSales.forEach(sale => {
        const d = new Date(sale.date);
        const label = `${d.getDate()}/${d.getMonth() + 1}`;
        dailyMap[label] = (dailyMap[label] || 0) + sale.total;
      });

      const points = Object.keys(dailyMap).map(k => ({
        label: k,
        value: dailyMap[k]
      })).slice(-7);

      setChartData(points);

    } catch (e) {
      console.error("Error fetching shop reports:", e);
      Alert.alert("Error", "Could not fetch reports.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (shopId) {
      setSelectedShopId(shopId);
    }
  }, [shopId]);

  useEffect(() => {
    if (selectedShopId) {
      fetchData();
    }
  }, [selectedShopId]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [selectedShopId, shopId, managerShops]);

  const handleExportPDF = async () => {
    const currentShopName = selectedShopId === 'all' 
      ? `Consolidated Manager Report (All Shops)` 
      : (managerShops.find(s => s._id === selectedShopId)?.name || shopName);

    const html = `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Outfit:wght@400;600;800&display=swap" rel="stylesheet">
          <style>
            body { font-family: 'Inter', sans-serif; padding: 24px; color: #1e293b; }
            .header { background: linear-gradient(135deg, #0284c7, #0ea5e9); color: white; padding: 24px; border-radius: 16px; margin-bottom: 24px; }
            .title { font-family: 'Outfit', sans-serif; font-size: 24px; font-weight: 800; text-transform: uppercase; margin: 0; }
            .subtitle { font-size: 13px; opacity: 0.9; margin-top: 4px; }
            .section { margin-top: 30px; }
            .section-title { font-size: 14px; font-weight: 800; color: #0f172a; text-transform: uppercase; border-bottom: 2px solid #cbd5e1; padding-bottom: 6px; margin-bottom: 12px; }
            
            .kpi-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 20px; }
            .kpi-card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; background-color: #f8fafc; text-align: center; }
            .kpi-label { font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 4px; }
            .kpi-val { font-size: 16px; font-weight: 800; color: #0f172a; }

            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th { background-color: #f8fafc; color: #475569; font-weight: 700; text-transform: uppercase; padding: 10px; text-align: left; border-bottom: 2px solid #cbd5e1; }
            td { border-bottom: 1px solid #f1f5f9; padding: 10px; color: #334155; }
            tr:nth-child(even) td { background-color: #fafbfb; }
            
            .log-list { font-family: monospace; font-size: 10px; line-height: 1.5; }
            .log-item { border-bottom: 1px solid #f1f5f9; padding: 8px 0; }
            .log-time { color: #64748b; font-weight: bold; margin-right: 10px; }
            
            .footer { margin-top: 50px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 16px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="title">${currentShopName}</h1>
            <div class="subtitle">Manager: ${managerInfo ? managerInfo.name : 'N/A'} (${managerInfo ? managerInfo.email : 'N/A'})</div>
          </div>

          <div class="kpi-row">
            <div class="kpi-card">
              <div class="kpi-label">Revenue Generated</div>
              <div class="kpi-val">R ${stats.totalRevenue.toFixed(2)}</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Sales Count</div>
              <div class="kpi-val">${stats.totalCount}</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Billing Status</div>
              <div class="kpi-val" style="color: ${managerInfo?.subscriptionStatus === 'active' ? '#10b981' : '#ef4444'}">
                ${managerInfo ? (managerInfo.subscriptionStatus || 'ACTIVE').toUpperCase() : 'ACTIVE'}
              </div>
            </div>
          </div>

          <div class="section">
            <h2 class="section-title">Sales History</h2>
            <table>
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Transaction ID</th>
                  <th>Quantity</th>
                  <th style="text-align: right;">Total Paid</th>
                </tr>
              </thead>
              <tbody>
                ${sales.map(item => {
                  const dateObj = item.date ? new Date(item.date) : null;
                  const formattedDate = dateObj && !isNaN(dateObj.getTime())
                    ? `${dateObj.toLocaleDateString()} ${dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    : 'N/A';
                  const itemsCount = item.items && Array.isArray(item.items) ? item.items.length : 0;
                  const totalPaid = typeof item.total === 'number' ? item.total.toFixed(2) : '0.00';
                  return `
                    <tr>
                      <td>${formattedDate}</td>
                      <td>${item._id || 'N/A'}</td>
                      <td>${itemsCount} items</td>
                      <td style="text-align: right; font-weight: bold;">R ${totalPaid}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>

          <div class="section">
            <h2 class="section-title">Recent Activity Logs</h2>
            <div class="log-list">
              ${logs.map(log => {
                const dateObj = log.timestamp ? new Date(log.timestamp) : null;
                const formattedTime = dateObj && !isNaN(dateObj.getTime())
                  ? dateObj.toLocaleTimeString()
                  : 'N/A';
                const level = (log.level || 'info').toUpperCase();
                const logColor = log.level === 'error' ? '#ef4444' : log.level === 'warning' ? '#f59e0b' : '#10b981';
                return `
                  <div class="log-item">
                    <span class="log-time">[${formattedTime}]</span>
                    <span class="log-level" style="font-weight: bold; color: ${logColor}">[${level}]</span>
                    <span class="log-msg">${log.message || ''}</span>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <div class="footer">
            Stolar POS Platform • Manager Shop Audit Report
          </div>
        </body>
      </html>
    `;
    try {
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (e) {
      Alert.alert("Error", "Could not generate PDF");
    }
  };

  const renderHeader = () => (
    <View>
      {/* Manager Profile Panel */}
      <View style={styles.managerCard}>
        <View style={styles.managerRow}>
          <View style={styles.managerAvatar}>
            <Ionicons name="person" size={24} color="#0ea5e9" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.managerLabel}>SHOP MANAGER</Text>
            <Text style={styles.managerName}>{managerInfo ? managerInfo.name : 'Loading...'}</Text>
            <Text style={styles.managerEmail}>{managerInfo ? managerInfo.email : 'N/A'}</Text>
          </View>
          <View style={[
            styles.badge,
            { backgroundColor: managerInfo?.subscriptionStatus === 'active' ? '#ecfdf5' : '#fef2f2' }
          ]}>
            <Text style={[
              styles.badgeText,
              { color: managerInfo?.subscriptionStatus === 'active' ? '#10b981' : '#ef4444' }
            ]}>
              {managerInfo ? (managerInfo.subscriptionStatus || 'ACTIVE').toUpperCase() : 'ACTIVE'}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.kpiContainer}>
          <View style={styles.kpiItem}>
            <Text style={styles.kpiLabelText}>Total Sales</Text>
            <Text style={styles.kpiValText}>{stats.totalCount}</Text>
          </View>
          <View style={styles.kpiItem}>
            <Text style={styles.kpiLabelText}>Total Revenue</Text>
            <Text style={[styles.kpiValText, { color: '#10b981' }]}>R{stats.totalRevenue.toFixed(2)}</Text>
          </View>
        </View>
      </View>

      {/* Shop Selector Toggles */}
      {managerShops.length > 1 && (
        <View style={styles.shopSelectorContainer}>
          <Text style={styles.selectorTitle}>View Scope</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shopSelectorScroll}>
            <TouchableOpacity 
              style={[styles.shopCapsule, selectedShopId === 'all' && styles.shopCapsuleActive]}
              onPress={() => setSelectedShopId('all')}
            >
              <Text style={[styles.shopCapsuleText, selectedShopId === 'all' && styles.shopCapsuleTextActive]}>All Shops</Text>
            </TouchableOpacity>
            
            {managerShops.map((s) => (
              <TouchableOpacity 
                key={s._id}
                style={[styles.shopCapsule, selectedShopId === s._id && styles.shopCapsuleActive]}
                onPress={() => setSelectedShopId(s._id)}
              >
                <Text style={[styles.shopCapsuleText, selectedShopId === s._id && styles.shopCapsuleTextActive]}>{s.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Chart wrapper */}
      {chartData.length > 0 && (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Sales Trend</Text>
          <LineChart
            data={{
              labels: chartData.map(d => d.label),
              datasets: [{ data: chartData.map(d => d.value) }]
            }}
            width={SCREEN_WIDTH - 40}
            height={160}
            yAxisLabel="R"
            chartConfig={{
              backgroundColor: "#ffffff",
              backgroundGradientFrom: "#ffffff",
              backgroundGradientTo: "#ffffff",
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(14, 165, 233, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`,
              style: { borderRadius: 16 }
            }}
            bezier
            style={{ marginVertical: 8, borderRadius: 16 }}
          />
        </View>
      )}

      {/* Tab selection */}
      <View style={styles.tabBar}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'sales' && styles.tabActive]}
          onPress={() => setActiveTab('sales')}
        >
          <Text style={[styles.tabText, activeTab === 'sales' && styles.tabTextActive]}>Sales List</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'activities' && styles.tabActive]}
          onPress={() => setActiveTab('activities')}
        >
          <Text style={[styles.tabText, activeTab === 'activities' && styles.tabTextActive]}>Cashier Activities</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <LinearGradient 
        colors={['#0284c7', '#0ea5e9', '#38bdf8']} 
        start={{ x: 0, y: 0 }} 
        end={{ x: 1, y: 1 }} 
        style={[styles.header, { paddingTop: insets.top + 15 }]}
      >
        <View style={styles.headerTopRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{shopName || 'Shop Reports'}</Text>
            <Text style={styles.subtitle}>Audit & Activity Diagnostics</Text>
          </View>
          <TouchableOpacity onPress={handleExportPDF} style={styles.backButton}>
            <Ionicons name="document-text-outline" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0ea5e9" style={{ marginTop: 40 }} />
        </View>
      ) : (
        <FlatList
          data={(activeTab === 'sales' ? sales : logs) as any[]}
          keyExtractor={(item) => item._id}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0ea5e9']} tintColor="#0ea5e9" />
          }
          renderItem={({ item }: any) => {
            if (activeTab === 'sales') {
              return (
                <View style={styles.itemCard}>
                  <View style={styles.itemHeader}>
                    <Ionicons name="receipt-outline" size={18} color="#0ea5e9" />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.itemName}>R{item.total.toFixed(2)}</Text>
                      <Text style={styles.itemSub}>{item.items.length} items sold</Text>
                    </View>
                    <Text style={styles.itemTime}>
                      {new Date(item.date).toLocaleDateString()} {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                </View>
              );
            } else {
              const logColor = item.level === 'error' ? '#ef4444' : item.level === 'warning' ? '#f59e0b' : '#10b981';
              return (
                <View style={[styles.itemCard, { borderLeftColor: logColor, borderLeftWidth: 3 }]}>
                  <View style={styles.itemHeader}>
                    <Ionicons name="terminal-outline" size={18} color={logColor} />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[styles.itemName, { fontSize: 13, fontFamily: 'monospace' }]}>{item.message}</Text>
                      <Text style={[styles.itemSub, { textTransform: 'uppercase', fontSize: 10 }]}>{item.level}</Text>
                    </View>
                    <Text style={styles.itemTime}>
                      {item.timestamp || new Date().toLocaleTimeString()}
                    </Text>
                  </View>
                </View>
              );
            }
          }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="documents-outline" size={48} color="#bae6fd" style={{ marginBottom: 12 }} />
              <Text style={styles.emptyText}>No data available for this section.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f9ff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  // Header
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: "#0284c7",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: { padding: 8, backgroundColor: 'rgba(255, 255, 255, 0.2)', borderRadius: 12, marginRight: 15 },
  title: { fontSize: 20, fontWeight: 'bold', color: 'white', letterSpacing: 0.5 },
  subtitle: { fontSize: 13, color: 'rgba(255, 255, 255, 0.8)', marginTop: 2 },

  // Cards
  managerCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    margin: 20,
    padding: 16,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 3,
  },
  managerRow: { flexDirection: 'row', alignItems: 'center' },
  managerAvatar: {
    width: 44, height: 44,
    backgroundColor: '#f0f9ff',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  managerLabel: { fontSize: 9, fontWeight: '800', color: '#94a3b8', letterSpacing: 0.5, marginBottom: 2 },
  managerName: { fontSize: 14, fontWeight: '700', color: '#334155' },
  managerEmail: { fontSize: 11, color: '#64748b' },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 'auto',
  },
  badgeText: { fontSize: 10, fontWeight: '800' },
  
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 12 },
  
  kpiContainer: { flexDirection: 'row', justifyContent: 'space-between' },
  kpiItem: { flex: 1, alignItems: 'center' },
  kpiLabelText: { fontSize: 10, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase' },
  kpiValText: { fontSize: 18, fontWeight: '800', color: '#334155', marginTop: 4 },

  chartCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 16,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 3,
  },
  chartTitle: { fontSize: 14, fontWeight: '800', color: '#334155', textTransform: 'uppercase', marginBottom: 10 },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(14, 165, 233, 0.08)',
    borderRadius: 12,
    padding: 4,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: 'white' },
  tabText: { color: '#0ea5e9', fontWeight: '600', fontSize: 12 },
  tabTextActive: { color: '#0369a1', fontWeight: '800' },

  // Item Cards
  itemCard: {
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 12,
    marginHorizontal: 20,
    marginBottom: 10,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 1,
  },
  itemHeader: { flexDirection: 'row', alignItems: 'center' },
  itemName: { fontSize: 14, fontWeight: '700', color: '#334155' },
  itemSub: { fontSize: 11, color: '#64748b', marginTop: 2 },
  itemTime: { fontSize: 10, color: '#94a3b8', fontWeight: '600' },

  // Empty State
  emptyState: { alignItems: 'center', padding: 40 },
  emptyText: { fontSize: 13, color: '#94a3b8', fontWeight: '600' },

  // Shop selector styles
  shopSelectorContainer: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  selectorTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  shopSelectorScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  shopCapsule: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e0f2fe',
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  shopCapsuleActive: {
    backgroundColor: '#0ea5e9',
    borderColor: '#0ea5e9',
  },
  shopCapsuleText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  shopCapsuleTextActive: {
    color: 'white',
    fontWeight: '700',
  },
});
