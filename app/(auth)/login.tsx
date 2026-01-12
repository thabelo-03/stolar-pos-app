import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = () => {
    // HARDCODED USER CHECK
    if (email === 'admin@stolar.com' && password === 'admin123') {
      router.replace({ pathname: '/(tabs)/home', params: { role: 'admin' } });
    } else if (email === 'manager@stolar.com' && password === 'manager123') {
      router.replace({ pathname: '/(tabs)/home', params: { role: 'manager' } });
    } else if (email === 'cashier@stolar.com' && password === 'cashier123') {
      router.replace({ pathname: '/(tabs)/home', params: { role: 'cashier' } });
    } else {
      Alert.alert("Login Failed", "Invalid email or password. Hint: admin@stolar.com / admin123");
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={24} color="#1e3a8a" />
      </TouchableOpacity>

      <View style={styles.welcomeSection}>
        <View style={styles.userIconCircle}>
          <Ionicons name="person" size={40} color="#1e40af" />
        </View>
        <Text style={styles.title}>Welcome Stolar</Text>
        <Text style={styles.subtitle}>Enter your credentials to continue</Text>
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

        <TouchableOpacity style={styles.submitButton} onPress={handleLogin}>
          <Text style={styles.submitText}>Login</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.signupLink} onPress={() => router.push('/(auth)/signup')}>
          <Text style={styles.signupLinkText}>
            Don't have an account? <Text style={styles.signupLinkHighlight}>Sign Up</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF', padding: 25 },
  backBtn: { marginTop: 50, marginBottom: 20 },
  welcomeSection: { alignItems: 'center', marginBottom: 40 },
  userIconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#1e3a8a', textAlign: 'center' },
  subtitle: { color: '#64748b', fontSize: 16, textAlign: 'center', marginTop: 5 },
  form: { width: '100%' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', marginBottom: 20 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, paddingVertical: 12, fontSize: 16, color: '#1e293b' },
  submitButton: { backgroundColor: '#1e40af', padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 20, elevation: 4 },
  submitText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  signupLink: { marginTop: 25, alignItems: 'center' },
  signupLinkText: { color: '#64748b', fontSize: 15 },
  signupLinkHighlight: { color: '#1e40af', fontWeight: 'bold' },
});