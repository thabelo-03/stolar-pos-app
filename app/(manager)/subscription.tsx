import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_BASE_URL } from '../config';

interface User {
  _id: string;
  name: string;
  email: string;
  role?: string;
  subscriptionStatus?: string;
  nextBillingAmount?: number;
  planType?: string;
}

export default function SubscriptionPage() {
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const fetchUser = async () => {
      const userId = await AsyncStorage.getItem('userId');
      if (userId) {
        try {
          const response = await fetch(`${API_BASE_URL}/users/${userId}`);
          if (response.ok) {
            const userData = await response.json();
            setUser(userData);
          } else {
            console.error("Failed to fetch user data");
            Alert.alert("Error", "Failed to fetch user data. Please log in again.");
            router.replace('/(auth)/login');
          }
        } catch (error) {
          console.error("Network error fetching user:", error);
          Alert.alert("Error", "Network error. Please try again.");
          router.replace('/(auth)/login');
        }
      } else {
        router.replace('/(auth)/login');
      }
    };
    fetchUser();
  }, []);

  const handleLogout = async () => {
    await AsyncStorage.clear();
    router.replace('/(auth)/login');
  };

  if (!user) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <ActivityIndicator size="large" color="#7c3aed" />
        <Text style={styles.loadingText}>Loading user data...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#7c3aed" />
        </TouchableOpacity>
      </View>
      
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.contentContainer}>
          
          <View style={styles.header}>
            <View style={styles.logoWrapper}>
              <Image source={require('../../assets/images/stolar-logo.jpeg')} style={styles.logo} />
            </View>
            <Text style={styles.title}>Subscription Required</Text>
            <Text style={styles.subtitle}>
              Your access to manager features is currently restricted. Please renew your subscription to continue managing your shop and access all functionalities.
            </Text>
          </View>

          <View style={styles.detailsCard}>
            <View style={styles.row}>
              <Text style={styles.label}>Account:</Text>
              <Text style={styles.value}>{user.email}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.label}>Plan:</Text>
              <Text style={styles.value}>{user.planType || 'Standard'} (1 Month)</Text>
            </View>
            <View style={[styles.row, { marginTop: 10 }]}>
              <Text style={styles.label}>Total:</Text>
              <Text style={styles.amount}>R{(user.nextBillingAmount || 150).toFixed(2)}</Text>
            </View>
          </View>

          <View style={styles.actions}>
            <View style={styles.paymentInfoBox}>
              <Text style={styles.paymentTitle}>Payment Options</Text>
              
              <View style={styles.paymentRow}>
                <Text style={styles.paymentLabel}>EcoCash:</Text>
                <Text style={styles.paymentValue}>+263 777 926 123</Text>
              </View>
              <View style={styles.paymentRow}>
                <Text style={styles.paymentLabel}>Name:</Text>
                <Text style={styles.paymentValue}>Thabelo Dumani</Text>
              </View>
              
              <Text style={styles.instruction}>
                Please send proof of payment to the admin to activate your account.
              </Text>
            </View>

            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Text style={styles.logoutText}>Log Out Account</Text>
            </TouchableOpacity>
          </View>

        </View>
      </ScrollView>
    </View>
  );
}

import { ScrollView } from 'react-native';

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f3ff',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#475569',
    fontWeight: '500'
  },
  container: { 
    flex: 1, 
    backgroundColor: '#f5f3ff',
    paddingHorizontal: 20 
  },
  headerContainer: {
    position: 'absolute',
    top: 40,
    left: 20,
    zIndex: 10,
  },
  backButton: {
    padding: 8,
    backgroundColor: 'white',
    borderRadius: 12,
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 40,
  },
  contentContainer: {
    backgroundColor: 'white', 
    borderRadius: 24, 
    width: '100%', 
    padding: 24, 
    alignItems: 'center',
    shadowColor: "#4f46e5",
    shadowOffset: { width: 0, height: 10 }, 
    shadowOpacity: 0.08, 
    shadowRadius: 24,
    elevation: 8,
  },
  header: { 
    alignItems: 'center', 
    marginBottom: 24, 
    paddingHorizontal: 10,
  },
  logoWrapper: {
    padding: 4,
    backgroundColor: '#f5f3ff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#ddd6fe',
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  logo: { 
    width: 72, 
    height: 72, 
    borderRadius: 20,
    resizeMode: 'contain'
  },
  title: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    color: '#0f172a',
    marginTop: 16, 
    textAlign: 'center',
    letterSpacing: 0.5
  },
  subtitle: { 
    textAlign: 'center', 
    color: '#475569', 
    marginTop: 10, 
    fontSize: 14, 
    lineHeight: 20, 
  },
  
  detailsCard: { 
    width: '100%', 
    backgroundColor: '#f5f3ff', 
    padding: 16, 
    borderRadius: 16, 
    marginBottom: 24, 
    borderWidth: 1, 
    borderColor: '#ddd6fe',
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' },
  label: { color: '#475569', fontSize: 14, fontWeight: '600' }, 
  value: { color: '#0f172a', fontSize: 14, fontWeight: 'bold' }, 
  amount: { color: '#7c3aed', fontWeight: 'bold', fontSize: 22 }, 
  divider: { height: 1, backgroundColor: '#ddd6fe', marginVertical: 12 }, 
  
  paymentInfoBox: { width: '100%', backgroundColor: '#f0fdf4', padding: 16, borderRadius: 16, marginBottom: 15, borderWidth: 1, borderColor: '#bbf7d0' },
  paymentTitle: { fontWeight: 'bold', color: '#166534', marginBottom: 12, fontSize: 16, textAlign: 'center' },
  paymentRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  paymentLabel: { color: '#15803d', fontWeight: '600', fontSize: 14 },
  paymentValue: { color: '#14532d', fontWeight: 'bold', fontSize: 14 },
  instruction: { marginTop: 12, fontSize: 12, color: '#166534', fontStyle: 'italic', textAlign: 'center', lineHeight: 16 },
  
  actions: { width: '100%', gap: 10 }, 
  logoutButton: { 
    padding: 15, 
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#fca5a5',
    backgroundColor: '#fef2f2'
  },
  logoutText: { color: '#ef4444', fontWeight: 'bold', fontSize: 15 } 
});