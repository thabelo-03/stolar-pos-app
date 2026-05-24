import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_BASE_URL } from '../config';

export const cleanPremiumMessage = (msg: string) => {
  if (!msg) return "";
  if (msg.includes("R400") || msg.includes("Premium Plan")) {
    return "Adding another shop upgrades your subscription to R100.00 per active shop monthly (with a 30% discount if you manage more than 3 shops). Your first month is 100% free!";
  }
  return msg;
};

export default function RegisterShop() {
  const router = useRouter();
  const params = useLocalSearchParams(); 
  const insets = useSafeAreaInsets();
  
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);
  const [premiumModalVisible, setPremiumModalVisible] = useState(false);
  const [premiumMessage, setPremiumMessage] = useState('');
  
  // Modal for a polished success experience
  const [showSuccess, setShowSuccess] = useState(false);
  const [newBranchCode, setNewBranchCode] = useState('');
  const [managerId, setManagerId] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('userId').then(setManagerId);
  }, []);

  const handleRegisterShop = async (confirmPremium = false) => {
    if (!managerId) {
      Alert.alert("Error", "User session not found. Please login again.");
      return;
    }

    if (!name.trim() || !location.trim()) {
      Alert.alert("Input Required", "Please provide both Shop Name and Location.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/shops/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            name: name.trim(), 
            location: location.trim(), 
            managerId: managerId,
            confirmPremium
        }), 
      });

      const data = await response.json();

      if (response.status === 409 && data.requiresConfirmation) {
        setLoading(false);
        setPremiumMessage(data.message || 'Adding this shop requires updating your subscription plan.');
        setPremiumModalVisible(true);
        return;
      }

      if (response.ok || data.success) {
        setNewBranchCode(data.branchCode);
        setLoading(false);
        setShowSuccess(true); // Show the success modal
        
        // Clear inputs for next time
        setName('');
        setLocation('');
        setPremiumModalVisible(false);
      } else {
        setLoading(false);
        Alert.alert("Error", data.message || "Could not register shop.");
      }
    } catch (e) {
      setLoading(false);
      Alert.alert("Connection Error", "Ensure the server is running.");
    }
  };

  const closeAndNavigate = () => {
    setShowSuccess(false);
    // Go back to the dashboard which will now auto-refresh with the new shop
    router.replace('/(manager)'); 
  };

  return (
    <View style={styles.container}>
      <LinearGradient 
        colors={['#0284c7', '#0ea5e9', '#38bdf8']} 
        start={{ x: 0, y: 0 }} 
        end={{ x: 1, y: 1 }} 
        style={[styles.header, { paddingTop: insets.top + 15 }]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.title}>Branch Establishment</Text>
      </LinearGradient>
      
      <ScrollView contentContainerStyle={styles.formContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.form}>
          <Text style={styles.label}>Shop Name</Text>
          <View style={styles.inputContainer}>
              <Ionicons name="storefront" size={20} color="#0ea5e9" style={styles.icon} />
              <TextInput 
                placeholder="e.g. Zondo General Dealer" 
                placeholderTextColor="#94a3b8"
                style={styles.input} 
                value={name} 
                onChangeText={setName} 
                editable={!loading}
              />
          </View>

          <Text style={styles.label}>Shop Location</Text>
          <View style={styles.inputContainer}>
              <Ionicons name="location" size={20} color="#0ea5e9" style={styles.icon} />
              <TextInput 
                placeholder="e.g. Khalanyoni" 
                placeholderTextColor="#94a3b8"
                style={styles.input} 
                value={location} 
                onChangeText={setLocation} 
                editable={!loading}
              />
          </View>

          <TouchableOpacity 
            style={[styles.btn, loading && { backgroundColor: '#7dd3fc' }]} 
            onPress={() => handleRegisterShop(false)}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.btnText}>Launch Shop Branch</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* --- PREMIUM UPGRADE MODAL --- */}
      <Modal visible={premiumModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.premiumHeader}>
              <Ionicons name="diamond" size={40} color="#f59e0b" style={{ marginBottom: 10 }} />
              <Text style={styles.modalTitle}>Multi-Shop Upgrade</Text>
            </View>
            
            <Text style={[styles.premiumDesc, { color: '#0ea5e9', fontWeight: '700', fontSize: 16, marginBottom: 8 }]}>
              🎁 1st Month is 100% Free!
            </Text>
            
            <Text style={[styles.premiumDesc, { fontSize: 14, lineHeight: 20 }]}>
              {cleanPremiumMessage(premiumMessage) || "Adding another shop expands your business operations."}
            </Text>

            <View style={styles.planDetails}>
              <View style={styles.planRow}>
                <Ionicons name="checkmark-circle" size={18} color="#10b981" />
                <Text style={styles.planText}>Multi-Shop Inter-Stock Transfers</Text>
              </View>
              <View style={styles.planRow}>
                <Ionicons name="checkmark-circle" size={18} color="#10b981" />
                <Text style={styles.planText}>Aggregated Business Intelligence</Text>
              </View>
              <View style={styles.planRow}>
                <Ionicons name="checkmark-circle" size={18} color="#10b981" />
                <Text style={styles.planText}>Standard R100/month per active shop</Text>
              </View>
              <View style={styles.planRow}>
                <Ionicons name="checkmark-circle" size={18} color="#10b981" />
                <Text style={styles.planText}>30% Discount (for more than 3 shops)</Text>
              </View>
            </View>

            <View style={styles.paymentInfoBox}>
              <Text style={styles.paymentTitle}>Renewal Details</Text>
              <View style={styles.paymentRow}>
                <Text style={styles.paymentLabel}>EcoCash:</Text>
                <Text style={styles.paymentValue}>+263 777 926 123</Text>
              </View>
              <View style={styles.paymentRow}>
                <Text style={styles.paymentLabel}>Name:</Text>
                <Text style={styles.paymentValue}>Thabelo Dumani</Text>
              </View>
            </View>

            <TouchableOpacity 
              style={[styles.modalBtn, { backgroundColor: '#0ea5e9' }]} 
              onPress={() => handleRegisterShop(true)}
            >
              <Text style={styles.modalBtnText}>Confirm & Create Shop</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.modalBtn, { backgroundColor: '#f1f5f9', marginTop: 12 }]} 
              onPress={() => setPremiumModalVisible(false)}
            >
              <Text style={[styles.modalBtnText, { color: '#64748b' }]}>Cancel</Text>
            </TouchableOpacity>
            
            <Text style={styles.noteText}>
              * Trial is instant. Renewals are handled by EcoCash or Cash payment validation.
            </Text>
          </View>
        </View>
      </Modal>

      {/* --- SUCCESS MODAL --- */}
      <Modal visible={showSuccess} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Ionicons name="checkmark-circle" size={80} color="#10b981" />
            <Text style={styles.modalTitle}>Registration Successful!</Text>
            <Text style={styles.modalSub}>Branch Code Assigned:</Text>
            
            <View style={styles.codeBox}>
              <Text style={styles.codeText}>{newBranchCode}</Text>
            </View>

            <TouchableOpacity style={styles.modalBtn} onPress={closeAndNavigate}>
              <Text style={styles.modalBtnText}>Return to Dashboard</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f9ff' },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: { padding: 8, backgroundColor: 'rgba(255, 255, 255, 0.2)', borderRadius: 12, marginRight: 15 },
  title: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 0.5
  },
  formContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  form: { 
    padding: 24,
    backgroundColor: 'white',
    borderRadius: 20,
    margin: 20,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
  },
  label: { fontSize: 14, fontWeight: '600', color: '#475569', marginBottom: 8 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 12, paddingHorizontal: 15, marginBottom: 20, borderWidth: 1, borderColor: '#e2e8f0', height: 50 },
  icon: { marginRight: 10 },
  input: { flex: 1, fontSize: 16, color: '#0f172a', height: '100%' },
  btn: { 
    backgroundColor: '#0ea5e9', 
    paddingVertical: 16, 
    borderRadius: 16, 
    alignItems: 'center', 
    marginTop: 10,
    shadowColor: '#0ea5e9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  
  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(5, 7, 14, 0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: 'white', width: '85%', borderRadius: 24, padding: 30, alignItems: 'center', shadowColor: '#0284c7', shadowOpacity: 0.15, shadowRadius: 20, elevation: 10 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#0f172a', marginTop: 10, textAlign: 'center' },
  modalSub: { color: '#475569', fontSize: 15, marginTop: 10 },
  codeBox: { backgroundColor: '#f0f9ff', padding: 15, borderRadius: 16, width: '100%', alignItems: 'center', marginVertical: 20, borderWidth: 1, borderColor: '#bae6fd' },
  codeText: { fontSize: 32, fontWeight: 'bold', color: '#0ea5e9', letterSpacing: 2 },
  modalBtn: { backgroundColor: '#0ea5e9', width: '100%', paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  modalBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  
  // Premium Modal Specifics
  premiumHeader: { alignItems: 'center', marginBottom: 10 },
  premiumDesc: { textAlign: 'center', color: '#475569', marginBottom: 20, fontSize: 15, lineHeight: 22 },
  planDetails: { width: '100%', backgroundColor: '#f0f9ff', padding: 15, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: '#bae6fd' },
  planRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  planText: { marginLeft: 10, color: '#475569', fontSize: 14, fontWeight: '500' },
  priceTag: { marginTop: 10, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 10 },
  priceText: { fontSize: 18, fontWeight: 'bold', color: '#0ea5e9' },
  noteText: { fontSize: 11, color: '#94a3b8', marginTop: 15, textAlign: 'center', fontStyle: 'italic' },
  
  paymentInfoBox: { width: '100%', backgroundColor: '#f0fdf4', padding: 12, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#bbf7d0' },
  paymentTitle: { fontWeight: 'bold', color: '#166534', marginBottom: 8, fontSize: 14, textAlign: 'center' },
  paymentRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  paymentLabel: { color: '#15803d', fontWeight: '600', fontSize: 13 },
  paymentValue: { color: '#14532d', fontWeight: 'bold', fontSize: 13 }
});