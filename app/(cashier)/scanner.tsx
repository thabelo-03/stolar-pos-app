import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

// Use your computer's IP address here
const API_URL = 'http://192.168.1.XX:5000/api/products/add'; 

export default function CashierScanner() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentBarcode, setCurrentBarcode] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  if (!permission) return <View />;
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={{ textAlign: 'center' }}>We need your permission to show the camera</Text>
        <TouchableOpacity style={styles.btn} onPress={requestPermission}>
          <Text style={{ color: 'white' }}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleBarcodeScanned = ({ data }: any) => {
    setScanned(true);
    setCurrentBarcode(data);
    setModalVisible(true); // Open the "Add Stock" dialog
  };

  const submitStockUpdate = async () => {
    if (!quantity || isNaN(Number(quantity))) {
      Alert.alert("Error", "Please enter a valid number");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barcode: currentBarcode,
          quantity: Number(quantity),
          // Default values for brand new items
          name: "New Scanned Item",
          category: "Uncategorized",
          price: 0
        }),
      });

      const result = await response.json();

      if (response.ok) {
        Alert.alert("Success", `Stock updated for ${currentBarcode}`);
        setModalVisible(false);
        setScanned(false); // Reset scanner for next item
        setQuantity('1');
      } else {
        Alert.alert("Failed", result.message || "Server error");
      }
    } catch (error) {
      Alert.alert("Network Error", "Check server IP and connection");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <CameraView
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
        barcodeScannerSettings={{ barcodeTypes: ["qr", "ean13", "code128"] }}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={styles.overlay}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
          <Ionicons name="close-circle" size={40} color="white" />
        </TouchableOpacity>
        <View style={styles.scanFrame} />
        <Text style={styles.guideText}>Align barcode within the frame</Text>
      </View>

      {/* Stock Entry Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Add Stock</Text>
            <Text style={styles.barcodeLabel}>Barcode: {currentBarcode}</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Enter Quantity"
              keyboardType="numeric"
              value={quantity}
              onChangeText={setQuantity}
              autoFocus
            />

            <View style={styles.buttonRow}>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.cancelBtn]} 
                onPress={() => { setModalVisible(false); setScanned(false); }}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.modalBtn, styles.saveBtn]} 
                onPress={submitStockUpdate}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="white" /> : <Text style={styles.saveText}>Confirm</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  btn: { backgroundColor: '#1e40af', padding: 15, borderRadius: 10, alignSelf: 'center', marginTop: 20 },
  overlay: { flex: 1, backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'center' },
  scanFrame: { width: 250, height: 250, borderWidth: 2, borderColor: '#10b981', backgroundColor: 'transparent', borderRadius: 20 },
  closeBtn: { position: 'absolute', top: 50, right: 20 },
  guideText: { color: 'white', marginTop: 20, fontSize: 16, fontWeight: 'bold', backgroundColor: 'rgba(0,0,0,0.5)', padding: 10, borderRadius: 10 },
  
  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 },
  modalContainer: { backgroundColor: 'white', borderRadius: 20, padding: 25, alignItems: 'center' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e3a8a', marginBottom: 10 },
  barcodeLabel: { color: '#64748b', marginBottom: 20 },
  input: { width: '100%', borderBottomWidth: 2, borderBottomColor: '#1e40af', fontSize: 24, textAlign: 'center', marginBottom: 25, padding: 10 },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  modalBtn: { flex: 1, padding: 15, borderRadius: 12, alignItems: 'center', marginHorizontal: 5 },
  cancelBtn: { backgroundColor: '#f1f5f9' },
  saveBtn: { backgroundColor: '#1e40af' },
  cancelText: { color: '#64748b', fontWeight: 'bold' },
  saveText: { color: 'white', fontWeight: 'bold' }
});