import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, TextInput, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '../../components/themed-text';
import { ThemedView } from '../../components/themed-view';
import { useThemeColor } from '../../hooks/use-theme-color';
import { API_BASE_URL } from './api';

export default function ProfileSettingsScreen() {
  const router = useRouter();
  const textColor = useThemeColor({}, 'text');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [fixingCosts, setFixingCosts] = useState(false);
  const [estimatingCosts, setEstimatingCosts] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('biometricEnabled').then((value) => {
      setBiometricEnabled(value === 'true');
    });
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

  const handleMigrateData = () => {
    Alert.alert(
      "Confirm Migration",
      "This will update all past sales to link them to your current shop. This process may take a moment.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Start", 
          onPress: async () => {
            setMigrating(true);
            try {
              const userId = await AsyncStorage.getItem('userId');
              const response = await fetch(`${API_BASE_URL}/test/migrate-sales-shopid`, { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId })
              });
              const data = await response.json();
              Alert.alert("Migration Result", data.message || "Migration completed");
            } catch (error) {
              Alert.alert("Error", "Failed to run migration");
            } finally {
              setMigrating(false);
            }
          }
        }
      ]
    );
  };

  const handleFixCosts = async () => {
    setFixingCosts(true);
    try {
      const response = await fetch(`${API_BASE_URL}/test/fix-product-costs`, { method: 'POST' });
      const data = await response.json();
      Alert.alert("Success", data.message || "Products updated.");
    } catch (error) {
      Alert.alert("Error", "Failed to fix product costs.");
    } finally {
      setFixingCosts(false);
    }
  };

  const handleEstimateCosts = async () => {
    Alert.alert(
      "Estimate Costs",
      "This will set the Cost Price to 70% of the Selling Price for all items where Cost is currently 0. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Yes, Estimate", 
          onPress: async () => {
            setEstimatingCosts(true);
            try {
              const response = await fetch(`${API_BASE_URL}/test/backfill-estimated-costs`, { method: 'POST' });
              const data = await response.json();
              Alert.alert("Success", data.message);
            } catch (error) {
              Alert.alert("Error", "Failed to estimate costs.");
            } finally {
              setEstimatingCosts(false);
            }
          }
        }
      ]
    );
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={textColor} />
        </TouchableOpacity>
        <ThemedText type="title">Profile Settings</ThemedText>
      </View>

      <View style={styles.form}>
        <ThemedText type="subtitle" style={styles.sectionTitle}>Security</ThemedText>
        <View style={styles.switchRow}>
          <View>
            <ThemedText style={styles.label}>Biometric Approval</ThemedText>
            <ThemedText style={styles.subLabel}>Use Fingerprint/FaceID for manager overrides</ThemedText>
          </View>
          <Switch value={biometricEnabled} onValueChange={toggleBiometric} trackColor={{ false: '#767577', true: '#1e40af' }} thumbColor={biometricEnabled ? '#fff' : '#f4f3f4'} />
        </View>

        <ThemedText type="subtitle" style={styles.sectionTitle}>Change Password</ThemedText>
        
        <View style={styles.inputGroup}>
          <ThemedText style={styles.label}>Current Password</ThemedText>
          <TextInput
            style={[styles.input, { color: textColor, borderColor: textColor }]}
            secureTextEntry
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder="Enter current password"
            placeholderTextColor="#888"
          />
        </View>

        <View style={styles.inputGroup}>
          <ThemedText style={styles.label}>New Password</ThemedText>
          <TextInput
            style={[styles.input, { color: textColor, borderColor: textColor }]}
            secureTextEntry
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="Enter new password"
            placeholderTextColor="#888"
          />
        </View>

        <View style={styles.inputGroup}>
          <ThemedText style={styles.label}>Confirm New Password</ThemedText>
          <TextInput
            style={[styles.input, { color: textColor, borderColor: textColor }]}
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Confirm new password"
            placeholderTextColor="#888"
          />
        </View>

        <TouchableOpacity 
          style={styles.saveButton} 
          onPress={handleChangePassword}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <ThemedText style={styles.saveButtonText}>Update Password</ThemedText>
          )}
        </TouchableOpacity>

        <ThemedText type="subtitle" style={[styles.sectionTitle, { marginTop: 20 }]}>Data Management</ThemedText>
        <TouchableOpacity 
          style={[styles.saveButton, { backgroundColor: '#64748b' }]} 
          onPress={handleMigrateData}
          disabled={migrating || loading}
        >
          {migrating ? (
            <ActivityIndicator color="white" />
          ) : (
            <ThemedText style={styles.saveButtonText}>Fix Old Sales Data</ThemedText>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.saveButton, { backgroundColor: '#059669', marginTop: 10 }]} 
          onPress={handleFixCosts}
          disabled={fixingCosts}
        >
          {fixingCosts ? <ActivityIndicator color="white" /> : <ThemedText style={styles.saveButtonText}>Initialize Cost Prices</ThemedText>}
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.saveButton, { backgroundColor: '#0891b2', marginTop: 10 }]} 
          onPress={handleEstimateCosts}
          disabled={estimatingCosts}
        >
          {estimatingCosts ? <ActivityIndicator color="white" /> : <ThemedText style={styles.saveButtonText}>Estimate Missing Costs (70%)</ThemedText>}
        </TouchableOpacity>
      </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 30, gap: 15 },
  backButton: { padding: 5 },
  form: { gap: 20 },
  sectionTitle: { marginBottom: 10 },
  inputGroup: { gap: 8 },
  label: { fontSize: 14, fontWeight: '600', opacity: 0.8 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 16, opacity: 0.8 },
  saveButton: { backgroundColor: '#1e40af', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  saveButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', marginBottom: 10 },
  subLabel: { fontSize: 12, color: '#64748b', marginTop: 2 },
});