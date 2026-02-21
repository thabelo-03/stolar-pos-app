import { Ionicons } from '@expo/vector-icons';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '../../components/themed-text';
import { ThemedView } from '../../components/themed-view';
import { useThemeColor } from '../../hooks/use-theme-color';
import { API_BASE_URL } from './api';
import { useActiveShop } from './use-active-shop';

export default function AddStockScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const isEditMode = params.mode === 'edit';
  const insets = useSafeAreaInsets();

  const [itemName, setItemName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [loading, setLoading] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [activeScanField, setActiveScanField] = useState<'name' | 'barcode' | null>(null);
  // Add this near your other useState hooks
const [category, setCategory] = useState('General');
  const [existingCategories, setExistingCategories] = useState<string[]>(['Groceries', 'Beverages', 'Snacks', 'Household', 'Personal Care']);
  const itemNameInputRef = useRef<TextInput>(null);
  const cameraRef = useRef<CameraView>(null);
  
  const textColor = useThemeColor({}, 'text');
  const placeholderColor = '#888';

  const { shopId, userId, loading: shopLoading } = useActiveShop();

  useEffect(() => {
    if (isEditMode) {
      setItemName(params.name as string);
      setQuantity(params.quantity ? String(params.quantity) : '');
      setBarcode(params.barcode ? String(params.barcode) : '');
      setPrice(params.price ? Number(params.price).toFixed(2) : '');
      setCostPrice(params.costPrice ? Number(params.costPrice).toFixed(2) : '');
      if (params.category) setCategory(params.category as string);
    }
  }, []);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/products`);
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data)) {
            const cats = Array.from(new Set(data.map((p: any) => p.category).filter((c: any) => c && c !== 'General')));
            setExistingCategories(prev => Array.from(new Set([...prev, ...cats])));
          }
        }
      } catch (e) {}
    };
    fetchCategories();
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

    // Validate that Item Name ends with a weight (e.g., 1kg, 500g)
    if (!/[0-9]+(\.[0-9]+)?\s*(kg|g|l|ml)$/i.test(itemName.trim())) {
      Alert.alert('Invalid Name', 'Item name must include weight/volume at the end (e.g. "Rice 2kg", "Milk 1L")');
      return;
    }

    // Normalize name: Capitalize unit and remove space between number and unit
    const finalName = itemName.trim().replace(/([0-9]+(\.[0-9]+)?)\s*(kg|g|l|ml)$/i, (match, num, decimal, unit) => {
      return `${num}${unit.toUpperCase()}`;
    });

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
          body: JSON.stringify({ name: finalName, quantity: Number(quantity), barcode, price: Number(price), costPrice: Number(costPrice), category: category, shopId, userId }),
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
    if (activeScanField === 'barcode') {
      setBarcode(data);
      setActiveScanField(null);
    }
  };

  const handleTakePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync();
        if (photo?.uri) {
          let uriToRecognize = photo.uri;

          // Crop image to the center "text box" area to improve accuracy
          if (photo.width && photo.height) {
            const cropWidth = photo.width * 0.8;
            const cropHeight = photo.height * 0.20; // Approx 20% of screen height for text
            const originX = (photo.width - cropWidth) / 2;
            const originY = (photo.height - cropHeight) / 2;

            const manipResult = await manipulateAsync(photo.uri, [{ crop: { originX, originY, width: cropWidth, height: cropHeight } }], { compress: 1, format: SaveFormat.JPEG });
            uriToRecognize = manipResult.uri;
          }

          const result = await TextRecognition.recognize(uriToRecognize);
          if (result.text) {
            setItemName(result.text.trim());
          } else {
            Alert.alert("No Text", "Could not detect text in the image.");
          }
          setActiveScanField(null);
        }
      } catch (e) { console.log(e); }
    }
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
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={[styles.header, { marginTop: 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={textColor} />
        </TouchableOpacity>
        <ThemedText type="title" style={styles.title}>{isEditMode ? 'Edit Stock' : 'Add Stock'}</ThemedText>
      </View>
      
      <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false}>
        <ThemedView>
          <ThemedText type="defaultSemiBold">Item Name</ThemedText>
          <View style={styles.barcodeRow}>
            <TextInput 
              ref={itemNameInputRef}
              style={[styles.input, { color: textColor, flex: 1 }]}
              value={itemName}
              onChangeText={setItemName}
              placeholder="e.g. Apple 1kg, Milk 1L"
              placeholderTextColor={placeholderColor}
            />
            <TouchableOpacity onPress={async () => {
              if (!permission?.granted) {
                const { granted } = await requestPermission();
                if (granted) setActiveScanField('name');
              } else {
                setActiveScanField('name');
              }
            }} style={styles.scanButton}>
              <Ionicons name="scan-outline" size={24} color={textColor} />
            </TouchableOpacity>
          </View>
          <Text style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Must include weight/volume (e.g. 1kg, 1L)</Text>
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
          {existingCategories.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesContainer}>
              {existingCategories.map((cat, index) => (
                <TouchableOpacity 
                  key={index} 
                  style={styles.categoryChip} 
                  onPress={() => setCategory(cat)}
                >
                  <Text style={styles.categoryText}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
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
                if (granted) setActiveScanField('barcode');
              } else {
                setActiveScanField('barcode');
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

        {loading || shopLoading ? (
          <ActivityIndicator size="large" color={textColor} />
        ) : (
          <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={shopLoading}>
            <Text style={styles.saveButtonText}>{isEditMode ? "Update Stock" : "Save Stock"}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <Modal visible={!!activeScanField} animationType="slide" onRequestClose={() => setActiveScanField(null)}>
        <CameraView 
          ref={cameraRef}
          style={styles.camera} 
          facing="back" 
          onBarcodeScanned={activeScanField === 'barcode' ? handleBarcodeScanned : undefined}
        >
          <View style={styles.cameraOverlay}>
            <TouchableOpacity style={styles.closeButton} onPress={() => setActiveScanField(null)}>
              <Ionicons name="close" size={30} color="white" />
            </TouchableOpacity>
            
            <View style={[styles.scanFrame, activeScanField === 'name' && styles.textScanFrame]} />
            <Text style={styles.scanText}>{activeScanField === 'name' ? 'Align text & take photo' : 'Scanning Barcode...'}</Text>
            
            {activeScanField === 'name' && (
              <TouchableOpacity style={styles.shutterButton} onPress={handleTakePicture}>
                <View style={styles.shutterInner} />
              </TouchableOpacity>
            )}
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
  categoriesContainer: { marginTop: 10, flexDirection: 'row' },
  categoryChip: { backgroundColor: '#e0f2fe', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: '#bae6fd' },
  categoryText: { color: '#0284c7', fontSize: 12, fontWeight: '600' },
  camera: { flex: 1 },
  cameraOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  closeButton: { position: 'absolute', top: 50, right: 20, padding: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 },
  scanFrame: { width: 250, height: 250, borderWidth: 2, borderColor: 'white', backgroundColor: 'transparent', marginBottom: 20 },
  textScanFrame: { width: '80%', height: 120, borderColor: '#10b981', borderStyle: 'dashed' },
  scanText: { color: 'white', fontSize: 18, fontWeight: 'bold', marginBottom: 30 },
  shutterButton: { width: 70, height: 70, borderRadius: 35, backgroundColor: 'white', justifyContent: 'center', alignItems: 'center', position: 'absolute', bottom: 50 },
  shutterInner: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: 'black' },
});