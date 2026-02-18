import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { API_BASE_URL } from './config';

export default function StockTakeScreen() {
  const router = useRouter();
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [shops, setShops] = useState<any[]>([]);
  const [selectedShop, setSelectedShop] = useState<string>('all');
  const [userRole, setUserRole] = useState<string>('manager');
  
  // Metrics
  const [metrics, setMetrics] = useState({
    totalSalesCash: 0,      // Cash collected from sales
    inventoryValue: 0,      // Retail value of current stock
    inventoryCost: 0,       // Cost value of current stock
    soldCost: 0,            // Cost of items sold (COGS)
    totalStockManaged: 0,   // Cost of (Sold + Remaining)
    itemsSold: 0,
    itemsInStock: 0
  });

  useEffect(() => {
    fetchUserAndShops();
  }, []);

  useEffect(() => {
    if (shops.length > 0 || userRole === 'cashier') {
        calculateStockTake();
    }
  }, [date, selectedShop, shops]);

  const fetchUserAndShops = async () => {
    try {
      const userId = await AsyncStorage.getItem('userId');
      if (!userId) return;

      const userRes = await fetch(`${API_BASE_URL}/users/${userId}`);
      const user = await userRes.json();
      setUserRole(user.role);

      if (user.role === 'manager' || user.role === 'admin') {
        // Fetch all shops for manager
        const res = await fetch(`${API_BASE_URL}/shops?managerId=${userId}`);
        const data = await res.json();
        if (Array.isArray(data)) setShops(data);
      } else {
        // Fetch specific shop for cashier
        if (user.shopId) {
            const res = await fetch(`${API_BASE_URL}/shops/${user.shopId}`);
            const shop = await res.json();
            if (shop) {
                setShops([shop]);
                setSelectedShop(shop._id); // Force select their shop
            }
        }
      }
    } catch (e) { console.error(e); }
  };

  const calculateStockTake = async () => {
    setLoading(true);
    try {
      // 1. Define Month Range
      const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);

      // 2. Fetch Sales for the Month
      let salesUrl = `${API_BASE_URL}/sales/recent?startDate=${startOfMonth.toISOString()}&endDate=${endOfMonth.toISOString()}&limit=5000`;
      
      // If specific shop selected (or forced for cashier), filter by it
      if (selectedShop !== 'all') salesUrl += `&shopId=${selectedShop}`;
      
      const salesRes = await fetch(salesUrl);
      let sales = await salesRes.json();

      // Client-side filter for 'all' shops (Manager view)
      if (selectedShop === 'all' && shops.length > 0) {
        const shopIds = new Set(shops.map(s => s._id));
        sales = sales.filter((s: any) => shopIds.has(s.shopId));
      }

      // 3. Fetch Current Inventory
      let productsUrl = `${API_BASE_URL}/products`;
      if (selectedShop !== 'all') productsUrl += `?shopId=${selectedShop}`;
      
      const prodRes = await fetch(productsUrl);
      let products = await prodRes.json();

      if (selectedShop === 'all' && shops.length > 0) {
        const shopIds = new Set(shops.map(s => s._id));
        products = products.filter((p: any) => shopIds.has(p.shopId));
      }

      // --- CALCULATIONS ---

      // Create Cost Map for fallback (Fix for 0.0 cost on items sold)
      const costMap = new Map<string, number>();
      if (Array.isArray(products)) {
        products.forEach((p: any) => {
          if (p.barcode) costMap.set(p.barcode, Number(p.costPrice) || 0);
        });
      }

      // A. Sales Metrics
      let totalSalesCash = 0;
      let soldCost = 0;
      let itemsSold = 0;

      sales.forEach((sale: any) => {
        totalSalesCash += (sale.totalUSD || sale.total || 0);
        if (sale.items) {
          sale.items.forEach((item: any) => {
            itemsSold += (Number(item.quantity) || 0);
            
            // Use saved cost, or fallback to current inventory cost if 0/missing
            let unitCost = Number(item.costPrice) || 0;
            if (unitCost === 0 && item.barcode) {
              unitCost = costMap.get(item.barcode) || 0;
            }
            soldCost += (unitCost * Number(item.quantity || 0));
          });
        }
      });

      // B. Inventory Metrics
      let inventoryValue = 0;
      let inventoryCost = 0;
      let itemsInStock = 0;

      products.forEach((p: any) => {
        const qty = Number(p.quantity) || Number(p.stockQuantity) || 0;
        const price = Number(p.price) || 0;
        const cost = Number(p.costPrice) || 0;

        itemsInStock += qty;
        inventoryValue += (price * qty);
        inventoryCost += (cost * qty);
      });

      setMetrics({
        totalSalesCash,
        inventoryValue,
        inventoryCost,
        soldCost,
        totalStockManaged: inventoryCost + soldCost,
        itemsSold,
        itemsInStock
      });

    } catch (error) {
      console.error("Stock Take Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) setDate(selectedDate);
  };

  const handleExportPDF = async () => {
    const shopName = selectedShop === 'all' ? 'All Shops' : shops.find(s => s._id === selectedShop)?.name || 'Unknown Shop';
    const dateStr = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const html = `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; color: #333; }
            h1 { color: #1e3a8a; text-align: center; margin-bottom: 5px; }
            h2 { color: #64748b; text-align: center; font-size: 16px; margin-top: 0; margin-bottom: 30px; }
            .summary-box { border: 1px solid #e2e8f0; padding: 20px; border-radius: 8px; margin-bottom: 30px; background-color: #f8fafc; }
            .row { display: flex; justify-content: space-between; margin-bottom: 10px; align-items: center; }
            .label { font-weight: bold; color: #475569; }
            .value { font-weight: bold; color: #1e293b; font-size: 16px; }
            .divider { height: 1px; background-color: #e2e8f0; margin: 15px 0; }
            .total-row { margin-top: 10px; font-size: 18px; color: #1e3a8a; }
            .footer { margin-top: 40px; text-align: center; color: #94a3b8; font-size: 10px; }
          </style>
        </head>
        <body>
          <h1>Stock Take Report</h1>
          <h2>${shopName} • ${dateStr}</h2>
          
          <div class="summary-box">
            <h3>Cash Flow</h3>
            <div class="row">
              <span class="label">Monthly Cash Sales</span>
              <span class="value">$${metrics.totalSalesCash.toFixed(2)}</span>
            </div>
            
            <div class="divider"></div>
            
            <h3>Stock Inventory (Cost Basis)</h3>
            <div class="row">
               <span class="label">Items Sold (${metrics.itemsSold} units)</span>
               <span class="value">$${metrics.soldCost.toFixed(2)}</span>
            </div>
            <div class="row">
               <span class="label">Available Stock (${metrics.itemsInStock} units)</span>
               <span class="value">$${metrics.inventoryCost.toFixed(2)}</span>
            </div>
          </div>

          <div class="summary-box">
            <div class="row total-row">
               <span class="label">Total Stock Managed</span>
               <span class="value">$${metrics.totalStockManaged.toFixed(2)}</span>
            </div>
            <div style="text-align: right; font-size: 12px; color: #64748b; margin-top: 5px;">(Sold + Available)</div>
          </div>

          <div class="footer">Generated by Stolar POS</div>
        </body>
      </html>
    `;

    const { uri } = await Print.printToFileAsync({ html });
    await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
  };

  const currentShopName = selectedShop === 'all' ? 'All Shops' : shops.find(s => s._id === selectedShop)?.name || 'My Shop';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { flex: 1 }]}>Monthly Stock Take</Text>
        <TouchableOpacity onPress={handleExportPDF}>
          <Ionicons name="print-outline" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <View style={styles.filterSection}>
        <TouchableOpacity style={styles.dateSelector} onPress={() => setShowDatePicker(true)}>
          <Ionicons name="calendar" size={20} color="#1e40af" />
          <Text style={styles.dateText}>
            {date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </Text>
          <Ionicons name="chevron-down" size={16} color="#64748b" />
        </TouchableOpacity>

        {/* Only show shop selector if user is manager and has multiple shops */}
        {userRole === 'manager' && shops.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.shopScroll}>
            <TouchableOpacity 
                style={[styles.shopChip, selectedShop === 'all' && styles.activeShopChip]} 
                onPress={() => setSelectedShop('all')}
            >
                <Text style={[styles.shopChipText, selectedShop === 'all' && styles.activeShopChipText]}>All Shops</Text>
            </TouchableOpacity>
            {shops.map((shop) => (
                <TouchableOpacity 
                key={shop._id} 
                style={[styles.shopChip, selectedShop === shop._id && styles.activeShopChip]} 
                onPress={() => setSelectedShop(shop._id)}
                >
                <Text style={[styles.shopChipText, selectedShop === shop._id && styles.activeShopChipText]}>{shop.name}</Text>
                </TouchableOpacity>
            ))}
            </ScrollView>
        )}
      </View>

      {showDatePicker && (
        <DateTimePicker value={date} mode="date" display="default" onChange={onDateChange} />
      )}

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color="#1e40af" style={{ marginTop: 40 }} />
        ) : (
          <>
            <View style={styles.paperPreview}>
              {/* Document Header */}
              <View style={styles.paperHeader}>
                <Text style={styles.paperTitle}>Monthly Stock Report</Text>
                <Text style={styles.paperSubtitle}>{currentShopName}</Text>
                <Text style={styles.paperDate}>{date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</Text>
              </View>

              <View style={styles.divider} />

              {/* 1. Monthly Cash */}
              <View style={styles.section}>
                <Text style={styles.sectionHeader}>Cash Flow</Text>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Monthly Cash Sales</Text>
                  <Text style={styles.rowValue}>${metrics.totalSalesCash.toFixed(2)}</Text>
                </View>
              </View>

              <View style={styles.divider} />

              {/* 2. Stock Breakdown */}
              <View style={styles.section}>
                <Text style={styles.sectionHeader}>Stock Inventory (Cost)</Text>
                
                <View style={styles.row}>
                  <View>
                    <Text style={styles.rowLabel}>Items Sold</Text>
                    <Text style={styles.rowSub}>{metrics.itemsSold} units</Text>
                  </View>
                  <Text style={styles.rowValue}>${metrics.soldCost.toFixed(2)}</Text>
                </View>

                <View style={[styles.row, { marginTop: 15 }]}>
                  <View>
                    <Text style={styles.rowLabel}>Available Stock</Text>
                    <Text style={styles.rowSub}>{metrics.itemsInStock} units</Text>
                  </View>
                  <Text style={styles.rowValue}>${metrics.inventoryCost.toFixed(2)}</Text>
                </View>
              </View>

              <View style={styles.divider} />

              {/* 3. Total Stock */}
              <View style={styles.totalSection}>
                <Text style={styles.totalLabel}>Total Stock Managed</Text>
                <Text style={styles.totalValue}>${metrics.totalStockManaged.toFixed(2)}</Text>
                <Text style={styles.totalSub}>(Sold + Available)</Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    backgroundColor: '#1e3a8a',
    padding: 25,
    paddingTop: 60,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: { marginRight: 15 },
  headerTitle: { color: 'white', fontSize: 22, fontWeight: 'bold' },
  
  filterSection: { padding: 20, paddingBottom: 10 },
  dateSelector: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', padding: 12, borderRadius: 12, alignSelf: 'flex-start', marginBottom: 15, borderWidth: 1, borderColor: '#e2e8f0' },
  dateText: { marginHorizontal: 8, fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
  shopScroll: { flexDirection: 'row' },
  shopChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f1f5f9', marginRight: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  activeShopChip: { backgroundColor: '#1e40af', borderColor: '#1e40af' },
  shopChipText: { color: '#64748b', fontWeight: '600' },
  activeShopChipText: { color: 'white' },

  content: { padding: 20, paddingTop: 0 },
  
  paperPreview: { backgroundColor: 'white', borderRadius: 8, padding: 25, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4, marginBottom: 30 },
  paperHeader: { alignItems: 'center', marginBottom: 20 },
  paperTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e3a8a', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 1 },
  paperSubtitle: { fontSize: 16, color: '#334155', fontWeight: '600' },
  paperDate: { fontSize: 14, color: '#64748b', marginTop: 2 },
  
  divider: { height: 1, backgroundColor: '#e2e8f0', marginVertical: 20 },
  
  section: { marginBottom: 5 },
  sectionHeader: { fontSize: 12, color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 15, letterSpacing: 0.5 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLabel: { fontSize: 16, color: '#334155', fontWeight: '500' },
  rowSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
  rowValue: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  
  totalSection: { alignItems: 'center', marginTop: 10 },
  totalLabel: { fontSize: 14, color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold' },
  totalValue: { fontSize: 32, fontWeight: 'bold', color: '#1e3a8a', marginVertical: 5 },
  totalSub: { fontSize: 12, color: '#94a3b8' },
});