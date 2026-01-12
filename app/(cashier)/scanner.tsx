import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function CashierScanner() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const router = useRouter();

  if (!permission) return <View />;
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={{ textAlign: 'center' }}>We need your permission to show the camera</Text>
        <TouchableOpacity style={styles.btn} onPress={requestPermission}>
          <Text style={{color: 'white'}}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleBarcodeScanned = ({ type, data }: any) => {
    setScanned(true);
    // Logic: In a real app, search your product list for this barcode
    Alert.alert(
      "Item Scanned", 
      `Barcode: ${data}\nAction: Add to Sale?`,
      [
        { text: "Cancel", onPress: () => setScanned(false), style: "cancel" },
        { text: "Add to Cart", onPress: () => {
            console.log("Added to cart:", data);
            setScanned(false);
          } 
        }
      ]
    );
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center' },
  btn: { backgroundColor: '#1e40af', padding: 15, borderRadius: 10, alignSelf: 'center', marginTop: 20 },
  overlay: { flex: 1, backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'center' },
  scanFrame: { width: 250, height: 250, borderWidth: 2, borderColor: '#10b981', backgroundColor: 'transparent', borderRadius: 20 },
  closeBtn: { position: 'absolute', top: 50, right: 20 },
  guideText: { color: 'white', marginTop: 20, fontSize: 16, fontWeight: 'bold', backgroundColor: 'rgba(0,0,0,0.5)', padding: 10, borderRadius: 10 }
});