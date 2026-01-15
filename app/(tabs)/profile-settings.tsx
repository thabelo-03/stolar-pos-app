import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={textColor} />
        </TouchableOpacity>
        <ThemedText type="title">Profile Settings</ThemedText>
      </View>

      <View style={styles.form}>
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
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 30, gap: 15 },
  backButton: { padding: 5 },
  form: { gap: 20 },
  sectionTitle: { marginBottom: 10 },
  inputGroup: { gap: 8 },
  label: { fontSize: 14, fontWeight: '600', opacity: 0.8 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 16, opacity: 0.8 },
  saveButton: { backgroundColor: '#1e40af', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  saveButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
});