import { Ionicons } from '@expo/vector-icons';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { API_BASE_URL } from './api';
import { useActiveShop } from './use-active-shop';
import { useRates } from './use-rates';

export default function AddStockScreen() {
  const router = useRouter();
  const navigation = useNavigation();
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
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [activeScanField, setActiveScanField] = useState<'name' | 'barcode' | null>(null);
  // Add this near your other useState hooks
const [category, setCategory] = useState('General');
  const [existingCategories, setExistingCategories] = useState<string[]>(['Groceries', 'Beverages', 'Snacks', 'Household', 'Personal Care']);
  const itemNameInputRef = useRef<TextInput>(null);
  const cameraRef = useRef<CameraView>(null);
  
  const placeholderColor = '#94a3b8';

  const { shopId, userId, loading: shopLoading } = useActiveShop();
  const { rates } = useRates();
  const [currency, setCurrency] = useState<'USD' | 'ZAR' | 'ZiG'>('USD');
  const prevCurrency = useRef<'USD' | 'ZAR' | 'ZiG'>('USD');

  useEffect(() => {
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

  const handleSave = async (clearAndStay = false) => {
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
          body: JSON.stringify({ name: finalName, quantity: Number(quantity), barcode, price: numPrice, costPrice: numCost, category: category, shopId, userId }),
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
            if (clearAndStay) {
              Alert.alert('Success', 'Stock added successfully', [{ text: 'OK', onPress: () => {
                setItemName('');
                setBarcode('');
                setQuantity('');
                setPrice('');
                setCostPrice('');
                setCategory('General');
                itemNameInputRef.current?.focus();
              }}]);
            } else {
              Alert.alert('Success', 'Stock added successfully', [{ text: 'OK', onPress: () => router.back() }]);
            }
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
            const cropHeight = photo.height * 0.20; // Approx 20% of screen height for text
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

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEditMode ? 'Edit Stock' : 'Add New Stock'}</Text>
        <View style={{ width: 40 }} />
      </View>
      
      <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false}>
        
        {/* Card 1: Basic Info */}
        <View style={styles.card}>
            <Text style={styles.cardTitle}>Product Details</Text>
            
            <View style={styles.inputGroup}>
                <Text style={styles.label}>Item Name</Text>
                <View style={styles.inputWrapper}>
                    <Ionicons name="cube-outline" size={20} color="#64748b" style={styles.inputIcon} />
                    <TextInput 
                        ref={itemNameInputRef}
                        style={styles.input}
                        value={itemName}
                        onChangeText={(text) => { setItemName(text); setHasUnsavedChanges(true); }}
                        placeholder="e.g. Apple 1kg"
                        placeholderTextColor={placeholderColor}
                    />
                    <TouchableOpacity onPress={async () => {
                        if (!permission?.granted) {
                            const { granted } = await requestPermission();
                            if (granted) setActiveScanField('name');
                        } else {
                            setActiveScanField('name');
                        }
                    }} style={styles.scanIconBtn}>
                        <Ionicons name="scan-outline" size={20} color="#1e40af" />
                    </TouchableOpacity>
                </View>
                <Text style={styles.helperText}>Must include weight/volume (e.g. 1kg, 1L)</Text>
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>Category</Text>
                <View style={styles.inputWrapper}>
                    <Ionicons name="grid-outline" size={20} color="#64748b" style={styles.inputIcon} />
                    <TextInput 
                        style={styles.input}
                        value={category}
                        onChangeText={(text) => { setCategory(text); setHasUnsavedChanges(true); }}
                        placeholder="e.g. Groceries"
                        placeholderTextColor={placeholderColor}
                    />
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                    {existingCategories.map((cat, index) => (
                        <TouchableOpacity 
                            key={index} 
                            style={[styles.chip, category === cat && styles.activeChip]} 
                            onPress={() => { setCategory(cat); setHasUnsavedChanges(true); }}
                        >
                            <Text style={[styles.chipText, category === cat && styles.activeChipText]}>{cat}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>Barcode</Text>
                <View style={styles.inputWrapper}>
                    <Ionicons name="barcode-outline" size={20} color="#64748b" style={styles.inputIcon} />
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
                    }} style={styles.scanIconBtn}>
                        <Ionicons name="camera-outline" size={20} color="#1e40af" />
                    </TouchableOpacity>
                </View>
            </View>
        </View>

        {/* Card 2: Pricing & Stock */}
        <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>Pricing & Stock</Text>
                <View style={styles.currencyToggle}>
                    {(['USD', 'ZAR', 'ZiG'] as const).map((curr) => (
                    <TouchableOpacity key={curr} style={[styles.currBtn, currency === curr && styles.currBtnActive]} onPress={() => setCurrency(curr)}>
                        <Text style={[styles.currText, currency === curr && styles.currTextActive]}>{curr}</Text>
                    </TouchableOpacity>
                    ))}
                </View>
            </View>

            <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.label}>Selling Price</Text>
                    <View style={styles.inputWrapper}>
                        <Text style={styles.currencySymbol}>{currency === 'USD' ? '$' : currency === 'ZAR' ? 'R' : 'Z'}</Text>
                        <TextInput 
                            style={styles.input}
                            value={price}
                            onChangeText={(text) => handleCurrencyChange(text, setPrice)}
                            keyboardType="numeric"
                            placeholder="0.00"
                            placeholderTextColor={placeholderColor}
                        />
                    </View>
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.label}>Cost Price</Text>
                    <View style={styles.inputWrapper}>
                        <Text style={styles.currencySymbol}>{currency === 'USD' ? '$' : currency === 'ZAR' ? 'R' : 'Z'}</Text>
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
            </View>

            <View style={styles.marginContainer}>
                <Text style={styles.marginLabel}>Profit Margin</Text>
                <View style={[styles.marginBadge, { backgroundColor: calculateMargin() >= 20 ? '#dcfce7' : calculateMargin() > 0 ? '#fef3c7' : '#fee2e2' }]}>
                    <Text style={[styles.marginValue, { color: calculateMargin() >= 20 ? '#16a34a' : calculateMargin() > 0 ? '#d97706' : '#dc2626' }]}>
                        {calculateMargin().toFixed(1)}%
                    </Text>
                </View>
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>Quantity</Text>
                <View style={styles.inputWrapper}>
                    <Ionicons name="layers-outline" size={20} color="#64748b" style={styles.inputIcon} />
                    <TextInput 
                        style={styles.input}
                        value={quantity}
                        onChangeText={(text) => { setQuantity(text); setHasUnsavedChanges(true); }}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={placeholderColor}
                    />
                </View>
            </View>
        </View>

        {loading || shopLoading ? (
          <ActivityIndicator size="large" color="#1e40af" style={{ marginTop: 20 }} />
        ) : (
          <View style={styles.actionContainer}>
            {!isEditMode && (
              <TouchableOpacity style={styles.secondaryButton} onPress={() => handleSave(true)} disabled={shopLoading}>
                <Ionicons name="duplicate-outline" size={20} color="#1e40af" style={{ marginRight: 8 }} />
                <Text style={styles.secondaryButtonText}>Save & Add Another</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.primaryButton} onPress={() => handleSave(false)} disabled={shopLoading}>
              <Ionicons name="checkmark-circle-outline" size={20} color="white" style={{ marginRight: 8 }} />
              <Text style={styles.primaryButtonText}>{isEditMode ? "Update Item" : "Save Item"}</Text>
            </TouchableOpacity>
          </View>
        )}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 15,
    backgroundColor: '#f8fafc',
  },
  backButton: { padding: 8, backgroundColor: 'white', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
  
  form: { padding: 20, gap: 20, paddingBottom: 120 },
  
  card: { backgroundColor: 'white', borderRadius: 20, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginBottom: 20 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },

  inputGroup: { marginBottom: 15 },
  label: { fontSize: 14, fontWeight: '600', color: '#64748b', marginBottom: 8 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', height: 50 },
  inputIcon: { marginLeft: 15, marginRight: 10 },
  input: { flex: 1, fontSize: 16, color: '#1e293b', height: '100%' },
  helperText: { fontSize: 12, color: '#94a3b8', marginTop: 5, marginLeft: 5 },
  scanIconBtn: { padding: 10, borderLeftWidth: 1, borderLeftColor: '#e2e8f0' },
  
  chipScroll: { marginTop: 10, flexDirection: 'row' },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f1f5f9', marginRight: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  activeChip: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },
  chipText: { color: '#64748b', fontSize: 13, fontWeight: '600' },
  activeChipText: { color: '#1e40af' },

  currencyToggle: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 10, padding: 3 },
  currBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  currBtnActive: { backgroundColor: 'white', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 2, elevation: 1 },
  currText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  currTextActive: { color: '#1e40af' },
  currencySymbol: { fontSize: 18, fontWeight: 'bold', color: '#64748b', marginLeft: 15, marginRight: 5 },

  row: { flexDirection: 'row', gap: 15 },
  
  marginContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 5, marginBottom: 15, backgroundColor: '#f8fafc', padding: 12, borderRadius: 12 },
  marginLabel: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  marginBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  marginValue: { fontSize: 14, fontWeight: 'bold' },

  actionContainer: { gap: 12, marginTop: 10 },
  primaryButton: {
    backgroundColor: '#1e40af',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: '#e0f2fe',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  secondaryButtonText: {
    color: '#1e40af',
    fontSize: 16,
    fontWeight: 'bold',
  },

  camera: { flex: 1 },
  cameraOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  closeButton: { position: 'absolute', top: 50, right: 20, padding: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 },
  scanFrame: { width: 250, height: 250, borderWidth: 2, borderColor: 'white', backgroundColor: 'transparent', marginBottom: 20 },
  textScanFrame: { width: '80%', height: 120, borderColor: '#10b981', borderStyle: 'dashed' },
  scanText: { color: 'white', fontSize: 18, fontWeight: 'bold', marginBottom: 30 },
  shutterButton: { width: 70, height: 70, borderRadius: 35, backgroundColor: 'white', justifyContent: 'center', alignItems: 'center', position: 'absolute', bottom: 50 },
  shutterInner: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: 'black' },
});