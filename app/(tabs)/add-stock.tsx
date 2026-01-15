import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Button, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '../../components/themed-text';
import { ThemedView } from '../../components/themed-view';
import { useThemeColor } from '../../hooks/use-theme-color';
import { API_BASE_URL } from './api';

export default function AddStockScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const isEditMode = params.mode === 'edit';

  const [itemName, setItemName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [loading, setLoading] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(false);
  
  const textColor = useThemeColor({}, 'text');
  const placeholderColor = '#888';

  useEffect(() => {
    if (isEditMode) {
      setItemName(params.name as string);
      setQuantity(params.quantity ? String(params.quantity) : '');
      setBarcode(params.barcode ? String(params.barcode) : '');
      setPrice(params.price ? String(params.price) : '');
      setCostPrice(params.costPrice ? String(params.costPrice) : '');
    }
  }, [params]);

  const handleSave = async () => {
    if (!itemName || !quantity || !price || !costPrice) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);

    if (barcode) {
      try {
        const checkResponse = await fetch(`${API_BASE_URL}/inventory`);
        const inventory = await checkResponse.json();
        if (Array.isArray(inventory)) {
          const duplicate = inventory.find((item: any) => 
            item.barcode === barcode && (!isEditMode || (item._id || item.id) !== params.id)
          );
          if (duplicate) {
            Alert.alert('Duplicate Barcode', `This barcode is already assigned to "${duplicate.name}".`);
            setLoading(false);
            return;
          }
        }
      } catch (e) {}
    }

    try {
      const url = isEditMode 
        ? `${API_BASE_URL}/inventory/${params.id}`
        : `${API_BASE_URL}/inventory`;
      
      const method = isEditMode ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: itemName, quantity: Number(quantity), barcode, price: Number(price), costPrice: Number(costPrice) }),
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert('Success', isEditMode ? 'Stock updated successfully' : 'Stock added successfully');
        router.back();
      } else if (response.status === 409) {
        Alert.alert('Duplicate Item', 'An item with this name already exists.');
      } else {
        Alert.alert('Error', data.message || 'Failed to add stock');
      }
    } catch (error) {
      Alert.alert('Network Error', 'Could not connect to server');
    } finally {
      setLoading(false);
    }
  };

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    setBarcode(data);
    setIsScanning(false);
  };

  return (
    <ThemedView style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="arrow-back" size={24} color={textColor} />
      </TouchableOpacity>
      <ThemedText type="title">{isEditMode ? 'Edit Stock' : 'Add Stock'}</ThemedText>
      
      <ThemedView style={styles.form}>
        <ThemedView>
          <ThemedText type="defaultSemiBold">Item Name</ThemedText>
          <TextInput 
            style={[styles.input, { color: textColor, borderColor: textColor }]}
            value={itemName}
            onChangeText={setItemName}
            placeholder="e.g. Apple"
            placeholderTextColor={placeholderColor}
          />
        </ThemedView>

        <ThemedView>
          <ThemedText type="defaultSemiBold">Barcode</ThemedText>
          <View style={styles.barcodeRow}>
            <TextInput 
              style={[styles.input, { color: textColor, borderColor: textColor, flex: 1 }]}
              value={barcode}
              onChangeText={setBarcode}
              placeholder="Scan or enter barcode"
              placeholderTextColor={placeholderColor}
              keyboardType="numeric"
            />
            <TouchableOpacity onPress={async () => {
              if (!permission?.granted) {
                const { granted } = await requestPermission();
                if (granted) setIsScanning(true);
              } else {
                setIsScanning(true);
              }
            }} style={[styles.input, { borderColor: textColor, justifyContent: 'center', alignItems: 'center', width: 50 }]}>
              <Ionicons name="barcode-outline" size={24} color={textColor} />
            </TouchableOpacity>
          </View>
        </ThemedView>

        <ThemedView>
          <ThemedText type="defaultSemiBold">Price</ThemedText>
          <TextInput 
            style={[styles.input, { color: textColor, borderColor: textColor }]}
            value={price}
            onChangeText={setPrice}
            keyboardType="numeric"
            placeholder="0.00"
            placeholderTextColor={placeholderColor}
          />
        </ThemedView>

        <ThemedView>
          <ThemedText type="defaultSemiBold">Cost Price</ThemedText>
          <TextInput 
            style={[styles.input, { color: textColor, borderColor: textColor }]}
            value={costPrice}
            onChangeText={setCostPrice}
            keyboardType="numeric"
            placeholder="0.00"
            placeholderTextColor={placeholderColor}
          />
        </ThemedView>

        <ThemedView>
          <ThemedText type="defaultSemiBold">Quantity</ThemedText>
          <TextInput 
            style={[styles.input, { color: textColor, borderColor: textColor }]}
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={placeholderColor}
          />
        </ThemedView>

        {loading ? (
          <ActivityIndicator size="large" color={textColor} />
        ) : (
          <Button title={isEditMode ? "Update Stock" : "Save Stock"} onPress={handleSave} />
        )}
      </ThemedView>

      <Modal visible={isScanning} animationType="slide" onRequestClose={() => setIsScanning(false)}>
        <CameraView style={styles.camera} facing="back" onBarcodeScanned={handleBarcodeScanned}>
          <View style={styles.cameraOverlay}>
            <TouchableOpacity style={styles.closeButton} onPress={() => setIsScanning(false)}>
              <Ionicons name="close" size={30} color="white" />
            </TouchableOpacity>
            <View style={styles.scanFrame} />
            <Text style={styles.scanText}>Scanning...</Text>
          </View>
        </CameraView>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  backButton: {
    marginBottom: 16,
  },
  form: {
    marginTop: 24,
    gap: 20,
  },
  input: {
    borderWidth: 1,
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    opacity: 0.8,
  },
  barcodeRow: { flexDirection: 'row', gap: 10 },
  camera: { flex: 1 },
  cameraOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  closeButton: { position: 'absolute', top: 50, right: 20, padding: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 },
  scanFrame: { width: 250, height: 250, borderWidth: 2, borderColor: 'white', backgroundColor: 'transparent' },
  scanText: { color: 'white', marginTop: 20, fontSize: 18, fontWeight: 'bold' },
});