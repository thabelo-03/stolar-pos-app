  import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { API_BASE_URL } from '../(tabs)/api';

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
            // const response = await fetch(`${API_BASE_URL}/auth/signup`, {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok && data.success) {
          // --- MULTI-ROLE REDIRECTION LOGIC ---
          
          if (data.role === 'admin') {
            // 1. Admin lands on the Master Console
            router.replace('/(admin)/admin-dashboard');
            
          } else if (data.role === 'manager') {
            // 2. Manager lands on Shop Management/Establishment
            // This allows Danger Dumani to set up the branch first
            router.replace('/(manager)/register-shop');
            
          } else {
            // 3. Cashiers go to the standard POS Sales screen
            router.replace({ 
              pathname: '/(tabs)/home', 
              params: { role: data.role, name: data.name } 
            });
          }
        } else {
          Alert.alert("Login Failed", data.message || "Invalid credentials");
        }
      } catch (error) {
        Alert.alert("Network Error", "Check server connection (192.168.54.12)");
      } finally {
        setLoading(false);
      }
    };
    
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        <View style={styles.welcomeSection}>
          <View style={styles.userIconCircle}>
            <Ionicons name="shield-checkmark" size={40} color="#1e40af" />
          </View>
          <Text style={styles.title}>Stolar POS</Text>
          <Text style={styles.subtitle}>Secure System Access</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color="#64748b" style={styles.inputIcon} />
            <TextInput 
              placeholder="Email" 
              style={styles.input} 
              autoCapitalize="none" 
              placeholderTextColor="#94a3b8"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#64748b" style={styles.inputIcon} />
            <TextInput 
              placeholder="Password" 
              style={styles.input} 
              secureTextEntry 
              placeholderTextColor="#94a3b8"
              value={password}
              onChangeText={setPassword}
            />
          </View>

          <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')} style={styles.forgotPassword}>
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.submitButton} 
            onPress={handleLogin} 
            disabled={loading}
          >
            <Text style={styles.submitText}>Login to System</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.signupLink} onPress={() => router.push('/(auth)/signup')}>
            <Text style={styles.signupLinkText}>Need access? <Text style={styles.signupLinkHighlight}>Register Staff</Text></Text>
          </TouchableOpacity>
        </View>

        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={styles.loadingText}>Authenticating...</Text>
          </View>
        )}
      </KeyboardAvoidingView>
    );
  }

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF', padding: 25, justifyContent: 'center' },
    welcomeSection: { alignItems: 'center', marginBottom: 40 },
    userIconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
    title: { fontSize: 32, fontWeight: 'bold', color: '#1e3a8a' },
    subtitle: { color: '#64748b', fontSize: 16 },
    form: { width: '100%' },
    inputContainer: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', marginBottom: 25 },
    inputIcon: { marginRight: 10 },
    input: { flex: 1, paddingVertical: 12, fontSize: 16, color: '#1e293b' },
    submitButton: { backgroundColor: '#1e40af', padding: 18, borderRadius: 12, alignItems: 'center', elevation: 4 },
    submitText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
    signupLink: { marginTop: 25, alignItems: 'center' },
    signupLinkText: { color: '#64748b', fontSize: 15 },
    signupLinkHighlight: { color: '#1e40af', fontWeight: 'bold' },
    forgotPassword: { alignSelf: 'flex-end', marginBottom: 20 },
    forgotPasswordText: { color: '#1e40af', fontWeight: '600' },
    loadingOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.7)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
    },
    loadingText: {
      marginTop: 10,
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
  });