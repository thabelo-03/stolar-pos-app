import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { API_BASE_URL } from '../config';

export default function LinkShopScreen() {
  const [branchCode, setBranchCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLinkShop = async () => {
    const formattedCode = branchCode.trim().toUpperCase();

    if (!formattedCode) {
      Alert.alert('Error', 'Please enter a shop code.');
      return;
    }

    setIsLoading(true);
    try {
      const userId = await AsyncStorage.getItem('userId');
      if (!userId) {
        Alert.alert('Error', 'Session expired. Please login again.');
        router.replace('/(auth)/login');
        return;
      }

      // This endpoint must exist on your Node.js server
      const response = await fetch(`${API_BASE_URL}/shops/request-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchCode: formattedCode,
          userId: userId, // This is the Cashier's ID
        }),
      });

      const responseData = await response.json();

      if (response.ok) {
        Alert.alert(
          'Request Sent', 
          'Danger has been notified. Please wait for him to approve your access in the Operation Hub.'
        );
        // We stay here or go to a "Pending" screen so they don't see the POS yet
        router.replace('/(auth)/login'); 
      } else {
        Alert.alert('Invalid Code', responseData.message || 'That shop code does not exist.');
      }
    } catch (error) {
      Alert.alert('Network Error', 'Could not reach the server.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Ionicons name="business-outline" size={50} color="#1e40af" style={styles.icon} />
        <Text style={styles.title}>Link to a Shop</Text>
        <Text style={styles.subtitle}>Enter the Branch Code shared by your manager via WhatsApp.</Text>
        
        <TextInput
          style={styles.input}
          placeholder="STLR-XXXX"
          value={branchCode}
          onChangeText={setBranchCode}
          autoCapitalize="characters"
          placeholderTextColor="#94a3b8"
        />

        <TouchableOpacity 
          style={[styles.button, isLoading && styles.buttonDisabled]} 
          onPress={handleLinkShop} 
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Send Link Request</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 25, backgroundColor: '#f1f5f9' },
  card: { backgroundColor: '#fff', padding: 30, borderRadius: 20, elevation: 5, alignItems: 'center' },
  icon: { marginBottom: 15 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1e3a8a', marginBottom: 10 },
  subtitle: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 25, lineHeight: 20 },
  input: { width: '100%', height: 55, borderColor: '#e2e8f0', borderWidth: 2, borderRadius: 12, paddingHorizontal: 20, fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 20, color: '#1e293b' },
  button: { backgroundColor: '#1e40af', width: '100%', padding: 16, borderRadius: 12, alignItems: 'center' },
  buttonDisabled: { backgroundColor: '#94a3b8' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});