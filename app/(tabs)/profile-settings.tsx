import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, TextInput, TouchableOpacity, View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '../../components/themed-text';
import { ThemedView } from '../../components/themed-view';
import { API_BASE_URL } from '../config';
import { Colors } from '../../constants/theme';

export default function ProfileSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('biometricEnabled').then((value) => {
      setBiometricEnabled(value === 'true');
    });
    AsyncStorage.getItem('userRole').then(setUserRole);
  }, []);

  const toggleBiometric = async (value: boolean) => {
    setBiometricEnabled(value);
    await AsyncStorage.setItem('biometricEnabled', value.toString());
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert('Success', 'Password changed successfully');
        router.back();
      } else {
        Alert.alert('Error', data.message || 'Failed to change password');
      }
    } catch (error) {
      Alert.alert('Error', 'Could not connect to server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <LinearGradient colors={['#0a0f1e', '#162444']} style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#f1f5f9" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile Settings</Text>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {userRole === 'manager' && (
          <TouchableOpacity 
            style={styles.switchDashboardButton} 
            onPress={() => router.replace('/(manager)')}
          >
            <LinearGradient 
              colors={['#8b5cf6', '#4f46e5']} 
              start={{ x: 0, y: 0 }} 
              end={{ x: 1, y: 0 }} 
              style={styles.gradientButton}
            >
              <Text style={styles.switchDashboardText}>Switch to Manager Workspace</Text>
              <Ionicons name="swap-horizontal" size={20} color="white" />
            </LinearGradient>
          </TouchableOpacity>
        )}

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Security Settings</Text>
          
          <View style={styles.switchRow}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={styles.label}>Biometric Approval</Text>
              <Text style={styles.subLabel}>Use Fingerprint/FaceID for manager overrides</Text>
            </View>
            <Switch 
              value={biometricEnabled} 
              onValueChange={toggleBiometric} 
              trackColor={{ false: 'rgba(255,255,255,0.1)', true: '#06b6d4' }} 
              thumbColor={biometricEnabled ? '#fff' : '#94a3b8'} 
            />
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Change Password</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Current Password</Text>
            <TextInput
              style={styles.input}
              secureTextEntry
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="Enter current password"
              placeholderTextColor="#64748b"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>New Password</Text>
            <TextInput
              style={styles.input}
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Enter new password"
              placeholderTextColor="#64748b"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Confirm New Password</Text>
            <TextInput
              style={styles.input}
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm new password"
              placeholderTextColor="#64748b"
            />
          </View>

          <TouchableOpacity 
            style={styles.saveButton} 
            onPress={handleChangePassword}
            disabled={loading}
          >
            <LinearGradient 
              colors={['#0891b2', '#06b6d4']} 
              start={{ x: 0, y: 0 }} 
              end={{ x: 1, y: 0 }} 
              style={styles.gradientButton}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Text style={styles.saveButtonText}>Update Password</Text>
                  <Ionicons name="lock-closed" size={20} color="white" />
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.bg },
  header: {
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  backButton: { 
    marginRight: 15, 
    padding: 8, 
    backgroundColor: 'rgba(255,255,255,0.06)', 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.08)', 
    borderRadius: 12 
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.dark.text },
  scrollContent: { padding: 20, paddingBottom: 40, gap: 20 },
  switchDashboardButton: { borderRadius: 16, overflow: 'hidden' },
  gradientButton: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  switchDashboardText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  sectionCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 20,
    gap: 15,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#06b6d4', marginBottom: 5 },
  switchRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    paddingVertical: 10
  },
  label: { fontSize: 15, fontWeight: '600', color: Colors.dark.text },
  subLabel: { fontSize: 12, color: Colors.dark.textSecondary, marginTop: 4 },
  inputGroup: { gap: 8 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: Colors.dark.textSecondary },
  input: { 
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12, 
    padding: 14, 
    fontSize: 16, 
    color: Colors.dark.text 
  },
  saveButton: { borderRadius: 16, overflow: 'hidden', marginTop: 10 },
  saveButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
});