import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_BASE_URL } from '../config';

export default function Login() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [workspaceModalVisible, setWorkspaceModalVisible] = useState(false);
  const [managerData, setManagerData] = useState<any>(null);
  const [shops, setShops] = useState<any[]>([]);
  const [shopSelectionVisible, setShopSelectionVisible] = useState(false);
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);

  // Animations
  const logoAnim = useRef(new Animated.Value(0)).current;
  const formAnim = useRef(new Animated.Value(0)).current;
  const scaleValue = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const particle1 = useRef(new Animated.Value(0)).current;
  const particle2 = useRef(new Animated.Value(0)).current;
  const particle3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entrance animations
    Animated.stagger(150, [
      Animated.spring(logoAnim, { toValue: 1, useNativeDriver: true, damping: 18, stiffness: 100 }),
      Animated.spring(formAnim, { toValue: 1, useNativeDriver: true, damping: 18, stiffness: 100 }),
    ]).start();

    // Pulse animation for logo ring
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 2000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
      ])
    ).start();

    // Floating particles
    const animateParticle = (anim: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 1, duration: 4000 + delay, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 4000 + delay, useNativeDriver: true }),
        ])
      ).start();
    };
    animateParticle(particle1, 0);
    animateParticle(particle2, 800);
    animateParticle(particle3, 1600);
  }, []);

  useEffect(() => {
    if (workspaceModalVisible) {
      scaleValue.setValue(0);
      Animated.spring(scaleValue, {
        toValue: 1,
        useNativeDriver: true,
        damping: 15,
        stiffness: 150,
      }).start();
    }
  }, [workspaceModalVisible]);

  useEffect(() => {
    const showSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setIsKeyboardActive(true)
    );
    const hideSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setIsKeyboardActive(false)
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter both email and password");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        await AsyncStorage.setItem('userToken', 'logged-in');
        await AsyncStorage.setItem('userId', data.id);
        await AsyncStorage.setItem('userRole', data.role);
        await AsyncStorage.setItem('userName', data.name);

        if (data.role === 'admin') {
          router.replace('/(admin)/admin-dashboard');
          return;
        }

        if (data.role === 'cashier') {
          if (!data.shopId) {
            router.replace('/(cashier)/my-shop');
          } else {
            await AsyncStorage.setItem('shopId', data.shopId);
            router.replace('/(tabs)');
          }
          return;
        }

        if (data.role === 'manager') {
          setManagerData(data);
          setWorkspaceModalVisible(true);
          return;
        }

      } else {
        Alert.alert("Login Failed", data.message || "Invalid credentials");
      }
    } catch (error) {
      Alert.alert("Network Error", "Could not connect to server.");
    } finally {
      setLoading(false);
    }
  };

  const handleWorkspaceSelection = async (type: 'manager' | 'cashier') => {
    if (type === 'manager') {
      setWorkspaceModalVisible(false);
      router.replace('/(manager)');
    } else {
      try {
        const userId = await AsyncStorage.getItem('userId');
        const response = await fetch(`${API_BASE_URL}/shops?managerId=${userId}`);
        const shopsData = await response.json();

        setWorkspaceModalVisible(false);

        if (Array.isArray(shopsData) && shopsData.length > 0) {
          setShops(shopsData);
          setTimeout(() => setShopSelectionVisible(true), 300);
        } else {
          router.replace('/(manager)');
        }
      } catch (e) {
        setWorkspaceModalVisible(false);
        Alert.alert("Error", "Failed to load shops.");
      }
    }
  };

  const handleSelectShopForPOS = async (shop: any) => {
    await AsyncStorage.setItem('shopId', shop._id);
    setShopSelectionVisible(false);
    router.replace('/(tabs)');
  };

  const particleStyle = (anim: Animated.Value, x: number, y: number) => ({
    position: 'absolute' as const,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(6,182,212,0.5)',
    left: x,
    top: y,
    transform: [
      {
        translateY: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -30],
        }),
      },
    ],
    opacity: anim.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [0, 0.8, 0],
    }),
  });

  return (
    <LinearGradient
      colors={['#060d1f', '#0f172a', '#1a2744']}
      style={styles.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      {/* Floating Particles */}
      <Animated.View style={particleStyle(particle1, 60, 200)} />
      <Animated.View style={[particleStyle(particle2, 200, 350), { backgroundColor: 'rgba(37,99,235,0.5)', width: 8, height: 8, borderRadius: 4 }]} />
      <Animated.View style={[particleStyle(particle3, 310, 150), { backgroundColor: 'rgba(16,185,129,0.5)', width: 5, height: 5 }]} />

      {/* Glowing orbs */}
      <View style={styles.orbBlue} />
      <View style={styles.orbCyan} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: isKeyboardActive ? insets.top : insets.top + 20 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo Section */}
          <Animated.View
            style={[
              styles.logoSection,
              isKeyboardActive && styles.logoSectionKeyboardActive,
              {
                opacity: logoAnim,
                transform: [
                  { translateY: logoAnim.interpolate({ inputRange: [0, 1], outputRange: [-30, 0] }) },
                ],
              },
            ]}
          >
            {!isKeyboardActive && (
              <Animated.View style={[styles.logoRing, { transform: [{ scale: pulseAnim }] }]}>
                <View style={styles.logoInner}>
                  <Image
                    source={require('../../assets/images/stolar-logo.jpeg')}
                    style={styles.logoImage}
                  />
                </View>
              </Animated.View>
            )}
            <Text style={[styles.brandName, isKeyboardActive && styles.brandNameKeyboardActive]}>STOLAR POS</Text>
            {!isKeyboardActive && (
              <>
                <Text style={styles.brandTagline}>Management & Retail System</Text>

                {/* Status dots */}
                <View style={styles.statusRow}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusText}>Secure Connection</Text>
                </View>
              </>
            )}
          </Animated.View>

          {/* Form Card */}
          <Animated.View
            style={[
              styles.formCard,
              {
                opacity: formAnim,
                transform: [
                  { translateY: formAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) },
                ],
              },
            ]}
          >
            <Text style={styles.formTitle}>Welcome Back</Text>
            <Text style={styles.formSubtitle}>Sign in to continue</Text>

            {/* Email Field */}
            <View collapsable={false} style={[styles.inputWrapper, emailFocused && styles.inputWrapperFocused]}>
              <Ionicons name="mail-outline" size={20} color={emailFocused ? '#06b6d4' : '#475569'} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email Address"
                placeholderTextColor="#475569"
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
              />
            </View>

            {/* Password Field */}
            <View collapsable={false} style={[styles.inputWrapper, passwordFocused && styles.inputWrapperFocused]}>
              <Ionicons name="lock-closed-outline" size={20} color={passwordFocused ? '#06b6d4' : '#475569'} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { paddingRight: 8 }]}
                placeholder="Password"
                placeholderTextColor="#475569"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={passwordFocused ? '#06b6d4' : '#475569'} />
              </TouchableOpacity>
            </View>

            {/* Forgot Password */}
            <TouchableOpacity
              style={styles.forgotRow}
              onPress={() => router.push('/(auth)/forgot-password')}
            >
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>

            {/* Login Button */}
            <TouchableOpacity
              style={[styles.loginBtn, loading && { opacity: 0.7 }]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#2563eb', '#1d4ed8']}
                style={styles.loginBtnGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <>
                    <Text style={styles.loginBtnText}>Enter System</Text>
                    <Ionicons name="arrow-forward" size={20} color="white" style={{ marginLeft: 8 }} />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Sign Up Link */}
            <TouchableOpacity style={styles.signupRow} onPress={() => router.push('/(auth)/signup')}>
              <Text style={styles.signupText}>
                {"Don't have an account? "}
                <Text style={styles.signupLink}>Create Account</Text>
              </Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Footer */}
          <Text style={styles.footer}>Powered by Stolar Technologies</Text>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Workspace Selection Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={workspaceModalVisible}
        onRequestClose={() => setWorkspaceModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.modalCard, { transform: [{ scale: scaleValue }] }]}>
            <View style={styles.modalTopBar} />
            <Text style={styles.modalTitle}>Select Workspace</Text>
            <Text style={styles.modalSubtitle}>Where would you like to start today?</Text>

            <TouchableOpacity
              style={styles.workspaceBtn}
              onPress={() => handleWorkspaceSelection('manager')}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#1e3a8a', '#2563eb']}
                style={styles.workspaceBtnGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.workspaceIconWrap}>
                  <Ionicons name="stats-chart" size={28} color="white" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.workspaceBtnTitle}>Manager Dashboard</Text>
                  <Text style={styles.workspaceBtnSub}>Analytics, Inventory & Staff</Text>
                </View>
                <Ionicons name="chevron-forward" size={22} color="rgba(255,255,255,0.6)" />
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.workspaceBtn}
              onPress={() => handleWorkspaceSelection('cashier')}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#064e3b', '#059669']}
                style={styles.workspaceBtnGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.workspaceIconWrap}>
                  <Ionicons name="cart" size={28} color="white" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.workspaceBtnTitle}>Cashier POS</Text>
                  <Text style={styles.workspaceBtnSub}>Sales, Checkout & Daily Tasks</Text>
                </View>
                <Ionicons name="chevron-forward" size={22} color="rgba(255,255,255,0.6)" />
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setWorkspaceModalVisible(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>

      {/* Shop Selection Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={shopSelectionVisible}
        onRequestClose={() => setShopSelectionVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { paddingBottom: 20 }]}>
            <View style={styles.modalTopBar} />
            <Text style={styles.modalTitle}>Select Shop</Text>
            <Text style={styles.modalSubtitle}>Choose a shop for your POS session</Text>

            <FlatList
              data={shops}
              keyExtractor={(item) => item._id}
              style={{ maxHeight: 300, width: '100%' }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.shopItem}
                  onPress={() => handleSelectShopForPOS(item)}
                  activeOpacity={0.8}
                >
                  <View style={styles.shopItemIcon}>
                    <Ionicons name="storefront" size={22} color="#2563eb" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.shopItemName}>{item.name}</Text>
                    <Text style={styles.shopItemLoc}>{item.location}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
                </TouchableOpacity>
              )}
            />

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShopSelectionVisible(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  keyboardView: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40, alignItems: 'center' },

  // Glowing background orbs
  orbBlue: {
    position: 'absolute', top: -80, right: -80,
    width: 280, height: 280, borderRadius: 140,
    backgroundColor: 'rgba(37,99,235,0.12)',
  },
  orbCyan: {
    position: 'absolute', bottom: 100, left: -60,
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: 'rgba(6,182,212,0.08)',
  },

  // Logo
  logoSection: { alignItems: 'center', marginBottom: 32 },
  logoRing: {
    width: 140, height: 140, borderRadius: 70,
    borderWidth: 2, borderColor: 'rgba(6,182,212,0.4)',
    padding: 8, marginBottom: 20,
    shadowColor: '#06b6d4', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5, shadowRadius: 20,
  },
  logoInner: {
    flex: 1, borderRadius: 62,
    overflow: 'hidden', backgroundColor: 'white',
  },
  logoImage: { width: '100%', height: '100%', borderRadius: 62 },
  brandName: {
    fontSize: 28, fontWeight: '900', color: '#f1f5f9',
    letterSpacing: 4, marginBottom: 6,
  },
  brandTagline: { fontSize: 13, color: '#64748b', letterSpacing: 0.5 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981' },
  statusText: { fontSize: 12, color: '#10b981', fontWeight: '600' },

  // Form Card
  formCard: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    padding: 24,
    marginBottom: 24,
  },
  formTitle: { fontSize: 22, fontWeight: '800', color: '#f1f5f9', marginBottom: 4 },
  formSubtitle: { fontSize: 14, color: '#64748b', marginBottom: 28 },

  // Inputs
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
    paddingHorizontal: 16, height: 54, marginBottom: 14,
  },
  inputWrapperFocused: {
    borderColor: '#06b6d4',
    backgroundColor: 'rgba(6,182,212,0.06)',
    shadowColor: '#06b6d4', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  inputIcon: { marginRight: 12, width: 20 },
  input: { flex: 1, fontSize: 15, color: '#f1f5f9' },
  eyeBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },

  forgotRow: { alignSelf: 'flex-end', marginBottom: 20 },
  forgotText: { fontSize: 13, color: '#06b6d4', fontWeight: '600' },

  // Login Button
  loginBtn: { borderRadius: 14, marginBottom: 20, overflow: 'hidden' },
  loginBtnGradient: {
    flexDirection: 'row', height: 54,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#2563eb', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5, shadowRadius: 12,
  },
  loginBtnText: { color: 'white', fontSize: 17, fontWeight: '800' },

  signupRow: { alignItems: 'center' },
  signupText: { color: '#64748b', fontSize: 14 },
  signupLink: { color: '#06b6d4', fontWeight: '700' },

  footer: { color: '#334155', fontSize: 12, marginTop: 10 },

  // Modals
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center', alignItems: 'center', padding: 20,
  },
  modalCard: {
    backgroundColor: '#111827', borderRadius: 28,
    padding: 24, width: '100%', maxWidth: 380,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
  },
  modalTopBar: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)', marginBottom: 20,
  },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#f1f5f9', marginBottom: 6 },
  modalSubtitle: { fontSize: 14, color: '#64748b', marginBottom: 24, textAlign: 'center' },

  workspaceBtn: { width: '100%', borderRadius: 16, marginBottom: 12, overflow: 'hidden' },
  workspaceBtnGrad: {
    flexDirection: 'row', alignItems: 'center',
    padding: 18, gap: 14,
  },
  workspaceIconWrap: {
    width: 52, height: 52, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  workspaceBtnTitle: { fontSize: 16, fontWeight: '700', color: 'white', marginBottom: 4 },
  workspaceBtnSub: { fontSize: 12, color: 'rgba(255,255,255,0.65)' },

  cancelBtn: {
    marginTop: 10, width: '100%', padding: 14,
    borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  cancelBtnText: { color: '#94a3b8', fontWeight: '600', fontSize: 14 },

  // Shop items
  shopItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', width: '100%',
  },
  shopItemIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: 'rgba(37,99,235,0.15)',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  shopItemName: { fontSize: 15, fontWeight: '700', color: '#f1f5f9' },
  shopItemLoc: { fontSize: 12, color: '#64748b', marginTop: 2 },
  logoSectionKeyboardActive: {
    marginBottom: 8,
  },
  brandNameKeyboardActive: {
    fontSize: 20,
    letterSpacing: 2,
    marginBottom: 2,
  },
});