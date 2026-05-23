import CalendarView from '@/components/ui/CalendarView';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  Modal,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { API_BASE_URL } from '../config';

interface LinkRequest {
  _id: string;
  cashier: { _id: string; name: string; email: string; };
  status: string;
}

export default function OperationHub() {
  const router = useRouter();
  const { shop: shopString } = useLocalSearchParams();
  const [shop, setShop] = useState<{ name: string; branchCode: string, _id: string } | null>(null);

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isCalendarVisible, setCalendarVisible] = useState(false);
  const [isStaffModalVisible, setStaffModalVisible] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<LinkRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // --- MULTI-CURRENCY & RATES STATE ---
  const [displayCurrency, setDisplayCurrency] = useState<'USD' | 'ZAR'>('USD');
  const [rates, setRates] = useState({ ZAR: 19.2, ZiG: 26.5 });
  const [tempZar, setTempZar] = useState('19.2'); 
  const [tempZig, setTempZig] = useState('26.5');

  const [stats, setStats] = useState({ revenue: 0, orders: 0 });

  useEffect(() => {
    const loadShopData = async () => {
      if (typeof shopString === 'string') {
        try {
          const parsed = JSON.parse(shopString);
          setShop(parsed);
          await AsyncStorage.setItem('activeShop', shopString);
          fetchCurrentRates(parsed._id); // Fetch saved rates for this shop
        } catch (e) { console.error("Parse Error", e); }
      } else {
        const stored = await AsyncStorage.getItem('activeShop');
        if (stored) {
            const parsed = JSON.parse(stored);
            setShop(parsed);
            fetchCurrentRates(parsed._id);
        }
      }
    };
    loadShopData();
  }, [shopString]);

  // --- FETCH STATS ---
  useEffect(() => {
    if (shop?._id) {
      fetchStats();
    }
  }, [shop, selectedDate]);

  const fetchStats = async () => {
    if (!shop?._id) return;
    try {
      const res = await fetch(`${API_BASE_URL}/sales/stats?shopId=${shop._id}&date=${selectedDate.toISOString()}`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error("Stats fetch error", e);
    }
  };

  // --- API: FETCH SAVED RATES ---
  const fetchCurrentRates = async (shopId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/shops/rates/${shopId}`);
      if (res.ok) {
        const data = await res.json();
        setRates(data.rates);
        setTempZar(data.rates.ZAR.toString());
        setTempZig(data.rates.ZiG.toString());
      }
    } catch (e) { console.log("Using default rates"); }
  };

  // --- API: UPDATE RATES ---
  const updateRates = async () => {
    if (!shop?._id) return;
    setIsLoading(true);
    try {
      const newRates = { ZAR: parseFloat(tempZar), ZiG: parseFloat(tempZig) };
      
      const response = await fetch(`${API_BASE_URL}/shops/update-rates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId: shop._id,
          rates: newRates
        })
      });

      if (response.ok) {
        setRates(newRates);
        Alert.alert("Success", "Daily exchange rates updated for all cashiers.");
      } else {
        Alert.alert("Error", "Failed to save rates to server.");
      }
    } catch (error) {
      Alert.alert("Network Error", "Check your connection.");
    } finally {
      setIsLoading(false);
    }
  };

  const formatValue = (val: number) => {
    if (displayCurrency === 'ZAR') return `R ${(val * rates.ZAR).toFixed(2)}`;
    return `$ ${val.toFixed(2)}`;
  };

  // --- STAFF REQUESTS ---
  const fetchRequests = async () => {
    if (!shop?._id) return;
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/shops/requests/${shop._id}`);
      const data = await response.json();
      setPendingRequests(Array.isArray(data) ? data : []);
    } catch (error) { console.error('Fetch Error', error); }
    finally { setIsLoading(false); }
  };

  // Automatically fetch requests when shop loads or modal opens
  useEffect(() => {
    if (shop?._id) {
      fetchRequests();
    }
  }, [shop, isStaffModalVisible]);

  const handleShareCode = async () => {
    if (!shop) return;
    const msg = `Stolar POS Link\nShop: ${shop.name}\nCode: ${shop.branchCode}\n\nJoin my branch!`;
    try {
      Clipboard.setString(shop.branchCode);
      await Share.share({ message: msg });
    } catch (error) { Alert.alert('Error', 'Could not share.'); }
  };

  const handleRequestUpdate = async (requestId: string, status: 'approved' | 'rejected') => {
    try {
      const response = await fetch(`${API_BASE_URL}/shops/requests/${requestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (response.ok) {
        Alert.alert('Success', `Staff member ${status}.`);
        fetchRequests();
      }
    } catch (error) { Alert.alert('Error', 'Action failed.'); }
  };

  if (!shop) return <ActivityIndicator size="large" color="#1e40af" style={{flex: 1}} />;

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#0f172a', '#1e3a8a', '#2563eb']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerSubtitle}>Operational Hub</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>{shop.name}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{shop.branchCode}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.staffBtn} onPress={() => setStaffModalVisible(true)}>
          <Ionicons name="people" size={24} color="white" />
          {pendingRequests.length > 0 && <View style={styles.notifDot} />}
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* VIEW MODE TOGGLE */}
        <View style={styles.currencyToggleRow}>
            <Text style={styles.currencySectionHeader}>View Stats In:</Text>
            <View style={styles.toggleContainer}>
                {(['USD', 'ZAR'] as const).map((curr) => (
                    <TouchableOpacity 
                        key={curr} 
                        onPress={() => setDisplayCurrency(curr)}
                        style={[styles.toggleBtn, displayCurrency === curr && styles.toggleBtnActive]}
                    >
                        <Text style={[styles.toggleBtnText, displayCurrency === curr && styles.toggleBtnTextActive]}>{curr}</Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>

        <View style={styles.dateBar}>
            <Text style={styles.dateLabel}>Date: {selectedDate.toDateString()}</Text>
            <TouchableOpacity onPress={() => setCalendarVisible(true)} style={styles.calendarIconBtn}>
              <Ionicons name="calendar" size={18} color="#2563eb" />
            </TouchableOpacity>
        </View>

        <View style={styles.statsGrid}>
            <MetricBox 
                label="Revenue" 
                value={formatValue(stats.revenue)} 
                icon="cash-outline" 
                gradientColors={['#2563eb', '#1d4ed8']} 
                textColor="#1e40af" 
            />
            <MetricBox 
                label="Orders" 
                value={stats.orders.toString()} 
                icon="receipt-outline" 
                gradientColors={['#10b981', '#059669']} 
                textColor="#16a34a" 
            />
        </View>

        {/* SET DAILY RATES */}
        <View style={styles.rateCard}>
            <View style={styles.cardHeader}>
                <View style={styles.rateCardHeaderIconWrap}>
                    <Ionicons name="trending-up" size={18} color="#2563eb" />
                </View>
                <Text style={styles.cardTitle}>Daily Exchange Rates (vs $1 USD)</Text>
            </View>
            <View style={styles.rateInputRow}>
                <View style={styles.rateField}>
                    <Text style={styles.rateLabel}>ZAR (Rands)</Text>
                    <TextInput style={styles.rateInput} value={tempZar} onChangeText={setTempZar} keyboardType="numeric" />
                </View>
                <View style={styles.rateField}>
                    <Text style={styles.rateLabel}>ZiG (Local)</Text>
                    <TextInput style={styles.rateInput} value={tempZig} onChangeText={setTempZig} keyboardType="numeric" />
                </View>
            </View>
            <TouchableOpacity 
                style={[styles.updateRateBtn, isLoading && {opacity: 0.6}]} 
                onPress={updateRates}
                disabled={isLoading}
            >
                <LinearGradient
                    colors={['#2563eb', '#1d4ed8']}
                    style={styles.updateRateBtnGrad}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                >
                    {isLoading ? <ActivityIndicator size="small" color="white" /> : <Text style={styles.updateRateText}>Update Branch Rates</Text>}
                </LinearGradient>
            </TouchableOpacity>
        </View>

        <TouchableOpacity 
            style={styles.mainAction} 
            onPress={() => router.push({ pathname: '/(manager)/inventory', params: { shopId: shop._id } })}
            activeOpacity={0.85}
        >
            <LinearGradient
                colors={['#1e3a8a', '#2563eb']}
                style={styles.mainActionGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
            >
                <MaterialCommunityIcons name="package-variant" size={24} color="white" />
                <Text style={styles.mainActionText}>Manage Inventory</Text>
            </LinearGradient>
        </TouchableOpacity>
      </ScrollView>

      {/* Staff Request Modal */}
      <Modal visible={isStaffModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBody}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Branch Staff Management</Text>
              <TouchableOpacity onPress={() => setStaffModalVisible(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color="#475569" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.shareCodeCard}>
                <Text style={styles.shareLabel}>Share Invite Code</Text>
                <View style={styles.codeRow}>
                    <Text style={styles.codeDisplay}>{shop.branchCode}</Text>
                    <TouchableOpacity style={styles.copyBtn} onPress={handleShareCode}>
                        <LinearGradient
                            colors={['#16a34a', '#15803d']}
                            style={styles.copyBtnGrad}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                        >
                            <Ionicons name="logo-whatsapp" size={18} color="white" />
                            <Text style={styles.copyBtnText}>Invite</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </View>
            <Text style={styles.sectionHeader}>Pending Join Requests</Text>
            {isLoading ? <ActivityIndicator color="#2563eb" style={{ marginVertical: 20 }} /> : (
                <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                    {pendingRequests.length === 0 ? (
                        <Text style={styles.emptyText}>No pending staff requests.</Text>
                    ) : pendingRequests.map(req => (
                        <View key={req._id} style={styles.requestCard}>
                            <View style={{ flex: 1, marginRight: 10 }}>
                              <Text style={styles.reqName}>{req.cashier.name}</Text>
                              <Text style={styles.reqEmail} numberOfLines={1}>{req.cashier.email}</Text>
                            </View>
                            <View style={styles.reqActions}>
                                <TouchableOpacity onPress={() => handleRequestUpdate(req._id, 'approved')}>
                                  <Ionicons name="checkmark-circle" size={32} color="#10b981" />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => handleRequestUpdate(req._id, 'rejected')}>
                                  <Ionicons name="close-circle" size={32} color="#f43f5e" style={{marginLeft: 12}} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))}
                </ScrollView>
            )}
            <TouchableOpacity style={styles.closeBtn} onPress={() => setStaffModalVisible(false)}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <CalendarView visible={isCalendarVisible} onClose={() => setCalendarVisible(false)} onSelectDate={(d) => {setSelectedDate(new Date(d)); setCalendarVisible(false);}} />
    </SafeAreaView>
  );
}

const MetricBox = ({label, value, icon, gradientColors, textColor}: any) => (
    <View style={styles.statCard}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.statLabel}>{label}</Text>
            <LinearGradient
                colors={gradientColors}
                style={styles.statIconWrap}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                <Ionicons name={icon} size={16} color="white" />
            </LinearGradient>
        </View>
        <Text style={[styles.statValue, {color: textColor}]}>{value}</Text>
    </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4ff' },
  header: { 
    paddingHorizontal: 20, 
    paddingBottom: 28, 
    paddingTop: 60, 
    flexDirection: 'row', 
    alignItems: 'center',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitleContainer: { flex: 1, alignItems: 'center', paddingHorizontal: 10 },
  headerSubtitle: { color: 'rgba(255,255,255,0.6)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, fontWeight: '700' },
  headerTitle: { color: 'white', fontSize: 20, fontWeight: '800', marginTop: 2, textAlign: 'center' },
  badge: { 
    backgroundColor: 'rgba(255,255,255,0.15)', 
    paddingHorizontal: 12, 
    paddingVertical: 3, 
    borderRadius: 12, 
    marginTop: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  badgeText: { color: 'white', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  staffBtn: { 
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },
  notifDot: { position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: '#f43f5e', borderWidth: 1, borderColor: '#1e3a8a' },
  content: { padding: 20 },
  
  currencyToggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  currencySectionHeader: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  toggleContainer: { flexDirection: 'row', backgroundColor: '#e2e8f0', borderRadius: 12, padding: 3 },
  toggleBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  toggleBtnActive: { backgroundColor: 'white', elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 3 },
  toggleBtnText: { fontSize: 13, fontWeight: '700', color: '#64748b' },
  toggleBtnTextActive: { color: '#2563eb' },

  dateBar: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    marginBottom: 20, 
    backgroundColor: 'white', 
    paddingHorizontal: 16, 
    paddingVertical: 12, 
    borderRadius: 14, 
    borderWidth: 1, 
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  dateLabel: { color: '#0f172a', fontWeight: '700', fontSize: 14 },
  calendarIconBtn: {
    width: 32,
    height: 32,
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },

  statsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, gap: 12 },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  statIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statLabel: { fontSize: 11, color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { fontSize: 18, fontWeight: '800', marginTop: 4 },

  rateCard: { 
    backgroundColor: 'white', 
    padding: 20, 
    borderRadius: 20, 
    marginBottom: 20, 
    borderWidth: 1, 
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 10 },
  rateCardHeaderIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: { fontWeight: '800', color: '#0f172a', fontSize: 14 },
  rateInputRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  rateField: { flex: 1 },
  rateLabel: { fontSize: 11, color: '#475569', marginBottom: 6, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  rateInput: { 
    borderWidth: 1.5, 
    borderColor: '#cbd5e1', 
    borderRadius: 12, 
    padding: 12, 
    fontSize: 16, 
    fontWeight: '700', 
    color: '#0f172a', 
    backgroundColor: '#f8fafc',
    textAlign: 'center',
  },
  updateRateBtn: { 
    marginTop: 20, 
    borderRadius: 14, 
    overflow: 'hidden'
  },
  updateRateBtnGrad: {
    padding: 14, 
    alignItems: 'center', 
    justifyContent: 'center',
  },
  updateRateText: { color: 'white', fontWeight: '700', fontSize: 15 },

  mainAction: { 
    borderRadius: 20, 
    overflow: 'hidden', 
    elevation: 4, 
    shadowColor: '#2563eb', 
    shadowOffset: { width: 0, height: 6 }, 
    shadowOpacity: 0.25, 
    shadowRadius: 16, 
    marginBottom: 30 
  },
  mainActionGrad: { flexDirection: 'row', padding: 18, justifyContent: 'center', alignItems: 'center', gap: 10 },
  mainActionText: { color: 'white', fontWeight: '800', fontSize: 16 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.65)', justifyContent: 'flex-end' },
  modalBody: { 
    backgroundColor: 'white', 
    borderTopLeftRadius: 28, 
    borderTopRightRadius: 28, 
    padding: 24, 
    height: '75%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 20,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  shareCodeCard: { 
    backgroundColor: '#f8fafc', 
    padding: 18, 
    borderRadius: 20, 
    marginBottom: 24,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
  },
  shareLabel: { fontSize: 11, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '700' },
  codeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  codeDisplay: { fontSize: 28, fontWeight: '800', color: '#2563eb', letterSpacing: 4 },
  copyBtn: { borderRadius: 12, overflow: 'hidden' },
  copyBtnGrad: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center', gap: 6 },
  copyBtnText: { color: 'white', fontWeight: '800' },
  sectionHeader: { fontSize: 14, fontWeight: '800', color: '#475569', marginBottom: 12, marginTop: 10 },
  requestCard: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 16, 
    backgroundColor: 'white', 
    borderRadius: 16, 
    marginBottom: 12, 
    borderWidth: 1, 
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  reqName: { fontWeight: '800', color: '#0f172a', fontSize: 15 },
  reqEmail: { fontSize: 12, color: '#64748b', marginTop: 2 },
  reqActions: { flexDirection: 'row', alignItems: 'center' },
  closeBtn: { marginTop: 15, padding: 14, alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 14 },
  closeBtnText: { fontWeight: '700', color: '#475569', fontSize: 15 },
  emptyText: { textAlign: 'center', color: '#94a3b8', marginTop: 24, fontSize: 14 }
});