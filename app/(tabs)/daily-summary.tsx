import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import * as Print from 'expo-print';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Dimensions, FlatList, Platform, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useActiveShop } from '@/hooks/use-active-shop';
import { useRates } from '@/hooks/use-rates';
import { ThemedView } from '../../components/themed-view';
import { useThemeColor } from '../../hooks/use-theme-color';
import { API_BASE_URL } from '../config';
import { Colors } from '../../constants/theme';

export default function DailySummaryScreen() {
  const router = useRouter();
  const textColor = Colors.dark.text;
  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'daily' | 'weekly'>('daily');
  const insets = useSafeAreaInsets();
  
  const flatListRef = useRef<FlatList>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  
  const [transactions, setTransactions] = useState<any[]>([]);
  const [totalSales, setTotalSales] = useState(0);
  const [totalRefunds, setTotalRefunds] = useState(0);
  const [transactionCount, setTransactionCount] = useState(0);
  const [avgTransaction, setAvgTransaction] = useState(0);
  const [paymentStats, setPaymentStats] = useState({ cash: 0, card: 0, other: 0 });
  const [topItems, setTopItems] = useState<any[]>([]);
  const [chartData, setChartData] = useState({
    labels: ["8am", "10am", "12pm", "2pm", "4pm", "6pm"],
    datasets: [{ data: [0, 0, 0, 0, 0, 0] }]
  });

  const { shopId, userRole, userId, loading: shopLoading } = useActiveShop();
  const [currency, setCurrency] = useState<'USD' | 'ZAR' | 'ZiG'>('ZAR');
  const { rates } = useRates();

  const convert = (amount: number) => {
    if (currency === 'ZAR') return amount * rates.ZAR;
    if (currency === 'ZiG') return amount * rates.ZiG;
    return amount;
  };

  const symbol = currency === 'USD' ? '$' : currency === 'ZAR' ? 'R' : 'ZiG';

  const onChange = (event: any, selectedDate?: Date) => {
    setShowPicker(Platform.OS === 'ios');
    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  const fetchDailySales = async () => {
    if (shopLoading) return;
    setRefreshing(true);
    try {
      let queryParams = '';
      
      if (userId) {
        if (shopId && userRole !== 'admin') {
          queryParams = `?shopId=${shopId}`;
        }
      }

      const response = await fetch(`${API_BASE_URL}/sales${queryParams}`);
      const data = await response.json();

      if (response.ok && Array.isArray(data)) {
        console.log(`Daily Summary: Fetched ${data.length} sales`);
        let daysSales = [];
        let chartLabels = [];
        let chartDataPoints = [];

        if (viewMode === 'daily') {
          // 1. Filter for selected date
          const selectedDateStr = date.toDateString();
          daysSales = data.filter((s: any) => new Date(s.date).toDateString() === selectedDateStr);

          // Hourly chart logic
          const hourlyTotals = new Array(24).fill(0);
          daysSales.forEach((sale: any) => {
            if (sale.refunded) return;
            const hour = new Date(sale.date).getHours();
            hourlyTotals[hour] += convert(sale.total || sale.amount || 0);
          });
          chartLabels = ["8am", "10am", "12pm", "2pm", "4pm", "6pm"];
          chartDataPoints = [8, 10, 12, 14, 16, 18].map(h => hourlyTotals[h]);
        } else {
          // Weekly logic (Last 7 days ending on selected date)
          const endDate = new Date(date);
          endDate.setHours(23, 59, 59, 999);
          const startDate = new Date(date);
          startDate.setDate(date.getDate() - 6);
          startDate.setHours(0, 0, 0, 0);

          daysSales = data.filter((s: any) => {
            const d = new Date(s.date);
            return d >= startDate && d <= endDate;
          });

          // Daily totals for chart
          for (let i = 0; i < 7; i++) {
            const d = new Date(startDate);
            d.setDate(startDate.getDate() + i);
            chartLabels.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
            
            const dayStart = new Date(d); dayStart.setHours(0,0,0,0);
            const dayEnd = new Date(d); dayEnd.setHours(23,59,59,999);
            
            const daySum = daysSales
              .filter((s: any) => {
                const sd = new Date(s.date);
                return sd >= dayStart && sd <= dayEnd && !s.refunded;
              })
              .reduce((acc: number, curr: any) => acc + convert(curr.total || curr.amount || 0), 0);
            chartDataPoints.push(daySum);
          }
        }

        // 2. Calculate Totals
        const validSales = daysSales.filter((s: any) => !s.refunded);
        const refundedSales = daysSales.filter((s: any) => s.refunded);
        const total = validSales.reduce((sum: number, item: any) => sum + convert(item.total || item.amount || 0), 0);
        const refunds = refundedSales.reduce((sum: number, item: any) => sum + convert(item.total || item.amount || 0), 0);
        
        setTotalSales(total);
        setTotalRefunds(refunds);
        setTransactionCount(validSales.length);
        setAvgTransaction(validSales.length ? total / validSales.length : 0);
        
        // 3. Payment Stats
        const pStats = { cash: 0, card: 0, other: 0 };
        validSales.forEach((s: any) => {
            const method = (s.paymentMethod || 'cash').toLowerCase();
            const amt = convert(s.total || s.amount || 0);
            if (method.includes('card')) pStats.card += amt;
            else if (method.includes('cash')) pStats.cash += amt;
            else pStats.other += amt;
        });
        setPaymentStats(pStats);

        // 4. Top Items
        const itemMap = new Map();
        validSales.forEach((s: any) => {
            if (Array.isArray(s.items)) {
                s.items.forEach((i: any) => {
                    const current = itemMap.get(i.name) || 0;
                    itemMap.set(i.name, current + (i.quantity || 1));
                });
            }
        });
        const sortedItems = Array.from(itemMap.entries())
            .map(([name, qty]) => ({ name, qty }))
            .sort((a: any, b: any) => b.qty - a.qty)
            .slice(0, 3);
        setTopItems(sortedItems);

        // 5. Update List (Newest first)
        setTransactions([...daysSales].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));

        setChartData({
          labels: chartLabels,
          datasets: [{ data: chartDataPoints }]
        });
      }
    } catch (error) {
      console.log('Error fetching daily sales:', error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!shopLoading) {
      fetchDailySales();
    }
  }, [date, viewMode, shopLoading, shopId, currency, rates]);

  const onRefresh = () => {
    fetchDailySales();
  };

  const generatePDF = async () => {
    const html = `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Outfit:wght@400;600;800&display=swap" rel="stylesheet">
          <style>
            body { 
              font-family: 'Inter', -apple-system, sans-serif; 
              padding: 24px; 
              color: #1e293b;
              background-color: #ffffff;
              margin: 0;
            }
            .header-banner {
              background: linear-gradient(135deg, #0a0f1e 0%, #162444 100%);
              border-radius: 16px;
              padding: 24px;
              color: #ffffff;
              margin-bottom: 24px;
              box-shadow: 0 4px 12px rgba(10, 15, 30, 0.15);
            }
            .header-title {
              font-family: 'Outfit', sans-serif;
              font-size: 22px;
              font-weight: 800;
              margin: 0;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              color: #06b6d4;
            }
            .header-subtitle {
              font-size: 13px;
              color: rgba(255, 255, 255, 0.85);
              margin-top: 6px;
              font-weight: 500;
            }
            
            /* KPI Grid */
            .kpi-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 12px;
              margin-bottom: 24px;
            }
            .kpi-card {
              border: 1px solid #e2e8f0;
              border-radius: 14px;
              padding: 12px;
              background-color: #f8fafc;
              text-align: center;
            }
            .kpi-label {
              font-size: 9px;
              font-weight: 700;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 4px;
            }
            .kpi-value {
              font-size: 16px;
              font-weight: 800;
              color: #0f172a;
            }
            .kpi-highlight {
              background-color: #f0fdf4;
              border-color: #bbf7d0;
            }
            .kpi-highlight .kpi-label {
              color: #16a34a;
            }
            .kpi-highlight .kpi-value {
              color: #14532d;
            }
            .kpi-danger {
              background-color: #fef2f2;
              border-color: #fca5a5;
            }
            .kpi-danger .kpi-label {
              color: #ef4444;
            }
            .kpi-danger .kpi-value {
              color: #7f1d1d;
            }

            .section-title {
              font-family: 'Outfit', sans-serif;
              font-size: 14px;
              font-weight: 800;
              color: #0f172a;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              border-bottom: 2px solid #cbd5e1;
              padding-bottom: 6px;
              margin-top: 24px;
              margin-bottom: 12px;
            }

            /* Table Styling */
            table { 
              width: 100%; 
              border-collapse: collapse; 
              font-size: 12px;
              margin-top: 10px;
            }
            th { 
              background-color: #f8fafc; 
              color: #475569; 
              font-weight: 700; 
              text-transform: uppercase;
              letter-spacing: 0.5px;
              font-size: 11px;
              border-bottom: 2px solid #cbd5e1;
              padding: 10px 8px;
              text-align: left;
            }
            td { 
              border-bottom: 1px solid #f1f5f9; 
              padding: 10px 8px; 
              color: #334155;
            }
            tr:nth-child(even) td { 
              background-color: #fafbfb; 
            }
            .refund-row td { 
              color: #94a3b8; 
              background-color: #fef2f2 !important; 
            }
            .refund-text { 
              text-decoration: line-through; 
              color: #ef4444; 
            }
            
            .footer { 
              margin-top: 48px; 
              text-align: center; 
              font-size: 10px; 
              color: #94a3b8; 
              border-top: 1px solid #f1f5f9;
              padding-top: 16px;
              font-weight: 500;
            }
          </style>
        </head>
        <body>
          <div class="header-banner">
            <h1 class="header-title">${viewMode === 'daily' ? 'Daily' : 'Weekly'} Sales Summary</h1>
            <div class="header-subtitle">Generated on ${new Date().toLocaleString()} for ${date.toLocaleDateString()}</div>
          </div>

          <div class="kpi-grid">
            <div class="kpi-card kpi-highlight">
              <div class="kpi-label">Total Revenue</div>
              <div class="kpi-value">${symbol} ${totalSales.toFixed(2)}</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Transactions</div>
              <div class="kpi-value">${transactionCount}</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Avg Ticket</div>
              <div class="kpi-value">${symbol} ${avgTransaction.toFixed(2)}</div>
            </div>
            <div class="kpi-card kpi-danger">
              <div class="kpi-label">Refunds</div>
              <div class="kpi-value">${symbol} ${totalRefunds.toFixed(2)}</div>
            </div>
          </div>

          <div class="section-title">Payment Breakdown</div>
          <table>
            <thead>
              <tr>
                <th>Payment Method</th>
                <th style="text-align: right;">Total Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="font-weight: 600; color: #10b981;">Cash</td>
                <td style="text-align: right; font-weight: 700; color: #0f172a;">${symbol} ${paymentStats.cash.toFixed(2)}</td>
              </tr>
              <tr>
                <td style="font-weight: 600; color: #3b82f6;">Card</td>
                <td style="text-align: right; font-weight: 700; color: #0f172a;">${symbol} ${paymentStats.card.toFixed(2)}</td>
              </tr>
              <tr>
                <td style="font-weight: 600; color: #f59e0b;">Other</td>
                <td style="text-align: right; font-weight: 700; color: #0f172a;">${symbol} ${paymentStats.other.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>

          <div class="section-title">Top Selling Items</div>
          <table>
            <thead>
              <tr>
                <th style="width: 50px;">Rank</th>
                <th>Item Name</th>
                <th style="text-align: right;">Quantity Sold</th>
              </tr>
            </thead>
            <tbody>
              ${topItems.map((item, index) => `
                <tr>
                  <td style="font-weight: 700; color: #06b6d4;">#${index + 1}</td>
                  <td style="font-weight: 600; color: #0f172a;">${item.name}</td>
                  <td style="text-align: right; font-weight: 700; color: #475569;">${item.qty} units</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="section-title">Transaction History</div>
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Details</th>
                <th>Method</th>
                <th style="text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${transactions.map(t => `
                <tr class="${t.refunded ? 'refund-row' : ''}">
                  <td style="color: #64748b; font-weight: 500;">${new Date(t.date).toLocaleDateString([], { month: 'short', day: 'numeric' })} ${new Date(t.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                  <td style="font-weight: 600; color: #0f172a;">${Array.isArray(t.items) ? t.items.length + ' items' : t.items} ${t.refunded ? '<span style="color: #ef4444; font-weight: 700;">(Refunded)</span>' : ''}</td>
                  <td style="text-transform: capitalize; color: #475569; font-weight: 500;">${t.paymentMethod || 'Cash'}</td>
                  <td style="text-align: right;" class="${t.refunded ? 'refund-text' : ''} font-weight: 700;">${symbol} ${convert(t.total || t.amount || 0).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="footer">
            Stolar POS System • Cashier Daily Shift Shift Summary Audit
          </div>
        </body>
      </html>
    `;

    try {
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (error) {
      Alert.alert('Error', 'Failed to generate or share PDF');
    }
  };

  const renderHeader = () => (
    <View>
      {/* Header */}
      <LinearGradient colors={['#0a0f1e', '#162444']} style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.topRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#f1f5f9" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{viewMode === 'daily' ? 'Daily Summary' : 'Weekly Summary'}</Text>
          <TouchableOpacity onPress={generatePDF} style={styles.backButton}>
            <Ionicons name="share-outline" size={24} color="#f1f5f9" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.controlsRow}>
          <TouchableOpacity 
            style={styles.currencySelector} 
            onPress={() => setCurrency(prev => prev === 'USD' ? 'ZAR' : prev === 'ZAR' ? 'ZiG' : 'USD')}
          >
            <Text style={styles.dateText}>{currency}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.dateSelector} onPress={() => setShowPicker(true)}>
            <Ionicons name="calendar" size={18} color="#06b6d4" />
            <Text style={styles.dateText}>{date.toLocaleDateString()}</Text>
            <Ionicons name="chevron-down" size={14} color="#06b6d4" />
          </TouchableOpacity>

          <View style={styles.viewToggle}>
            <TouchableOpacity 
              style={[styles.toggleBtn, viewMode === 'daily' && styles.toggleBtnActive]} 
              onPress={() => setViewMode('daily')}
            >
              <Text style={[styles.toggleText, viewMode === 'daily' && styles.toggleTextActive]}>Day</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.toggleBtn, viewMode === 'weekly' && styles.toggleBtnActive]} 
              onPress={() => setViewMode('weekly')}
            >
              <Text style={[styles.toggleText, viewMode === 'weekly' && styles.toggleTextActive]}>Week</Text>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      {showPicker && (
        <DateTimePicker
          value={date}
          mode="date"
          display="default"
          onChange={onChange}
        />
      )}

      {/* Key Metrics */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Total Sales</Text>
          <Text style={styles.statValue}>{symbol} {totalSales.toFixed(2)}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Count</Text>
          <Text style={styles.statValue}>{transactionCount}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Avg Value</Text>
          <Text style={styles.statValue}>{symbol} {avgTransaction.toFixed(2)}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statLabel, { color: '#f43f5e' }]}>Refunds</Text>
          <Text style={[styles.statValue, { color: '#f43f5e' }]}>{symbol} {totalRefunds.toFixed(2)}</Text>
        </View>
      </View>

      {/* Chart */}
      <View style={styles.chartCard}>
        <Text style={styles.sectionTitle}>Sales Trend</Text>
        <LineChart
          data={chartData}
          width={Dimensions.get("window").width - 40}
          height={180}
          yAxisLabel={symbol === '$' ? '$' : ''}
          yAxisSuffix=""
          yAxisInterval={1}
          chartConfig={{
            backgroundColor: "#111827",
            backgroundGradientFrom: "#111827",
            backgroundGradientTo: "#111827",
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(6, 182, 212, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(148, 163, 184, ${opacity})`,
            style: { borderRadius: 16 },
            propsForDots: { r: "4", strokeWidth: "2", stroke: "#06b6d4" }
          }}
          bezier
          style={{ marginVertical: 8, borderRadius: 16 }}
        />
      </View>

      {/* Payment Breakdown */}
      <View style={styles.rowContainer}>
        <View style={[styles.paymentCard, { backgroundColor: 'rgba(16, 185, 129, 0.08)', borderColor: 'rgba(16, 185, 129, 0.2)', borderWidth: 1 }]}>
          <Ionicons name="cash-outline" size={20} color="#10b981" />
          <Text style={[styles.paymentLabel, { color: '#10b981' }]}>Cash</Text>
          <Text style={[styles.paymentValue, { color: '#34d399' }]}>{symbol} {paymentStats.cash.toFixed(0)}</Text>
        </View>
        <View style={[styles.paymentCard, { backgroundColor: 'rgba(37, 99, 235, 0.08)', borderColor: 'rgba(37, 99, 235, 0.2)', borderWidth: 1 }]}>
          <Ionicons name="card-outline" size={20} color="#3b82f6" />
          <Text style={[styles.paymentLabel, { color: '#3b82f6' }]}>Card</Text>
          <Text style={[styles.paymentValue, { color: '#60a5fa' }]}>{symbol} {paymentStats.card.toFixed(0)}</Text>
        </View>
        <View style={[styles.paymentCard, { backgroundColor: 'rgba(245, 158, 11, 0.08)', borderColor: 'rgba(245, 158, 11, 0.2)', borderWidth: 1 }]}>
          <Ionicons name="wallet-outline" size={20} color="#f59e0b" />
          <Text style={[styles.paymentLabel, { color: '#f59e0b' }]}>Other</Text>
          <Text style={[styles.paymentValue, { color: '#fbbf24' }]}>{symbol} {paymentStats.other.toFixed(0)}</Text>
        </View>
      </View>

      {/* Top Items */}
      {topItems.length > 0 && (
        <View style={styles.topItemsCard}>
          <Text style={styles.sectionTitle}>Top Selling Items</Text>
          {topItems.map((item, index) => (
            <View key={index} style={styles.topItemRow}>
              <View style={styles.rankBadge}><Text style={styles.rankText}>{index + 1}</Text></View>
              <Text style={styles.topItemName}>{item.name}</Text>
              <Text style={styles.topItemQty}>{item.qty} sold</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={[styles.sectionTitle, { marginTop: 20, marginBottom: 10, paddingHorizontal: 20 }]}>Recent Transactions</Text>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={transactions}
        keyExtractor={(item) => item.id || item._id || Math.random().toString()}
        ListHeaderComponent={renderHeader}
        renderItem={({ item }) => (
          <View style={[styles.transactionCard, item.refunded && { opacity: 0.6 }]}>
            <View style={styles.transLeft}>
              <View style={styles.iconBox}>
                <MaterialCommunityIcons name={item.refunded ? "refresh" : "receipt"} size={20} color={item.refunded ? "#f43f5e" : "#94a3b8"} />
              </View>
              <View>
                <Text style={[styles.transAmount, item.refunded && { textDecorationLine: 'line-through', color: '#64748b' }]}>
                  {symbol} {convert(item.total || item.amount || 0).toFixed(2)}
                </Text>
                <Text style={styles.transItems}>
                  {Array.isArray(item.items) ? `${item.items.length} items` : (item.items || 'Sale')}
                  {item.refunded && <Text style={{ color: '#f43f5e', fontWeight: 'bold' }}> • Refunded</Text>}
                </Text>
              </View>
            </View>
            <Text style={styles.transTime}>
              {new Date(item.date).toLocaleDateString([], { month: 'short', day: 'numeric' })} {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#06b6d4" colors={["#06b6d4"]} />
        }
        onScroll={(e) => setShowScrollTop(e.nativeEvent.contentOffset.y > 300)}
        scrollEventThrottle={16}
      />

      {showScrollTop && (
        <TouchableOpacity 
          style={styles.scrollTopButton} 
          onPress={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })}
        >
          <Ionicons name="arrow-up" size={24} color="white" />
        </TouchableOpacity>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.bg },
  header: {
    paddingBottom: 60, // Extra space for overlapping cards
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    marginBottom: -40, // Pull up content
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  backButton: { padding: 8, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 12 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.dark.text },
  
  controlsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 10 },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderColor: Colors.dark.border,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
  },
  dateText: { color: Colors.dark.text, fontWeight: 'bold', fontSize: 14 },
  currencySelector: { backgroundColor: Colors.dark.surface, borderColor: Colors.dark.border, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 20, marginRight: 8 },

  viewToggle: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 20, padding: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  toggleBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16 },
  toggleBtnActive: { backgroundColor: '#06b6d4' },
  toggleText: { color: Colors.dark.textSecondary, fontWeight: '600', fontSize: 12 },
  toggleTextActive: { color: '#0a0f1e', fontWeight: 'bold' },

  statsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 10, gap: 10 },
  statCard: { width: '48%', backgroundColor: Colors.dark.surface, borderColor: Colors.dark.border, borderWidth: 1, padding: 15, borderRadius: 16, alignItems: 'center', marginBottom: 10 },
  statLabel: { fontSize: 12, color: Colors.dark.textSecondary, marginBottom: 4, fontWeight: '600' },
  statValue: { fontSize: 16, fontWeight: 'bold', color: Colors.dark.text },

  chartCard: { backgroundColor: Colors.dark.surface, borderColor: Colors.dark.border, borderWidth: 1, marginHorizontal: 20, borderRadius: 16, padding: 10, marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: Colors.dark.text, marginBottom: 10 },

  rowContainer: { flexDirection: 'row', paddingHorizontal: 20, gap: 10, marginBottom: 20 },
  paymentCard: { flex: 1, padding: 12, borderRadius: 12, alignItems: 'center' },
  paymentLabel: { fontSize: 12, fontWeight: '600', marginTop: 4 },
  paymentValue: { fontSize: 14, fontWeight: 'bold', marginTop: 2 },

  topItemsCard: { backgroundColor: Colors.dark.surface, borderColor: Colors.dark.border, borderWidth: 1, marginHorizontal: 20, borderRadius: 16, padding: 15 },
  topItemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  rankBadge: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(6, 182, 212, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  rankText: { color: '#06b6d4', fontWeight: 'bold', fontSize: 12 },
  topItemName: { flex: 1, fontSize: 14, color: Colors.dark.text, fontWeight: '500' },
  topItemQty: { fontSize: 12, color: Colors.dark.textSecondary },

  listContent: { paddingBottom: 120 },
  transactionCard: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    backgroundColor: Colors.dark.surface, 
    borderColor: Colors.dark.border,
    borderWidth: 1,
    marginHorizontal: 20, 
    marginBottom: 10, 
    padding: 15, 
    borderRadius: 12,
  },
  transLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.04)', justifyContent: 'center', alignItems: 'center' },
  transAmount: { fontSize: 16, fontWeight: 'bold', color: Colors.dark.text },
  transItems: { fontSize: 12, color: Colors.dark.textSecondary },
  transTime: { fontSize: 12, color: Colors.dark.textMuted, fontWeight: '500' },
  scrollTopButton: {
    position: 'absolute',
    bottom: 110,
    right: 20,
    backgroundColor: '#06b6d4',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84,
  },
});