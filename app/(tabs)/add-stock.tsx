import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

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
  // Add this near your other useState hooks
const [category, setCategory] = useState('General');
  const [shopId, setShopId] = useState<string | null>(null);
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

  useEffect(() => {
    const fetchUserShop = async () => {
      try {
        const userId = await AsyncStorage.getItem('userId');
        if (userId) {
          const response = await fetch(`${API_BASE_URL}/users/${userId}`);
          const userData = await response.json();
          if (userData.shopId) setShopId(userData.shopId);
        }
      } catch (e) { console.log("Error fetching shop ID", e); }
    };
    fetchUserShop();
  }, []);

  const handleSave = async () => {
    if (!shopId) {
      Alert.alert('Restricted', 'You must be linked to a shop to manage inventory.');
      return;
    }

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

      if (barcode) {
        try {
          const checkResponse = await fetch(`${API_BASE_URL}/products`);
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

  const handleCurrencyChange = (text: string, setFunction: (value: string) => void) => {
    const cleanText = text.replace(/[^0-9]/g, '');
    if (cleanText === '') {
      setFunction('');
      return;
    }
    const numberValue = parseFloat(cleanText) / 100;
    setFunction(numberValue.toFixed(2));
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={textColor} />
        </TouchableOpacity>
        <ThemedText type="title" style={styles.title}>{isEditMode ? 'Edit Stock' : 'Add Stock'}</ThemedText>
      </View>
      
      <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false}>
        <ThemedView>
          <ThemedText type="defaultSemiBold">Item Name</ThemedText>
          <TextInput 
            ref={itemNameInputRef}
            style={[styles.input, { color: textColor }]}
            value={itemName}
            onChangeText={setItemName}
            placeholder="e.g. Apple"
            placeholderTextColor={placeholderColor}
          />
        </ThemedView>

        <ThemedView>
          <ThemedText type="defaultSemiBold">Category</ThemedText>
          <TextInput 
            style={[styles.input, { color: textColor }]}
            value={category}
            onChangeText={setCategory}
            placeholder="e.g. Groceries"
            placeholderTextColor={placeholderColor}
          />
        </ThemedView>

        <ThemedView>
          <ThemedText type="defaultSemiBold">Barcode</ThemedText>
          <View style={styles.barcodeRow}>
            <TextInput 
              style={[styles.input, { color: textColor, flex: 1 }]}
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
            }} style={styles.scanButton}>
              <Ionicons name="barcode-outline" size={24} color={textColor} />
            </TouchableOpacity>
          </View>
        </ThemedView>

        <View style={styles.row}>
          <View style={styles.halfInput}>
            <ThemedText type="defaultSemiBold">Price</ThemedText>
            <TextInput 
              style={[styles.input, { color: textColor }]}
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
              style={[styles.input, { color: textColor }]}
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
            style={[styles.input, { color: textColor }]}
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
          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>{isEditMode ? "Update Stock" : "Save Stock"}</Text>
          </TouchableOpacity>
        )}
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
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    padding: 8,
    marginRight: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  form: {
    gap: 20,
    paddingBottom: 40,
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: 'rgba(150, 150, 150, 0.08)',
    padding: 15,
    borderRadius: 12,
    marginTop: 8,
    fontSize: 16,
  },
  barcodeRow: { flexDirection: 'row', gap: 10 },
  scanButton: {
    backgroundColor: 'rgba(150, 150, 150, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    width: 54,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  row: { flexDirection: 'row', gap: 15 },
  halfInput: { flex: 1 },
  saveButton: {
    backgroundColor: '#1e40af',
    paddingVertical: 18,
    borderRadius: 15,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  camera: { flex: 1 },
  cameraOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  closeButton: { position: 'absolute', top: 50, right: 20, padding: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 },
  scanFrame: { width: 250, height: 250, borderWidth: 2, borderColor: 'white', backgroundColor: 'transparent' },
  scanText: { color: 'white', marginTop: 20, fontSize: 18, fontWeight: 'bold' },
});