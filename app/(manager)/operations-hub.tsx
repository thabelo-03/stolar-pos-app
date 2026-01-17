import CalendarView from '@/components/ui/CalendarView';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Clipboard // Added for professional copy-to-clipboard
  ,

  Modal,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { API_BASE_URL } from '../config';

interface LinkRequest {
  _id: string;
  cashier: {
    _id: string;
    name: string;
    email: string;
  };
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

  // --- 1. SHOP DATA INITIALIZATION ---
  useEffect(() => {
    const loadShopData = async () => {
      if (typeof shopString === 'string') {
        try {
          const parsed = JSON.parse(shopString);
          setShop(parsed);
          await AsyncStorage.setItem('activeShop', shopString);
        } catch (e) {
          console.error("Parse Error", e);
        }
      } else {
        const stored = await AsyncStorage.getItem('activeShop');
        if (stored) setShop(JSON.parse(stored));
      }
    };
    loadShopData();
  }, [shopString]);

  // --- 2. STAFF REQUESTS LOGIC ---
  const fetchRequests = async () => {
    if (!shop?._id) return;
    setIsLoading(true);
    try {
      // We fetch requests specifically for this branch ID
      const response = await fetch(`${API_BASE_URL}/shops/requests/${shop._id}`);
      const data = await response.json();
      //setPendingRequests(data);
      if (Array.isArray(data)) {
        setPendingRequests(data);
      } else {
        setPendingRequests([]); // Fallback to empty array if it's an error object
      }
    } catch (error) {
      console.error('Fetch Error', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isStaffModalVisible) fetchRequests();
  }, [isStaffModalVisible]);

  // --- 3. WHATSAPP / SHARE LOGIC ---
  const handleShareCode = async () => {
    if (!shop) return;
    const msg = `Stolar POS Link\n\nShop: ${shop.name}\nCode: ${shop.branchCode}\n\nCashiers: Enter this code to join my branch!`;
    
    try {
      // Copy to clipboard first as a backup
      Clipboard.setString(shop.branchCode);
      
      await Share.share({
        message: msg,
      });
    } catch (error) {
      Alert.alert('Error', 'Could not initiate share.');
    }
  };

  const handleRequestUpdate = async (requestId: string, status: 'approved' | 'rejected') => {
    try {
      const response = await fetch(`${API_BASE_URL}/shops/requests/${requestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });

      if (response.ok) {
        Alert.alert('Success', `Cashier has been ${status}.`);
        fetchRequests();
      }
    } catch (error) {
      Alert.alert('Error', 'Action failed.');
    }
  };

  if (!shop) return <ActivityIndicator size="large" style={{flex: 1}} />;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerSubtitle}>Operational Hub</Text>
          <Text style={styles.headerTitle}>{shop.name}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{shop.branchCode}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.staffBtn} onPress={() => setStaffModalVisible(true)}>
          <Ionicons name="people" size={26} color="white" />
          {pendingRequests.length > 0 && <View style={styles.notifDot} />}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Simplified Dashboard Metrics */}
        <View style={styles.dateBar}>
            <Text style={styles.dateLabel}>Stats for: {selectedDate.toDateString()}</Text>
            <TouchableOpacity onPress={() => setCalendarVisible(true)}>
                <Ionicons name="calendar" size={20} color="#1e40af" />
            </TouchableOpacity>
        </View>

        <View style={styles.statsGrid}>
            <MetricBox label="Daily Sales" value="R 0.00" color="#eff6ff" text="#1e40af" />
            <MetricBox label="Orders" value="0" color="#f0fdf4" text="#16a34a" />
        </View>

        <TouchableOpacity style={styles.mainAction} onPress={() => router.push('/(manager)/inventory')}>
            <MaterialCommunityIcons name="package-variant" size={24} color="white" />
            <Text style={styles.mainActionText}>Manage Inventory</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Staff Modal */}
      <Modal visible={isStaffModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBody}>
            <Text style={styles.modalTitle}>Branch Staff Link</Text>
            
            <View style={styles.shareCodeCard}>
                <Text style={styles.shareLabel}>Cashier Invite Code</Text>
                <View style={styles.codeRow}>
                    <Text style={styles.codeDisplay}>{shop.branchCode}</Text>
                    <TouchableOpacity style={styles.copyBtn} onPress={handleShareCode}>
                        <Ionicons name="logo-whatsapp" size={20} color="white" />
                        <Text style={styles.copyBtnText}>Send</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <Text style={styles.sectionHeader}>Join Requests</Text>
            {isLoading ? <ActivityIndicator color="#1e40af" /> : (
                <ScrollView>
                    {Array.isArray(pendingRequests) &&pendingRequests.length === 0 ? (
                        <Text style={styles.emptyText}>No pending requests for this branch.</Text>
                    ) : pendingRequests.map(req => (
                        <View key={req._id} style={styles.requestCard}>
                            <View>
                                <Text style={styles.reqName}>{req.cashier.name}</Text>
                                <Text style={styles.reqEmail}>{req.cashier.email}</Text>
                            </View>
                            <View style={styles.reqActions}>
                                <TouchableOpacity onPress={() => handleRequestUpdate(req._id, 'approved')}>
                                    <Ionicons name="checkmark-circle" size={32} color="#22c55e" />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => handleRequestUpdate(req._id, 'rejected')}>
                                    <Ionicons name="close-circle" size={32} color="#ef4444" style={{marginLeft: 10}} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))}
                </ScrollView>
            )}

            <TouchableOpacity style={styles.closeBtn} onPress={() => setStaffModalVisible(false)}>
              <Text style={styles.closeBtnText}>Back to Hub</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <CalendarView 
        visible={isCalendarVisible} 
        onClose={() => setCalendarVisible(false)} 
        onSelectDate={(d) => {setSelectedDate(new Date(d)); setCalendarVisible(false);}} 
      />
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
  headerSubtitle: { color: '#bfdbfe', fontSize: 12, textTransform: 'uppercase' },
  headerTitle: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  badge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, borderRadius: 5, marginTop: 5 },
  badgeText: { color: 'white', fontSize: 12, fontWeight: 'bold' },
  staffBtn: { padding: 5 },
  notifDot: { position: 'absolute', top: 0, right: 0, width: 10, height: 10, borderRadius: 5, backgroundColor: '#ef4444', borderWidth: 1, borderColor: 'white' },
  content: { padding: 20 },
  dateBar: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, backgroundColor: 'white', padding: 15, borderRadius: 12 },
  dateLabel: { color: '#64748b', fontWeight: '600' },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  statCard: { width: '48%', padding: 20, borderRadius: 15 },
  statLabel: { fontSize: 12, color: '#64748b' },
  statValue: { fontSize: 20, fontWeight: 'bold', marginTop: 5 },
  mainAction: { backgroundColor: '#1e40af', flexDirection: 'row', padding: 20, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  mainActionText: { color: 'white', fontWeight: 'bold', marginLeft: 10, fontSize: 16 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBody: { backgroundColor: 'white', borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 25, height: '70%' },
  modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, color: '#1e293b' },
  shareCodeCard: { backgroundColor: '#f1f5f9', padding: 20, borderRadius: 15, marginBottom: 25 },
  shareLabel: { fontSize: 14, color: '#64748b', marginBottom: 10 },
  codeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  codeDisplay: { fontSize: 24, fontWeight: 'bold', color: '#1e40af', letterSpacing: 2 },
  copyBtn: { backgroundColor: '#16a34a', flexDirection: 'row', padding: 10, borderRadius: 10, alignItems: 'center' },
  copyBtnText: { color: 'white', fontWeight: 'bold', marginLeft: 5 },
  sectionHeader: { fontSize: 16, fontWeight: 'bold', color: '#64748b', marginBottom: 15 },
  requestCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, backgroundColor: '#f8fafc', borderRadius: 12, marginBottom: 10 },
  reqName: { fontWeight: 'bold', color: '#1e293b' },
  reqEmail: { fontSize: 12, color: '#64748b' },
  reqActions: { flexDirection: 'row' },
  closeBtn: { marginTop: 20, padding: 15, alignItems: 'center', backgroundColor: '#e2e8f0', borderRadius: 12 },
  closeBtnText: { fontWeight: 'bold', color: '#475569' },
  emptyText: { textAlign: 'center', color: '#94a3b8', marginTop: 20 }
});