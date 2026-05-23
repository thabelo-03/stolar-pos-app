import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import * as Print from 'expo-print';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_BASE_URL } from './config';

export default function StockTakeScreen() {
  const router = useRouter();
  const { shopId } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [endDate, setEndDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<'start' | 'end'>('start');
  const [loading, setLoading] = useState(false);
  const [shops, setShops] = useState<any[]>([]);
  const [selectedShop, setSelectedShop] = useState<string>('all');
  const [userRole, setUserRole] = useState<string>('manager');
  const [currency, setCurrency] = useState<'USD' | 'ZAR'>('ZAR');
  const [rates, setRates] = useState({ ZAR: 19.2 });
  
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
    if (shopId) {
      setSelectedShop(Array.isArray(shopId) ? shopId[0] : (shopId || 'all'));
    }
  }, [shopId]);

  useEffect(() => {
    if (shops.length > 0 || userRole === 'cashier') {
        calculateStockTake();
    }
  }, [startDate, endDate, selectedShop, shops]);

  useEffect(() => {
    if (selectedShop !== 'all') {
      fetch(`${API_BASE_URL}/shops/rates/${selectedShop}`)
        .then(res => res.json())
        .then(data => {
          if (data.rates) setRates(data.rates);
        })
        .catch(e => console.log("Rates fetch error", e));
    }
  }, [selectedShop]);

  const convert = (amount: number) => {
    if (currency === 'ZAR') return amount * (rates.ZAR || 19.2);
    return amount;
  };

  const symbol = currency === 'USD' ? '$' : 'R';

  const fetchUserAndShops = async () => {
    try {
      const storedRole = await AsyncStorage.getItem('userRole');
      if (storedRole) {
        setUserRole(storedRole);
      }

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
      const start = new Date(startDate); start.setHours(0, 0, 0, 0);
      const end = new Date(endDate); end.setHours(23, 59, 59, 999);

      // 2. Fetch Sales for the Month
      let salesUrl = `${API_BASE_URL}/sales/recent?startDate=${start.toISOString()}&endDate=${end.toISOString()}&limit=5000`;
      
      // If specific shop selected (or forced for cashier), filter by it
      if (selectedShop !== 'all') salesUrl += `&shopId=${selectedShop}`;
      
      const salesRes = await fetch(salesUrl);
      let sales = await salesRes.json();
      if (!Array.isArray(sales)) sales = [];

      // Client-side filter for 'all' shops (Manager view)
      if (selectedShop === 'all' && shops.length > 0) {
        const shopIds = new Set(shops.map(s => s._id));
        sales = sales.filter((s: any) => {
          const sId = s.shopId && (typeof s.shopId === 'object' ? s.shopId._id : s.shopId);
          return shopIds.has(sId);
        });
      }

      // 3. Fetch Current Inventory
      let productsUrl = `${API_BASE_URL}/products`;
      if (selectedShop !== 'all') productsUrl += `?shopId=${selectedShop}`;
      
      const prodRes = await fetch(productsUrl);
      let products = await prodRes.json();
      if (!Array.isArray(products)) products = [];

      if (selectedShop === 'all' && shops.length > 0) {
        const shopIds = new Set(shops.map(s => s._id));
        products = products.filter((p: any) => {
          const pId = p.shopId && (typeof p.shopId === 'object' ? p.shopId._id : p.shopId);
          return shopIds.has(pId);
        });
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
        const qty = p.stockQuantity !== undefined ? Number(p.stockQuantity) : (Number(p.quantity) || 0);
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
        totalStockManaged: soldCost + inventoryCost,
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
    if (selectedDate) {
      if (pickerMode === 'start') {
        setStartDate(selectedDate);
        if (selectedDate > endDate) setEndDate(selectedDate);
      } else {
        setEndDate(selectedDate);
        if (selectedDate < startDate) setStartDate(selectedDate);
      }
    }
  };

  const openDatePicker = (mode: 'start' | 'end') => {
    setPickerMode(mode);
    setShowDatePicker(true);
  };

  const handleExportPDF = async () => {
    const shopName = selectedShop === 'all' ? 'All Shops' : shops.find(s => s._id === selectedShop)?.name || 'Unknown Shop';
    const dateStr = `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
    const s = symbol;

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
          <h2>${shopName}<br/>${dateStr}</h2>
          
          <div class="summary-box">
            <h3>Cash Flow</h3>
            <div class="row">
              <span class="label">Total Cash Sales (Retail)</span>
              <span class="value">${s}${convert(metrics.totalSalesCash).toFixed(2)}</span>
            </div>
            
            <div class="divider"></div>
            
            <h3>Stock Inventory</h3>
            <div class="row">
               <span class="label">Items Sold (${metrics.itemsSold} units)</span>
               <span class="value">${s}${convert(metrics.soldCost).toFixed(2)} (Cost)</span>
            </div>
            <div class="row">
               <span class="label">Available Stock (${metrics.itemsInStock} units)</span>
               <span class="value">${s}${convert(metrics.inventoryValue).toFixed(2)} (Retail)</span>
            </div>
            <div class="row">
               <span class="label">Available Stock Cost</span>
               <span class="value">${s}${convert(metrics.inventoryCost).toFixed(2)} (Cost)</span>
            </div>
          </div>

          <div class="summary-box">
            <div class="row total-row">
               <span class="label">Total Stock Managed (Retail)</span>
               <span class="value">${s}${convert(metrics.totalSalesCash + metrics.inventoryValue).toFixed(2)}</span>
            </div>
            <div style="text-align: right; font-size: 11px; color: #64748b; margin-top: 3px;">(Sales Retail + Available Retail)</div>
            
            <div class="divider"></div>
            
            <div class="row total-row" style="font-size: 16px; color: #475569;">
               <span class="label">Total Stock Investment (Cost)</span>
               <span class="value">${s}${convert(metrics.soldCost + metrics.inventoryCost).toFixed(2)}</span>
            </div>
            <div style="text-align: right; font-size: 11px; color: #64748b; margin-top: 3px;">(Sold Cost + Available Cost)</div>
          </div>

          <div class="footer">Generated by Stolar POS</div>
        </body>
      </html>
    `;

    const { uri } = await Print.printToFileAsync({ html });
    await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
  };

  const currentShopName = selectedShop === 'all' ? 'All Shops' : shops.find(s => s._id === selectedShop)?.name || 'My Shop';
  const isDark = userRole === 'cashier';

  // Dynamic Theme Colors
  const colors = {
    bg: isDark ? '#0a0f1e' : '#f5f3ff',
    cardBg: isDark ? 'rgba(255, 255, 255, 0.05)' : 'white',
    cardBorder: isDark ? 'rgba(255, 255, 255, 0.08)' : '#f1f5f9',
    primary: isDark ? '#06b6d4' : '#7c3aed',
    primaryLight: isDark ? 'rgba(6, 182, 212, 0.12)' : '#f5f3ff',
    primaryBorder: isDark ? 'rgba(6, 182, 212, 0.15)' : '#ddd6fe',
    textMain: isDark ? '#f1f5f9' : '#0f172a',
    textMuted: isDark ? '#94a3b8' : '#64748b',
    textHighlight: isDark ? '#06b6d4' : '#7c3aed',
    divider: isDark ? 'rgba(255, 255, 255, 0.08)' : '#f1f5f9',
    shadowColor: isDark ? '#000' : '#4f46e5',
    shadowOpacity: isDark ? 0.4 : 0.04,
    inputBg: isDark ? 'rgba(255, 255, 255, 0.04)' : '#f5f3ff',
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <LinearGradient
        colors={isDark ? ['#111827', '#0f172a'] : ['#4f46e5', '#7c3aed', '#9333ea']}
        style={[styles.header, { paddingTop: insets.top + 15 }]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { flex: 1 }]}>Stock Report</Text>
        <TouchableOpacity onPress={handleExportPDF} style={styles.printBtn}>
          <Ionicons name="print-outline" size={24} color="white" />
        </TouchableOpacity>
      </LinearGradient>

      {/* Filters */}
      <View style={[
        styles.filterSection, 
        { 
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'white', 
          borderColor: colors.cardBorder,
          shadowColor: colors.shadowColor,
          shadowOpacity: colors.shadowOpacity,
        }
      ]}>
        <View style={styles.filterRow}>
          <TouchableOpacity 
              style={[styles.currencySelector, { backgroundColor: colors.inputBg, borderColor: colors.primaryBorder }]} 
              onPress={() => setCurrency(prev => prev === 'USD' ? 'ZAR' : 'USD')}
          >
              <Text style={[styles.currencyText, { color: colors.primary }]}>{currency}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.dateSelector, { backgroundColor: colors.inputBg, borderColor: colors.primaryBorder }]} onPress={() => openDatePicker('start')}>
            <Text style={[styles.dateText, { color: colors.primary }]}>
              {startDate.toLocaleDateString(undefined, {month:'numeric', day:'numeric'})}
            </Text>
          </TouchableOpacity>
          
          <Text style={{color: colors.textMuted, marginHorizontal: 5}}>-</Text>

          <TouchableOpacity style={[styles.dateSelector, { backgroundColor: colors.inputBg, borderColor: colors.primaryBorder }]} onPress={() => openDatePicker('end')}>
            <Text style={[styles.dateText, { color: colors.primary }]}>
              {endDate.toLocaleDateString(undefined, {month:'numeric', day:'numeric'})}
            </Text>
            <Ionicons name="calendar-outline" size={16} color={colors.primary} style={{marginLeft: 6}} />
          </TouchableOpacity>
        </View>

        {/* Only show shop selector if user is manager and has multiple shops */}
        {userRole === 'manager' && shops.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.shopScroll}>
            <TouchableOpacity 
                style={[
                  styles.shopChip, 
                  { backgroundColor: colors.inputBg, borderColor: colors.primaryBorder },
                  selectedShop === 'all' && [styles.activeShopChip, { backgroundColor: colors.primary, borderColor: colors.primary }]
                ]} 
                onPress={() => setSelectedShop('all')}
            >
                <Text style={[styles.shopChipText, { color: colors.primary }, selectedShop === 'all' && styles.activeShopChipText]}>All Shops</Text>
            </TouchableOpacity>
            {shops.map((shop) => (
                <TouchableOpacity 
                  key={shop._id} 
                  style={[
                    styles.shopChip, 
                    { backgroundColor: colors.inputBg, borderColor: colors.primaryBorder },
                    selectedShop === shop._id && [styles.activeShopChip, { backgroundColor: colors.primary, borderColor: colors.primary }]
                  ]} 
                  onPress={() => setSelectedShop(shop._id)}
                >
                  <Text style={[styles.shopChipText, { color: colors.primary }, selectedShop === shop._id && styles.activeShopChipText]}>
                    {shop.name}
                  </Text>
                </TouchableOpacity>
            ))}
            </ScrollView>
        )}
      </View>

      {showDatePicker && (
        <DateTimePicker value={pickerMode === 'start' ? startDate : endDate} mode="date" display="default" onChange={onDateChange} />
      )}

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <View style={[
            styles.paperPreview, 
            { 
              backgroundColor: colors.cardBg, 
              borderColor: colors.cardBorder, 
              shadowColor: colors.shadowColor,
              shadowOpacity: colors.shadowOpacity,
            }
          ]}>
            {/* Document Header */}
            <View style={styles.paperHeader}>
              <Text style={[styles.paperTitle, { color: colors.primary }]}>Stock Report</Text>
              <Text style={[styles.paperSubtitle, { color: colors.textMain }]}>{currentShopName}</Text>
              <Text style={[styles.paperDate, { color: colors.textMuted }]}>{startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}</Text>
            </View>

            <View style={[styles.divider, { backgroundColor: colors.divider }]} />

            {/* 1. Monthly Cash */}
            <View style={styles.section}>
              <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>Cash Flow</Text>
              <View style={styles.row}>
                <Text style={[styles.rowLabel, { color: colors.textMain }]}>Total Cash Sales</Text>
                <Text style={[styles.rowValue, { color: colors.textMain }]}>{symbol}{convert(metrics.totalSalesCash).toFixed(2)}</Text>
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: colors.divider }]} />

            {/* 2. Stock Breakdown */}
            <View style={styles.section}>
              <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>Stock Inventory</Text>
              
              <View style={styles.row}>
                <View>
                  <Text style={[styles.rowLabel, { color: colors.textMain }]}>Items Sold</Text>
                  <Text style={[styles.rowSub, { color: colors.textMuted }]}>{metrics.itemsSold} units</Text>
                </View>
                <Text style={[styles.rowValue, { color: colors.textMain }]}>{symbol}{convert(metrics.soldCost).toFixed(2)}</Text>
              </View>

              <View style={[styles.row, { marginTop: 15 }]}>
                <View>
                  <Text style={[styles.rowLabel, { color: colors.textMain }]}>Available Stock (Retail)</Text>
                  <Text style={[styles.rowSub, { color: colors.textMuted }]}>{metrics.itemsInStock} units</Text>
                </View>
                <Text style={[styles.rowValue, { color: colors.textMain }]}>{symbol}{convert(metrics.inventoryValue).toFixed(2)}</Text>
              </View>
              <View style={[styles.row, { marginTop: 8 }]}>
                <Text style={[styles.rowLabel, { fontSize: 13, color: colors.textMuted }]}>Cost Value</Text>
                <Text style={[styles.rowValue, { fontSize: 15, color: colors.textMuted }]}>{symbol}{convert(metrics.inventoryCost).toFixed(2)}</Text>
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: colors.divider }]} />

            {/* 3. Total Stock */}
            <View style={styles.totalSection}>
              <Text style={[styles.totalLabel, { color: colors.textMuted }]}>Total Stock Managed (Retail)</Text>
              <Text style={[styles.totalValue, { color: colors.primary, fontSize: 28 }]}>
                {symbol}{convert(metrics.totalSalesCash + metrics.inventoryValue).toFixed(2)}
              </Text>
              <Text style={[styles.totalSub, { color: colors.textMuted, marginTop: 4 }]}>
                (Sales: {symbol}{convert(metrics.totalSalesCash).toFixed(0)} + Available: {symbol}{convert(metrics.inventoryValue).toFixed(0)})
              </Text>

              <View style={[styles.divider, { backgroundColor: colors.divider, marginVertical: 12, height: 1, width: '80%', alignSelf: 'center' }]} />

              <Text style={[styles.totalLabel, { color: colors.textMuted, fontSize: 11 }]}>Total Stock Investment (Cost)</Text>
              <Text style={[styles.totalValue, { color: colors.textMain, fontSize: 22, marginTop: 2 }]}>
                {symbol}{convert(metrics.soldCost + metrics.inventoryCost).toFixed(2)}
              </Text>
              <Text style={[styles.totalSub, { color: colors.textMuted }]}>
                (Sold Cost: {symbol}{convert(metrics.soldCost).toFixed(0)} + Available Cost: {symbol}{convert(metrics.inventoryCost).toFixed(0)})
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: { padding: 8, backgroundColor: 'rgba(255, 255, 255, 0.15)', borderRadius: 12, marginRight: 15 },
  headerTitle: { color: 'white', fontSize: 20, fontWeight: 'bold', letterSpacing: 0.5 },
  printBtn: { padding: 8, backgroundColor: 'rgba(255, 255, 255, 0.15)', borderRadius: 12 },
  
  filterSection: { padding: 20, paddingBottom: 15, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, borderWidth: 1, borderTopWidth: 0, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, elevation: 2, marginBottom: 15 },
  filterRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  currencySelector: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1, justifyContent: 'center' },
  currencyText: { fontWeight: 'bold', fontSize: 14 },
  dateSelector: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  dateText: { fontSize: 14, fontWeight: 'bold' },
  
  shopScroll: { flexDirection: 'row', marginTop: 15 },
  shopChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 10, borderWidth: 1 },
  activeShopChip: {},
  shopChipText: { fontWeight: '600', fontSize: 13 },
  activeShopChipText: { color: 'white' },

  content: { padding: 20, paddingTop: 5 },
  
  paperPreview: { borderRadius: 20, padding: 25, shadowOffset: { width: 0, height: 4 }, shadowRadius: 16, elevation: 4, marginBottom: 30, borderWidth: 1 },
  paperHeader: { alignItems: 'center', marginBottom: 20 },
  paperTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 1 },
  paperSubtitle: { fontSize: 16, fontWeight: '600' },
  paperDate: { fontSize: 13, marginTop: 2 },
  
  divider: { height: 1, marginVertical: 20 },
  
  section: { marginBottom: 5 },
  sectionHeader: { fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 15, letterSpacing: 0.5 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLabel: { fontSize: 15, fontWeight: '600' },
  rowSub: { fontSize: 12, marginTop: 2 },
  rowValue: { fontSize: 16, fontWeight: 'bold' },
  
  totalSection: { alignItems: 'center', marginTop: 10 },
  totalLabel: { fontSize: 13, textTransform: 'uppercase', fontWeight: 'bold' },
  totalValue: { fontSize: 32, fontWeight: 'bold', marginVertical: 5 },
  totalSub: { fontSize: 12 },
});