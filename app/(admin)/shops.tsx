import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_BASE_URL } from '../config';

interface Shop {
  _id: string;
  name: string;
  category?: string;
  manager?: {
    name: string;
    email: string;
    subscriptionStatus?: string;
    subscriptionExpiry?: string;
  } | string;
}

// ─── Category icon map ────────────────────────────────────────────────────────
const getCategoryIcon = (cat?: string): any => {
  if (!cat) return 'storefront-outline';
  const c = cat.toLowerCase();
  if (c.includes('grocer') || c.includes('food')) return 'basket-outline';
  if (c.includes('restaurant') || c.includes('cafe')) return 'restaurant-outline';
  if (c.includes('cloth') || c.includes('fashion')) return 'shirt-outline';
  if (c.includes('pharmacy') || c.includes('health')) return 'medical-outline';
  if (c.includes('tech') || c.includes('electron')) return 'hardware-chip-outline';
  return 'storefront-outline';
};

// ─── Days remaining ───────────────────────────────────────────────────────────
const getDaysLeft = (expiry?: string): number | null => {
  if (!expiry) return null;
  return Math.ceil((new Date(expiry).getTime() - Date.now()) / 86400000);
};

export default function ShopsList() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [shops, setShops] = useState<Shop[]>([]);
  const [filteredShops, setFilteredShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchShops = async () => {
    try {
      if (!refreshing) setLoading(true);
      const [shopsRes, usersRes] = await Promise.all([
        fetch(`${API_BASE_URL}/shops`),
        fetch(`${API_BASE_URL}/users`),
      ]);
      const shopsData = await shopsRes.json();
      const usersData = await usersRes.json();

      const userMap = new Map<string, any>();
      if (Array.isArray(usersData)) usersData.forEach((u: any) => userMap.set(u._id, u));

      if (Array.isArray(shopsData)) {
        const enriched = shopsData.map((s: any) => {
          const managerId = typeof s.manager === 'object' ? s.manager?._id : s.manager;
          const mu = userMap.get(managerId);
          return {
            ...s,
            manager: mu
              ? { name: mu.name, email: mu.email, subscriptionStatus: mu.subscriptionStatus || 'active', subscriptionExpiry: mu.subscriptionExpiry }
              : { name: 'Unknown Manager', email: 'N/A', subscriptionStatus: 'expired', subscriptionExpiry: undefined },
          };
        });
        setShops(enriched);
        setFilteredShops(enriched);
      }
    } catch {
      Alert.alert('Error', 'Could not fetch registered shops.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchShops(); }, []);

  useEffect(() => {
    if (!searchTerm.trim()) { setFilteredShops(shops); return; }
    const q = searchTerm.toLowerCase();
    setFilteredShops(shops.filter(s =>
      s.name.toLowerCase().includes(q) ||
      (s.category && s.category.toLowerCase().includes(q)) ||
      (s.manager && typeof s.manager === 'object' && s.manager.name?.toLowerCase().includes(q))
    ));
  }, [searchTerm, shops]);

  const onRefresh = useCallback(() => { setRefreshing(true); fetchShops(); }, []);

  // Summary counts
  const activeCount = filteredShops.filter(s => {
    const mgr = s.manager && typeof s.manager === 'object' ? s.manager : null;
    return mgr?.subscriptionStatus === 'active';
  }).length;
  const expiredCount = filteredShops.length - activeCount;

  const handleExportPDF = async () => {
    const html = `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
          <style>
            body { font-family: 'Inter', sans-serif; padding: 24px; color: #1e293b; background: #fff; margin: 0; }
            .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-radius: 16px; padding: 24px; color: #fff; margin-bottom: 24px; }
            .header h1 { font-size: 20px; font-weight: 800; margin: 0; text-transform: uppercase; letter-spacing: 1px; }
            .header p { font-size: 12px; color: rgba(255,255,255,0.6); margin-top: 6px; }
            .kpi-row { display: flex; gap: 12px; margin-bottom: 24px; }
            .kpi { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; text-align: center; }
            .kpi-label { font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
            .kpi-value { font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 4px; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th { background: #f8fafc; color: #475569; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; font-size: 9px; border-bottom: 2px solid #cbd5e1; padding: 10px 8px; text-align: left; }
            td { border-bottom: 1px solid #f1f5f9; padding: 10px 8px; color: #334155; }
            tr:nth-child(even) td { background: #fafbfb; }
            .active { color: #10b981; font-weight: 700; }
            .expired { color: #ef4444; font-weight: 700; }
            .footer { margin-top: 40px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 16px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Registered Shops Report</h1>
            <p>Generated ${new Date().toLocaleString()} — ${filteredShops.length} shops</p>
          </div>
          <div class="kpi-row">
            <div class="kpi"><div class="kpi-label">Total Shops</div><div class="kpi-value">${filteredShops.length}</div></div>
            <div class="kpi"><div class="kpi-label">Active</div><div class="kpi-value" style="color:#10b981">${activeCount}</div></div>
            <div class="kpi"><div class="kpi-label">Expired</div><div class="kpi-value" style="color:#ef4444">${expiredCount}</div></div>
          </div>
          <table>
            <thead><tr><th>Shop Name</th><th>Category</th><th>Manager</th><th>Email</th><th>Status</th></tr></thead>
            <tbody>
              ${filteredShops.map(s => {
                const m = s.manager && typeof s.manager === 'object' ? s.manager : null;
                return `<tr>
                  <td style="font-weight:600;color:#0f172a">${s.name}</td>
                  <td style="color:#64748b">${s.category || 'General'}</td>
                  <td>${m?.name || 'Unknown'}</td>
                  <td>${m?.email || 'N/A'}</td>
                  <td class="${m?.subscriptionStatus === 'active' ? 'active' : 'expired'}">${(m?.subscriptionStatus || 'expired').toUpperCase()}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
          <div class="footer">Stolar POS System • Master Shops Directory</div>
        </body>
      </html>
    `;
    try {
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch { Alert.alert('Error', 'Failed to generate PDF'); }
  };

  const renderShopItem = ({ item }: { item: Shop }) => {
    const mgr = item.manager && typeof item.manager === 'object' ? item.manager : null;
    const isActive = mgr?.subscriptionStatus === 'active';
    const daysLeft = getDaysLeft(mgr?.subscriptionExpiry);
    const isExpiringSoon = daysLeft !== null && daysLeft > 0 && daysLeft <= 7;
    const catIcon = getCategoryIcon(item.category);

    return (
      <TouchableOpacity
        style={[styles.shopCard, !isActive && styles.shopCardExpired]}
        onPress={() => router.push({ pathname: '/(admin)/shop-reports', params: { shopId: item._id, shopName: item.name } })}
        activeOpacity={0.8}
      >
        {/* Top row */}
        <View style={styles.shopCardTop}>
          <View style={[styles.shopIcon, { backgroundColor: isActive ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', borderColor: isActive ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)' }]}>
            <Ionicons name={catIcon} size={22} color={isActive ? '#10b981' : '#ef4444'} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.shopName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.shopCategory}>{item.category || 'General Retail'}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: isActive ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', borderColor: isActive ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)' }]}>
            <View style={[styles.statusDot, { backgroundColor: isActive ? '#10b981' : '#ef4444' }]} />
            <Text style={[styles.statusText, { color: isActive ? '#10b981' : '#ef4444' }]}>
              {isActive ? 'ACTIVE' : 'EXPIRED'}
            </Text>
          </View>
        </View>

        {/* Days remaining bar for expiring soon */}
        {isActive && isExpiringSoon && daysLeft !== null && (
          <View style={styles.expiryWarning}>
            <Ionicons name="warning-outline" size={12} color="#f59e0b" />
            <Text style={styles.expiryWarningText}>Expires in {daysLeft} day{daysLeft !== 1 ? 's' : ''}</Text>
          </View>
        )}

        <View style={styles.shopDivider} />

        {/* Manager info */}
        <View style={styles.shopCardBottom}>
          <View style={{ flex: 1 }}>
            <Text style={styles.mgrLabel}>MANAGER</Text>
            <Text style={styles.mgrName}>{mgr?.name || 'Unknown'}</Text>
            <Text style={styles.mgrEmail}>{mgr?.email || 'N/A'}</Text>
          </View>
          <View style={styles.reportsBtn}>
            <Text style={styles.reportsBtnText}>Reports</Text>
            <Ionicons name="chevron-forward" size={14} color="#3b82f6" />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

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
            <Text style={styles.headerTitle}>Registered Shops</Text>
            <Text style={styles.headerSub}>{filteredShops.length} stores in system</Text>
          </View>
          <TouchableOpacity onPress={handleExportPDF} style={styles.backBtn}>
            <Ionicons name="document-text-outline" size={20} color="#94a3b8" />
          </TouchableOpacity>
        </View>

        {/* Summary Strip */}
        <View style={styles.summaryStrip}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{filteredShops.length}</Text>
            <Text style={styles.summaryLabel}>TOTAL</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: '#10b981' }]}>{activeCount}</Text>
            <Text style={styles.summaryLabel}>ACTIVE</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: expiredCount > 0 ? '#ef4444' : '#475569' }]}>{expiredCount}</Text>
            <Text style={styles.summaryLabel}>EXPIRED</Text>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={16} color="#475569" />
          <TextInput
            placeholder="Search shops or managers..."
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

      {/* ── List ── */}
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#3b82f6" /></View>
      ) : (
        <FlatList
          data={filteredShops}
          keyExtractor={item => item._id}
          contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" colors={['#3b82f6']} />}
          renderItem={renderShopItem}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="storefront-outline" size={56} color="#1e293b" style={{ marginBottom: 12 }} />
              <Text style={styles.emptyText}>No registered shops found</Text>
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
  header: { paddingHorizontal: 16, paddingBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  backBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, marginRight: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  headerTitle: { color: '#f1f5f9', fontSize: 20, fontWeight: '800' },
  headerSub: { color: '#475569', fontSize: 12, marginTop: 2 },

  // Summary strip
  summaryStrip: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { color: '#f1f5f9', fontSize: 20, fontWeight: '800' },
  summaryLabel: { color: '#334155', fontSize: 9, fontWeight: '700', letterSpacing: 0.8, marginTop: 2 },
  summaryDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginHorizontal: 4 },

  // Search
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, paddingHorizontal: 12, height: 44, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  searchInput: { flex: 1, color: '#94a3b8', marginLeft: 8, fontSize: 14 },

  // Shop Card
  shopCard: { backgroundColor: '#111827', borderRadius: 18, marginBottom: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  shopCardExpired: { borderColor: 'rgba(239,68,68,0.2)', backgroundColor: '#110f18' },
  shopCardTop: { flexDirection: 'row', alignItems: 'center' },
  shopIcon: { width: 46, height: 46, borderRadius: 13, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  shopName: { color: '#e2e8f0', fontSize: 15, fontWeight: '700' },
  shopCategory: { color: '#475569', fontSize: 11, marginTop: 2 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },

  expiryWarning: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(245,158,11,0.1)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, marginTop: 10 },
  expiryWarningText: { color: '#f59e0b', fontSize: 11, fontWeight: '700' },

  shopDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.04)', marginVertical: 12 },
  shopCardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  mgrLabel: { color: '#334155', fontSize: 9, fontWeight: '700', letterSpacing: 0.5, marginBottom: 2 },
  mgrName: { color: '#94a3b8', fontSize: 13, fontWeight: '700' },
  mgrEmail: { color: '#475569', fontSize: 11, marginTop: 2 },
  reportsBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(59,130,246,0.1)', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(59,130,246,0.25)' },
  reportsBtnText: { color: '#3b82f6', fontSize: 12, fontWeight: '700' },

  // Empty
  emptyState: { alignItems: 'center', marginTop: 80 },
  emptyText: { color: '#334155', fontSize: 14, fontWeight: '600' },
});
