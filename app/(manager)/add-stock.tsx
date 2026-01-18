import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '../../components/themed-text';
import { ThemedView } from '../../components/themed-view';
import { useThemeColor } from '../../hooks/use-theme-color';
import { API_BASE_URL } from '../config';

export default function ManagerAddStockScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const isEditMode = params.mode === 'edit';
  const shopId = params.shopId;

  const [itemName, setItemName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [loading, setLoading] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(false);
  const [category, setCategory] = useState('General');
  const itemNameInputRef = useRef<TextInput>(null);
  
  const textColor = useThemeColor({}, 'text');
  const placeholderColor = '#888';

  useEffect(() => {
    if (isEditMode) {
      setItemName(params.name as string);
      setQuantity(params.quantity ? String(params.quantity) : '');
      setBarcode(params.barcode ? String(params.barcode) : '');
      setPrice(params.price ? Number(params.price).toFixed(2) : '');
      setCostPrice(params.costPrice ? Number(params.costPrice).toFixed(2) : '');
    }
  }, [params]);

  const handleCurrencyChange = (text: string, setFunction: (value: string) => void) => {
    const cleanText = text.replace(/[^0-9]/g, '');
    if (cleanText === '') {
      setFunction('');
      return;
    }
    const numberValue = parseFloat(cleanText) / 100;
    setFunction(numberValue.toFixed(2));
  };

  const handleSave = async () => {
    if (!itemName || !quantity || !price || !costPrice) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    const numPrice = Number(price);
    const numCost = Number(costPrice);

    if (numPrice <= numCost) {
      Alert.alert('Invalid Price', 'Selling price must be greater than cost price.');
      return;
    }

    const margin = ((numPrice - numCost) / numPrice) * 100;

    const executeSave = async () => {
      setLoading(true);

      try {
        const url = isEditMode 
          ? `${API_BASE_URL}/products/${params.id}`
          : `${API_BASE_URL}/products/add`;
        
        const method = isEditMode ? 'PUT' : 'POST';

        const response = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: itemName, quantity: Number(quantity), barcode, price: Number(price), costPrice: Number(costPrice), category: category, shopId }),
        });

        const data = await response.json();

        if (response.ok) {
          if (isEditMode) {
            Alert.alert(
              'Success',
              'Stock updated successfully',
              [{ text: 'OK', onPress: () => router.back() }]
            );
          } else {
            Alert.alert('Success', 'Stock added successfully', [{ text: 'OK', onPress: () => {
              setItemName('');
              setBarcode('');
              setQuantity('');
              setPrice('');
              setCostPrice('');
              setCategory('General');
              itemNameInputRef.current?.focus();
            }}]);
          }
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

    if (margin < 5) {
      Alert.alert(
        'Low Profit Margin',
        `The profit margin is only ${margin.toFixed(1)}%. Are you sure you want to proceed?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Yes, Save', onPress: executeSave }
        ]
      );
    } else {
      executeSave();
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
      
      <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false}>
        <ThemedView>
          <ThemedText type="defaultSemiBold">Item Name</ThemedText>
          <TextInput 
            ref={itemNameInputRef}
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
          <ThemedText type="defaultSemiBold">Category</ThemedText>
          <TextInput 
            style={[styles.input, { color: textColor, borderColor: textColor }]}
            value={category}
            onChangeText={setCategory}
            placeholder="e.g. Groceries"
            placeholderTextColor={placeholderColor}
          />
        </ThemedView>

        <View style={styles.row}>
            <View style={styles.halfInput}>
                <ThemedText type="defaultSemiBold">Price</ThemedText>
                <TextInput 
                    style={[styles.input, { color: textColor, borderColor: textColor }]}
                    value={price}
                    onChangeText={(text) => handleCurrencyChange(text, setPrice)}
                    keyboardType="numeric"
                    placeholder="0.00"
                    placeholderTextColor={placeholderColor}
                />
            </View>
            <View style={styles.halfInput}>
                <ThemedText type="defaultSemiBold">Cost Price</ThemedText>
                <TextInput 
                    style={[styles.input, { color: textColor, borderColor: textColor }]}
                    value={costPrice}
                    onChangeText={(text) => handleCurrencyChange(text, setCostPrice)}
                    keyboardType="numeric"
                    placeholder="0.00"
                    placeholderTextColor={placeholderColor}
                />
            </View>
        </View>

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

        <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={loading}>
            {loading ? <ActivityIndicator color="white" /> : <Text style={styles.saveButtonText}>{isEditMode ? "Update Stock" : "Save Stock"}</Text>}
        </TouchableOpacity>
      </ScrollView>

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
  container: { flex: 1, padding: 20 },
  backButton: { marginBottom: 16 },
  form: { marginTop: 10, gap: 20, paddingBottom: 40 },
  input: { borderWidth: 1, padding: 12, borderRadius: 8, marginTop: 8, opacity: 0.8 },
  barcodeRow: { flexDirection: 'row', gap: 10 },
  camera: { flex: 1 },
  cameraOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  closeButton: { position: 'absolute', top: 50, right: 20, padding: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 },
  scanFrame: { width: 250, height: 250, borderWidth: 2, borderColor: 'white', backgroundColor: 'transparent' },
  scanText: { color: 'white', marginTop: 20, fontSize: 18, fontWeight: 'bold' },
  row: { flexDirection: 'row', gap: 15 },
  halfInput: { flex: 1 },
  saveButton: { backgroundColor: '#1e40af', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 20, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5, elevation: 3 },
  saveButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
});
