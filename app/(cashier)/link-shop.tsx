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
  View,
  Image
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { API_BASE_URL } from '../config';
import { Colors } from '../../constants/theme';

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

    Alert.alert(
      'Confirm Link Request',
      `Join branch: ${formattedCode}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Yes', 
          onPress: () => executeRequest(formattedCode)
        },
      ]
    );
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <View style={styles.card}>
        <View style={styles.iconContainer}>
          <Image source={require('../../assets/images/stolar-logo.jpeg')} style={styles.logoImage} />
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
            placeholderTextColor="#64748b"
            maxLength={10}
          />
          <Text style={styles.inputHint}>Check your WhatsApp for the code</Text>
        </View>

        <TouchableOpacity 
          style={styles.button} 
          onPress={handleLinkShop} 
          disabled={isLoading}
        >
          <LinearGradient 
            colors={isLoading ? ['#475569', '#475569'] : ['#0891b2', '#06b6d4']} 
            start={{ x: 0, y: 0 }} 
            end={{ x: 1, y: 0 }} 
            style={styles.buttonGradient}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.buttonText}>Send Link Request</Text>
                <Ionicons name="send-outline" size={18} color="white" style={{marginLeft: 10}} />
              </>
            )}
          </LinearGradient>
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
  container: { flex: 1, justifyContent: 'center', padding: 25, backgroundColor: Colors.dark.bg },
  card: { 
    backgroundColor: 'rgba(255,255,255,0.05)', 
    padding: 30, 
    borderRadius: 25, 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center' 
  },
  iconContainer: { 
    width: 80, 
    height: 80, 
    borderRadius: 40, 
    backgroundColor: 'rgba(255,255,255,0.05)', 
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 20,
    overflow: 'hidden'
  },
  logoImage: { width: 60, height: 60, resizeMode: 'contain' },
  title: { fontSize: 22, fontWeight: 'bold', color: Colors.dark.text, marginBottom: 12 },
  subtitle: { fontSize: 14, color: Colors.dark.textSecondary, textAlign: 'center', marginBottom: 30, lineHeight: 22 },
  inputWrapper: { width: '100%', marginBottom: 30 },
  input: { 
    width: '100%', 
    height: 60, 
    borderColor: 'rgba(255,255,255,0.08)', 
    borderWidth: 1, 
    borderRadius: 15, 
    paddingHorizontal: 20, 
    fontSize: 20, 
    fontWeight: 'bold', 
    textAlign: 'center', 
    color: Colors.dark.text, 
    backgroundColor: 'rgba(255,255,255,0.03)' 
  },
  inputHint: { textAlign: 'center', color: Colors.dark.textMuted, fontSize: 12, marginTop: 8 },
  button: { width: '100%', borderRadius: 15, overflow: 'hidden' },
  buttonGradient: { 
    padding: 18, 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  cancelLink: { marginTop: 25 },
  cancelText: { color: '#f43f5e', fontWeight: '600', fontSize: 14 }
});