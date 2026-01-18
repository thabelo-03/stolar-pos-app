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

export default function LinkShopScreen() {
  const [branchCode, setBranchCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  // This is the function that actually talks to your Stolar Server
  const executeRequest = async (formattedCode: string) => {
    setIsLoading(true);
    try {
      const userId = await AsyncStorage.getItem('userId');
      if (!userId) {
        Alert.alert('Session Expired', 'Please login again to continue.');
        router.replace('/(auth)/login');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/shops/request-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchCode: formattedCode,
          cashierId: userId, 
        }),
      });

      const responseData = await response.json();

      if (response.ok) {
        Alert.alert(
          'Request Submitted', 
          'Your link request is now pending. Danger (Manager) will see this in his Operation Hub.',
          [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
        );
      } else {
        Alert.alert('Linking Failed', responseData.message || 'Invalid branch code.');
      }
    } catch (error) {
      Alert.alert('Connection Error', 'Unable to reach the server. Please check your internet.');
    } finally {
      setIsLoading(false);
    }
  };

  // STEP 1: New Confirmation Logic
  const handleLinkShop = () => {
  const formattedCode = branchCode.trim().toUpperCase();

  if (!formattedCode) {
    Alert.alert('Error', 'Please enter the branch code.');
    return;
  }

  // Ensure this Alert block is exactly like this:
  Alert.alert(
    'Confirm Link Request',
    `Join branch: ${formattedCode}?`,
    [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Yes', 
        onPress: () => executeRequest(formattedCode) // <--- Check this line!
      },
    ]
  );
};

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.card}>
        <View style={styles.iconContainer}>
          <Ionicons name="link-outline" size={50} color="#1e40af" />
        </View>
        
        <Text style={styles.title}>Join a Shop Branch</Text>
        <Text style={styles.subtitle}>
          Enter the unique code shared by your manager to link your account to a specific shop department.
        </Text>
        
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder="STLR-XXXX"
            value={branchCode}
            onChangeText={setBranchCode}
            autoCapitalize="characters"
            placeholderTextColor="#94a3b8"
            maxLength={10}
          />
          <Text style={styles.inputHint}>Check your WhatsApp for the code</Text>
        </View>

        <TouchableOpacity 
          style={[styles.button, isLoading && styles.buttonDisabled]} 
          onPress={handleLinkShop} 
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.buttonText}>Send Link Request</Text>
              <Ionicons name="send-outline" size={18} color="white" style={{marginLeft: 10}} />
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.cancelLink}
          onPress={() => router.replace('/(auth)/login')}
        >
          <Text style={styles.cancelText}>Cancel and Log Out</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 25, backgroundColor: '#f1f5f9' },
  card: { backgroundColor: '#fff', padding: 30, borderRadius: 25, elevation: 8, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, alignItems: 'center' },
  iconContainer: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#1e3a8a', marginBottom: 12 },
  subtitle: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 30, lineHeight: 22 },
  inputWrapper: { width: '100%', marginBottom: 30 },
  input: { width: '100%', height: 60, borderColor: '#e2e8f0', borderWidth: 2, borderRadius: 15, paddingHorizontal: 20, fontSize: 20, fontWeight: 'bold', textAlign: 'center', color: '#1e293b', backgroundColor: '#f8fafc' },
  inputHint: { textAlign: 'center', color: '#94a3b8', fontSize: 12, marginTop: 8 },
  button: { backgroundColor: '#1e40af', width: '100%', padding: 18, borderRadius: 15, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  buttonDisabled: { backgroundColor: '#94a3b8' },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  cancelLink: { marginTop: 25 },
  cancelText: { color: '#ef4444', fontWeight: '600', fontSize: 14 }
});