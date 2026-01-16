import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Button, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function ScanScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [manualEntry, setManualEntry] = useState(false);
  const [manualCode, setManualCode] = useState('');

  if (!permission) {
    // Camera permissions are still loading.
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    // Camera permissions are not granted yet.
    return (
      <View style={styles.container}>
        <Text style={styles.message}>We need your permission to show the camera</Text>
        <Button onPress={requestPermission} title="Grant Permission" />
        <Button onPress={() => router.back()} title="Cancel" />
      </View>
    );
  }

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    // Navigate to the cart screen with the scanned barcode
    router.push({
      pathname: '/(tabs)/cart',
      params: { barcode: data },
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
             <Ionicons name="close" size={30} color="white" />
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
                placeholderTextColor="#999"
                keyboardType="numeric"
                autoFocus
              />
              <View style={styles.manualActions}>
                <Button title="Cancel" onPress={() => setManualEntry(false)} color="#ef4444" />
                <Button title="Submit" onPress={handleManualSubmit} />
              </View>
            </View>
          )}
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black', justifyContent: 'center' },
  message: { textAlign: 'center', paddingBottom: 10, color: 'white' },
  camera: { flex: 1 },
  overlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.3)', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  closeButton: { 
    position: 'absolute', 
    top: 50, 
    right: 20, 
    padding: 10, 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    borderRadius: 20 
  },
  scanArea: { width: 250, height: 250, position: 'relative' },
  cornerTL: { position: 'absolute', top: 0, left: 0, width: 40, height: 40, borderTopWidth: 4, borderLeftWidth: 4, borderColor: '#10b981' },
  cornerTR: { position: 'absolute', top: 0, right: 0, width: 40, height: 40, borderTopWidth: 4, borderRightWidth: 4, borderColor: '#10b981' },
  cornerBL: { position: 'absolute', bottom: 0, left: 0, width: 40, height: 40, borderBottomWidth: 4, borderLeftWidth: 4, borderColor: '#10b981' },
  cornerBR: { position: 'absolute', bottom: 0, right: 0, width: 40, height: 40, borderBottomWidth: 4, borderRightWidth: 4, borderColor: '#10b981' },
  hintText: { 
    color: 'white', 
    marginTop: 20, 
    fontSize: 16, 
    fontWeight: '600', 
    backgroundColor: 'rgba(0,0,0,0.6)', 
    paddingHorizontal: 16, 
    paddingVertical: 8, 
    borderRadius: 8 
  },
  manualButton: {
    marginTop: 30,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
  },
  manualButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  manualContainer: {
    width: '80%',
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  manualTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  manualInput: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    marginBottom: 20,
    fontSize: 16,
  },
  manualActions: {
    flexDirection: 'row',
    gap: 20,
    justifyContent: 'center',
    width: '100%',
  },
});