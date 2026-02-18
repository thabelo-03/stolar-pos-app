import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { API_BASE_URL } from '../config';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [workspaceModalVisible, setWorkspaceModalVisible] = useState(false);
  const [managerData, setManagerData] = useState<any>(null);
  const scaleValue = useRef(new Animated.Value(0)).current;

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
        // --- 1. PERSIST SESSION DATA ---
        await AsyncStorage.setItem('userId', data.id);
        await AsyncStorage.setItem('userRole', data.role);
        await AsyncStorage.setItem('userName', data.name);

        // --- 2. MULTI-ROLE REDIRECTION LOGIC ---

        // CASE: ADMIN
        if (data.role === 'admin') {
          router.replace('/(admin)/admin-dashboard');
          return;
        }

        // CASE: CASHIER (The Staff-to-Shop Link)
        if (data.role === 'cashier') {
          if (!data.shopId) {
            // New Staff member: Needs to enter the Manager's Branch Code
            router.replace('/(cashier)/my-shop');
          } else {
            // Established Staff: Go directly to the Sales POS
            await AsyncStorage.setItem('shopId', data.shopId);
            router.replace('/(tabs)/home');
          }
          return;
        }

        // CASE: MANAGER (Danger Dumani)
        if (data.role === 'manager') {
          setManagerData(data);
          setWorkspaceModalVisible(true);
          return;
        }

      } else {
        Alert.alert("Login Failed", data.message || "Invalid credentials");
      }
    } catch (error) {
      Alert.alert("Network Error", "Check server connection at 192.168.54.12:5000");
    } finally {
      setLoading(false);
    }
  };

  const handleWorkspaceSelection = async (type: 'manager' | 'cashier') => {
    setWorkspaceModalVisible(false);
    if (type === 'manager') {
      router.replace('/(manager)');
    } else {
      if (managerData?.shopId) {
        await AsyncStorage.setItem('shopId', managerData.shopId);
        router.replace('/(tabs)/home');
      } else {
        router.replace('/(cashier)/my-shop');
      }
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={styles.container}
    >
      <View style={styles.headerSection}>
        <View style={styles.iconCircle}>
          <Ionicons name="business" size={40} color="#1e40af" />
        </View>
        <Text style={styles.title}>Stolar POS</Text>
        <Text style={styles.subtitle}>Management & Retail System</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <Ionicons name="mail-outline" size={20} color="#64748b" style={styles.inputIcon} />
          <TextInput 
            placeholder="Email Address" 
            style={styles.input} 
            autoCapitalize="none" 
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
          />
        </View>

        <View style={styles.inputGroup}>
          <Ionicons name="lock-closed-outline" size={20} color="#64748b" style={styles.inputIcon} />
          <TextInput 
            placeholder="Password" 
            style={styles.input} 
            secureTextEntry 
            value={password}
            onChangeText={setPassword}
          />
        </View>

        <TouchableOpacity 
          style={styles.forgotPassword} 
          onPress={() => router.push('/(auth)/forgot-password')}
        >
          <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.loginBtn} 
          onPress={handleLogin} 
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.loginBtnText}>Enter System</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.footerLink} 
          onPress={() => router.push('/(auth)/signup')}
        >
          <Text style={styles.footerLinkText}>
            Don&apos;t have an account? <Text style={styles.linkHighlight}>Sign Up</Text>
          </Text>
        </TouchableOpacity>
      </View>

      {/* Workspace Selection Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={workspaceModalVisible}
        onRequestClose={() => setWorkspaceModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.modalContent, { transform: [{ scale: scaleValue }] }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Workspace</Text>
              <Text style={styles.modalSubtitle}>Where would you like to start today?</Text>
            </View>

            <TouchableOpacity 
              style={styles.workspaceButton} 
              onPress={() => handleWorkspaceSelection('manager')}
            >
              <View style={[styles.iconBox, { backgroundColor: '#eff6ff' }]}>
                <Ionicons name="stats-chart" size={24} color="#1e40af" />
              </View>
              <View style={styles.workspaceTextContainer}>
                <Text style={styles.workspaceTitle}>Manager Dashboard</Text>
                <Text style={styles.workspaceDesc}>Analytics, Inventory & Staff</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.workspaceButton} 
              onPress={() => handleWorkspaceSelection('cashier')}
            >
              <View style={[styles.iconBox, { backgroundColor: '#f0fdf4' }]}>
                <Ionicons name="cart" size={24} color="#16a34a" />
              </View>
              <View style={styles.workspaceTextContainer}>
                <Text style={styles.workspaceTitle}>Cashier POS</Text>
                <Text style={styles.workspaceDesc}>Sales, Checkout & Daily Tasks</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF', padding: 30, justifyContent: 'center' },
  headerSection: { alignItems: 'center', marginBottom: 50 },
  iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#1e3a8a' },
  subtitle: { color: '#64748b', fontSize: 16 },
  form: { width: '100%' },
  inputGroup: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 12, paddingHorizontal: 15, marginBottom: 15, borderWidth: 1, borderColor: '#e2e8f0' },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, paddingVertical: 15, fontSize: 16, color: '#1e293b' },
  forgotPassword: { alignSelf: 'flex-end', marginBottom: 15 },
  forgotPasswordText: { color: '#1e40af', fontWeight: '600', fontSize: 14 },
  loginBtn: { backgroundColor: '#1e40af', padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 10, elevation: 2 },
  loginBtnText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  footerLink: { marginTop: 25, alignItems: 'center' },
  footerLinkText: { color: '#64748b', fontSize: 14 },
  linkHighlight: { color: '#1e40af', fontWeight: 'bold' },

  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: 'white', borderRadius: 24, padding: 24, width: '100%', maxWidth: 360, shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 10 },
  modalHeader: { alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 22, fontWeight: 'bold', color: '#1e293b', marginBottom: 8 },
  modalSubtitle: { fontSize: 14, color: '#64748b', textAlign: 'center' },
  workspaceButton: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: 'white', borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  iconBox: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  workspaceTextContainer: { flex: 1 },
  workspaceTitle: { fontSize: 16, fontWeight: 'bold', color: '#1e293b', marginBottom: 4 },
  workspaceDesc: { fontSize: 12, color: '#64748b' },
});