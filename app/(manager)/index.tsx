import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, FlatList, Linking, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { BarChart, PieChart } from 'react-native-chart-kit';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_BASE_URL } from '../config';
import { useRates } from '../../hooks/use-rates';

interface Shop {
  _id: string;
  name: string;
  location: string;
  branchCode: string;
  manager?: string;
}

interface User {
  name: string;
  email: string;
  subscriptionStatus?: string; 
  shopId?: string;
}

const ManagerIndex = () => {
  const [shops, setShops] = useState<Shop[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [menuVisible, setMenuVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingShop, setEditingShop] = useState<Shop | null>(null);
  const [editName, setEditName] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editManagerId, setEditManagerId] = useState('');
  const [saving, setSaving] = useState(false);
  const [shopSelectionVisible, setShopSelectionVisible] = useState(false);
  const [trialModalVisible, setTrialModalVisible] = useState(false);
  const [chartData, setChartData] = useState({
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    datasets: [{ data: [0, 0, 0, 0, 0, 0, 0] }]
  });
  const [pieChartData, setPieChartData] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [startDate, setStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 6)));
  const [endDate, setEndDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<'start' | 'end'>('start');
  const [allSales, setAllSales] = useState<any[]>([]);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { rates } = useRates();

  useFocusEffect(
    React.useCallback(() => {
    const fetchData = async () => {
      try {
        const userId = await AsyncStorage.getItem('userId');
        if (!userId) {
          throw new Error('User not logged in');
        }

        // Fetch user data
        const userResponse = await fetch(`${API_BASE_URL}/users/${userId}`);
        if (!userResponse.ok) {
          throw new Error('Failed to fetch user data');
        }
        const userData = await userResponse.json();
        console.log("Fetched User Data:", userData);
        console.log("User Role:", userData.role);

        console.log("Subscription Status:", userData.subscriptionStatus);
        
        // Check real subscription status (30-day trial logic handled by backend dates)
        if (userData.role === 'manager' && userData.subscriptionStatus === 'expired') {
          console.log("Subscription expired. Redirecting...");
          router.replace('/(manager)/subscription');
          return;
        }
        setUser(userData);

        // Fetch all shops data
        const shopResponse = await fetch(`${API_BASE_URL}/shops?managerId=${userId}`);
        let currentShops: Shop[] = [];
        if (shopResponse.ok) {
          const shopData = await shopResponse.json();
          setShops(shopData);
          currentShops = shopData;
        } else if (shopResponse.status === 404) {
          setShops([]);
        } else {
          throw new Error('Failed to fetch shops');
        }

        // Get IDs of shops owned by this manager to filter global data
        const myShopIds = new Set(currentShops.map(s => s._id));

        // Fetch notifications for badge count
        const notifResponse = await fetch(`${API_BASE_URL}/notifications/${userId}`);
        if (notifResponse.ok) {
          const notifs = await notifResponse.json();
          const count = notifs.filter((n: any) => !n.isRead).length;
          setUnreadCount(count);
        }

        // Fetch sales for chart
        const salesRes = await fetch(`${API_BASE_URL}/sales?managerId=${userId}`);
        if (salesRes.ok) {
          const salesData = await salesRes.json();
          if (Array.isArray(salesData)) {
            // Filter sales to only those belonging to the manager's shops
            const mySales = salesData.filter((s: any) => myShopIds.has(s.shopId));
            setAllSales(mySales);
          }
        }

        // Fetch products for low stock alerts
        const productsRes = await fetch(`${API_BASE_URL}/products`);
        if (productsRes.ok) {
          const productsData = await productsRes.json();
          if (Array.isArray(productsData)) {
            // Filter products to only those belonging to the manager's shops
            const myProducts = productsData.filter((p: any) => myShopIds.has(p.shopId));
            const low = myProducts
              .map((p: any) => ({
                ...p,
                quantity: p.stockQuantity !== undefined ? Number(p.stockQuantity) : (Number(p.quantity) || 0)
              }))
              .filter((p: any) => p.quantity < 5);
            setLowStockItems(low.slice(0, 5));
          }
        }
      } catch (e) {
        if (e instanceof Error) {
            setError(e.message);
        } else {
            setError('An unknown error occurred');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    }, [])
  );

  useEffect(() => {
    if (allSales.length === 0) return;

    let labels: string[] = [];
    let dataPoints: number[] = [];
    
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    if (diffDays <= 14) {
      for (let i = 0; i < diffDays; i++) {
        const d = new Date(startDate);
        d.setDate(startDate.getDate() + i);
        labels.push(d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' }));
        
        const dayStart = new Date(d); dayStart.setHours(0,0,0,0);
        const dayEnd = new Date(d); dayEnd.setHours(23,59,59,999);
        
        const dailyTotal = allSales
          .filter((s: any) => {
            const saleDate = new Date(s.date);
            return saleDate >= dayStart && saleDate <= dayEnd;
          })
          .reduce((acc: number, curr: any) => acc + (curr.totalUSD || curr.total || curr.amount || 0), 0);
          
        dataPoints.push(Math.round(dailyTotal));
      }
    } else {
      let currentStart = new Date(startDate);
      while (currentStart <= endDate) {
        let currentEnd = new Date(currentStart);
        currentEnd.setDate(currentStart.getDate() + 6);
        if (currentEnd > endDate) currentEnd = new Date(endDate);

        labels.push(`${currentStart.getDate()}/${currentStart.getMonth() + 1}`);

        const chunkStart = new Date(currentStart); chunkStart.setHours(0,0,0,0);
        const chunkEnd = new Date(currentEnd); chunkEnd.setHours(23,59,59,999);

        const chunkTotal = allSales
          .filter((s: any) => {
            const d = new Date(s.date);
            return d >= chunkStart && d <= chunkEnd;
          })
          .reduce((acc: number, curr: any) => acc + (curr.totalUSD || curr.total || curr.amount || 0), 0);
        
        dataPoints.push(Math.round(chunkTotal));
        currentStart.setDate(currentStart.getDate() + 7);
      }
    }
    
    if (dataPoints.length > 0) {
      let finalLabels = labels;
      if (labels.length > 6) {
        const step = Math.ceil(labels.length / 6);
        finalLabels = labels.map((l, i) => (i % step === 0) ? l : '');
      }
      // Convert chart data to ZAR too (use default 19.2 since rates may not be loaded in useEffect)
      const zarRate = rates?.ZAR || 19.2;
      setChartData({ labels: finalLabels, datasets: [{ data: dataPoints.map(v => Math.round(v * zarRate)) }] });
    }

    // Filter for Pie Chart (use selected range)
    const windowStart = new Date(startDate);
    windowStart.setHours(0,0,0,0);
    const windowEnd = new Date(endDate);
    windowEnd.setHours(23,59,59,999);

    const filteredSales = allSales.filter((s: any) => {
        const d = new Date(s.date);
        return d >= windowStart && d <= windowEnd;
    });

    const salesByShop: Record<string, number> = {};
    filteredSales.forEach((sale: any) => {
      const sId = sale.shopId || (sale.items && sale.items[0]?.shopId) || 'unknown';
      salesByShop[sId] = (salesByShop[sId] || 0) + (sale.totalUSD || sale.total || sale.amount || 0);
    });

    const colors = ['#bae6fd', '#7dd3fc', '#0ea5e9', '#38bdf8', '#bae6fd', '#e0f2fe'];
    const pieData = shops.map((shop, index) => ({
      name: shop.name,
      population: salesByShop[shop._id] || 0,
      color: colors[index % colors.length],
      legendFontColor: "#7F7F7F",
      legendFontSize: 12
    })).filter(item => item.population > 0);

    setPieChartData(pieData);

    // Process Top Selling Products
    const productMap = new Map<string, number>();
    filteredSales.forEach((sale: any) => {
      if (Array.isArray(sale.items)) {
        sale.items.forEach((item: any) => {
          const currentQty = productMap.get(item.name) || 0;
          productMap.set(item.name, currentQty + (Number(item.quantity) || 1));
        });
      }
    });

    const sortedProducts = Array.from(productMap.entries())
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    setTopProducts(sortedProducts);
  }, [allSales, startDate, endDate, shops]);

  const onChangeDate = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      if (datePickerMode === 'start') {
        setStartDate(selectedDate);
        if (selectedDate > endDate) setEndDate(selectedDate);
      } else {
        setEndDate(selectedDate);
        if (selectedDate < startDate) setStartDate(selectedDate);
      }
    }
  };

  const handleShopPress = (shop: Shop) => {
    router.push({
      pathname: '/(manager)/operations-hub',
      params: { shop: JSON.stringify(shop) },
    });
  };

  const handleEditPress = (shop: Shop) => {
    setEditingShop(shop);
    setEditName(shop.name);
    setEditLocation(shop.location);
    setEditManagerId(shop.manager || '');
    setEditModalVisible(true);
  };

  const saveEditShop = async () => {
    if (!editingShop) return;
    if (!editName.trim() || !editLocation.trim()) {
        Alert.alert("Error", "Name and Location are required");
        return;
    }

    setSaving(true);
    try {
        const response = await fetch(`${API_BASE_URL}/shops/${editingShop._id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: editName, location: editLocation, managerId: editManagerId }),
        });

        const data = await response.json();

        if (response.ok) {
            setShops(prev => prev.map(s => s._id === editingShop._id ? { ...s, name: editName, location: editLocation, manager: editManagerId } : s));
            setEditModalVisible(false);
            Alert.alert("Success", "Shop updated successfully");
        } else {
            Alert.alert("Error", data.message || "Failed to update shop");
        }
    } catch (e) {
        Alert.alert("Error", "Network error");
    } finally {
        setSaving(false);
    }
  };

  const handleDeleteShop = (shopId: string, shopName: string) => {
    Alert.alert(
      "Delete Shop",
      `Are you sure you want to delete ${shopName}? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const response = await fetch(`${API_BASE_URL}/shops/${shopId}`, {
                method: 'DELETE',
              });
              if (response.ok) {
                setShops(prev => prev.filter(shop => shop._id !== shopId));
              } else {
                Alert.alert("Error", "Failed to delete shop");
              }
            } catch (e) {
              Alert.alert("Error", "Network error");
            }
          }
        }
      ]
    );
  };

  const handleSignOut = () => {
    setMenuVisible(false);
    AsyncStorage.clear();
    router.replace('/(auth)/login');
  };

  const handleSwitchToCashier = () => {
    setMenuVisible(false);
    if (shops.length > 0) {
      setShopSelectionVisible(true);
    } else {
      Alert.alert("No Shops", "Please register a shop first.");
    }
  };

  const handleSelectShopForPOS = async (shop: Shop) => {
      Alert.alert(
        "Switch to POS Mode",
        `You are about to enter Cashier mode for ${shop.name}.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Proceed", onPress: async () => {
              await AsyncStorage.setItem('shopId', shop._id);
              setShopSelectionVisible(false);
              router.replace('/(tabs)');
          }}
        ]
      );
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" />
        <ThemedText>Loading...</ThemedText>
      </ThemedView>
    );
  }

  if (error) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText style={styles.errorText}>Error: {error}</ThemedText>
        <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
          <Text>Go to Login</Text>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  // Convert from base (USD) to ZAR
  const convertToZAR = (amount: number) => amount * (rates?.ZAR || 19.2);

  // Today's revenue for KPI card
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

  const totalRevenue = convertToZAR(
    allSales
      .filter((s: any) => {
        const d = new Date(s.date);
        return d >= todayStart && d <= todayEnd;
      })
      .reduce((acc: number, curr: any) => acc + (curr.totalUSD || curr.total || curr.amount || 0), 0)
  );

  // Range revenue (used by AI insights)
  const rangeRevenue = convertToZAR(
    allSales
      .filter((s: any) => {
        const d = new Date(s.date);
        const start = new Date(startDate); start.setHours(0,0,0,0);
        const end = new Date(endDate); end.setHours(23,59,59,999);
        return d >= start && d <= end;
      })
      .reduce((acc: number, curr: any) => acc + (curr.totalUSD || curr.total || curr.amount || 0), 0)
  );

  const ordersToday = allSales.filter((s: any) => {
    const d = new Date(s.date);
    const today = new Date();
    return d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear();
  }).length;

  // ── Stolar AI Insights ──────────────────────────────────────────
  const getAIInsight = (): { icon: string; color: string; title: string; message: string }[] => {
    const insights: { icon: string; color: string; title: string; message: string }[] = [];

    // Revenue growth hint
    if (rangeRevenue > 0) {
      const avgPerShop = shops.length > 0 ? rangeRevenue / shops.length : rangeRevenue;
      insights.push({
        icon: 'trending-up',
        color: '#0ea5e9',
        title: 'Revenue Insight',
        message: shops.length > 1
          ? `Avg R${(rangeRevenue / shops.length).toFixed(0)}/shop this period. Focus on under-performing locations to lift overall revenue.`
          : `You generated R${rangeRevenue.toFixed(0)} this period. Great progress — consider promoting top-sellers.`,
      });
    } else {
      insights.push({
        icon: 'bar-chart-outline',
        color: '#38bdf8',
        title: 'No Sales Yet',
        message: 'Record your first sale to start seeing AI-powered trends and recommendations.',
      });
    }

    // Low stock warning
    if (lowStockItems.length > 0) {
      const names = lowStockItems.slice(0, 2).map((i: any) => i.name).join(', ');
      insights.push({
        icon: 'alert-circle-outline',
        color: '#f59e0b',
        title: `${lowStockItems.length} Low-Stock Item${lowStockItems.length > 1 ? 's' : ''}`,
        message: `Restock ${names}${lowStockItems.length > 2 ? ' and others' : ''} soon to avoid lost sales.`,
      });
    }

    // Orders today tip
    if (ordersToday === 0) {
      insights.push({
        icon: 'bulb-outline',
        color: '#0ea5e9',
        title: 'Quiet Day',
        message: 'No orders recorded today. Consider a flash promo or checking cashier connectivity.',
      });
    } else if (ordersToday >= 10) {
      insights.push({
        icon: 'flame-outline',
        color: '#ef4444',
        title: 'High Traffic Day',
        message: `${ordersToday} orders today! Ensure stock levels are up-to-date across all shops.`,
      });
    }

    return insights.slice(0, 3);
  };

  const aiInsights = getAIInsight();

  const renderHeader = () => (
    <View>
      <LinearGradient
        colors={['#0284c7', '#0ea5e9', '#38bdf8']}
        style={[styles.header, { paddingTop: insets.top + 16, paddingBottom: 40 }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.headerGreeting}>Manager Dashboard</Text>
          <Text style={styles.headerTitle}>Welcome, {user?.name?.split(' ')[0]} 👋</Text>
          <Text style={styles.headerSubtitle}>{user?.email}</Text>
        </View>
        <View style={styles.headerIcons}>
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => router.push('/(manager)/notifications')}>
            <Ionicons name="notifications-outline" size={22} color="rgba(255,255,255,0.85)" />
            {unreadCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => setMenuVisible(true)}>
            <Ionicons name="menu" size={22} color="rgba(255,255,255,0.85)" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* KPI Metrics Row */}
      <View style={styles.kpiContainer}>
        <View style={[styles.kpiCard, styles.kpiCardIndigo]}>
          <Ionicons name="cash-outline" size={18} color="#0ea5e9" style={styles.kpiIcon} />
          <Text style={styles.kpiLabel}>Today</Text>
          <Text style={styles.kpiValue}>R{totalRevenue.toFixed(0)}</Text>
        </View>

        <View style={[styles.kpiCard, styles.kpiCardGreen]}>
          <Ionicons name="receipt-outline" size={18} color="#10b981" style={styles.kpiIcon} />
          <Text style={styles.kpiLabel}>Orders Today</Text>
          <Text style={styles.kpiValue}>{ordersToday}</Text>
        </View>

        <View style={[styles.kpiCard, styles.kpiCardRose]}>
          <Ionicons name="alert-circle-outline" size={18} color="#f43f5e" style={styles.kpiIcon} />
          <Text style={styles.kpiLabel}>Low Stock</Text>
          <Text style={styles.kpiValue}>{lowStockItems.length}</Text>
        </View>
      </View>

      {/* ── Stolar AI Insights Card ── */}
      {aiInsights.length > 0 && (
        <View style={styles.aiInsightsCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <View style={styles.aiInsightsBadge}>
              <Ionicons name="sparkles" size={14} color="white" />
            </View>
            <Text style={styles.aiInsightsTitle}>Stolar AI Insights</Text>
          </View>
          {aiInsights.map((insight, idx) => (
            <View key={idx} style={[styles.aiInsightRow, idx < aiInsights.length - 1 && { borderBottomWidth: 1, borderBottomColor: '#e0f2fe' }]}>
              <View style={[styles.aiInsightIcon, { backgroundColor: insight.color + '18' }]}>
                <Ionicons name={insight.icon as any} size={18} color={insight.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.aiInsightRowTitle}>{insight.title}</Text>
                <Text style={styles.aiInsightRowMsg}>{insight.message}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Sales Chart */}
      <View style={styles.chartContainer}>
        <View style={styles.chartHeader}>
          <Text style={styles.chartTitle}>Sales Performance</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity onPress={() => { setDatePickerMode('start'); setShowDatePicker(true); }} style={styles.dateButton}>
              <Ionicons name="calendar-outline" size={16} color="#0ea5e9" />
              <Text style={styles.dateButtonText}>{startDate.toLocaleDateString(undefined, {month:'numeric', day:'numeric'})}</Text>
            </TouchableOpacity>
            <Text style={{ color: '#94a3b8' }}>-</Text>
            <TouchableOpacity onPress={() => { setDatePickerMode('end'); setShowDatePicker(true); }} style={styles.dateButton}>
              <Ionicons name="calendar-outline" size={16} color="#0ea5e9" />
              <Text style={styles.dateButtonText}>{endDate.toLocaleDateString(undefined, {month:'numeric', day:'numeric'})}</Text>
            </TouchableOpacity>
          </View>
        </View>
        <BarChart
          data={{
            labels: chartData.labels,
            datasets: [{ data: chartData.datasets[0].data.map((v: number) => Math.round(v)) }],
          }}
          width={Dimensions.get("window").width - 100}
          height={200}
          yAxisLabel="R"
          yAxisSuffix=""
          chartConfig={{
            backgroundColor: "#ffffff",
            backgroundGradientFrom: "#ffffff",
            backgroundGradientTo: "#ffffff",
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(14, 165, 233, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`,
            style: { borderRadius: 12 },
            barPercentage: 0.5,
            propsForLabels: {
              fontSize: 10,
              fontWeight: '600',
            },
            propsForBackgroundLines: {
              strokeDasharray: '',
              stroke: '#f1f5f9',
              strokeWidth: 1,
            },
          }}
          style={{ marginVertical: 4, borderRadius: 12, alignSelf: 'center' }}
          showValuesOnTopOfBars
          fromZero
          withInnerLines={true}
        />
        
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
            <TouchableOpacity style={styles.compactActionBtn} onPress={() => router.push('/(manager)/profit-loss')}>
                <View style={[styles.iconBox, { backgroundColor: '#dcfce7', width: 32, height: 32, padding: 0 }]}>
                    <Ionicons name="trending-up" size={18} color="#16a34a" />
                </View>
                <Text style={styles.compactActionText}>Profit Report</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.compactActionBtn} onPress={() => router.push('/stock-take')}>
                <View style={[styles.iconBox, { backgroundColor: '#e0f2fe', width: 32, height: 32, padding: 0 }]}>
                    <Ionicons name="clipboard" size={18} color="#0284c7" />
                </View>
                <Text style={styles.compactActionText}>Stock Take</Text>
            </TouchableOpacity>
        </View>
      </View>

      {showDatePicker && (
        <DateTimePicker
          value={datePickerMode === 'start' ? startDate : endDate}
          mode="date"
          display="default"
          onChange={onChangeDate}
        />
      )}

      {/* Row: Sales Distribution & Top Products */}
      <View style={styles.rowContainer}>
        <View style={[styles.chartContainer, styles.halfCard]}>
          <Text style={styles.chartTitle}>Sales/Shop</Text>
          {pieChartData.length > 0 ? (
            <>
              <PieChart
                data={pieChartData}
                width={Dimensions.get("window").width / 2 - 50}
                height={120}
                chartConfig={{
                  color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                }}
                accessor={"population"}
                backgroundColor={"transparent"}
                paddingLeft={"15"}
                center={[10, 0]}
                absolute={false}
                hasLegend={false}
              />
              <View style={{ marginTop: 10 }}>
                {pieChartData.slice(0, 3).map((p, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: p.color, marginRight: 6 }} />
                    <Text numberOfLines={1} style={{ fontSize: 10, color: '#64748b', flex: 1 }}>{p.name}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 10 }}>No data</Text>
          )}
        </View>

        <View style={[styles.chartContainer, styles.halfCard]}>
          <Text style={styles.chartTitle}>Top Items</Text>
          {topProducts.slice(0, 4).map((item, index) => (
            <View key={index} style={styles.miniTopItemRow}>
              <View style={styles.miniRankBadge}>
                <Text style={styles.miniRankText}>{index + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={styles.miniTopItemName}>{item.name}</Text>
                <Text style={styles.miniTopItemQty}>{item.qty} sold</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Low Stock Alerts */}
      {lowStockItems.length > 0 && (
        <View style={[styles.chartContainer, { borderLeftWidth: 4, borderLeftColor: '#ef4444' }]}>
          <Text style={[styles.chartTitle, { color: '#ef4444' }]}>Low Stock Alerts</Text>
          {lowStockItems.map((item, index) => (
            <View key={index} style={styles.topItemRow}>
              <View style={[styles.rankBadge, { backgroundColor: '#fee2e2' }]}>
                <Ionicons name="alert-circle" size={16} color="#ef4444" />
              </View>
              <Text style={styles.topItemName}>{item.name}</Text>
              <Text style={[styles.topItemQty, { color: '#ef4444', fontWeight: 'bold' }]}>{item.quantity} left</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.title}>My Shops</Text>
          <Text style={{ fontSize: 12, color: '#7dd3fc', fontWeight: '600', marginTop: 1 }}>
            {shops.length} {shops.length === 1 ? 'location' : 'locations'} registered
          </Text>
        </View>
        <TouchableOpacity style={styles.addShopButton} onPress={() => router.push('/(manager)/register-shop')}>
          <LinearGradient colors={['#0ea5e9', '#38bdf8']} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 }} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            <Ionicons name="add" size={18} color="white" />
            <Text style={styles.addShopButtonText}>Add Shop</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Modal
        animationType="fade"
        transparent={true}
        visible={menuVisible}
        onRequestClose={() => setMenuVisible(false)}
      >
        <TouchableOpacity style={styles.menuOverlay} onPress={() => setMenuVisible(false)}>
          <View style={styles.menuContainer}>
            <TouchableOpacity style={styles.menuItem}>
              <Ionicons name="person-circle-outline" size={24} color="#0ea5e9" />
              <Text style={styles.menuItemText}>Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem}>
              <Ionicons name="settings-outline" size={24} color="#0ea5e9" />
              <Text style={styles.menuItemText}>Settings</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={handleSwitchToCashier}>
              <Ionicons name="calculator-outline" size={24} color="#0ea5e9" />
              <Text style={styles.menuItemText}>Switch to POS</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={handleSignOut}>
              <Ionicons name="log-out-outline" size={24} color="#ef4444" />
              <Text style={[styles.menuItemText, { color: '#ef4444' }]}>Sign Out</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem}>
              <Ionicons name="help-circle-outline" size={24} color="#0ea5e9" />
              <Text style={styles.menuItemText}>Help</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Shop Selection Modal for POS Switch */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={shopSelectionVisible}
        onRequestClose={() => setShopSelectionVisible(false)}
      >
        <View style={styles.centeredModalOverlay}>
            <View style={[styles.editModalContent, { backgroundColor: '#ffffff' }]}>
                {/* Header */}
                <View style={{ alignItems: 'center', marginBottom: 16 }}>
                    <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: '#f0f9ff', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
                        <Ionicons name="storefront" size={28} color="#0ea5e9" />
                    </View>
                    <Text style={styles.modalTitle}>Select Shop for POS</Text>
                    <Text style={{ textAlign: 'center', color: '#64748b', fontSize: 13, marginTop: 2 }}>Choose which shop to manage as a cashier.</Text>
                </View>

                <FlatList
                    data={shops}
                    keyExtractor={(item) => item._id}
                    renderItem={({ item }) => (
                        <TouchableOpacity style={styles.shopSelectionItem} onPress={() => handleSelectShopForPOS(item)} activeOpacity={0.75}>
                            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#0ea5e9', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                                <Ionicons name="storefront" size={18} color="white" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.shopSelectionText}>{item.name}</Text>
                                {item.location ? <Text style={{ fontSize: 12, color: '#94a3b8', marginTop: 1 }}>{item.location}</Text> : null}
                            </View>
                            <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: '#e0f2fe', justifyContent: 'center', alignItems: 'center' }}>
                                <Ionicons name="chevron-forward" size={16} color="#0ea5e9" />
                            </View>
                        </TouchableOpacity>
                    )}
                    style={{ maxHeight: 300, width: '100%' }}
                    scrollEnabled
                />

                <TouchableOpacity
                    style={{ marginTop: 16, width: '100%', paddingVertical: 14, borderRadius: 14, backgroundColor: '#f0f9ff', borderWidth: 1.5, borderColor: '#e0f2fe', alignItems: 'center' }}
                    onPress={() => setShopSelectionVisible(false)}
                >
                    <Text style={{ fontWeight: '700', color: '#0ea5e9', fontSize: 15 }}>Cancel</Text>
                </TouchableOpacity>
            </View>
        </View>
      </Modal>

      {/* Edit Shop Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={editModalVisible}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.centeredModalOverlay}>
            <View style={styles.editModalContent}>
                <Text style={styles.modalTitle}>Edit Shop</Text>
                
                <Text style={styles.label}>Shop Name</Text>
                <TextInput 
                    style={styles.input} 
                    value={editName} 
                    onChangeText={setEditName} 
                    placeholder="Shop Name"
                />

                <Text style={styles.label}>Location</Text>
                <TextInput 
                    style={styles.input} 
                    value={editLocation} 
                    onChangeText={setEditLocation} 
                    placeholder="Location"
                />

                <View style={styles.modalButtons}>
                    <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setEditModalVisible(false)}>
                        <Text style={styles.buttonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={saveEditShop} disabled={saving}>
                        {saving ? <ActivityIndicator color="#fff" /> : <Text style={[styles.buttonText, { color: '#fff' }]}>Save</Text>}
                    </TouchableOpacity>
                </View>
            </View>
        </View>
      </Modal>

      {/* Trial Reminder Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={trialModalVisible}
        onRequestClose={() => setTrialModalVisible(false)}
      >
        <View style={styles.centeredModalOverlay}>
            <View style={styles.editModalContent}>
                <View style={{ alignItems: 'center', marginBottom: 16 }}>
                    <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff7ed', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
                        <Ionicons name="alert-circle" size={32} color="#f59e0b" />
                    </View>
                    <Text style={styles.modalTitle}>Subscription Due</Text>
                    <Text style={{ textAlign: 'center', color: '#64748b', fontSize: 14, paddingHorizontal: 10 }}>
                        Your subscription has expired. Please renew to continue using the application.
                    </Text>
                </View>

                <View style={{ backgroundColor: '#f8fafc', padding: 16, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: '#e2e8f0' }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                        <Text style={styles.label}>Start Date:</Text>
                        <Text style={{ fontWeight: '600', color: '#1e293b' }}>{new Date().toLocaleDateString()}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                        <Text style={styles.label}>Due Date:</Text>
                        <Text style={{ fontWeight: '600', color: '#ef4444' }}>{new Date().toLocaleDateString()}</Text>
                    </View>
                    <View style={{ height: 1, backgroundColor: '#e2e8f0', marginVertical: 8 }} />
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={styles.label}>Amount Due:</Text>
                        <Text style={{ fontWeight: '800', color: '#1e40af', fontSize: 18 }}>$10.00</Text>
                    </View>
                </View>

                <Text style={{ fontSize: 13, fontWeight: '700', color: '#94a3b8', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Payment Options</Text>
                
                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
                    <TouchableOpacity 
                        style={styles.paymentOption} 
                        onPress={() => {
                            setTrialModalVisible(false);
                            router.push('/(manager)/subscription');
                        }}
                    >
                        <Ionicons name="card" size={24} color="#1e40af" />
                        <Text style={styles.paymentOptionText}>Paynow</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={styles.paymentOption} 
                        onPress={() => Alert.alert("Cash Payment", "Please visit our office or contact an admin to pay via cash.")}
                    >
                        <Ionicons name="cash" size={24} color="#059669" />
                        <Text style={[styles.paymentOptionText, { color: '#059669' }]}>Cash</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={styles.paymentOption} 
                        onPress={() => Linking.openURL('tel:+123456789')}
                    >
                        <Ionicons name="call" size={24} color="#475569" />
                        <Text style={[styles.paymentOptionText, { color: '#475569' }]}>Admin</Text>
                    </TouchableOpacity>
                </View>

                <View style={{ flexDirection: 'row', gap: 12 }}>
                    <TouchableOpacity 
                        style={[styles.modalButton, styles.cancelButton]} 
                        onPress={() => setTrialModalVisible(false)}
                    >
                        <Text style={styles.buttonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.modalButton, styles.saveButton]} 
                        onPress={() => setTrialModalVisible(false)}
                    >
                        <Text style={[styles.buttonText, { color: '#fff' }]}>Okay</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
      </Modal>

      <FlatList
        data={shops}
        ListHeaderComponent={renderHeader}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.shopItem} onPress={() => handleShopPress(item)} activeOpacity={0.85}>
            {/* Left accent bar */}
            <LinearGradient
              colors={['#0284c7', '#0ea5e9']}
              style={styles.shopItemAccent}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
            />
            {/* Icon circle */}
            <View style={styles.shopIconCircle}>
              <Ionicons name="storefront" size={22} color="white" />
            </View>
            {/* Info */}
            <View style={{ flex: 1 }}>
              <Text style={styles.shopName} numberOfLines={1}>{item.name}</Text>
              <View style={styles.shopLocationRow}>
                <Ionicons name="location-outline" size={12} color="#94a3b8" />
                <Text style={styles.shopLocation} numberOfLines={1}>{item.location}</Text>
              </View>
              {item.branchCode ? (
                <View style={styles.shopBranchRow}>
                  <Ionicons name="barcode-outline" size={11} color="#7dd3fc" />
                  <Text style={styles.shopBranchCode}>{item.branchCode}</Text>
                </View>
              ) : null}
            </View>
            {/* Actions */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <TouchableOpacity onPress={() => handleEditPress(item)} style={styles.shopActionBtn}>
                <Ionicons name="create-outline" size={17} color="#0ea5e9" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDeleteShop(item._id, item.name)} style={[styles.shopActionBtn, { backgroundColor: '#fee2e2' }]}>
                <Ionicons name="trash-outline" size={17} color="#f43f5e" />
              </TouchableOpacity>
              <Ionicons name="chevron-forward" size={18} color="#bae6fd" />
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={() => (
          <TouchableOpacity
            style={styles.registerShopButton}
            onPress={() => router.push('/(manager)/register-shop')}
          >
            <Ionicons name="add-circle-outline" size={28} color="#0ea5e9" />
            <Text style={styles.registerShopButtonText}>Register Your First Shop</Text>
            <Text style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>Tap to get started</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
    // RENOVATED STYLES
    container: { flex: 1, backgroundColor: '#f0f4ff' },

    // KPI Metrics
    kpiContainer: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        marginTop: -20,
        gap: 10,
        marginBottom: 10,
        zIndex: 10,
    },
    kpiCard: {
        flex: 1,
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 3,
    },
    kpiCardIndigo: {
        borderTopWidth: 3,
        borderTopColor: '#0ea5e9',
    },
    kpiCardGreen: {
        borderTopWidth: 3,
        borderTopColor: '#10b981',
    },
    kpiCardRose: {
        borderTopWidth: 3,
        borderTopColor: '#f43f5e',
    },
    kpiIcon: {
        marginBottom: 6,
    },
    kpiLabel: {
        fontSize: 11,
        color: '#64748b',
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    kpiValue: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0f172a',
        marginTop: 4,
    },

    // Header
    header: {
        padding: 22,
        paddingBottom: 28,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    headerGreeting: { fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
    headerTitle: { color: 'white', fontSize: 24, fontWeight: '800', marginBottom: 2 },
    headerSubtitle: { color: 'rgba(255,255,255,0.55)', fontSize: 13 },
    headerIcons: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    headerIconBtn: {
        width: 40, height: 40, borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.12)',
        justifyContent: 'center', alignItems: 'center',
    },

    // Section
    sectionHeader: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', paddingHorizontal: 20,
        marginTop: 20, marginBottom: 12,
    },
    title: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
    addShopButton: { borderRadius: 20, overflow: 'hidden' },
    addShopButtonText: { color: 'white', fontWeight: '700', marginLeft: 4, fontSize: 13 },

    // Shop cards
    shopItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'white',
        paddingRight: 14,
        paddingVertical: 0,
        borderRadius: 18,
        marginBottom: 12,
        marginHorizontal: 20,
        shadowColor: '#0ea5e9',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.10,
        shadowRadius: 10,
        elevation: 5,
        overflow: 'hidden',
        minHeight: 78,
        borderWidth: 1,
        borderColor: '#e0f2fe',
    },
    shopItemAccent: {
        width: 6,
        alignSelf: 'stretch',
    },
    shopIconCircle: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: '#0ea5e9',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 12,
        marginRight: 12,
    },
    shopItemGrad: { width: 56, height: 80, justifyContent: 'center', alignItems: 'center' },
    shopItemIconWrap: {
        width: 40, height: 40, borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center', alignItems: 'center',
    },
    shopName: { fontSize: 15, fontWeight: '800', color: '#0c4a6e', marginBottom: 2 },
    shopLocationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    shopLocation: { fontSize: 12, color: '#94a3b8', fontWeight: '500', flex: 1 },
    shopBranchRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
    shopBranchCode: { fontSize: 11, color: '#7dd3fc', fontWeight: '700', letterSpacing: 0.5 },
    shopActionBtn: {
        width: 34, height: 34, borderRadius: 10,
        backgroundColor: '#f0f9ff',
        justifyContent: 'center', alignItems: 'center',
    },

    errorText: { color: '#f43f5e', fontSize: 16 },
    registerShopButton: {
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'white', padding: 32, margin: 20,
        borderRadius: 20, borderWidth: 2, borderColor: '#e0e9ff',
        borderStyle: 'dashed',
    },
    registerShopButtonText: {
        marginTop: 12, fontSize: 16, fontWeight: '800', color: '#0ea5e9',
    },

    // Menu
    menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
    menuContainer: {
        backgroundColor: '#111827', padding: 8,
        borderRadius: 18, position: 'absolute',
        top: 110, right: 20, minWidth: 210,
        shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4, shadowRadius: 16, elevation: 12,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
    },
    menuItem: {
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12,
    },
    menuItemText: { marginLeft: 14, fontSize: 15, color: '#f1f5f9', fontWeight: '600' },

    shopSelectionItem: {
        flexDirection: 'row', alignItems: 'center',
        padding: 14,
        backgroundColor: '#faf5ff',
        borderRadius: 14, marginBottom: 10,
        borderWidth: 1.5, borderColor: '#e0f2fe',
    },
    shopSelectionText: { fontSize: 15, fontWeight: '700', color: '#0c4a6e', flex: 1 },

    centeredModalOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.65)',
        justifyContent: 'center', alignItems: 'center', padding: 20,
    },
    editModalContent: {
        backgroundColor: 'white', width: '92%',
        borderRadius: 24, padding: 24,
        shadowColor: '#000', shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2, shadowRadius: 20, elevation: 15,
    },
    modalTitle: { fontSize: 20, fontWeight: '800', marginBottom: 16, textAlign: 'center', color: '#0f172a' },
    label: { fontSize: 13, fontWeight: '700', marginBottom: 6, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5 },
    input: {
        borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 12,
        padding: 14, marginBottom: 16, fontSize: 15, color: '#0f172a',
        backgroundColor: '#f8faff',
    },
    modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, gap: 12 },
    modalButton: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
    cancelButton: { backgroundColor: '#f1f5f9' },
    saveButton: { backgroundColor: '#0ea5e9' },
    buttonText: { fontWeight: '700', color: '#475569' },

    // AI Insights
    aiInsightsCard: {
        backgroundColor: '#faf5ff',
        borderRadius: 20,
        padding: 16,
        marginHorizontal: 20,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#e0f2fe',
        shadowColor: '#0ea5e9',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 4,
    },
    aiInsightsBadge: {
        width: 26, height: 26, borderRadius: 8,
        backgroundColor: '#0ea5e9',
        justifyContent: 'center', alignItems: 'center',
        marginRight: 8,
    },
    aiInsightsTitle: {
        fontSize: 14, fontWeight: '800', color: '#4c1d95', letterSpacing: 0.3,
    },
    aiInsightRow: {
        flexDirection: 'row', alignItems: 'flex-start',
        paddingVertical: 10, gap: 12,
    },
    aiInsightIcon: {
        width: 36, height: 36, borderRadius: 10,
        justifyContent: 'center', alignItems: 'center',
    },
    aiInsightRowTitle: {
        fontSize: 13, fontWeight: '700', color: '#3b0764', marginBottom: 2,
    },
    aiInsightRowMsg: {
        fontSize: 12, color: '#6b7280', lineHeight: 17,
    },

    notificationBadge: {
        position: 'absolute', right: -5, top: -5,
        backgroundColor: '#f43f5e', borderRadius: 10,
        minWidth: 18, height: 18, justifyContent: 'center',
        alignItems: 'center', paddingHorizontal: 4,
        borderWidth: 1.5, borderColor: '#0f172a',
    },
    notificationBadgeText: { color: 'white', fontSize: 9, fontWeight: '800' },

    chartContainer: {
        backgroundColor: 'white', borderRadius: 20,
        padding: 16, margin: 20, marginBottom: 12,
        shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08, shadowRadius: 12, elevation: 6,
    },
    chartHeader: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 12,
    },
    chartTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
    dateButton: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#f0f9ff', paddingHorizontal: 10,
        paddingVertical: 6, borderRadius: 10,
    },
    dateButtonText: { marginLeft: 5, color: '#0ea5e9', fontSize: 12, fontWeight: '700' },

    rowContainer: {
        flexDirection: 'row', marginHorizontal: 15,
        marginBottom: 10, justifyContent: 'space-between',
    },
    halfCard: { flex: 1, margin: 5, padding: 14, minHeight: 180 },

    miniTopItemRow: {
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
    },
    miniRankBadge: {
        width: 22, height: 22, borderRadius: 11,
        backgroundColor: '#f0f9ff', justifyContent: 'center',
        alignItems: 'center', marginRight: 8,
    },
    miniRankText: { color: '#0ea5e9', fontWeight: '800', fontSize: 10 },
    miniTopItemName: { fontSize: 12, color: '#334155', fontWeight: '600' },
    miniTopItemQty: { fontSize: 10, color: '#94a3b8' },

    topItemRow: {
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
    },
    rankBadge: {
        width: 28, height: 28, borderRadius: 14,
        backgroundColor: '#fee2e2', justifyContent: 'center',
        alignItems: 'center', marginRight: 10,
    },
    rankText: { color: '#0ea5e9', fontWeight: '800', fontSize: 12 },
    topItemName: { flex: 1, fontSize: 14, color: '#334155', fontWeight: '600' },
    topItemQty: { fontSize: 12, color: '#94a3b8', fontWeight: '600' },

    paymentOption: {
        flex: 1, alignItems: 'center', padding: 12,
        backgroundColor: '#faf5ff', borderRadius: 14,
        borderWidth: 1, borderColor: '#e0f2fe',
    },
    paymentOptionText: { marginTop: 6, fontSize: 12, fontWeight: '700', color: '#0ea5e9' },

    actionRow: {
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9',
    },
    iconBox: {
        padding: 8, borderRadius: 12, marginRight: 12,
        width: 38, height: 38, justifyContent: 'center', alignItems: 'center',
    },
    actionTitle: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
    actionSub: { fontSize: 12, color: '#64748b' },

    compactActionBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center',
        justifyContent: 'center', backgroundColor: '#f0f9ff',
        paddingVertical: 12, borderRadius: 14, marginHorizontal: 4,
        borderWidth: 1, borderColor: '#e0f2fe',
    },
    compactActionText: { fontSize: 12, fontWeight: '700', color: '#334155', marginLeft: 8 },

    shopIcon: { marginRight: 14 },
    shopItemContent: { flexDirection: 'row', alignItems: 'center' },
    viewReportButton: {},
    viewReportText: {},
    quickActionsRow: {},
    quickActionCard: {},
    actionIconCircle: {},
    quickActionText: {},
    headerIcons2: {},
});

export default ManagerIndex;
