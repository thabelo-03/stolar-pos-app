import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, FlatList, Linking, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { BarChart, LineChart, PieChart } from 'react-native-chart-kit';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_BASE_URL } from '../config';

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
        const salesRes = await fetch(`${API_BASE_URL}/sales`);
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
            const low = myProducts.filter((p: any) => Number(p.quantity) < 5);
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

    const labels = [];
    const dataPoints = [];
    
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

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
        
      dataPoints.push(dailyTotal);
    }
    
    if (dataPoints.length > 0) {
      let finalLabels = labels;
      if (diffDays > 10) {
        const step = Math.ceil(diffDays / 6);
        finalLabels = labels.map((l, i) => (i % step === 0) ? l : '');
      }
      setChartData({ labels: finalLabels, datasets: [{ data: dataPoints }] });
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

    const colors = ['#fca5a5', '#3b82f6', '#86efac', '#93c5fd', '#c4b5fd', '#f9a8d4'];
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
      await AsyncStorage.setItem('shopId', shop._id);
      setShopSelectionVisible(false);
      router.replace('/(tabs)/home');
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

  const renderHeader = () => (
    <View>
      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <View>
          <Text style={styles.headerTitle}>Welcome, {user?.name}</Text>
          <Text style={styles.headerSubtitle}>{user?.email}</Text>
        </View>
        <View style={styles.headerIcons}>
          <TouchableOpacity onPress={() => router.push('/(manager)/notifications')}>
            <Ionicons name="notifications-outline" size={24} color="#fff" />
            {unreadCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMenuVisible(true)}>
            <Ionicons name="menu" size={24} color="#fff" style={{ marginLeft: 15 }} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Sales Chart */}
      <View style={styles.chartContainer}>
        <View style={styles.chartHeader}>
          <Text style={styles.chartTitle}>Sales Performance</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity onPress={() => { setDatePickerMode('start'); setShowDatePicker(true); }} style={styles.dateButton}>
              <Ionicons name="calendar-outline" size={16} color="#1e40af" />
              <Text style={styles.dateButtonText}>{startDate.toLocaleDateString(undefined, {month:'numeric', day:'numeric'})}</Text>
            </TouchableOpacity>
            <Text style={{ color: '#94a3b8' }}>-</Text>
            <TouchableOpacity onPress={() => { setDatePickerMode('end'); setShowDatePicker(true); }} style={styles.dateButton}>
              <Ionicons name="calendar-outline" size={16} color="#1e40af" />
              <Text style={styles.dateButtonText}>{endDate.toLocaleDateString(undefined, {month:'numeric', day:'numeric'})}</Text>
            </TouchableOpacity>
          </View>
        </View>
        <BarChart
          data={chartData}
          width={Dimensions.get("window").width - 40}
          height={220}
          yAxisLabel="$"
          yAxisSuffix=""
          chartConfig={{
            backgroundColor: "#ffffff",
            backgroundGradientFrom: "#ffffff",
            backgroundGradientTo: "#ffffff",
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`,
            style: { borderRadius: 16 },
            barPercentage: 0.5,
          }}
          style={{ marginVertical: 8, borderRadius: 16 }}
          showValuesOnTopOfBars
          fromZero
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
        <Text style={styles.title}>My Shops</Text>
        <TouchableOpacity style={styles.addShopButton} onPress={() => router.push('/(manager)/register-shop')}>
          <Ionicons name="add" size={20} color="white" />
          <Text style={styles.addShopButtonText}>Add Shop</Text>
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
              <Ionicons name="person-circle-outline" size={24} color="#1e40af" />
              <Text style={styles.menuItemText}>Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem}>
              <Ionicons name="settings-outline" size={24} color="#1e40af" />
              <Text style={styles.menuItemText}>Settings</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={handleSwitchToCashier}>
              <Ionicons name="calculator-outline" size={24} color="#1e40af" />
              <Text style={styles.menuItemText}>Switch to POS</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={handleSignOut}>
              <Ionicons name="log-out-outline" size={24} color="#ef4444" />
              <Text style={[styles.menuItemText, { color: '#ef4444' }]}>Sign Out</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem}>
              <Ionicons name="help-circle-outline" size={24} color="#1e40af" />
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
            <View style={styles.editModalContent}>
                <Text style={styles.modalTitle}>Select Shop for POS</Text>
                <Text style={{textAlign: 'center', color: '#64748b', marginBottom: 20}}>Choose which shop you want to manage as a cashier.</Text>
                
                <FlatList
                    data={shops}
                    keyExtractor={(item) => item._id}
                    renderItem={({ item }) => (
                        <TouchableOpacity style={styles.shopSelectionItem} onPress={() => handleSelectShopForPOS(item)}>
                            <Ionicons name="storefront" size={20} color="#1e40af" style={{marginRight: 10}} />
                            <Text style={styles.shopSelectionText}>{item.name}</Text>
                            <Ionicons name="chevron-forward" size={20} color="#cbd5e1" style={{marginLeft: 'auto'}} />
                        </TouchableOpacity>
                    )}
                    style={{maxHeight: 300, width: '100%'}}
                />

                <TouchableOpacity style={[styles.modalButton, styles.cancelButton, {marginTop: 15, width: '100%'}]} onPress={() => setShopSelectionVisible(false)}>
                    <Text style={styles.buttonText}>Cancel</Text>
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
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.shopItem} onPress={() => handleShopPress(item)}>
            <View style={styles.shopItemContent}>
              <Ionicons name="storefront-outline" size={24} color="#1e40af" style={styles.shopIcon} />
              <View>
                <ThemedText style={styles.shopName}>{item.name}</ThemedText>
                <ThemedText style={styles.shopLocation}>{item.location}</ThemedText>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity onPress={() => handleEditPress(item)} style={{ padding: 8 }}>
                <Ionicons name="create-outline" size={24} color="#1e40af" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDeleteShop(item._id, item.name)} style={{ padding: 8 }}>
                <Ionicons name="trash-outline" size={24} color="#ef4444" />
              </TouchableOpacity>
              <Ionicons name="chevron-forward" size={24} color="#94a3b8" />
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={() => (
          <TouchableOpacity
            style={styles.registerShopButton}
            onPress={() => router.push('/(manager)/register-shop')}
          >
            <Ionicons name="add-circle-outline" size={24} color="#1e40af" />
            <Text style={styles.registerShopButtonText}>Register a New Shop</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    header: {
        backgroundColor: '#1e3a8a',
        padding: 25,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerTitle: {
        color: 'white',
        fontSize: 22,
        fontWeight: 'bold',
    },
    headerSubtitle: {
        color: '#93c5fd',
        fontSize: 14,
    },
    headerIcons: {
        flexDirection: 'row',
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginTop: 20,
        marginBottom: 10,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1e3a8a',
    },
    addShopButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1e40af',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
    },
    addShopButtonText: {
        color: 'white',
        fontWeight: 'bold',
        marginLeft: 4,
        fontSize: 14,
    },
    shopItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#fff',
        padding: 15,
        borderRadius: 15,
        marginBottom: 10,
        marginHorizontal: 20,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 3,
        },
        shadowOpacity: 0.1,
        shadowRadius: 3.84,
        elevation: 5,
    },
    shopItemContent: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    shopIcon: {
        marginRight: 15,
    },
    shopName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1e293b',
    },
    shopLocation: {
        fontSize: 14,
        color: '#64748b',
    },
    errorText: {
        color: 'red',
        fontSize: 16,
    },
    registerShopButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#e0f2fe',
        padding: 15,
        borderRadius: 10,
        margin: 20,
        borderWidth: 1,
        borderColor: '#1e40af',
    },
    registerShopButtonText: {
        marginLeft: 10,
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1e40af',
    },
    menuOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    menuContainer: {
        backgroundColor: '#fff',
        padding: 20,
        borderRadius: 10,
        position: 'absolute',
        top: 110,
        right: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
    },
    menuItemText: {
        marginLeft: 15,
        fontSize: 16,
        color: '#1e293b',
    },
    shopSelectionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    shopSelectionText: { fontSize: 16, fontWeight: '600', color: '#1e293b' },
    
    centeredModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    editModalContent: {
        backgroundColor: 'white',
        width: '85%',
        borderRadius: 20,
        padding: 20,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 15,
        textAlign: 'center',
        color: '#1e293b',
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 5,
        color: '#334155',
    },
    input: {
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 8,
        padding: 10,
        marginBottom: 15,
        fontSize: 16,
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 10,
    },
    modalButton: {
        flex: 1,
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
        marginHorizontal: 5,
    },
    cancelButton: {
        backgroundColor: '#e2e8f0',
    },
    saveButton: {
        backgroundColor: '#1e40af',
    },
    buttonText: {
        fontWeight: 'bold',
    },
    notificationBadge: {
        position: 'absolute',
        right: -6,
        top: -6,
        backgroundColor: '#ef4444',
        borderRadius: 10,
        minWidth: 18,
        height: 18,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
        borderWidth: 1.5,
        borderColor: '#1e3a8a',
    },
    notificationBadgeText: {
        color: 'white',
        fontSize: 10,
        fontWeight: 'bold',
    },
    quickActionsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginHorizontal: 20,
        marginTop: 20,
        marginBottom: 5,
    },
    quickActionCard: {
        backgroundColor: 'white',
        borderRadius: 16,
        paddingVertical: 20,
        paddingHorizontal: 15,
        alignItems: 'center',
        justifyContent: 'center',
        width: '48%',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 4.65,
        elevation: 8,
    },
    actionIconCircle: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#eff6ff',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
    },
    quickActionText: {
        color: '#1e3a8a',
        fontWeight: 'bold',
        fontSize: 14,
        textAlign: 'center',
    },
    chartContainer: {
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 15,
        margin: 20,
        marginBottom: 10,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.1,
        shadowRadius: 4.65,
        elevation: 8,
    },
    chartHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    chartTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1e293b',
    },
    dateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
        padding: 6,
        borderRadius: 8,
    },
    dateButtonText: {
        marginLeft: 5,
        color: '#1e40af',
        fontSize: 12,
        fontWeight: 'bold',
    },
    viewReportButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 10,
        paddingTop: 15,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        paddingVertical: 12,
        backgroundColor: '#f8fafc',
        borderRadius: 10,
    },
    viewReportText: {
        color: '#1e40af',
        fontWeight: 'bold',
        fontSize: 14,
        marginRight: 5,
    },
    rowContainer: {
        flexDirection: 'row',
        marginHorizontal: 15,
        marginBottom: 10,
        justifyContent: 'space-between',
    },
    halfCard: {
        flex: 1,
        margin: 5,
        padding: 12,
        minHeight: 200,
    },
    miniTopItemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    miniRankBadge: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#eff6ff',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    miniRankText: { color: '#1e40af', fontWeight: 'bold', fontSize: 10 },
    miniTopItemName: { fontSize: 12, color: '#334155', fontWeight: '600' },
    miniTopItemQty: { fontSize: 10, color: '#64748b' },
    topItemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    rankBadge: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#eff6ff',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    rankText: { color: '#1e40af', fontWeight: 'bold', fontSize: 12 },
    topItemName: { flex: 1, fontSize: 14, color: '#334155', fontWeight: '500' },
    topItemQty: { fontSize: 12, color: '#64748b' },
    paymentOption: {
        flex: 1,
        alignItems: 'center',
        padding: 10,
        backgroundColor: '#f1f5f9',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    paymentOptionText: {
        marginTop: 5,
        fontSize: 12,
        fontWeight: 'bold',
        color: '#1e40af',
    },
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    iconBox: {
        padding: 10,
        borderRadius: 12,
        marginRight: 12,
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    actionTitle: { fontSize: 14, fontWeight: 'bold', color: '#1e293b' },
    actionSub: { fontSize: 12, color: '#64748b' },
    compactActionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8fafc',
        paddingVertical: 12,
        borderRadius: 12,
        marginHorizontal: 4,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    compactActionText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#334155',
        marginLeft: 8,
    },
});

export default ManagerIndex;