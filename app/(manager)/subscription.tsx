import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Linking,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config';

interface User {
  id: string;
  name: string;
  email: string;
  role?: string;
  subscriptionStatus?: string;
}

export default function SubscriptionPage() {
  const [loading, setLoading] = useState(false);
  const [pollUrl, setPollUrl] = useState<string | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  const AMOUNT = 10.00;
  const PERIOD = "1 Month";

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

  const handlePayNow = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/subscription/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          amount: AMOUNT,
          userId: user.id
        }),
      });

      const data = await response.json();

      if (data.success) {
        Linking.openURL(data.redirectUrl);
        setPollUrl(data.pollUrl);
      } else {
        Alert.alert("Error", data.message || "Failed to initiate payment");
      }
    } catch (error) {
      Alert.alert("Error", "Network error occurred");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const checkPaymentStatus = async () => {
    if (!pollUrl || !user) return;
    setCheckingStatus(true);

    try {
      const response = await fetch(`${API_BASE_URL}/subscription/check-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pollUrl, userId: user.id }),
      });

      const data = await response.json();

      if (data.success && (data.status === 'paid' || data.status === 'awaiting delivery')) {
        Alert.alert("Success", "Payment received! Your subscription is active.");
        setPollUrl(null);
        // On success, navigate to the manager dashboard
        router.replace('/(manager)/'); 
      } else {
        Alert.alert("Status", `Current status: ${data.status || 'Unpaid'}. Please wait a moment if you just paid.`);
      }
    } catch (error) {
      Alert.alert("Error", "Could not check status");
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.clear();
    router.replace('/(auth)/login');
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1e40af" />
        <Text style={styles.loadingText}>Loading user data...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.contentContainer}>
        
        <View style={styles.header}>
          <Ionicons name="card-outline" size={60} color="#1e40af" /> 
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
            <Text style={styles.value}>{PERIOD}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Total:</Text>
            <Text style={styles.amount}>${AMOUNT.toFixed(2)}</Text>
          </View>
        </View>

        <View style={styles.actions}>
          {!pollUrl ? (
            <TouchableOpacity 
              style={styles.payButton} 
              onPress={handlePayNow}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.payButtonText}>Pay Now</Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={styles.checkButton} 
              onPress={checkPaymentStatus}
              disabled={checkingStatus}
            >
              {checkingStatus ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.checkButtonText}>I Have Paid (Check Status)</Text>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#334155',
  },
  container: { 
    flex: 1, 
    backgroundColor: '#eef2ff', // Lighter, subtle background
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 20 
  },
  contentContainer: { // Renamed from modalContainer for clarity
    backgroundColor: 'white', 
    borderRadius: 16, // Slightly smaller radius
    width: '100%', 
    maxWidth: 450, // Slightly wider max width
    padding: 30, // Increased padding
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 }, // More pronounced shadow
    shadowOpacity: 0.1, // Softer shadow
    shadowRadius: 12,
    elevation: 10,
  },
  header: { 
    alignItems: 'center', 
    marginBottom: 30, // Increased margin
    paddingHorizontal: 15,
  },
  title: { 
    fontSize: 28, // Larger title
    fontWeight: '800', 
    color: '#1e40af', // Primary blue for title
    marginTop: 20, 
    textAlign: 'center',
  },
  subtitle: { 
    textAlign: 'center', 
    color: '#475569', // Darker gray for better contrast
    marginTop: 10, 
    fontSize: 16, 
    lineHeight: 24, // Improved line height for readability
  },
  
  detailsCard: { 
    width: '100%', 
    backgroundColor: '#f8fafc', 
    padding: 20, // Increased padding
    borderRadius: 12, // Slightly smaller radius
    marginBottom: 30, // Increased margin
    borderWidth: 1, 
    borderColor: '#e2e8f0',
    shadowColor: "#000", // Add subtle shadow to card
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, alignItems: 'center' },
  label: { color: '#64748b', fontSize: 15, fontWeight: '600' }, // Slightly larger font
  value: { color: '#0f172a', fontSize: 16, fontWeight: '700' }, // Slightly larger font
  amount: { color: '#1e40af', fontWeight: '800', fontSize: 24 }, // Larger amount
  divider: { height: 1, backgroundColor: '#cbd5e1', marginVertical: 15 }, // More vertical margin

  actions: { width: '100%', gap: 15 }, // Increased gap between buttons
  payButton: { 
    backgroundColor: '#1e40af', // Primary blue button
    paddingVertical: 18, // More padding
    borderRadius: 12, 
    alignItems: 'center',
    shadowColor: "#1e40af", // Shadow matching button color
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  payButtonText: { color: 'white', fontWeight: 'bold', fontSize: 18 }, // Larger font
  checkButton: { 
    backgroundColor: '#059669', // Green for success check
    paddingVertical: 18, 
    borderRadius: 12, 
    alignItems: 'center',
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  checkButtonText: { color: 'white', fontWeight: 'bold', fontSize: 18 }, // Larger font
  logoutButton: { 
    padding: 15, 
    alignItems: 'center',
    // No shadow for logout to de-emphasize
  },
  logoutText: { color: '#ef4444', fontWeight: '600', fontSize: 16 } // Larger font
});