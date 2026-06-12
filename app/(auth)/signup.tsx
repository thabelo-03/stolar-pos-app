import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform, // Added to detect Chrome vs Android
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image
} from 'react-native';
import { API_BASE_URL } from '../config';

export default function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState('cashier');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const validateEmail = (text: string) => {
    const reg = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    return reg.test(text);
  };

  const registerUser = async () => {
    console.log("🚀 Starting API Call...");
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: name.trim(), 
          email: email.trim().toLowerCase(), 
          password, 
          role 
        }),
      });

      const data = await response.json();

      if (response.ok) {
        if (Platform.OS === 'web') alert("Success: Account created!");
        else Alert.alert("Success", "Account created! Please login.");
        router.push('/(auth)/login');
      } else {
        const errorMsg = data.message || "Something went wrong";
        if (Platform.OS === 'web') alert(errorMsg);
        else Alert.alert("Signup Failed", errorMsg);
      }
    } catch (error) {
      console.error("❌ Network Error:", error);
      const netError = "Could not connect to server. Check your connection.";
      if (Platform.OS === 'web') alert(netError);
      else Alert.alert("Network Error", netError);
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = () => {
    console.log("🔘 Signup button pressed");

    // 1. Validation
    if (!name || !email || !password) {
      console.log("⚠️ Validation failed: Missing fields");
      if (Platform.OS === 'web') alert("Please fill in all fields");
      else Alert.alert("Error", "Please fill in all fields");
      return;
    }

    if (!validateEmail(email)) {
      console.log("⚠️ Validation failed: Invalid email");
      if (Platform.OS === 'web') alert("Please enter a valid email address.");
      else Alert.alert("Invalid Email", "Please enter a valid email address.");
      return;
    }

    const confirmMessage = `Create ${role.toUpperCase()} account for ${name}?`;

    // 2. Hybrid Confirmation Logic
    if (Platform.OS === 'web') {
      // Logic for Chrome Browser
      const confirmed = window.confirm(confirmMessage);
      if (confirmed) {
        console.log("✅ Web User confirmed.");
        registerUser();
      }
    } else {
      // Logic for Android / Expo Go
      console.log("🛡️ Opening native confirmation modal");
      Alert.alert(
        "Confirm Registration",
        confirmMessage,
        [
          { text: "Edit Details", style: "cancel" },
          { text: "Confirm & Create", onPress: () => registerUser() },
        ]
      );
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View style={styles.logoBox}>
          <Image source={require('../../assets/images/stolar-logo.jpeg')} style={{ width: 50, height: 50, resizeMode: 'contain' }} />
        </View>
        <Text style={styles.title}>Stolar POS</Text>
        <Text style={styles.subtitle}>Create Rural Staff Account</Text>
      </View>

      <View style={styles.form}>
        <TextInput 
          placeholder="Full Name" 
          style={styles.input} 
          placeholderTextColor="#94a3b8" 
          value={name}
          onChangeText={setName}
        />
        <TextInput 
          placeholder="Email Address" 
          style={styles.input} 
          keyboardType="email-address" 
          autoCapitalize="none" 
          placeholderTextColor="#94a3b8"
          value={email}
          onChangeText={setEmail}
        />
        <View style={styles.passwordContainer}>
          <TextInput 
            placeholder="Password" 
            style={[styles.input, styles.passwordInput]} 
            placeholderTextColor="#94a3b8"
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() => setShowPassword(prev => !prev)}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={22}
              color="#64748b"
            />
          </TouchableOpacity>
        </View>

        <Text style={styles.roleLabel}>Select Staff Role:</Text>
        <View style={styles.roleContainer}>
          {['manager', 'cashier'].map((r) => (
            <TouchableOpacity 
              key={r} 
              onPress={() => setRole(r)}
              style={[styles.roleButton, role === r && styles.roleButtonActive]}
            >
              <Text style={[styles.roleText, role === r && styles.roleTextActive]}>
                {r.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity 
          style={styles.submitButton} 
          onPress={handleSignup}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.submitText}>Create Account</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.loginLink} onPress={() => router.push('/(auth)/login')}>
          <Text style={styles.loginLinkText}>
            Already have an account? <Text style={styles.loginLinkHighlight}>Login</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#FFFFFF', padding: 25, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 30 },
  logoBox: { backgroundColor: '#1e40af', padding: 15, borderRadius: 20, marginBottom: 15 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#1e3a8a' },
  subtitle: { color: '#64748b', fontSize: 16 },
  form: { width: '100%' },
  input: { borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingVertical: 12, fontSize: 16, color: '#1e293b' },
  passwordContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  passwordInput: { flex: 1, borderBottomWidth: 0, marginBottom: 0, ...(Platform.OS === 'web' ? ({ WebkitAppearance: 'none' } as any) : {}) },
  eyeButton: { padding: 8 },
  roleLabel: { fontWeight: 'bold', color: '#1e3a8a', marginBottom: 10 },
  roleContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
  roleButton: { flex: 1, padding: 10, borderWidth: 1, borderColor: '#e2e8f0', marginHorizontal: 2, alignItems: 'center', borderRadius: 8 },
  roleButtonActive: { backgroundColor: '#1e40af', borderColor: '#1e40af' },
  roleText: { color: '#64748b', fontSize: 11, fontWeight: '700' },
  roleTextActive: { color: '#FFFFFF' },
  submitButton: { backgroundColor: '#1e40af', padding: 18, borderRadius: 12, alignItems: 'center', height: 60, justifyContent: 'center' },
  submitText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  loginLink: { marginTop: 25, alignItems: 'center' },
  loginLinkText: { color: '#64748b', fontSize: 15 },
  loginLinkHighlight: { color: '#1e40af', fontWeight: 'bold' },
});