import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_BASE_URL } from '../config';
import { useActiveShop } from '@/hooks/use-active-shop';
import { useNotifications } from '@/hooks/use-notifications';

const { width } = Dimensions.get('window');

// Animated action card component
const AnimatedCard = ({ onPress, children, style, disabled }: { onPress: () => void, children: React.ReactNode, style?: any, disabled?: boolean }) => {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (disabled) return;
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 25, bounciness: 6 }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 25, bounciness: 6 }).start();
  };

  return (
    <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut} disabled={disabled}>
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
};

// Live clock hook
const useClock = () => {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return time;
};

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
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
  const time = useClock();

  const { shopId, shopName: hookShopName, userRole: hookUserRole, userId, loading: shopLoading, refreshShop } = useActiveShop();

  const [passwordVisible, setPasswordVisible] = useState(false);
  const [password, setPassword] = useState('');
  const [verifying, setVerifying] = useState(false);
  const pendingAction = useRef<any>(null);

  // Entrance animations
  const headerAnim = useRef(new Animated.Value(0)).current;
  const cardsAnim = useRef(new Animated.Value(0)).current;
  const ctaAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.stagger(100, [
      Animated.spring(headerAnim, { toValue: 1, useNativeDriver: true, damping: 20 }),
      Animated.spring(cardsAnim, { toValue: 1, useNativeDriver: true, damping: 20 }),
      Animated.spring(ctaAnim, { toValue: 1, useNativeDriver: true, damping: 20 }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const requestPassword = (action: any) => console.log('Password requested for action:', action);
  const handlePasswordSubmit = async () => setPasswordVisible(false);

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
    Alert.alert("Logout", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", style: "destructive", onPress: () => router.replace('/(auth)/login') }
    ]);
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

  const formatTime = (d: Date) =>
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const formatDate = (d: Date) =>
    d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* HEADER */}
      <LinearGradient
        colors={['#0a0f1e', '#162444', '#1a2d55']}
        style={[styles.header, { paddingTop: insets.top + 16 }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Top row */}
        <Animated.View style={[styles.headerTop, {
          opacity: headerAnim,
          transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
        }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>{getGreeting()},</Text>
            <Text style={styles.cashierName} numberOfLines={1}>
              {cashierName || 'Cashier'} 👋
            </Text>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/(tabs)/profile-settings')}>
              <Ionicons name="settings-outline" size={22} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/notifications')}>
              <Ionicons name="notifications" size={22} color="rgba(255,255,255,0.8)" />
              {unreadCount > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.iconBtn, { marginLeft: 0 }]} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={22} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Clock & Shop */}
        <Animated.View style={[styles.clockRow, {
          opacity: headerAnim,
          transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }],
        }]}>
          <View style={styles.clockCard}>
            <Text style={styles.clockTime}>{formatTime(time)}</Text>
            <Text style={styles.clockDate}>{formatDate(time)}</Text>
          </View>

          <TouchableOpacity style={styles.shopBadge} onPress={handleOpenShopInfo} disabled={!isLinked}>
            <View style={[styles.shopStatusDot, { backgroundColor: isLinked ? '#10b981' : '#f59e0b' }]} />
            <View>
              <Text style={styles.shopBadgeLabel}>Active Shop</Text>
              <Text style={styles.shopBadgeName} numberOfLines={1}>{shopName}</Text>
            </View>
            {isLinked && <Ionicons name="information-circle-outline" size={16} color="rgba(255,255,255,0.5)" style={{ marginLeft: 6 }} />}
          </TouchableOpacity>
        </Animated.View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 120 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Big CTA */}
        <Animated.View style={{
          opacity: ctaAnim,
          transform: [{ translateY: ctaAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }],
          marginTop: -20,
        }}>
          <AnimatedCard
            style={styles.bigCta}
            onPress={() => router.push('/(tabs)/cart')}
          >
            <LinearGradient
              colors={['#065f46', '#059669', '#10b981']}
              style={styles.bigCtaGrad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.bigCtaLeft}>
                <Animated.View style={[styles.bigCtaIcon, { transform: [{ scale: pulseAnim }] }]}>
                  <MaterialCommunityIcons name="barcode-scan" size={32} color="white" />
                </Animated.View>
                <View>
                  <Text style={styles.bigCtaTitle}>Start Selling</Text>
                  <Text style={styles.bigCtaSub}>Scan or search items to begin</Text>
                </View>
              </View>
              <View style={styles.bigCtaArrow}>
                <Ionicons name="arrow-forward" size={22} color="white" />
              </View>
            </LinearGradient>
          </AnimatedCard>
        </Animated.View>

        {/* Quick Actions */}
        <Animated.View style={{
          opacity: cardsAnim,
          transform: [{ translateY: cardsAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
        }}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <AnimatedCard style={styles.gridCard} onPress={() => router.push('/(tabs)/daily-summary')}>
              <LinearGradient colors={['#1e3a8a', '#2563eb']} style={styles.gridCardGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <Ionicons name="bar-chart" size={28} color="white" />
                <Text style={styles.gridCardTitle}>Daily Summary</Text>
                <Text style={styles.gridCardSub}>Sales & Stats</Text>
              </LinearGradient>
            </AnimatedCard>

            <AnimatedCard style={styles.gridCard} onPress={() => router.push('/(tabs)/last-sales')}>
              <LinearGradient colors={['#78350f', '#d97706']} style={styles.gridCardGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <Ionicons name="receipt" size={28} color="white" />
                <Text style={styles.gridCardTitle}>Last Sales</Text>
                <Text style={styles.gridCardSub}>Recent receipts</Text>
              </LinearGradient>
            </AnimatedCard>

            <AnimatedCard
              style={[styles.gridCard, !isLinked && { opacity: 0.5 }]}
              onPress={() => router.push('/(tabs)/add-stock')}
              disabled={!isLinked}
            >
              <LinearGradient colors={['#064e3b', '#059669']} style={styles.gridCardGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <Ionicons name="add-circle" size={28} color="white" />
                <Text style={styles.gridCardTitle}>Add Stock</Text>
                <Text style={styles.gridCardSub}>{isLinked ? 'Adjust inventory' : 'Shop required'}</Text>
              </LinearGradient>
            </AnimatedCard>

            <AnimatedCard style={styles.gridCard} onPress={() => router.push('/(cashier)/my-shop')}>
              <LinearGradient colors={['#1e3799', '#4c6ef5']} style={styles.gridCardGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <Ionicons name="storefront" size={28} color="white" />
                <Text style={styles.gridCardTitle}>{isLinked ? 'My Shop' : 'Link Shop'}</Text>
                <Text style={styles.gridCardSub}>{isLinked ? 'View details' : 'Connect branch'}</Text>
                {hasPendingRequest && !isLinked && (
                  <View style={styles.pendingChip}>
                    <Text style={styles.pendingChipText}>Pending</Text>
                  </View>
                )}
              </LinearGradient>
            </AnimatedCard>
          </View>

          {/* Manager-only options */}
          {userRole === 'manager' && (
            <View style={{ marginTop: 4 }}>
              <Text style={styles.sectionTitle}>Manager Access</Text>
              <AnimatedCard style={styles.managerCard} onPress={() => router.replace('/(manager)')}>
                <View style={styles.managerCardContent}>
                  <View style={styles.managerIconWrap}>
                    <Ionicons name="briefcase" size={24} color="#a78bfa" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.managerCardTitle}>Manager Dashboard</Text>
                    <Text style={styles.managerCardSub}>Analytics, shops & staff management</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.4)" />
                </View>
              </AnimatedCard>

              <AnimatedCard style={styles.managerCard} onPress={() => router.push('/(tabs)/profit-report')}>
                <View style={styles.managerCardContent}>
                  <View style={[styles.managerIconWrap, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                    <Ionicons name="trending-up" size={24} color="#34d399" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.managerCardTitle}>Profit Report</Text>
                    <Text style={styles.managerCardSub}>Margins & revenue analysis</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.4)" />
                </View>
              </AnimatedCard>
            </View>
          )}

          {/* Change Calculator */}
          <AnimatedCard style={[styles.managerCard, { marginTop: 4 }]} onPress={() => router.push('/(cashier)/change-calculator')}>
            <View style={styles.managerCardContent}>
              <View style={[styles.managerIconWrap, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                <Ionicons name="calculator" size={24} color="#fbbf24" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.managerCardTitle}>Change Calculator</Text>
                <Text style={styles.managerCardSub}>Quick cash change helper</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.4)" />
            </View>
          </AnimatedCard>
        </Animated.View>
      </ScrollView>

      {/* Password Modal */}
      <Modal visible={passwordVisible} transparent animationType="fade" onRequestClose={() => setPasswordVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.passwordCard}>
            <Text style={styles.passwordTitle}>Manager Password</Text>
            <TextInput
              style={styles.passwordInput}
              secureTextEntry
              placeholder="Enter password"
              placeholderTextColor="#64748b"
              value={password}
              onChangeText={setPassword}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setPasswordVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={handlePasswordSubmit} disabled={verifying}>
                {verifying ? <ActivityIndicator color="white" size="small" /> : <Text style={styles.modalConfirmText}>Confirm</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Shop Info Modal */}
      <Modal visible={infoModalVisible} transparent animationType="fade" onRequestClose={() => setInfoModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.infoCard}>
            <View style={styles.infoCardHeader}>
              <Text style={styles.infoCardTitle}>Shop Information</Text>
              <TouchableOpacity onPress={() => setInfoModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            {loadingDetails ? (
              <ActivityIndicator size="large" color="#2563eb" style={{ marginVertical: 30 }} />
            ) : shopDetails ? (
              <View style={{ gap: 16 }}>
                {[
                  { icon: 'storefront', label: 'Shop Name', value: shopDetails.name },
                  { icon: 'location', label: 'Location', value: shopDetails.location },
                  { icon: 'qr-code', label: 'Branch Code', value: shopDetails.branchCode },
                  { icon: 'person', label: 'Manager', value: shopDetails.manager?.name || 'N/A' },
                  { icon: 'mail', label: 'Contact', value: shopDetails.manager?.email || 'N/A' },
                ].map((row, i) => (
                  <View key={i} style={styles.infoRow}>
                    <View style={styles.infoIconBox}>
                      <Ionicons name={row.icon as any} size={20} color="#2563eb" />
                    </View>
                    <View>
                      <Text style={styles.infoLabel}>{row.label}</Text>
                      <Text style={styles.infoValue}>{row.value}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={{ color: '#64748b', textAlign: 'center', marginVertical: 20 }}>Could not load details.</Text>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0f1e' },

  // Header
  header: { paddingHorizontal: 20, paddingBottom: 28 },
  headerTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20 },
  greeting: { fontSize: 13, color: 'rgba(255,255,255,0.55)', fontWeight: '500' },
  cashierName: { fontSize: 22, fontWeight: '800', color: 'white', maxWidth: 200 },
  headerActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  iconBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },
  notifBadge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: '#f43f5e', borderRadius: 10,
    width: 18, height: 18, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#0a0f1e',
  },
  notifBadgeText: { color: 'white', fontSize: 9, fontWeight: '800' },

  clockRow: { flexDirection: 'row', gap: 12 },
  clockCard: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14, padding: 14, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  clockTime: { fontSize: 26, fontWeight: '800', color: 'white', letterSpacing: -0.5 },
  clockDate: { fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 2 },

  shopBadge: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14, padding: 14, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  shopStatusDot: { width: 8, height: 8, borderRadius: 4 },
  shopBadgeLabel: { fontSize: 10, color: 'rgba(255,255,255,0.45)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  shopBadgeName: { fontSize: 14, fontWeight: '700', color: 'white', marginTop: 2 },

  // Content
  scroll: { paddingHorizontal: 16, paddingTop: 24 },

  // Big CTA
  bigCta: { marginBottom: 24, borderRadius: 20, overflow: 'hidden' },
  bigCtaGrad: {
    flexDirection: 'row', alignItems: 'center',
    padding: 20, justifyContent: 'space-between',
    shadowColor: '#10b981', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 10,
  },
  bigCtaLeft: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  bigCtaIcon: {
    width: 60, height: 60, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  bigCtaTitle: { fontSize: 20, fontWeight: '800', color: 'white' },
  bigCtaSub: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  bigCtaArrow: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },

  // Grid
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#f1f5f9', marginBottom: 12, marginTop: 8 },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  gridCard: {
    width: (width - 44) / 2,
    borderRadius: 18, overflow: 'hidden',
  },
  gridCardGrad: { padding: 18, minHeight: 120, justifyContent: 'flex-end' },
  gridCardTitle: { fontSize: 15, fontWeight: '800', color: 'white', marginTop: 10 },
  gridCardSub: { fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  pendingChip: {
    position: 'absolute', top: 10, right: 10,
    backgroundColor: '#f59e0b', paddingHorizontal: 8,
    paddingVertical: 3, borderRadius: 8,
  },
  pendingChipText: { fontSize: 9, color: 'white', fontWeight: '800' },

  // Manager cards
  managerCard: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, marginBottom: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  managerCardContent: {
    flexDirection: 'row', alignItems: 'center',
    padding: 16, gap: 14,
  },
  managerIconWrap: {
    width: 46, height: 46, borderRadius: 14,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  managerCardTitle: { fontSize: 15, fontWeight: '700', color: '#f1f5f9' },
  managerCardSub: { fontSize: 12, color: '#94a3b8', marginTop: 2 },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  passwordCard: {
    backgroundColor: '#111827', borderRadius: 24, padding: 24,
    width: '100%', maxWidth: 340,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  passwordTitle: { fontSize: 18, fontWeight: '800', color: 'white', textAlign: 'center', marginBottom: 20 },
  passwordInput: {
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
    padding: 14, fontSize: 16, color: 'white', textAlign: 'center',
    marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  modalButtons: { flexDirection: 'row', gap: 10 },
  modalCancelBtn: { flex: 1, padding: 14, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, alignItems: 'center' },
  modalCancelText: { color: '#94a3b8', fontWeight: '700' },
  modalConfirmBtn: { flex: 1, padding: 14, backgroundColor: '#2563eb', borderRadius: 12, alignItems: 'center' },
  modalConfirmText: { color: 'white', fontWeight: '700' },

  infoCard: {
    backgroundColor: '#111827', borderRadius: 24, padding: 24,
    width: '100%', maxWidth: 380,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3, shadowRadius: 20, elevation: 15,
  },
  infoCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  infoCardTitle: { fontSize: 18, fontWeight: '800', color: '#f1f5f9' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  infoIconBox: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: 'rgba(37,99,235,0.15)', justifyContent: 'center', alignItems: 'center',
  },
  infoLabel: { fontSize: 11, color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { fontSize: 15, fontWeight: '700', color: '#f1f5f9', marginTop: 2 },
});