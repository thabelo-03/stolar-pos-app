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
            <Ionicons name="lock-closed" size={40} color="#ef4444" />
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
    borderRadius: 20, 
    width: '85%', 
    maxWidth: 340, 
    padding: 20, 
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  header: { alignItems: 'center', marginBottom: 15 },
  title: { fontSize: 20, fontWeight: '800', color: '#1e293b', marginTop: 10 },
  subtitle: { textAlign: 'center', color: '#64748b', marginTop: 5, fontSize: 13 },
  
  detailsCard: { 
    width: '100%', 
    backgroundColor: '#f8fafc', 
    padding: 12, 
    borderRadius: 12, 
    marginBottom: 15, 
    borderWidth: 1, 
    borderColor: '#e2e8f0' 
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6, alignItems: 'center' },
  label: { color: '#64748b', fontSize: 13, fontWeight: '600' },
  value: { color: '#0f172a', fontSize: 13, fontWeight: '700' },
  amount: { color: '#1e40af', fontWeight: '800', fontSize: 18 },
  divider: { height: 1, backgroundColor: '#cbd5e1', marginVertical: 8 },

  paymentInfoBox: { width: '100%', backgroundColor: '#f0fdf4', padding: 12, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#bbf7d0' },
  paymentTitle: { fontWeight: 'bold', color: '#166534', marginBottom: 8, fontSize: 14, textAlign: 'center' },
  paymentRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  paymentLabel: { color: '#15803d', fontWeight: '600', fontSize: 13 },
  paymentValue: { color: '#14532d', fontWeight: 'bold', fontSize: 13 },
  instruction: { marginTop: 8, fontSize: 11, color: '#166534', fontStyle: 'italic', textAlign: 'center' },

  actions: { width: '100%', gap: 12 },
  payButton: { backgroundColor: '#2563eb', padding: 16, borderRadius: 12, alignItems: 'center' },
  payButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  checkButton: { backgroundColor: '#059669', padding: 16, borderRadius: 12, alignItems: 'center' },
  checkButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  logoutButton: { padding: 10, alignItems: 'center' },
  logoutText: { color: '#ef4444', fontWeight: '600', fontSize: 14 }
});