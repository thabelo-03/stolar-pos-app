import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useActiveShop } from '@/hooks/use-active-shop';
import { Colors } from '../../constants/theme';

export default function ScanScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [manualEntry, setManualEntry] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const { shopId, loading: shopLoading } = useActiveShop();

  if (shopLoading || !permission) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#06b6d4" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 20 }]}>
        <Ionicons name="camera-reverse" size={64} color="#06b6d4" style={{ marginBottom: 20 }} />
        <Text style={styles.message}>We need your permission to show the camera</Text>
        
        <TouchableOpacity style={styles.actionButton} onPress={requestPermission}>
          <LinearGradient colors={['#0891b2', '#06b6d4']} style={styles.buttonGradient}>
            <Text style={styles.actionButtonText}>Grant Permission</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelLink} onPress={() => router.back()}>
          <Text style={styles.cancelLinkText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    router.push({
      pathname: '/(tabs)/cart',
      params: { barcode: data, shopId: shopId || '' },
    });
  };

  const handleManualSubmit = () => {
    if (manualCode.trim()) {
      handleBarCodeScanned({ data: manualCode });
      setManualCode('');
      setManualEntry(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <CameraView
        style={styles.camera}
        facing="back"
        onBarcodeScanned={handleBarCodeScanned}
      >
        <View style={styles.overlay}>
          <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
             <Ionicons name="close" size={24} color="white" />
          </TouchableOpacity>
          
          {!manualEntry ? (
            <>
              <View style={styles.scanArea}>
                <View style={styles.cornerTL} />
                <View style={styles.cornerTR} />
                <View style={styles.cornerBL} />
                <View style={styles.cornerBR} />
              </View>

              <Text style={styles.hintText}>Align barcode within frame</Text>

              <TouchableOpacity style={styles.manualButton} onPress={() => setManualEntry(true)}>
                <Ionicons name="create-outline" size={20} color="white" />
                <Text style={styles.manualButtonText}>Enter Code Manually</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.manualContainer}>
              <Text style={styles.manualTitle}>Enter Barcode</Text>
              <TextInput
                style={styles.manualInput}
                value={manualCode}
                onChangeText={setManualCode}
                placeholder="Barcode / SKU"
                placeholderTextColor="#64748b"
                keyboardType="numeric"
                autoFocus
              />
              <View style={styles.manualActions}>
                <TouchableOpacity style={styles.manualCancelBtn} onPress={() => setManualEntry(false)}>
                  <Text style={styles.manualCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.manualSubmitBtn} onPress={handleManualSubmit}>
                  <LinearGradient colors={['#0891b2', '#06b6d4']} style={styles.submitGradient}>
                    <Text style={styles.manualSubmitText}>Submit</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.bg },
  message: { textAlign: 'center', fontSize: 16, color: '#f1f5f9', marginBottom: 30 },
  camera: { flex: 1 },
  overlay: { 
    flex: 1, 
    backgroundColor: 'rgba(10,15,30,0.5)', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  closeButton: { 
    position: 'absolute', 
    top: 50, 
    right: 20, 
    padding: 12, 
    backgroundColor: 'rgba(255,255,255,0.06)', 
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16 
  },
  scanArea: { width: 250, height: 250, position: 'relative' },
  cornerTL: { position: 'absolute', top: 0, left: 0, width: 40, height: 40, borderTopWidth: 4, borderLeftWidth: 4, borderColor: '#06b6d4' },
  cornerTR: { position: 'absolute', top: 0, right: 0, width: 40, height: 40, borderTopWidth: 4, borderRightWidth: 4, borderColor: '#06b6d4' },
  cornerBL: { position: 'absolute', bottom: 0, left: 0, width: 40, height: 40, borderBottomWidth: 4, borderLeftWidth: 4, borderColor: '#06b6d4' },
  cornerBR: { position: 'absolute', bottom: 0, right: 0, width: 40, height: 40, borderBottomWidth: 4, borderRightWidth: 4, borderColor: '#06b6d4' },
  hintText: { 
    color: '#f1f5f9', 
    marginTop: 25, 
    fontSize: 15, 
    fontWeight: '600', 
    backgroundColor: 'rgba(255,255,255,0.06)', 
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 18, 
    paddingVertical: 10, 
    borderRadius: 12 
  },
  manualButton: {
    marginTop: 35,
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  manualButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  manualContainer: {
    width: '85%',
    backgroundColor: 'rgba(20, 25, 45, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 24,
    borderRadius: 24,
    alignItems: 'center',
    gap: 15,
  },
  manualTitle: { fontSize: 18, fontWeight: 'bold', color: '#06b6d4', marginBottom: 5 },
  manualInput: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: 14,
    fontSize: 16,
    color: '#f1f5f9',
    textAlign: 'center',
  },
  manualActions: {
    flexDirection: 'row',
    gap: 15,
    width: '100%',
    marginTop: 10,
  },
  manualCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    alignItems: 'center',
  },
  manualCancelText: { color: '#f1f5f9', fontWeight: 'bold', fontSize: 16 },
  manualSubmitBtn: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  submitGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  manualSubmitText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  actionButton: { borderRadius: 16, overflow: 'hidden', width: '80%' },
  buttonGradient: { paddingVertical: 16, alignItems: 'center' },
  actionButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  cancelLink: { marginTop: 20 },
  cancelLinkText: { color: '#94a3b8', fontSize: 15 },
});