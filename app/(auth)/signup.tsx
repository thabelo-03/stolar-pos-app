import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function Signup() {
  const [role, setRole] = useState('cashier');
  const router = useRouter();

  const handleSignup = () => {
    // Basic bypass: Just navigate to the app for now
    router.replace('/(tabs)');
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View style={styles.logoBox}>
          <Ionicons name="storefront" size={40} color="white" />
        </View>
        <Text style={styles.title}>Stolar POS</Text>
        <Text style={styles.subtitle}>Create Rural Staff Account</Text>
      </View>

      <View style={styles.form}>
        <TextInput placeholder="Full Name" style={styles.input} placeholderTextColor="#94a3b8" />
        <TextInput placeholder="Email Address" style={styles.input} keyboardType="email-address" autoCapitalize="none" />
        <TextInput placeholder="Password" style={styles.input} secureTextEntry />

        <Text style={styles.roleLabel}>Select Staff Role:</Text>
        <View style={styles.roleContainer}>
          {['admin', 'manager', 'cashier'].map((r) => (
            <TouchableOpacity 
              key={r} 
              onPress={() => setRole(r)}
              style={[styles.roleButton, role === r && styles.roleButtonActive]}
            >
              <Text style={[styles.roleText, role === r && styles.roleTextActive]}>{r.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.submitButton} onPress={handleSignup}>
          <Text style={styles.submitText}>Create Account</Text>
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
  input: { borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingVertical: 12, fontSize: 16, marginBottom: 20, color: '#1e293b' },
  roleLabel: { fontWeight: 'bold', color: '#1e3a8a', marginBottom: 10 },
  roleContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
  roleButton: { flex: 1, padding: 10, borderWidth: 1, borderColor: '#e2e8f0', marginHorizontal: 2, alignItems: 'center', borderRadius: 8 },
  roleButtonActive: { backgroundColor: '#1e40af', borderColor: '#1e40af' },
  roleText: { color: '#64748b', fontSize: 11, fontWeight: '700' },
  roleTextActive: { color: '#FFFFFF' },
  submitButton: { backgroundColor: '#1e40af', padding: 18, borderRadius: 12, alignItems: 'center' },
  submitText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  loginLink: { marginTop: 25, alignItems: 'center' },
  loginLinkText: { color: '#64748b', fontSize: 15 },
  loginLinkHighlight: { color: '#1e40af', fontWeight: 'bold' },
});