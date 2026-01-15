import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
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

export default function RegisterShop() {
  const router = useRouter();
  const params = useLocalSearchParams(); 
  
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Modal for a polished success experience
  const [showSuccess, setShowSuccess] = useState(false);
  const [newBranchCode, setNewBranchCode] = useState('');

  // Use Danger's ID passed from login or fallback to the one we verified
  const managerId = params.id || "6966ad15a4b1e45a20db7042"; 

  const handleRegisterShop = async () => {
    if (!name.trim() || !location.trim()) {
      Alert.alert("Input Required", "Please provide both Shop Name and Location.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('http://192.168.54.12:5000/api/shops/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            name: name.trim(), 
            location: location.trim(), 
            managerId: managerId 
        }), 
      });

      const data = await response.json();

      if (response.ok || data.success) {
        setNewBranchCode(data.branchCode);
        setLoading(false);
        setShowSuccess(true); // Show the success modal
        
        // Clear inputs for next time
        setName('');
        setLocation('');
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
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View style={styles.iconCircle}>
            <Ionicons name="business" size={50} color="#1e40af" />
        </View>
        <Text style={styles.title}>Branch Establishment</Text>
        <Text style={styles.subtitle}>Adding a new branch for Danger Dumani</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Shop Name</Text>
        <View style={styles.inputContainer}>
            <Ionicons name="storefront" size={20} color="#64748b" style={styles.icon} />
            <TextInput 
              placeholder="e.g. Zondo General Dealer" 
              style={styles.input} 
              value={name} 
              onChangeText={setName} 
            />
        </View>

        <Text style={styles.label}>Shop Location</Text>
        <View style={styles.inputContainer}>
            <Ionicons name="location" size={20} color="#64748b" style={styles.icon} />
            <TextInput 
              placeholder="e.g. Khalanyoni" 
              style={styles.input} 
              value={location} 
              onChangeText={setLocation} 
            />
        </View>

        <TouchableOpacity 
          style={[styles.btn, loading && { backgroundColor: '#94a3b8' }]} 
          onPress={handleRegisterShop}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.btnText}>Launch Shop Branch</Text>
          )}
        </TouchableOpacity>
      </View>

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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#f8fafc', padding: 25 },
  header: { alignItems: 'center', marginTop: 40, marginBottom: 30 },
  iconCircle: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1e3a8a', marginTop: 15 },
  subtitle: { color: '#64748b', fontSize: 14 },
  form: { width: '100%' },
  label: { fontSize: 14, fontWeight: '600', color: '#1e293b', marginBottom: 8 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderRadius: 12, paddingHorizontal: 15, marginBottom: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  icon: { marginRight: 10 },
  input: { flex: 1, paddingVertical: 15, fontSize: 16 },
  btn: { backgroundColor: '#1e40af', paddingVertical: 18, borderRadius: 15, alignItems: 'center', marginTop: 10 },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 18 },
  
  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: 'white', width: '85%', borderRadius: 20, padding: 30, alignItems: 'center' },
  modalTitle: { fontSize: 22, fontWeight: 'bold', color: '#1e293b', marginTop: 15 },
  modalSub: { color: '#64748b', fontSize: 16, marginTop: 10 },
  codeBox: { backgroundColor: '#f1f5f9', padding: 15, borderRadius: 10, width: '100%', alignItems: 'center', marginVertical: 20 },
  codeText: { fontSize: 32, fontWeight: 'bold', color: '#1e40af', letterSpacing: 2 },
  modalBtn: { backgroundColor: '#1e40af', width: '100%', paddingVertical: 15, borderRadius: 12, alignItems: 'center' },
  modalBtnText: { color: 'white', fontWeight: 'bold' }
});