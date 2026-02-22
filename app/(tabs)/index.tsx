import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Modal, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_BASE_URL } from '../config';
import { useActiveShop } from './use-active-shop';
import { useManagerAuth } from './use-manager-auth';
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
  const { name, shopName: initialShopName } = useLocalSearchParams();
  const [cashierName, setCashierName] = useState(Array.isArray(name) ? name[0] : name);
  const [shopName, setShopName] = useState(initialShopName ? (Array.isArray(initialShopName) ? initialShopName[0] : initialShopName) : 'Loading...');
  const [isLinked, setIsLinked] = useState(false);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [shopDetails, setShopDetails] = useState<any>(null);
  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const { unreadCount, fetchUnreadCount } = useNotifications();
  const insets = useSafeAreaInsets();

  const { shopId, shopName: hookShopName, userRole: hookUserRole, userId, loading: shopLoading, refreshShop } = useActiveShop();

  // Password Protection Hook
  const {
    passwordVisible,
    setPasswordVisible,
    password,
    setPassword,
    verifying,
    requestPassword,
    handlePasswordSubmit,
    pendingAction
  } = useManagerAuth();

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

  const handleOpenShopInfo = async () => {
    if (!shopId) return;
    setInfoModalVisible(true);
    
    if (!shopDetails) {
      setLoadingDetails(true);
      try {
        const res = await fetch(`${API_BASE_URL}/shops/${shopId}`);
        if (res.ok) {
          const data = await res.json();
          setShopDetails(data);
        }
      } catch (e) {}
      setLoadingDetails(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1e40af" />
      
      {/* 1. Top Header Section */}
      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.brandTitle}>Stolar POS</Text>
            <TouchableOpacity onPress={handleOpenShopInfo} disabled={!isLinked}>
              <Text style={styles.statusSub}> • Shop: {shopName} <Ionicons name="information-circle-outline" size={14} color="#bfdbfe" /> <Ionicons name="checkmark-circle" size={12} color="#4ade80" /> </Text>
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
        
        <View style={styles.contentContainer}>
            
            {/* Quick Actions Card */}
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>Quick Actions</Text>

              <AnimatedCard style={[styles.actionRow, styles.primaryActionRow]} onPress={() => router.push('/(tabs)/scan')}>
                  <View style={[styles.iconBox, styles.primaryIconBox]}>
                    <MaterialCommunityIcons name="barcode-scan" size={24} color="white" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.actionTitle, { color: '#064e3b', fontSize: 16 }]}>Start Selling</Text>
                    <Text style={[styles.actionSub, { color: '#059669' }]}>Scan or Search Items</Text>
                  </View>
                  <View style={styles.primaryArrow}>
                     <Ionicons name="arrow-forward" size={18} color="white" />
                  </View>
              </AnimatedCard>

              {userRole === 'manager' && (
                <AnimatedCard style={styles.actionRow} onPress={() => router.replace('/(manager)')}>
                  <View style={[styles.iconBox, { backgroundColor: '#f1f5f9' }]}>
                    <Ionicons name="briefcase" size={20} color="#0f172a" />
                  </View>
                  <View>
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
                <View>
                  <Text style={styles.actionTitle}>Sales Summary</Text>
                  <Text style={styles.actionSub}>Daily & Weekly Stats</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#cbd5e1" style={{ marginLeft: 'auto' }} />
              </AnimatedCard>

              <AnimatedCard style={styles.actionRow} onPress={() => router.push('/(tabs)/last-sales')}>
                <View style={[styles.iconBox, { backgroundColor: '#fffbeb' }]}>
                  <Ionicons name="receipt" size={20} color="#f59e0b" />
                </View>
                <View>
                  <Text style={styles.actionTitle}>My Last 10 Sales</Text>
                  <Text style={styles.actionSub}>Receipts</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#cbd5e1" style={{ marginLeft: 'auto' }} />
              </AnimatedCard>

              {userRole === 'manager' && (
                <AnimatedCard style={styles.actionRow} onPress={() => router.push('/(tabs)/profit-report')}>
                  <View style={[styles.iconBox, { backgroundColor: '#dcfce7' }]}>
                    <Ionicons name="trending-up" size={20} color="#16a34a" />
                  </View>
                  <View>
                    <Text style={styles.actionTitle}>Profit Report</Text>
                    <Text style={styles.actionSub}>Margins & Revenue</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#cbd5e1" style={{ marginLeft: 'auto' }} />
                </AnimatedCard>
              )}
            </View>



            {/* Inventory Management Card */}
            <View style={[styles.card, !isLinked && { opacity: 0.6 }]}>
              <Text style={styles.sectionLabel}>Inventory Management</Text>
              <AnimatedCard 
                style={[styles.actionRow, !isLinked && { backgroundColor: '#f1f5f9' }]} 
                onPress={() => router.push('/(tabs)/add-stock')}
                disabled={!isLinked}
              >
                <View style={[styles.iconBox, { backgroundColor: isLinked ? '#dcfce7' : '#e2e8f0' }]}>
                   <Ionicons name="add-circle" size={24} color={isLinked ? "#16a34a" : "#94a3b8"} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.actionTitle, !isLinked && { color: '#64748b' }]}>Add Stock</Text>
                  <Text style={styles.actionSub}>{isLinked ? 'Adjust Inventory' : 'Link Shop Required'}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#cbd5e1" style={{ marginLeft: 'auto' }} />
              </AnimatedCard>
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
            
            {loadingDetails ? (
              <ActivityIndicator size="large" color="#1e40af" style={{ marginVertical: 20 }} />
            ) : shopDetails ? (
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
            ) : (
              <Text style={{ textAlign: 'center', color: '#64748b', marginVertical: 20 }}>Could not load details.</Text>
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
    zIndex: 10,
    elevation: 5,
  },
  headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brandTitle: { color: 'white', fontSize: 32, fontWeight: 'bold' },
  statusSub: { color: '#bfdbfe', fontSize: 14, marginTop: 4 },
  notificationBtn: { backgroundColor: 'rgba(255,255,255,0.2)', padding: 10, borderRadius: 12 },
  notificationBadge: { position: 'absolute', top: -5, right: -5, backgroundColor: '#ef4444', borderRadius: 10, width: 20, height: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#1e40af' },
  badgeText: { color: 'white', fontSize: 10, fontWeight: 'bold' },
  
  scrollContent: { paddingHorizontal: 20, marginTop: -40, paddingBottom: 120 },
  contentContainer: { width: '100%' },
  
  card: { backgroundColor: 'white', borderRadius: 24, padding: 20, marginBottom: 20, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8 },
  sectionLabel: { fontSize: 16, fontWeight: 'bold', color: '#1e293b', marginBottom: 15 },
  
  actionRow: { 
    flexDirection: 'row', alignItems: 'center', padding: 12, 
    backgroundColor: '#f8fafc', borderRadius: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#f1f5f9',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 2, elevation: 1
  },
  primaryActionRow: { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0', borderWidth: 1, paddingVertical: 16 },
  iconBox: { width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  primaryIconBox: { backgroundColor: '#10b981', shadowColor: '#10b981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4 },
  primaryArrow: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#10b981', justifyContent: 'center', alignItems: 'center' },
  
  actionTitle: { fontSize: 14, fontWeight: 'bold', color: '#1e293b' },
  actionSub: { fontSize: 12, color: '#64748b' },

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