import CalendarView from '@/components/ui/CalendarView';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  const [displayCurrency, setDisplayCurrency] = useState<'USD' | 'ZAR' | 'ZiG'>('USD');
  const [rates, setRates] = useState({ ZAR: 19.2, ZiG: 26.5 });
  const [tempZar, setTempZar] = useState('19.2'); 
  const [tempZig, setTempZig] = useState('26.5');

  // Placeholder stats (In production, fetch from /sales/stats?shopId=...&date=...)
  const statsUSD = { sales: 150.50, orders: 12 }; 

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
    if (displayCurrency === 'ZiG') return `ZiG ${(val * rates.ZiG).toFixed(2)}`;
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color="white" /></TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerSubtitle}>Operational Hub</Text>
          <Text style={styles.headerTitle}>{shop.name}</Text>
          <View style={styles.badge}><Text style={styles.badgeText}>{shop.branchCode}</Text></View>
        </View>
        <TouchableOpacity style={styles.staffBtn} onPress={() => setStaffModalVisible(true)}>
          <Ionicons name="people" size={26} color="white" />
          {pendingRequests.length > 0 && <View style={styles.notifDot} />}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* VIEW MODE TOGGLE */}
        <View style={styles.currencyToggleRow}>
            <Text style={styles.sectionHeader}>View Stats In:</Text>
            <View style={styles.toggleContainer}>
                {(['USD', 'ZAR', 'ZiG'] as const).map((curr) => (
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
            <TouchableOpacity onPress={() => setCalendarVisible(true)}><Ionicons name="calendar" size={20} color="#1e40af" /></TouchableOpacity>
        </View>

        <View style={styles.statsGrid}>
            <MetricBox label="Revenue" value={formatValue(statsUSD.sales)} color="#eff6ff" text="#1e40af" />
            <MetricBox label="Orders" value={statsUSD.orders.toString()} color="#f0fdf4" text="#16a34a" />
        </View>

        {/* SET DAILY RATES */}
        <View style={styles.rateCard}>
            <View style={styles.cardHeader}>
                <Ionicons name="trending-up" size={18} color="#1e293b" />
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
                {isLoading ? <ActivityIndicator size="small" color="#1e40af" /> : <Text style={styles.updateRateText}>Update Branch Rates</Text>}
            </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.mainAction} onPress={() => router.push('/(manager)/inventory')}>
            <MaterialCommunityIcons name="package-variant" size={24} color="white" />
            <Text style={styles.mainActionText}>Manage Inventory</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Staff Request Modal */}
      <Modal visible={isStaffModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBody}>
            <Text style={styles.modalTitle}>Branch Staff Management</Text>
            <View style={styles.shareCodeCard}>
                <Text style={styles.shareLabel}>Share Invite Code</Text>
                <View style={styles.codeRow}>
                    <Text style={styles.codeDisplay}>{shop.branchCode}</Text>
                    <TouchableOpacity style={styles.copyBtn} onPress={handleShareCode}>
                        <Ionicons name="logo-whatsapp" size={20} color="white" /><Text style={styles.copyBtnText}>Invite</Text>
                    </TouchableOpacity>
                </View>
            </View>
            <Text style={styles.sectionHeader}>Pending Join Requests</Text>
            {isLoading ? <ActivityIndicator color="#1e40af" /> : (
                <ScrollView>
                    {pendingRequests.length === 0 ? <Text style={styles.emptyText}>No requests at the moment.</Text> : pendingRequests.map(req => (
                        <View key={req._id} style={styles.requestCard}>
                            <View><Text style={styles.reqName}>{req.cashier.name}</Text><Text style={styles.reqEmail}>{req.cashier.email}</Text></View>
                            <View style={styles.reqActions}>
                                <TouchableOpacity onPress={() => handleRequestUpdate(req._id, 'approved')}><Ionicons name="checkmark-circle" size={32} color="#22c55e" /></TouchableOpacity>
                                <TouchableOpacity onPress={() => handleRequestUpdate(req._id, 'rejected')}><Ionicons name="close-circle" size={32} color="#ef4444" style={{marginLeft: 10}} /></TouchableOpacity>
                            </View>
                        </View>
                    ))}
                </ScrollView>
            )}
            <TouchableOpacity style={styles.closeBtn} onPress={() => setStaffModalVisible(false)}><Text style={styles.closeBtnText}>Close</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <CalendarView visible={isCalendarVisible} onClose={() => setCalendarVisible(false)} onSelectDate={(d) => {setSelectedDate(new Date(d)); setCalendarVisible(false);}} />
    </SafeAreaView>
  );
}

const MetricBox = ({label, value, color, text}: any) => (
    <View style={[styles.statCard, {backgroundColor: color}]}>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={[styles.statValue, {color: text}]}>{value}</Text>
    </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { backgroundColor: '#1e40af', padding: 20, paddingTop: 50, flexDirection: 'row', alignItems: 'center' },
  headerTitleContainer: { flex: 1, alignItems: 'center' },
  headerSubtitle: { color: '#bfdbfe', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 },
  headerTitle: { color: 'white', fontSize: 22, fontWeight: 'bold' },
  badge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, borderRadius: 5, marginTop: 5 },
  badgeText: { color: 'white', fontSize: 12, fontWeight: 'bold' },
  staffBtn: { padding: 5 },
  notifDot: { position: 'absolute', top: 0, right: 0, width: 10, height: 10, borderRadius: 5, backgroundColor: '#ef4444', borderWidth: 1, borderColor: 'white' },
  content: { padding: 20 },
  
  currencyToggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  toggleContainer: { flexDirection: 'row', backgroundColor: '#e2e8f0', borderRadius: 10, padding: 2 },
  toggleBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  toggleBtnActive: { backgroundColor: 'white', elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 2 },
  toggleBtnText: { fontSize: 12, fontWeight: 'bold', color: '#64748b' },
  toggleBtnTextActive: { color: '#1e40af' },

  dateBar: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, backgroundColor: 'white', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  dateLabel: { color: '#64748b', fontWeight: '600' },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  statCard: { width: '48%', padding: 20, borderRadius: 15 },
  statLabel: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  statValue: { fontSize: 18, fontWeight: 'bold', marginTop: 5 },

  rateCard: { backgroundColor: 'white', padding: 20, borderRadius: 15, marginBottom: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, gap: 8 },
  cardTitle: { fontWeight: 'bold', color: '#1e293b', fontSize: 14 },
  rateInputRow: { flexDirection: 'row', justifyContent: 'space-between' },
  rateField: { width: '45%' },
  rateLabel: { fontSize: 11, color: '#64748b', marginBottom: 5, fontWeight: '500' },
  rateInput: { borderBottomWidth: 2, borderBottomColor: '#1e40af', paddingVertical: 8, fontSize: 18, fontWeight: 'bold', color: '#1e40af' },
  updateRateBtn: { backgroundColor: '#eff6ff', marginTop: 20, padding: 15, borderRadius: 12, alignItems: 'center' },
  updateRateText: { color: '#1e40af', fontWeight: 'bold', fontSize: 15 },

  mainAction: { backgroundColor: '#1e40af', flexDirection: 'row', padding: 20, borderRadius: 15, justifyContent: 'center', alignItems: 'center', elevation: 3 },
  mainActionText: { color: 'white', fontWeight: 'bold', marginLeft: 10, fontSize: 16 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBody: { backgroundColor: 'white', borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 25, height: '75%' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, color: '#1e293b' },
  shareCodeCard: { backgroundColor: '#f1f5f9', padding: 20, borderRadius: 15, marginBottom: 25 },
  shareLabel: { fontSize: 12, color: '#64748b', marginBottom: 10, textTransform: 'uppercase' },
  codeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  codeDisplay: { fontSize: 26, fontWeight: 'bold', color: '#1e40af', letterSpacing: 3 },
  copyBtn: { backgroundColor: '#16a34a', flexDirection: 'row', padding: 10, paddingHorizontal: 15, borderRadius: 10, alignItems: 'center' },
  copyBtnText: { color: 'white', fontWeight: 'bold', marginLeft: 5 },
  sectionHeader: { fontSize: 14, fontWeight: 'bold', color: '#64748b', marginBottom: 15 },
  requestCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, backgroundColor: '#f8fafc', borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  reqName: { fontWeight: 'bold', color: '#1e293b' },
  reqEmail: { fontSize: 12, color: '#64748b' },
  reqActions: { flexDirection: 'row' },
  closeBtn: { marginTop: 20, padding: 15, alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 12 },
  closeBtnText: { fontWeight: 'bold', color: '#475569' },
  emptyText: { textAlign: 'center', color: '#94a3b8', marginTop: 20, fontSize: 14 }
});