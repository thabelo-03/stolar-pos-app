import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
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
            router.replace('/(cashier)/link-shop');
          } else {
            // Established Staff: Go directly to the Sales POS
            await AsyncStorage.setItem('shopId', data.shopId);
            router.replace('/(tabs)/home');
          }
          return;
        }

        // CASE: MANAGER (Danger Dumani)
        if (data.role === 'manager') {
          // We always send the manager to the Dashboard (index.tsx)
          // The Dashboard will handle showing their shops or prompting registration
          router.replace('/(manager)');
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
  loginBtn: { backgroundColor: '#1e40af', padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 10, elevation: 2 },
  loginBtnText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  footerLink: { marginTop: 25, alignItems: 'center' },
  footerLinkText: { color: '#64748b', fontSize: 14 },
  linkHighlight: { color: '#1e40af', fontWeight: 'bold' },
});