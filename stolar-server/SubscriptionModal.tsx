import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Linking,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { API_BASE_URL } from '../app/config';

// 1. Define Types clearly
interface User {
  id: string;
  name: string;
  email: string;
  role?: string;
  subscriptionStatus?: string; // Helpful to have
  nextBillingAmount?: number;
  planType?: string;
}

interface SubscriptionModalProps {
  visible: boolean;
  user: User | null;
  onSuccess: () => void; // Simplified: Just tell parent to close/refresh
  onLogout: () => void;
}

export default function SubscriptionModal({ visible, user, onSuccess, onLogout }: SubscriptionModalProps) {
  const [loading, setLoading] = useState(false);
  const [pollUrl, setPollUrl] = useState<string | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);

  const handlePayNow = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/subscription/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          userId: user.id
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Open Paynow and save the status URL
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
        setPollUrl(null); // Reset local state
        onSuccess(); // Triggers the parent to refresh user profile and close modal
      } else {
        Alert.alert("Status", `Current status: ${data.status || 'Unpaid'}. Please wait a moment if you just paid.`);
      }
    } catch (error) {
      Alert.alert("Error", "Could not check status");
    } finally {
      setCheckingStatus(false);
    }
  };

  if (!user) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      // 2. Prevent hardware back button from closing it on Android
      onRequestClose={() => { 
        // Do nothing: forcing user to pay or logout
      }} 
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          
          <View style={styles.header}>
            <Ionicons name="lock-closed" size={48} color="#ef4444" />
            <Text style={styles.title}>Subscription Expired</Text>
            <Text style={styles.subtitle}>
              Your access is restricted. Please renew your subscription to continue managing your shop.
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
            <View style={styles.row}>
              <Text style={styles.label}>Total:</Text>
              <Text style={styles.amount}>R{(user.nextBillingAmount || 150).toFixed(2)}</Text>
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

            <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
              <Text style={styles.logoutText}>Log Out</Text>
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.85)', // Darker background for focus
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 20 
  },
  modalContainer: { 
    backgroundColor: 'white', 
    borderRadius: 24, 
    width: '100%', 
    maxWidth: 400, 
    padding: 24, 
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  header: { alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 24, fontWeight: '800', color: '#1e293b', marginTop: 16 },
  subtitle: { textAlign: 'center', color: '#64748b', marginTop: 8, fontSize: 15 },
  
  detailsCard: { 
    width: '100%', 
    backgroundColor: '#f8fafc', 
    padding: 16, 
    borderRadius: 16, 
    marginBottom: 24, 
    borderWidth: 1, 
    borderColor: '#e2e8f0' 
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' },
  label: { color: '#64748b', fontSize: 14, fontWeight: '600' },
  value: { color: '#0f172a', fontSize: 15, fontWeight: '700' },
  amount: { color: '#1e40af', fontWeight: '800', fontSize: 20 },
  divider: { height: 1, backgroundColor: '#cbd5e1', marginVertical: 10 },

  actions: { width: '100%', gap: 12 },
  payButton: { backgroundColor: '#2563eb', padding: 16, borderRadius: 12, alignItems: 'center' },
  payButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  checkButton: { backgroundColor: '#059669', padding: 16, borderRadius: 12, alignItems: 'center' },
  checkButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  logoutButton: { padding: 16, alignItems: 'center' },
  logoutText: { color: '#ef4444', fontWeight: '600' }
});