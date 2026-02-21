import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Modal, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_BASE_URL } from './api';
import { useActiveShop } from './use-active-shop';
import { useNotifications } from './use-notifications';

const AnimatedCard = ({ onPress, children, style, disabled }: { onPress: () => void, children: React.ReactNode, style?: any, disabled?: boolean }) => {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (disabled) return;
    Animated.spring(scale, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 20,
      bounciness: 8,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 8,
    }).start();
  };

  return (
    <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut} disabled={disabled}>
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
};

export default function CashierHome() {
  const router = useRouter();
  const { name, role, shopName: initialShopName } = useLocalSearchParams();
  const [cashierName, setCashierName] = useState(Array.isArray(name) ? name[0] : name);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isLinked, setIsLinked] = useState(false);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [shopName, setShopName] = useState(initialShopName ? (Array.isArray(initialShopName) ? initialShopName[0] : initialShopName) : 'Loading...');
  const [shopDetails, setShopDetails] = useState<any>(null);
  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const { unreadCount, fetchUnreadCount } = useNotifications();
  const insets = useSafeAreaInsets();

  const { shopId, shopName: hookShopName, userRole: hookUserRole, userId, loading: shopLoading, refreshShop } = useActiveShop();

  // Password Protection
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [password, setPassword] = useState('');
  const [verifying, setVerifying] = useState(false);
  const pendingAction = useRef<(() => void) | null>(null);

  const requestPassword = async (action: () => void) => {
    pendingAction.current = action;
    setPassword('');
    setVerifying(false);

    // Try Biometrics First
    const bioEnabled = await AsyncStorage.getItem('biometricEnabled');
    if (bioEnabled === 'true') {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (hasHardware && isEnrolled) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Manager Approval Required',
          fallbackLabel: 'Use Password',
        });
        if (result.success) return action();
      }
    }

    setPasswordVisible(true);
  };

  const handlePasswordSubmit = async () => {
    if (!password) return;
    setVerifying(true);
    try {
      const userId = await AsyncStorage.getItem('userId');
      const response = await fetch(`${API_BASE_URL}/auth/verify-manager`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cashierId: userId, password }),
      });
      
      const data = await response.json();
      if (response.ok && data.success) {
        setPasswordVisible(false);
        setTimeout(() => {
          pendingAction.current?.();
        }, 100);
      } else {
        Alert.alert("Error", data.message || "Incorrect Password");
      }
    } catch (e) {
      Alert.alert("Error", "Network error");
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    if (hookUserRole) setUserRole(hookUserRole);
  }, [hookUserRole]);

  useEffect(() => {
    if (hookShopName) setShopName(hookShopName);
  }, [hookShopName]);

  useEffect(() => {
    const updateDashboard = async () => {
      if (shopLoading) return;

      if (userId) {
        try {
          const userRes = await fetch(`${API_BASE_URL}/users/${userId}`);
          if (userRes.ok) {
            const userData = await userRes.json();
            if (userData.name) setCashierName(userData.name);
          }
        } catch (e) {}

        if (shopId) {
          setIsLinked(true);
          setHasPendingRequest(false);
          try {
            const shopRes = await fetch(`${API_BASE_URL}/shops/${shopId}`);
            if (shopRes.ok) {
              const shopData = await shopRes.json();
              setShopName(shopData.name || 'Unknown Shop');
              setShopDetails(shopData);
            } else {
              setShopName('Shop Not Found');
            }
          } catch (e) { setShopName('Offline'); }
        } else {
          setShopName('No Shop Linked');
          setIsLinked(false);
          setShopDetails(null);
          try {
            const reqRes = await fetch(`${API_BASE_URL}/shops/cashier-request/${userId}`);
            if (reqRes.ok) {
              const reqData = await reqRes.json();
              if (reqData) setHasPendingRequest(true);
            }
          } catch (e) {}
        }
      } else {
        setShopName('Not Logged In');
      }
    };
    updateDashboard();
  }, [shopId, userId, shopLoading]);

  useFocusEffect(
    useCallback(() => {
      refreshShop();
      fetchUnreadCount();
    }, [])
  );

  const handleLogout = () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to log out?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Logout", 
          style: "destructive",
          onPress: () => router.replace('/(auth)/login') 
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1e40af" />
      
      {/* 1. Top Header Section */}
      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.brandTitle}>Stolar POS</Text>
            <TouchableOpacity onPress={() => shopDetails && setInfoModalVisible(true)} disabled={!shopDetails}>
              <Text style={styles.statusSub}> • Shop: {shopName} <Ionicons name="information-circle-outline" size={14} color="#bfdbfe" /> <Ionicons name="checkmark-circle" size={12} color="#4ade80" /> </Text>
              {/* <Text style={styles.statusSub}>{cashierName || 'CASHIER'} • Shop: {shopName} <Ionicons name="information-circle-outline" size={14} color="#bfdbfe" /> <Ionicons name="checkmark-circle" size={14} color="#4ade80" /> Online</Text> */}

            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row' }}>
            <TouchableOpacity style={styles.notificationBtn} onPress={() => router.push('/(tabs)/profile-settings')}>
              <Ionicons name="settings-outline" size={26} color="white" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.notificationBtn, { marginLeft: 10 }]} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={26} color="white" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.notificationBtn, { marginLeft: 10 }]} onPress={() => router.push('/notifications')}>
              <Ionicons name="notifications" size={26} color="white" />
              {unreadCount > 0 && (
                <View style={styles.notificationBadge}><Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text></View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* 2. Large Start Selling Button */}
        <TouchableOpacity 
          style={styles.heroButton}
          onPress={() => router.push('/(tabs)/scan')}
          activeOpacity={0.9}
        >
          <View style={styles.heroContent}>
            <View style={styles.heroIconCircle}>
              <MaterialCommunityIcons name="barcode-scan" size={32} color="white" />
            </View>
            <View style={styles.heroTextContainer}>
              <Text style={styles.heroTitle}>Start Selling</Text>
              <Text style={styles.heroSubtitle}>Scan or Search Items</Text>
            </View>
          </View>
          <Ionicons name="arrow-forward" size={24} color="white" style={{ opacity: 0.8 }} />
        </TouchableOpacity>

        <View style={styles.mainGrid}>
          {/* 3. Left Side: Start Selling Card */}
          <View style={[styles.card, styles.leftCard]}>
             <TouchableOpacity 
               style={styles.miniHeroButton}
               onPress={() => router.push('/(tabs)/scan')}
             >
                <MaterialCommunityIcons name="barcode-scan" size={24} color="white" />
                <Text style={styles.miniHeroTitle}>START SELLING</Text>
                <Text style={styles.miniHeroSub}>SCAN / SEARCH</Text>
             </TouchableOpacity>
          </View>

          {/* 4. Right Side: Quick Actions & Add Stock */}
          <View style={styles.rightColumn}>
            
            {/* Quick Actions Card */}
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>Quick Actions</Text>

              {userRole === 'manager' && (
                <AnimatedCard style={styles.actionRow} onPress={() => router.replace('/(manager)')}>
                  <View style={[styles.iconBox, { backgroundColor: '#f1f5f9' }]}>
                    <Ionicons name="briefcase" size={20} color="#0f172a" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.actionTitle}>Manager Dashboard</Text>
                    <Text style={styles.actionSub}>Switch workspace</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
                </AnimatedCard>
              )}
              
              <AnimatedCard style={styles.actionRow} onPress={() => router.push('/(cashier)/my-shop')}>
                <View style={[styles.iconBox, { backgroundColor: '#e0f2fe' }]}>
                  <Ionicons name="storefront" size={20} color="#0284c7" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionTitle}>{isLinked ? "My Shop" : "Link Shop"}</Text>
                  <Text style={styles.actionSub}>{isLinked ? "View Details" : "Connect to Branch"}</Text>
                </View>
                {hasPendingRequest && !isLinked && (
                  <View style={styles.pendingBadge}>
                    <Text style={styles.pendingBadgeText}>Pending</Text>
                  </View>
                )}
                <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
              </AnimatedCard>

              <AnimatedCard style={styles.actionRow} onPress={() => router.push('/(tabs)/daily-summary')}>
                <View style={[styles.iconBox, { backgroundColor: '#eef2ff' }]}>
                  <Ionicons name="document-text" size={20} color="#6366f1" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionTitle}>Sales Summary</Text>
                  <Text style={styles.actionSub}>Daily & Weekly Stats</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
              </AnimatedCard>

              <AnimatedCard style={styles.actionRow} onPress={() => {
                if (userRole === 'manager') {
                  router.push('/(tabs)/profit-report');
                } else {
                  requestPassword(() => router.push('/(tabs)/profit-report'));
                }
              }}>
                <View style={[styles.iconBox, { backgroundColor: '#dcfce7' }]}>
                  <Ionicons name="trending-up" size={20} color="#16a34a" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                    <Text style={styles.actionTitle}>Profit Report</Text>
                    <Ionicons name="lock-closed" size={12} color="#f59e0b" style={{ marginLeft: 4 }} />
                  </View>
                  <Text style={styles.actionSub}>Margins & Revenue</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
              </AnimatedCard>

              <AnimatedCard style={styles.actionRow} onPress={() => router.push('/(tabs)/last-sales')}>
                <View style={[styles.iconBox, { backgroundColor: '#fffbeb' }]}>
                  <Ionicons name="receipt" size={20} color="#f59e0b" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionTitle}>My Last 10 Sales</Text>
                  <Text style={styles.actionSub}>Receipts</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
              </AnimatedCard>
            </View>

            {/* Add Stock Card */}
            <View style={[styles.card, !isLinked && { opacity: 0.6 }]}>
              <Text style={styles.sectionLabel}>Add Stock</Text>
              <AnimatedCard 
                style={[styles.addStockBtn, !isLinked && { backgroundColor: '#e2e8f0' }]} 
                onPress={() => router.push('/(tabs)/add-stock')}
                disabled={!isLinked}
              >
                <View style={styles.addStockIcon}>
                   <Ionicons name="add-circle" size={24} color={isLinked ? "#059669" : "#94a3b8"} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.actionTitle, !isLinked && { color: '#64748b' }]}>Add Stock</Text>
                  <Text style={styles.actionSub}>{isLinked ? 'Adjust Inventory' : 'Link Shop Required'}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
              </AnimatedCard>
            </View>

          </View>
        </View>
      </ScrollView>

      {/* Password Modal */}
      <Modal visible={passwordVisible} transparent animationType="fade" onRequestClose={() => setPasswordVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.passwordContainer}>
            <Text style={styles.passwordTitle}>Manager Password</Text>
            <TextInput 
              style={styles.passwordInput} 
              secureTextEntry 
              placeholder="Enter Password"
              value={password}
              onChangeText={setPassword}
              autoFocus
              keyboardType="default"
            />
            <TouchableOpacity style={{ alignSelf: 'center', marginBottom: 15 }} onPress={() => requestPassword(pendingAction.current!)}>
               <Ionicons name="finger-print" size={32} color="#1e40af" />
            </TouchableOpacity>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setPasswordVisible(false)}><Text style={styles.btnText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={handlePasswordSubmit} disabled={verifying}>
                {verifying ? <ActivityIndicator color="white" size="small" /> : <Text style={[styles.btnText, {color: 'white'}]}>Confirm</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Shop Info Modal */}
      <Modal visible={infoModalVisible} transparent animationType="fade" onRequestClose={() => setInfoModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.infoModalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Shop Information</Text>
              <TouchableOpacity onPress={() => setInfoModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            
            {shopDetails && (
              <View style={styles.infoContent}>
                <View style={styles.infoRow}>
                  <View style={styles.infoIconBox}><Ionicons name="storefront" size={20} color="#1e40af" /></View>
                  <View>
                    <Text style={styles.infoLabel}>Shop Name</Text>
                    <Text style={styles.infoValue}>{shopDetails.name}</Text>
                  </View>
                </View>

                <View style={styles.infoRow}>
                  <View style={styles.infoIconBox}><Ionicons name="location" size={20} color="#1e40af" /></View>
                  <View>
                    <Text style={styles.infoLabel}>Location</Text>
                    <Text style={styles.infoValue}>{shopDetails.location}</Text>
                  </View>
                </View>

                <View style={styles.infoRow}>
                  <View style={styles.infoIconBox}><Ionicons name="qr-code" size={20} color="#1e40af" /></View>
                  <View>
                    <Text style={styles.infoLabel}>Branch Code</Text>
                    <Text style={styles.infoValue}>{shopDetails.branchCode}</Text>
                  </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.infoRow}>
                  <View style={styles.infoIconBox}><Ionicons name="person" size={20} color="#1e40af" /></View>
                  <View>
                    <Text style={styles.infoLabel}>Manager</Text>
                    <Text style={styles.infoValue}>{shopDetails.manager?.name || 'N/A'}</Text>
                  </View>
                </View>

                <View style={styles.infoRow}>
                  <View style={styles.infoIconBox}><Ionicons name="mail" size={20} color="#1e40af" /></View>
                  <View>
                    <Text style={styles.infoLabel}>Contact</Text>
                    <Text style={styles.infoValue}>{shopDetails.manager?.email || 'N/A'}</Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { 
    backgroundColor: '#1e40af', 
    height: 160, 
    borderBottomLeftRadius: 40, 
    borderBottomRightRadius: 40,
    paddingHorizontal: 25,
  },
  headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brandTitle: { color: 'white', fontSize: 32, fontWeight: 'bold' },
  statusSub: { color: '#bfdbfe', fontSize: 14, marginTop: 4 },
  notificationBtn: { backgroundColor: 'rgba(255,255,255,0.2)', padding: 10, borderRadius: 12 },
  notificationBadge: { position: 'absolute', top: -5, right: -5, backgroundColor: '#ef4444', borderRadius: 10, width: 20, height: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#1e40af' },
  badgeText: { color: 'white', fontSize: 10, fontWeight: 'bold' },
  
  scrollContent: { padding: 20, marginTop: -40 },
  
  heroButton: { 
    backgroundColor: '#059669', 
    borderRadius: 24, 
    padding: 20, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
    marginBottom: 25,
  },
  heroContent: { flexDirection: 'row', alignItems: 'center' },
  heroIconCircle: {
    width: 56, height: 56, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center', marginRight: 16
  },
  heroTextContainer: { justifyContent: 'center' },
  heroTitle: { color: 'white', fontSize: 20, fontWeight: '800', letterSpacing: 0.5 },
  heroSubtitle: { color: '#d1fae5', fontSize: 13, fontWeight: '600', marginTop: 2 },

  mainGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  leftCard: { width: '45%', justifyContent: 'center', alignItems: 'center', minHeight: 400 },
  miniHeroButton: { backgroundColor: '#10b981', borderRadius: 20, padding: 15, width: '90%', alignItems: 'center' },
  miniHeroTitle: { color: 'white', fontWeight: 'bold', fontSize: 14, textAlign: 'center', marginTop: 5 },
  miniHeroSub: { color: 'white', fontSize: 10, opacity: 0.8 },

  rightColumn: { width: '52%' },
  card: { backgroundColor: 'white', borderRadius: 25, padding: 15, marginBottom: 15, elevation: 2 },
  sectionLabel: { fontSize: 16, fontWeight: 'bold', color: '#1e293b', marginBottom: 15 },
  
  actionRow: { 
    flexDirection: 'row', alignItems: 'center', padding: 12, 
    backgroundColor: '#f8fafc', borderRadius: 16, marginBottom: 10,
    borderWidth: 1, borderColor: '#f1f5f9'
  },
  iconBox: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  actionTitle: { fontSize: 14, fontWeight: 'bold', color: '#1e293b' },
  actionSub: { fontSize: 12, color: '#64748b' },

  addStockBtn: { 
    backgroundColor: '#f0fdf4', padding: 12, borderRadius: 16, flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#dcfce7'
  },
  addStockIcon: { marginRight: 10 },
  lockRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingLeft: 5 },
  lockText: { fontSize: 11, color: '#64748b', marginLeft: 5 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  passwordContainer: { backgroundColor: 'white', padding: 20, borderRadius: 12, width: '80%', maxWidth: 300 },
  passwordTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center', color: '#1e293b' },
  passwordInput: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 10, marginBottom: 20, fontSize: 16, textAlign: 'center' },
  modalButtons: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, padding: 12, backgroundColor: '#f1f5f9', borderRadius: 8, alignItems: 'center' },
  confirmBtn: { flex: 1, padding: 12, backgroundColor: '#1e40af', borderRadius: 8, alignItems: 'center' },
  btnText: { fontWeight: 'bold' },
  pendingBadge: { backgroundColor: '#f59e0b', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  pendingBadgeText: { color: 'white', fontSize: 10, fontWeight: 'bold' },

  infoModalContainer: { backgroundColor: 'white', borderRadius: 16, padding: 20, width: '85%', maxWidth: 400 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  infoContent: { gap: 16 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoIconBox: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center' },
  infoLabel: { fontSize: 12, color: '#64748b', marginBottom: 2 },
  infoValue: { fontSize: 16, fontWeight: '600', color: '#1e293b' },
  divider: { height: 1, backgroundColor: '#e2e8f0', marginVertical: 8 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
});