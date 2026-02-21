import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { useThemeColor } from '../../hooks/use-theme-color';
import { API_BASE_URL } from '../config';

export default function ManagerAddStockScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams();
  const isEditMode = params.mode === 'edit';
  const rawShopId = params.shopId;
  const shopId = Array.isArray(rawShopId) ? rawShopId[0] : rawShopId;

  const [itemName, setItemName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [loading, setLoading] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [activeScanField, setActiveScanField] = useState<'name' | 'barcode' | null>(null);
  const [category, setCategory] = useState('General');
  const [existingCategories, setExistingCategories] = useState<string[]>(['Groceries', 'Beverages', 'Snacks', 'Household', 'Personal Care']);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const itemNameInputRef = useRef<TextInput>(null);
  const cameraRef = useRef<CameraView>(null);
  
  const [currency, setCurrency] = useState<'USD' | 'ZAR' | 'ZiG'>('USD');
  const [rates, setRates] = useState({ ZAR: 19.2, ZiG: 26.5 });
  const prevCurrency = useRef<'USD' | 'ZAR' | 'ZiG'>('USD');
  const textColor = useThemeColor({}, 'text');
  const placeholderColor = '#888';

  useEffect(() => {
    const loadUser = async () => {
      const id = await AsyncStorage.getItem('userId');
      if (id) setCurrentUserId(id);
    };
    loadUser();

    if (isEditMode) {
      setItemName(params.name as string || '');
      setQuantity(params.quantity ? String(params.quantity) : '');
      setBarcode(params.barcode ? String(params.barcode) : '');
      setPrice(params.price ? Number(params.price).toFixed(2) : '');
      setCostPrice(params.costPrice ? Number(params.costPrice).toFixed(2) : '');
      if (params.category) setCategory(params.category as string);
    } else {
      setItemName('');
      setBarcode('');
      setQuantity('');
      setPrice('');
      setCostPrice('');
      setCategory('General');
    }
    setHasUnsavedChanges(false);
  }, [params.mode, params.id, params.name, params.quantity, params.barcode, params.price, params.costPrice, params.category]);

  useEffect(() => {
    if (shopId) {
      fetch(`${API_BASE_URL}/shops/rates/${shopId}`)
        .then(res => res.json())
        .then(data => {
          if (data.rates) setRates(data.rates);
        })
        .catch(e => console.log("Rates fetch error", e));
    }
  }, [shopId]);

  useEffect(() => {
    if (currency !== prevCurrency.current) {
      const convertVal = (valStr: string) => {
        const val = parseFloat(valStr);
        if (isNaN(val)) return '';
        
        const zarRate = rates?.ZAR || 1;
        const zigRate = rates?.ZiG || 1;

        let usdVal = val;
        if (prevCurrency.current === 'ZAR') usdVal = val / zarRate;
        else if (prevCurrency.current === 'ZiG') usdVal = val / zigRate;
        
        let newVal = usdVal;
        if (currency === 'ZAR') newVal = usdVal * zarRate;
        else if (currency === 'ZiG') newVal = usdVal * zigRate;
        
        return newVal.toFixed(2);
      };
      setPrice(p => convertVal(p));
      setCostPrice(c => convertVal(c));
      prevCurrency.current = currency;
    }
  }, [currency, rates]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (!hasUnsavedChanges) {
        return;
      }

      e.preventDefault();

      Alert.alert(
        'Discard changes?',
        'You have unsaved changes. Are you sure you want to discard them?',
        [
          { text: "Stay", style: 'cancel', onPress: () => {} },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => navigation.dispatch(e.data.action),
          },
        ]
      );
    });

    return unsubscribe;
  }, [navigation, hasUnsavedChanges]);

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

  const handleCurrencyChange = (text: string, setFunction: (value: string) => void) => {
    setHasUnsavedChanges(true);
    const cleanText = text.replace(/[^0-9]/g, '');
    if (cleanText === '') {
      setFunction('');
      return;
    }
    const numberValue = parseFloat(cleanText) / 100;
    setFunction(numberValue.toFixed(2));
  };

  const calculateMargin = () => {
    const p = parseFloat(price) || 0;
    const c = parseFloat(costPrice) || 0;
    if (p === 0) return 0;
    return ((p - c) / p) * 100;
  };

  const handleLogout = async () => {
    setHasUnsavedChanges(false);
    await AsyncStorage.clear();
    router.replace('/(auth)/login');
  };

  const handleSave = async () => {
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

    let numPrice = Number(price);
    let numCost = Number(costPrice);

    if (currency === 'ZAR') {
      numPrice /= (rates.ZAR || 1);
      numCost /= (rates.ZAR || 1);
    } else if (currency === 'ZiG') {
      numPrice /= (rates.ZiG || 1);
      numCost /= (rates.ZiG || 1);
    }

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
        
        // Prepare safe payload
        const payload = {
          name: finalName,
          quantity: Number(quantity) || 0,
          barcode,
          price: numPrice || 0,
          costPrice: numCost || 0,
          category: category,
          shopId,
          userId: currentUserId
        };

        const response = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (response.ok) {
          setHasUnsavedChanges(false);
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
      setHasUnsavedChanges(true);
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
            const cropHeight = photo.height * 0.20;
            const originX = (photo.width - cropWidth) / 2;
            const originY = (photo.height - cropHeight) / 2;

            const manipResult = await manipulateAsync(photo.uri, [{ crop: { originX, originY, width: cropWidth, height: cropHeight } }], { compress: 1, format: SaveFormat.JPEG });
            uriToRecognize = manipResult.uri;
          }

          const result = await TextRecognition.recognize(uriToRecognize);
          if (result.text) {
            setItemName(result.text.trim());
            setHasUnsavedChanges(true);
          } else {
            Alert.alert("No Text", "Could not detect text in the image.");
          }
          setActiveScanField(null);
        }
      } catch (e) { console.log(e); }
    }
  };

  return (
    <View style={[styles.container]}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.title}>{isEditMode ? 'Edit Stock' : 'Add Stock'}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color="white" />
        </TouchableOpacity>
      </View>
      
      <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false}>
        <View>
          <Text style={styles.label}>Item Name</Text>
          <View style={styles.inputContainer}>
            <TextInput 
              ref={itemNameInputRef}
              style={styles.input}
              value={itemName}
              onChangeText={(text) => { setItemName(text); setHasUnsavedChanges(true); }}
              placeholder="e.g. Apple"
              placeholderTextColor={placeholderColor}
            />
            <Text style={{ fontSize: 11, color: '#64748b', position: 'absolute', bottom: -18, left: 5 }}>Must include weight/volume (e.g. 1kg, 1L)</Text>
            <TouchableOpacity onPress={async () => {
              if (!permission?.granted) {
                const { granted } = await requestPermission();
                if (granted) setActiveScanField('name');
              } else {
                setActiveScanField('name');
              }
            }} style={styles.iconButton}>
              <Ionicons name="scan-outline" size={24} color="#1e40af" />
            </TouchableOpacity>
          </View>
        </View>

        <View>
          <Text style={styles.label}>Barcode</Text>
          <View style={styles.inputContainer}>
            <TextInput 
              style={styles.input}
              value={barcode}
              onChangeText={(text) => { setBarcode(text); setHasUnsavedChanges(true); }}
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
            }} style={styles.iconButton}>
              <Ionicons name="barcode-outline" size={24} color="#1e40af" />
            </TouchableOpacity>
          </View>
        </View>

        <View>
          <Text style={styles.label}>Category</Text>
          <TextInput 
            style={styles.input}
            value={category}
            onChangeText={(text) => { setCategory(text); setHasUnsavedChanges(true); }}
            placeholder="e.g. Groceries"
            placeholderTextColor={placeholderColor}
          />
          {existingCategories.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesContainer}>
              {existingCategories.map((cat, index) => (
                <TouchableOpacity 
                  key={index} 
                  style={styles.categoryChip} 
                  onPress={() => { setCategory(cat); setHasUnsavedChanges(true); }}
                >
                  <Text style={styles.categoryText}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        <View style={styles.currencyRow}>
          <Text style={styles.label}>Currency</Text>
          <View style={styles.currencyToggle}>
            {(['USD', 'ZAR', 'ZiG'] as const).map((curr) => (
              <TouchableOpacity key={curr} style={[styles.currBtn, currency === curr && styles.currBtnActive]} onPress={() => setCurrency(curr)}>
                <Text style={[styles.currText, currency === curr && styles.currTextActive]}>{curr}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.row}>
            <View style={styles.halfInput}>
                <Text style={styles.label}>Price</Text>
                <TextInput 
                    style={styles.input}
                    value={price}
                    onChangeText={(text) => handleCurrencyChange(text, setPrice)}
                    keyboardType="numeric"
                    placeholder="0.00"
                    placeholderTextColor={placeholderColor}
                />
            </View>
            <View style={styles.halfInput}>
                <Text style={styles.label}>Cost Price</Text>
                <TextInput 
                    style={styles.input}
                    value={costPrice}
                    onChangeText={(text) => handleCurrencyChange(text, setCostPrice)}
                    keyboardType="numeric"
                    placeholder="0.00"
                    placeholderTextColor={placeholderColor}
                />
            </View>
        </View>

        <View style={styles.marginContainer}>
          <Text style={styles.marginLabel}>Profit Margin:</Text>
          <Text style={[styles.marginValue, { color: calculateMargin() >= 20 ? '#10b981' : calculateMargin() > 0 ? '#f59e0b' : '#ef4444' }]}>
            {calculateMargin().toFixed(1)}%
          </Text>
        </View>

        <View>
          <Text style={styles.label}>Quantity</Text>
          <TextInput 
            style={styles.input}
            value={quantity}
            onChangeText={(text) => { setQuantity(text); setHasUnsavedChanges(true); }}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={placeholderColor}
          />
        </View>

        <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={loading}>
            {loading ? <ActivityIndicator color="white" /> : <Text style={styles.saveButtonText}>{isEditMode ? "Update Stock" : "Save Stock"}</Text>}
        </TouchableOpacity>
      </ScrollView>
      </KeyboardAvoidingView>

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    backgroundColor: '#1e3a8a',
    padding: 25,
    paddingTop: 60,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  backButton: { marginRight: 15 },
  title: {
    color: 'white',
    fontSize: 22,
    fontWeight: 'bold',
  },
  form: { padding: 20, gap: 20, paddingBottom: 120 },
  label: {
    fontSize: 16,
    color: '#1e3a8a',
    marginBottom: 10,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  input: {
    flex: 1,
    padding: 15,
    fontSize: 16,
  },
  iconButton: {
    padding: 15,
  },
  row: { flexDirection: 'row', gap: 15 },
  halfInput: { flex: 1 },
  saveButton: { backgroundColor: '#10b981', padding: 20, borderRadius: 15, alignItems: 'center', marginTop: 20 },
  saveButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  categoriesContainer: { marginTop: 10, flexDirection: 'row' },
  categoryChip: { backgroundColor: '#e0f2fe', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: '#bae6fd' },
  categoryText: { color: '#0284c7', fontSize: 12, fontWeight: '600' },
  
  // Camera Modal Styles
  camera: { flex: 1 },
  cameraOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  closeButton: { position: 'absolute', top: 50, right: 20, padding: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 },
  scanFrame: { width: 280, height: 180, borderWidth: 2, borderColor: 'white', backgroundColor: 'transparent', borderRadius: 15, marginBottom: 20 },
  textScanFrame: { height: 100, borderStyle: 'dashed' },
  scanText: { color: 'white', fontSize: 18, fontWeight: 'bold', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 10 },
  shutterButton: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', position: 'absolute', bottom: 50 },
  shutterInner: { width: 60, height: 60, borderRadius: 30, borderWidth: 3, borderColor: '#1e3a8a' },
  currencyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  currencyToggle: { flexDirection: 'row', backgroundColor: '#e2e8f0', borderRadius: 8, padding: 2 },
  currBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  currBtnActive: { backgroundColor: 'white', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 2, elevation: 1 },
  currText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  currTextActive: { color: '#1e40af' },
  marginContainer: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 5, marginBottom: 10 },
  marginLabel: { fontSize: 14, color: '#64748b', marginRight: 5 },
  marginValue: { fontSize: 16, fontWeight: 'bold' },
});
