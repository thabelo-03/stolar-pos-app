import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { API_BASE_URL } from '../config';
import { Colors } from '../../constants/theme';

const API_URL = `${API_BASE_URL}/products/add`;

export default function CashierScanner() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentBarcode, setCurrentBarcode] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  if (!permission) return <View style={styles.container} />;
  if (!permission.granted) {
    return (
      <View style={[styles.container, styles.center]}>
        <View style={styles.permissionCard}>
          <Ionicons name="camera-outline" size={48} color="#06b6d4" style={{ marginBottom: 16 }} />
          <Text style={styles.permissionText}>We need your permission to show the camera</Text>
          <TouchableOpacity style={styles.btn} onPress={requestPermission}>
            <Text style={styles.btnText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const handleBarcodeScanned = ({ data }: any) => {
    setScanned(true);
    setCurrentBarcode(data);
    setModalVisible(true);
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
          name: "New Scanned Item",
          category: "Uncategorized",
          price: 0
        }),
      });

      const result = await response.json();

      if (response.ok) {
        Alert.alert("Success", `Stock updated for ${currentBarcode}`);
        setModalVisible(false);
        setScanned(false);
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
          <Ionicons name="close-circle" size={44} color="rgba(255, 255, 255, 0.7)" />
        </TouchableOpacity>
        <View style={styles.scanFrame} />
        <Text style={styles.guideText}>Align barcode within the frame</Text>
      </View>

      {/* Stock Entry Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalIconWrapper}>
              <Ionicons name="cube-outline" size={32} color="#06b6d4" />
            </View>
            <Text style={styles.modalTitle}>Add Stock</Text>
            <Text style={styles.barcodeLabel}>Barcode: {currentBarcode}</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Enter Quantity"
              placeholderTextColor="#64748b"
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
                {loading ? <ActivityIndicator color="#0a0f1e" /> : <Text style={styles.saveText}>Confirm</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.bg },
  center: { justifyContent: 'center', alignItems: 'center', padding: 20 },
  permissionCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  permissionText: {
    color: '#94a3b8',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  btn: { 
    backgroundColor: '#06b6d4', 
    paddingHorizontal: 24, 
    paddingVertical: 14, 
    borderRadius: 16, 
    width: '100%', 
    alignItems: 'center' 
  },
  btnText: { color: '#0a0f1e', fontWeight: 'bold', fontSize: 16 },
  overlay: { flex: 1, backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'center' },
  scanFrame: { 
    width: 260, 
    height: 260, 
    borderWidth: 2, 
    borderColor: '#06b6d4', 
    backgroundColor: 'transparent', 
    borderRadius: 24,
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
  closeBtn: { position: 'absolute', top: 50, right: 20 },
  guideText: { 
    color: 'white', 
    marginTop: 24, 
    fontSize: 14, 
    fontWeight: 'bold', 
    backgroundColor: 'rgba(10, 15, 30, 0.8)', 
    paddingHorizontal: 16, 
    paddingVertical: 8, 
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    letterSpacing: 0.5,
  },
  
  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(5, 7, 14, 0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContainer: { 
    backgroundColor: '#111827', 
    borderRadius: 24, 
    padding: 24, 
    width: '100%', 
    maxWidth: 340, 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalIconWrapper: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginTop: 6, marginBottom: 8 },
  barcodeLabel: { fontSize: 14, color: '#94a3b8', marginBottom: 24 },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 16,
    padding: 18,
    fontSize: 20,
    width: '100%',
    textAlign: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    color: '#fff',
    fontWeight: 'bold',
  },
  buttonRow: { flexDirection: 'row', width: '100%', gap: 12 },
  modalBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cancelBtn: { backgroundColor: 'rgba(255, 255, 255, 0.08)' },
  saveBtn: { backgroundColor: '#06b6d4' },
  cancelText: { color: '#94a3b8', fontWeight: '600' },
  saveText: { color: '#0a0f1e', fontWeight: 'bold' }
});