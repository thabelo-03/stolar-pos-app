import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { API_BASE_URL } from '../config';

const SCREEN_WIDTH = Dimensions.get('window').width;

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

interface ChartPoint {
  label: string;
  value: number;
}

export default function SubscriptionReports() {
  const router = useRouter();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [filteredPayments, setFilteredPayments] = useState<PaymentRecord[]>([]);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [stats, setStats] = useState({ totalCollected: 0, activeMRR: 0, count: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSubscriptionData = async () => {
    try {
      if (!refreshing) setLoading(true);
      
      // 1. Fetch Payment History
      const historyRes = await fetch(`${API_BASE_URL}/admin/payment-history`);
      const historyData = await historyRes.json();
      const rawPayments = Array.isArray(historyData?.history) ? historyData.history : [];
      
      // 2. Fetch Users to calculate active MRR
      const usersRes = await fetch(`${API_BASE_URL}/users`);
      const usersData = await usersRes.json();
      const safeUsers = Array.isArray(usersData) ? usersData : [];

      // Calculate MRR from active manager subscriptions
      const activeMRR = safeUsers.reduce((acc: number, user: any) => {
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

      // Process raw payments
      setPayments(rawPayments);
      setFilteredPayments(rawPayments);

      // Calculate Stats
      const totalColl = rawPayments.reduce((sum: number, item: any) => sum + (item.amount || 0), 0);
      setStats({
        totalCollected: totalColl,
        activeMRR,
        count: rawPayments.length
      });

      // Format Chart Data (group by date)
      const dailyMap: Record<string, number> = {};
      const sortedPayments = [...rawPayments].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      sortedPayments.forEach(payment => {
        const d = new Date(payment.date);
        const dayLabel = `${d.getDate()}/${d.getMonth() + 1}`;
        dailyMap[dayLabel] = (dailyMap[dayLabel] || 0) + payment.amount;
      });

      const points = Object.keys(dailyMap).map(k => ({
        label: k,
        value: dailyMap[k]
      })).slice(-7); // Last 7 data points

      setChartData(points);

    } catch (e) {
      console.error("Failed to fetch subscription data:", e);
      Alert.alert("Error", "Could not fetch subscription reports.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSubscriptionData();
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredPayments(payments);
    } else {
      const q = searchTerm.toLowerCase();
      const filtered = payments.filter(p => 
        (p.managerName && p.managerName.toLowerCase().includes(q)) || 
        (p.managerEmail && p.managerEmail.toLowerCase().includes(q)) ||
        (p.details && p.details.toLowerCase().includes(q))
      );
      setFilteredPayments(filtered);
    }
  }, [searchTerm, payments]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchSubscriptionData();
  }, []);

  const handleLogout = async () => {
    await AsyncStorage.clear();
    router.replace('/(auth)/login');
  };

  const handleExportPDF = async () => {
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
              background: linear-gradient(135deg, #0284c7 0%, #0ea5e9 100%);
              border-radius: 16px;
              padding: 24px;
              color: #ffffff;
              margin-bottom: 24px;
            }
            .header-title {
              font-family: 'Outfit', sans-serif;
              font-size: 22px;
              font-weight: 800;
              margin: 0;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .header-subtitle {
              font-size: 13px;
              color: rgba(255, 255, 255, 0.85);
              margin-top: 6px;
              font-weight: 500;
            }
            
            .kpi-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 16px;
              margin-bottom: 28px;
            }
            .kpi-card {
              border: 1px solid #e2e8f0;
              border-radius: 14px;
              padding: 16px;
              background-color: #f8fafc;
              text-align: center;
            }
            .kpi-label {
              font-size: 10px;
              font-weight: 700;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 6px;
            }
            .kpi-value {
              font-size: 18px;
              font-weight: 800;
              color: #0f172a;
            }

            table { 
              width: 100%; 
              border-collapse: collapse; 
              font-size: 11px;
              margin-top: 20px;
            }
            th { 
              background-color: #f8fafc; 
              color: #475569; 
              font-weight: 700; 
              text-transform: uppercase;
              letter-spacing: 0.5px;
              font-size: 10px;
              border-bottom: 2px solid #cbd5e1;
              padding: 12px 10px;
              text-align: left;
            }
            td { 
              border-bottom: 1px solid #f1f5f9; 
              padding: 12px 10px; 
              color: #334155;
            }
            tr:nth-child(even) td { 
              background-color: #fafbfb; 
            }
            .amount-text {
              font-weight: 700;
              color: #10b981;
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
            <h1 class="header-title">Platform Subscription Earnings Report</h1>
            <div class="header-subtitle">Generated on ${new Date().toLocaleString()}</div>
          </div>
          
          <div class="kpi-grid">
            <div class="kpi-card">
              <div class="kpi-label">Total Cash Collected</div>
              <div class="kpi-value">R ${stats.totalCollected.toFixed(2)}</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Active Monthly MRR</div>
              <div class="kpi-value">R ${stats.activeMRR.toFixed(2)}</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Total Transactions</div>
              <div class="kpi-value">${stats.count}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Manager</th>
                <th>Email</th>
                <th>Plan Details</th>
                <th>Duration</th>
                <th style="text-align: right;">Amount Paid</th>
              </tr>
            </thead>
            <tbody>
              ${filteredPayments.map(item => {
                const dateObj = item.date ? new Date(item.date) : null;
                const formattedDate = dateObj && !isNaN(dateObj.getTime())
                  ? `${dateObj.toLocaleDateString()} ${dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                  : 'N/A';
                const amountPaid = typeof item.amount === 'number' ? item.amount.toFixed(2) : '0.00';
                return `
                  <tr>
                    <td style="color: #64748b; font-weight: 500;">${formattedDate}</td>
                    <td style="font-weight: 600;">${item.managerName || 'N/A'}</td>
                    <td>${item.managerEmail || 'N/A'}</td>
                    <td>${item.details || 'Manual Activation'}</td>
                    <td>${item.months || 0} month(s)</td>
                    <td style="text-align: right;" class="amount-text">R ${amountPaid}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
          
          <div class="footer">
            Stolar POS Platform • Owner Executive Intelligence
          </div>
        </body>
      </html>
    `;
    try {
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (error) { 
      Alert.alert('Error', 'Failed to generate PDF'); 
    }
  };

  const renderHeader = () => (
    <View>
      {/* Summary Cards */}
      <View style={styles.summaryContainer}>
        <LinearGradient
          colors={['#10b981', '#059669']}
          style={styles.summaryCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.summaryIconBox}>
            <Ionicons name="cash" size={20} color="white" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.summaryLabel}>Total Earnings</Text>
            <Text style={styles.summaryValue}>R{stats.totalCollected.toFixed(2)}</Text>
          </View>
        </LinearGradient>

        <LinearGradient
          colors={['#0284c7', '#0ea5e9']}
          style={styles.summaryCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.summaryIconBox}>
            <Ionicons name="stats-chart" size={20} color="white" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.summaryLabel}>Monthly MRR</Text>
            <Text style={styles.summaryValue}>R{stats.activeMRR.toFixed(2)}</Text>
          </View>
        </LinearGradient>
      </View>

      {/* Chart Section */}
      {chartData.length > 0 && (
        <View style={styles.chartWrapper}>
          <Text style={styles.sectionTitle}>Revenue Cash Flows</Text>
          <LineChart
            data={{
              labels: chartData.map(d => d.label),
              datasets: [{ data: chartData.map(d => d.value) }]
            }}
            width={SCREEN_WIDTH - 48}
            height={160}
            yAxisLabel="R"
            chartConfig={chartConfig}
            bezier
            style={styles.chart}
          />
        </View>
      )}

      <Text style={[styles.sectionTitle, { marginLeft: 24, marginTop: 10, marginBottom: 12 }]}>Subscription History</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      <LinearGradient
        colors={['#0284c7', '#0ea5e9', '#38bdf8']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerTopRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
            <Ionicons name="arrow-back" size={20} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerCenterTitle}>Earnings Console</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity onPress={handleExportPDF} style={styles.iconButton}>
              <Ionicons name="document-text-outline" size={20} color="white" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleLogout} style={styles.iconButton}>
              <Ionicons name="log-out-outline" size={20} color="white" />
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.title}>Subscription Reports</Text>
        <Text style={styles.subtitle}>Track Earnings & Monthly Recurring Revenue</Text>

        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#94a3b8" />
          <TextInput
            placeholder="Search by manager name or email..."
            placeholderTextColor="#94a3b8"
            style={styles.searchInput}
            value={searchTerm}
            onChangeText={setSearchTerm}
            autoCapitalize="none"
          />
          {searchTerm.length > 0 && (
            <Ionicons 
              name="close-circle" 
              size={18} 
              color="#cbd5e1" 
              onPress={() => setSearchTerm('')} 
            />
          )}
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0ea5e9" />
        </View>
      ) : (
        <FlatList
          data={filteredPayments}
          keyExtractor={(item) => item._id}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={{ paddingBottom: 50 }}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh} 
              colors={['#0ea5e9']} 
              tintColor="#0ea5e9" 
            />
          }
          renderItem={({ item }) => (
            <View style={styles.paymentCard}>
              <View style={styles.iconBox}>
                <Ionicons name="card-outline" size={20} color="#0ea5e9" />
              </View>
              <View style={styles.paymentInfo}>
                <Text style={styles.paymentName}>{item.managerName || 'Platform Manager'}</Text>
                <Text style={styles.paymentSub}>{item.managerEmail || 'N/A'}</Text>
                <Text style={styles.paymentDetails}>{item.details || 'Subscription Payment'} ({item.months} mo)</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.paymentAmount}>+R{item.amount.toFixed(2)}</Text>
                <Text style={styles.paymentDate}>
                  {new Date(item.date).toLocaleDateString()}
                </Text>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.center}>
               <Text style={{color: '#94a3b8', marginTop: 40, fontWeight: '600'}}>No subscription payments found.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

// Chart Configuration
const chartConfig = {
  backgroundColor: '#ffffff',
  backgroundGradientFrom: '#ffffff',
  backgroundGradientTo: '#ffffff',
  decimalPlaces: 0, 
  color: (opacity = 1) => `rgba(14, 165, 233, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`,
  style: { borderRadius: 16 },
  propsForDots: {
    r: '4',
    strokeWidth: '2',
    stroke: '#38bdf8',
  },
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f9ff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header
  header: {
    paddingHorizontal: 24,
    paddingTop: 50,
    paddingBottom: 20,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    shadowColor: "#0ea5e9",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenterTitle: {
    color: 'white',
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: { fontSize: 24, fontWeight: '800', color: 'white' },
  subtitle: { fontSize: 13, color: '#f0f9ff', marginTop: 4, fontWeight: '500', opacity: 0.9 },

  // Search Bar
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    marginTop: 15,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#0f172a',
  },

  // Summary Cards
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginTop: -20,
    marginBottom: 20,
    zIndex: 10,
    elevation: 5,
  },
  summaryCard: {
    width: '48%',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  summaryLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryValue: { color: 'white', fontSize: 16, fontWeight: '800', marginTop: 2 },

  // Chart
  chartWrapper: {
    backgroundColor: 'white',
    marginHorizontal: 24,
    borderRadius: 24,
    padding: 16,
    shadowColor: '#0ea5e9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e0f2fe',
    marginBottom: 20,
  },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: '#334155', textTransform: 'uppercase', letterSpacing: 0.5 },
  chart: { borderRadius: 16, marginTop: 12 },

  // List Item
  paymentCard: {
    backgroundColor: 'white',
    marginHorizontal: 24,
    marginBottom: 12,
    padding: 14,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#0ea5e9',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#e0f2fe',
  },
  iconBox: {
    width: 40, height: 40,
    backgroundColor: '#e0f2fe',
    borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 12,
  },
  paymentInfo: { flex: 1 },
  paymentName: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  paymentSub: { fontSize: 11, color: '#64748b', marginTop: 1 },
  paymentDetails: { fontSize: 11, color: '#0ea5e9', fontWeight: '600', marginTop: 2 },
  paymentAmount: { fontSize: 14, fontWeight: '800', color: '#10b981' },
  paymentDate: { fontSize: 10, color: '#94a3b8', fontWeight: '600', marginTop: 4 },
});
