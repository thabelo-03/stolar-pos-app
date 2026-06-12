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

interface Product {
  _id: string;
  name: string;
  price: number;
  stockQuantity: number;
  category?: string;
}

// ─── Stock level helpers ──────────────────────────────────────────────────────
const getStockConfig = (qty: number): { color: string; label: string; pct: number } => {
  if (qty === 0) return { color: '#ef4444', label: 'OUT OF STOCK', pct: 0 };
  if (qty < 5)  return { color: '#ef4444', label: `${qty} units`, pct: qty / 50 };
  if (qty < 20) return { color: '#f59e0b', label: `${qty} units`, pct: qty / 50 };
  return { color: '#10b981', label: `${qty} units`, pct: Math.min(qty / 50, 1) };
};

const getCategoryIcon = (cat?: string): any => {
  if (!cat) return 'cube-outline';
  const c = cat.toLowerCase();
  if (c.includes('drink') || c.includes('bev')) return 'wine-outline';
  if (c.includes('food') || c.includes('snack')) return 'fast-food-outline';
  if (c.includes('clean') || c.includes('hygiene')) return 'sparkles-outline';
  if (c.includes('tech') || c.includes('electron')) return 'phone-portrait-outline';
  return 'cube-outline';
};

export default function AllProducts() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/products`);
      const data = await res.json();
      if (Array.isArray(data)) { setProducts(data); setFilteredProducts(data); }
    } catch { console.error('Failed to fetch products'); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { fetchProducts(); }, []);

  useEffect(() => {
    if (!searchTerm.trim()) { setFilteredProducts(products); return; }
    const q = searchTerm.toLowerCase();
    setFilteredProducts(products.filter(p => p.name.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q)));
  }, [searchTerm, products]);

  const onRefresh = useCallback(() => { setRefreshing(true); fetchProducts(); }, []);

  // Summary stats
  const lowStockCount = products.filter(p => p.stockQuantity > 0 && p.stockQuantity < 20).length;
  const outOfStockCount = products.filter(p => p.stockQuantity === 0).length;
  const totalValue = products.reduce((sum, p) => sum + p.price * p.stockQuantity, 0);

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
          .kpi-row { display: flex; gap: 10px; margin-bottom: 24px; }
          .kpi { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; text-align: center; }
          .kpi-label { font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
          .kpi-value { font-size: 16px; font-weight: 800; color: #0f172a; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th { background: #f8fafc; color: #475569; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; font-size: 9px; border-bottom: 2px solid #cbd5e1; padding: 10px 8px; text-align: left; }
          td { border-bottom: 1px solid #f1f5f9; padding: 9px 8px; color: #334155; }
          tr:nth-child(even) td { background: #fafbfb; }
          .low { color: #f59e0b; font-weight: 700; }
          .out { color: #ef4444; font-weight: 700; }
          .ok { color: #10b981; font-weight: 600; }
          .footer { margin-top: 40px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 16px; }
        </style>
      </head><body>
        <div class="header">
          <h1>System Inventory Audit</h1>
          <p>Generated ${new Date().toLocaleString()} · ${filteredProducts.length} items</p>
        </div>
        <div class="kpi-row">
          <div class="kpi"><div class="kpi-label">Total Items</div><div class="kpi-value">${filteredProducts.length}</div></div>
          <div class="kpi"><div class="kpi-label">Low Stock</div><div class="kpi-value" style="color:#f59e0b">${lowStockCount}</div></div>
          <div class="kpi"><div class="kpi-label">Out of Stock</div><div class="kpi-value" style="color:#ef4444">${outOfStockCount}</div></div>
          <div class="kpi"><div class="kpi-label">Stock Value</div><div class="kpi-value" style="color:#10b981">R${totalValue.toFixed(0)}</div></div>
        </div>
        <table>
          <thead><tr><th>Product Name</th><th>Category</th><th>Stock</th><th>Unit Price</th><th style="text-align:right">Value</th></tr></thead>
          <tbody>
            ${filteredProducts.map(item => {
              const cls = item.stockQuantity === 0 ? 'out' : item.stockQuantity < 20 ? 'low' : 'ok';
              const label = item.stockQuantity === 0 ? 'OUT OF STOCK' : `${item.stockQuantity} units`;
              return `<tr>
                <td style="font-weight:600;color:#0f172a">${item.name}</td>
                <td style="color:#64748b">${item.category || 'General'}</td>
                <td class="${cls}">${label}</td>
                <td>R${item.price.toFixed(2)}</td>
                <td style="text-align:right;font-weight:600">R${(item.price * item.stockQuantity).toFixed(2)}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
        <div class="footer">Stolar POS System • Master Inventory Audit</div>
      </body></html>
    `;
    try {
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch { Alert.alert('Error', 'Failed to generate PDF'); }
  };

  const renderProductItem = ({ item }: { item: Product }) => {
    const stock = getStockConfig(item.stockQuantity);
    const catIcon = getCategoryIcon(item.category);
    const stockValue = item.price * item.stockQuantity;

    return (
      <View style={[styles.productCard, item.stockQuantity === 0 && styles.productCardOut]}>
        <View style={styles.productTop}>
          <View style={[styles.productIcon, { backgroundColor: item.stockQuantity === 0 ? 'rgba(239,68,68,0.12)' : 'rgba(59,130,246,0.12)', borderColor: item.stockQuantity === 0 ? 'rgba(239,68,68,0.3)' : 'rgba(59,130,246,0.25)' }]}>
            <Ionicons name={catIcon} size={20} color={item.stockQuantity === 0 ? '#ef4444' : '#3b82f6'} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.productCategory}>{item.category || 'General'}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.productPrice}>R{item.price.toFixed(2)}</Text>
            <Text style={styles.productValue}>R{stockValue.toFixed(0)} val</Text>
          </View>
        </View>

        {/* Stock progress bar */}
        <View style={styles.stockRow}>
          <Text style={[styles.stockLabel, { color: stock.color }]}>
            {item.stockQuantity === 0 && <Ionicons name="warning-outline" size={10} color="#ef4444" />}
            {' '}{stock.label}
          </Text>
          <View style={styles.stockBarBg}>
            <View style={[styles.stockBarFill, { width: `${Math.round(stock.pct * 100)}%` as any, backgroundColor: stock.color }]} />
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* ── Header ── */}
      <LinearGradient colors={['#0f172a', '#111827']} style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color="#94a3b8" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>System Inventory</Text>
            <Text style={styles.headerSub}>{filteredProducts.length} items registered</Text>
          </View>
          <TouchableOpacity onPress={handleExportPDF} style={styles.backBtn}>
            <Ionicons name="document-text-outline" size={20} color="#94a3b8" />
          </TouchableOpacity>
        </View>

        {/* Summary Strip */}
        <View style={styles.summaryStrip}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{products.length}</Text>
            <Text style={styles.summaryLabel}>TOTAL</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: '#f59e0b' }]}>{lowStockCount}</Text>
            <Text style={styles.summaryLabel}>LOW STOCK</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: outOfStockCount > 0 ? '#ef4444' : '#475569' }]}>{outOfStockCount}</Text>
            <Text style={styles.summaryLabel}>OUT</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: '#10b981', fontSize: 14 }]}>R{totalValue >= 1000 ? `${(totalValue / 1000).toFixed(1)}k` : totalValue.toFixed(0)}</Text>
            <Text style={styles.summaryLabel}>VALUE</Text>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={16} color="#475569" />
          <TextInput
            placeholder="Search products or categories..."
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
          data={filteredProducts}
          keyExtractor={item => item._id}
          contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" colors={['#3b82f6']} />}
          renderItem={renderProductItem}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="basket-outline" size={56} color="#1e293b" style={{ marginBottom: 12 }} />
              <Text style={styles.emptyText}>No products found</Text>
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
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  backBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, marginRight: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  headerTitle: { color: '#f1f5f9', fontSize: 20, fontWeight: '800' },
  headerSub: { color: '#475569', fontSize: 12, marginTop: 2 },

  // Summary strip
  summaryStrip: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { color: '#f1f5f9', fontSize: 18, fontWeight: '800' },
  summaryLabel: { color: '#334155', fontSize: 8, fontWeight: '700', letterSpacing: 0.6, marginTop: 2 },
  summaryDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.06)' },

  // Search
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, paddingHorizontal: 12, height: 44, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  searchInput: { flex: 1, color: '#94a3b8', marginLeft: 8, fontSize: 14 },

  // Product Card
  productCard: { backgroundColor: '#111827', borderRadius: 16, marginBottom: 10, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  productCardOut: { borderColor: 'rgba(239,68,68,0.2)', backgroundColor: '#120f18' },
  productTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  productIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  productName: { color: '#e2e8f0', fontSize: 14, fontWeight: '700' },
  productCategory: { color: '#475569', fontSize: 11, marginTop: 2 },
  productPrice: { color: '#10b981', fontSize: 15, fontWeight: '800' },
  productValue: { color: '#334155', fontSize: 10, fontWeight: '600', marginTop: 2 },

  // Stock bar
  stockRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stockLabel: { fontSize: 10, fontWeight: '700', width: 90 },
  stockBarBg: { flex: 1, height: 4, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' },
  stockBarFill: { height: '100%', borderRadius: 2 },

  // Empty
  emptyState: { alignItems: 'center', marginTop: 80 },
  emptyText: { color: '#334155', fontSize: 14, fontWeight: '600' },
});