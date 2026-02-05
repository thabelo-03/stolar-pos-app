import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import { ProductDetails } from '../../ProductDetails';
import { API_BASE_URL } from './api';

// IMPORT OFFLINE TOOLS
import * as Network from 'expo-network';
import { OfflineService } from '../services/offlineService';

export default function CartScreen() {
  const router = useRouter();
  const { barcode } = useLocalSearchParams();
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [totalUSD, setTotalUSD] = useState(0);
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [activeScanField, setActiveScanField] = useState<'search-barcode' | 'search-ocr' | null>(null);
  const cameraRef = useRef<CameraView>(null);
  const [parkedSales, setParkedSales] = useState<any[]>([]);
  const [showParkedModal, setShowParkedModal] = useState(false);
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [showRecentModal, setShowRecentModal] = useState(false);

  // MULTI-CURRENCY STATE
  const [currency, setCurrency] = useState<'USD' | 'ZAR' | 'ZiG'>('USD');
  const [rates, setRates] = useState<{ ZAR: number; ZiG: number; updatedAt?: string }>({ ZAR: 19.2, ZiG: 26.5 }); 

  // --- 1. FETCH LIVE RATES FROM DATABASE ---
  useEffect(() => {
    const fetchRates = async () => {
      try {
        const userId = await AsyncStorage.getItem('userId');
        let endpoint = `${API_BASE_URL}/shops/rates`;

        if (userId) {
          const userRes = await fetch(`${API_BASE_URL}/users/${userId}`);
          const user = await userRes.json();
          if (user.shopId) {
            endpoint = `${API_BASE_URL}/shops/rates/${user.shopId}`;
          }
        }

        const response = await fetch(endpoint); 
        if (response.ok) {
          const data = await response.json();
          if (data.rates) {
            setRates(data.rates);
          }
        }
      } catch (error) {
        console.log("Using default fallback rates due to connectivity.");
      }
    };
    fetchRates();
  }, []);

  // --- 2. FETCH PRODUCTS ---
  useEffect(() => {
    const fetchAllProducts = async () => {
      try {
        const userId = await AsyncStorage.getItem('userId');
        if (!userId) return;

        const userRes = await fetch(`${API_BASE_URL}/users/${userId}`);
        const user = await userRes.json();

        if (user.shopId) {
          const response = await fetch(`${API_BASE_URL}/products?shopId=${user.shopId}`);
          if (response.ok) {
            setAllProducts(await response.json());
          }
        }
      } catch (error) {
        console.log("Working in offline product mode.");
      }
    };
    fetchAllProducts();
  }, []);

  // Update total whenever cart changes
  useEffect(() => {
    const newTotal = cartItems.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 0)), 0);
    setTotalUSD(newTotal);
  }, [cartItems]);

  // --- 3. CONVERSION HELPERS ---
  const convert = (amountInUSD: number) => {
    if (currency === 'ZAR') return amountInUSD * rates.ZAR;
    if (currency === 'ZiG') return amountInUSD * rates.ZiG;
    return amountInUSD;
  };

  const symbol = () => {
    if (currency === 'ZAR') return 'R';
    if (currency === 'ZiG') return 'ZiG';
    return '$';
  };

  // --- 4. SEARCH & CART LOGIC ---
  const handleSearch = (text: string) => {
    setSearchQuery(text);
    if (text.trim().length > 0) {
      const filtered = allProducts.filter(p => 
        p.name.toLowerCase().includes(text.toLowerCase()) || 
        (p.barcode && p.barcode.includes(text))
      );
      setSearchResults(filtered.slice(0, 5));
    } else {
      setSearchResults([]);
    }
  };

  const startScan = async (mode: 'search-barcode' | 'search-ocr') => {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (granted) setActiveScanField(mode);
    } else {
      setActiveScanField(mode);
    }
  };

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (activeScanField === 'search-barcode') {
      handleSearch(data);
      setActiveScanField(null);
    }
  };

  const handleTakePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync();
        if (photo?.uri) {
          let uriToRecognize = photo.uri;
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
            handleSearch(result.text.trim());
          } else {
            Alert.alert("No Text", "Could not detect text.");
          }
          setActiveScanField(null);
        }
      } catch (e) { console.log(e); }
    }
  };

  const addItemToCart = (product: any) => {
    setCartItems(prevItems => {
      const existing = prevItems.find(item => item.barcode === product.barcode);
      if (existing) {
        return prevItems.map(item =>
          item.barcode === existing.barcode ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prevItems, {
        id: product._id || Date.now().toString(),
        name: product.name,
        price: Number(product.price) || 0,
        quantity: 1,
        barcode: product.barcode,
      }];
    });
    setSearchQuery('');
    setSearchResults([]);
  };

  const updateQuantity = (itemId: string, amount: number) => {
    setCartItems(curr => curr.map(i => i.id === itemId ? { ...i, quantity: i.quantity + amount } : i).filter(i => i.quantity > 0));
  };

  const removeItem = (id: string) => {
    Alert.alert(
      'Remove Item',
      'Are you sure you want to remove this item from the cart?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove', 
          style: 'destructive', 
          onPress: () => setCartItems(curr => curr.filter(item => item.id !== id)) 
        }
      ]
    );
  };

  const renderRightActions = (id: string) => {
    return (
      <TouchableOpacity style={styles.deleteAction} onPress={() => removeItem(id)}>
        <Ionicons name="trash" size={24} color="white" />
      </TouchableOpacity>
    );
  };

  const parkSale = async () => {
    if (cartItems.length === 0) return Alert.alert('Empty Cart', 'Nothing to park.');
    
    try {
      const draft = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        items: cartItems,
        total: totalUSD
      };
      
      const existing = await AsyncStorage.getItem('parked_sales');
      const parked = existing ? JSON.parse(existing) : [];
      parked.push(draft);
      
      await AsyncStorage.setItem('parked_sales', JSON.stringify(parked));
      setCartItems([]);
      Alert.alert('Success', 'Sale parked successfully.');
    } catch (e) {
      Alert.alert('Error', 'Failed to park sale.');
    }
  };

  const fetchParkedSales = async () => {
    try {
      const existing = await AsyncStorage.getItem('parked_sales');
      if (existing) {
        setParkedSales(JSON.parse(existing));
      } else {
        setParkedSales([]);
      }
      setShowParkedModal(true);
    } catch (e) {
      console.log(e);
    }
  };

  const restoreSale = async (sale: any) => {
    const confirmRestore = async () => {
      setCartItems(sale.items);
      const newParked = parkedSales.filter(s => s.id !== sale.id);
      setParkedSales(newParked);
      await AsyncStorage.setItem('parked_sales', JSON.stringify(newParked));
      setShowParkedModal(false);
    };

    if (cartItems.length > 0) {
      Alert.alert('Cart not empty', 'Restoring will overwrite current cart. Continue?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Overwrite', onPress: confirmRestore }]);
    } else {
      confirmRestore();
    }
  };

  const deleteParkedSale = async (id: string) => {
    const newParked = parkedSales.filter(s => s.id !== id);
    setParkedSales(newParked);
    await AsyncStorage.setItem('parked_sales', JSON.stringify(newParked));
  };

  const fetchRecentSales = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/sales/recent`);
      const data = await res.json();
      setRecentSales(data);
      setShowRecentModal(true);
    } catch (e) {
      Alert.alert("Error", "Could not fetch sales history");
    }
  };

  const handleRefund = async (saleId: string) => {
    Alert.alert("Confirm Refund", "Are you sure you want to refund this sale? Stock will be restored.", [
      { text: "Cancel", style: "cancel" },
      { text: "Refund", style: 'destructive', onPress: async () => {
        try {
          const res = await fetch(`${API_BASE_URL}/sales/refund/${saleId}`, { method: 'POST' });
          const data = await res.json();
          if (res.ok) {
            Alert.alert("Success", "Refund processed");
            fetchRecentSales(); // Refresh list
          } else {
            Alert.alert("Error", data.message || "Refund failed");
          }
        } catch (e) { Alert.alert("Error", "Network error"); }
      }}
    ]);
  };

  // --- 5. CHECKOUT WITH OFFLINE + CURRENCY LOGIC ---
  const handleCheckout = async () => {
    if (cartItems.length === 0) return Alert.alert('Empty Cart', 'Add items first.');

    setLoading(true);

    let shopId = null;
    try {
      const userId = await AsyncStorage.getItem('userId');
      if (userId) {
        const userRes = await fetch(`${API_BASE_URL}/users/${userId}`);
        const user = await userRes.json();
        if (user.shopId) shopId = user.shopId;
      }
    } catch(e) {
      console.log("Could not get shopId for sale record");
    }

    const saleData = {
      items: cartItems,
      total: totalUSD || 0,
      shopId: shopId,
      totalUSD: totalUSD || 0,
      totalPaidLocal: convert(totalUSD || 0),
      currencyUsed: currency,
      rateUsed: currency === 'USD' ? 1 : (rates as any)[currency],
      date: new Date().toISOString(),
      offlineId: `STLR-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    };

    try {
      const network = await Network.getNetworkStateAsync();
      if (network.isInternetReachable) {
        // VALIDATE STOCK BEFORE PROCESSING
        for (const item of cartItems) {
          try {
            const checkRes = await fetch(`${API_BASE_URL}/products/${item.id}`);
            if (checkRes.ok) {
              const product = await checkRes.json();
              const availableStock = product.stockQuantity !== undefined ? product.stockQuantity : (product.quantity || 0);
              if (availableStock < item.quantity) {
                Alert.alert('Insufficient Stock', `Only ${availableStock} units of "${item.name}" available.`);
                setLoading(false);
                return;
              }
            }
          } catch (e) {
            console.log("Error checking stock for", item.name);
          }
        }

        // DECREMENT INVENTORY
        await Promise.all(cartItems.map(async (item) => {
          try {
            const productRes = await fetch(`${API_BASE_URL}/products/${item.id}`);
            if (productRes.ok) {
              const product = await productRes.json();
              const newQuantity = (product.quantity || 0) - item.quantity;
              
              await fetch(`${API_BASE_URL}/products/${item.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  ...product,
                  quantity: newQuantity < 0 ? 0 : newQuantity
                }),
              });
            }
          } catch (err) {
            console.error("Failed to update stock for", item.name, err);
          }
        }));

        const response = await fetch(`${API_BASE_URL}/sales`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(saleData),
        });
        if (response.ok) {
          Alert.alert('Success', 'Transaction synced!');
          router.replace('/(tabs)/home');
          return;
        } else {
          let errorMessage = 'Transaction failed';
          try {
            const errorData = await response.json();
            errorMessage = errorData.message || errorMessage;
          } catch (e) {}
          Alert.alert('Error', errorMessage);
          return;
        }
      }
      throw new Error('Offline');
    } catch (error) {
      const saved = await OfflineService.saveSaleLocally(saleData);
      if (saved) {
        Alert.alert('Saved Offline', 'Connection lost. Sale stored locally and will sync later.');
        router.replace('/(tabs)/home');
      } else {
        Alert.alert('Error', 'Transaction failed and could not be saved offline.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color="#1e293b" /></TouchableOpacity>
        <Text style={styles.title}>Stolar Cart</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity onPress={fetchRecentSales} style={styles.headerIconBtn}>
              <Ionicons name="receipt-outline" size={20} color="#1e40af" />
          </TouchableOpacity>
          <TouchableOpacity onPress={fetchParkedSales} style={styles.headerIconBtn}>
              <Ionicons name="time-outline" size={20} color="#1e40af" />
          </TouchableOpacity>
          <TouchableOpacity onPress={parkSale} style={styles.headerIconBtn}>
              <Ionicons name="save-outline" size={20} color="#1e40af" />
          </TouchableOpacity>
          <View style={styles.rateBadge}>
            <Text style={styles.rateText}>Rate: {currency === 'USD' ? '1.00' : (rates as any)[currency]}</Text>
            {rates.updatedAt && (
              <Text style={styles.rateTimeText}>
                Updated: {new Date(rates.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* CURRENCY SELECTOR */}
      <View style={styles.currencySelector}>
        {(['USD', 'ZAR', 'ZiG'] as const).map((curr) => (
          <TouchableOpacity 
            key={curr} 
            onPress={() => setCurrency(curr)}
            style={[styles.currBtn, currency === curr && styles.currBtnActive]}
          >
            <Text style={[styles.currBtnText, currency === curr && styles.currBtnTextActive]}>{curr}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* SEARCH BACKDROP */}
      {searchResults.length > 0 && (
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={() => setSearchResults([])}
        />
      )}

      {/* SEARCH */}
      <View style={{ zIndex: 2000 }}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={20} color="#64748b" />
          <TextInput 
            style={styles.input} 
            placeholder="Search items..." 
            value={searchQuery}
            onChangeText={handleSearch}
          />
          <TouchableOpacity onPress={() => startScan('search-ocr')} style={{ marginLeft: 8 }}>
             <Ionicons name="scan-outline" size={20} color="#64748b" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => startScan('search-barcode')} style={{ marginLeft: 8 }}>
             <Ionicons name="barcode-outline" size={20} color="#64748b" />
          </TouchableOpacity>
        </View>
        {searchResults.length > 0 && (
          <View style={styles.dropdown}>
            {searchResults.map(p => (
              <TouchableOpacity key={p._id} style={styles.dropItem} onPress={() => setSelectedProduct(p)}>
                <View>
                  <Text style={styles.dropName}>{p.name}</Text>
                  <Text style={styles.dropSub}>{p.barcode}</Text>
                </View>
                <Text style={styles.dropPrice}>{symbol()} {convert(p.price).toFixed(2)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <Modal
        visible={!!selectedProduct}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedProduct(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity style={styles.closeModalButton} onPress={() => setSelectedProduct(null)}>
              <Ionicons name="close" size={24} color="#64748b" />
            </TouchableOpacity>
            {selectedProduct && (
              <>
                <ProductDetails product={{
                  ...selectedProduct,
                  stockQuantity: selectedProduct.quantity || 0,
                  category: selectedProduct.category || 'General'
                }} />
                <View style={styles.modalActions}>
                  <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setSelectedProduct(null)}>
                    <Text style={[styles.btnText, { color: '#64748b' }]}>Close</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalBtn, styles.editBtn]} onPress={() => {
                    const productToEdit = selectedProduct;
                    setSelectedProduct(null);
                    router.push({
                      pathname: '/(tabs)/add-stock',
                      params: {
                        mode: 'edit',
                        id: productToEdit._id,
                        name: productToEdit.name,
                        quantity: productToEdit.quantity,
                        barcode: productToEdit.barcode,
                        price: productToEdit.price,
                        costPrice: productToEdit.costPrice
                      }
                    });
                  }}>
                    <Text style={[styles.btnText, { color: 'white' }]}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalBtn, styles.confirmBtn]} onPress={() => {
                    addItemToCart(selectedProduct);
                    setSelectedProduct(null);
                  }}>
                    <Text style={[styles.btnText, { color: 'white' }]}>Add to Cart</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      <FlatList
        data={cartItems}
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingHorizontal: 20 }}
        renderItem={({ item }) => (
          <Swipeable renderRightActions={() => renderRightActions(item.id)} containerStyle={{ marginBottom: 12 }}>
            <View style={[styles.cartItem, { marginBottom: 0 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemPrice}>{symbol()} {convert(item.price).toFixed(2)} each</Text>
              </View>
              <View style={styles.qtyBox}>
                <TouchableOpacity onPress={() => updateQuantity(item.id, -1)}><Ionicons name="remove-circle" size={32} color="#cbd5e1" /></TouchableOpacity>
                <Text style={styles.qtyText}>{item.quantity}</Text>
                <TouchableOpacity onPress={() => updateQuantity(item.id, 1)}><Ionicons name="add-circle" size={32} color="#1e40af" /></TouchableOpacity>
              </View>
            </View>
          </Swipeable>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>Scan or search to add items.</Text>}
      />

      <Modal visible={!!activeScanField} animationType="slide" onRequestClose={() => setActiveScanField(null)}>
        <CameraView 
          ref={cameraRef}
          style={styles.camera} 
          facing="back" 
          onBarcodeScanned={activeScanField === 'search-barcode' ? handleBarcodeScanned : undefined}
        >
          <View style={styles.cameraOverlay}>
            <TouchableOpacity style={styles.closeButton} onPress={() => setActiveScanField(null)}>
              <Ionicons name="close" size={30} color="white" />
            </TouchableOpacity>
            <View style={[styles.scanFrame, activeScanField === 'search-ocr' && styles.textScanFrame]} />
            <Text style={styles.scanText}>{activeScanField === 'search-ocr' ? 'Align text & take photo' : 'Scanning Barcode...'}</Text>
            {activeScanField === 'search-ocr' && (
              <TouchableOpacity style={styles.shutterButton} onPress={handleTakePicture}>
                <View style={styles.shutterInner} />
              </TouchableOpacity>
            )}
          </View>
        </CameraView>
      </Modal>

      <Modal visible={showParkedModal} animationType="slide" transparent onRequestClose={() => setShowParkedModal(false)}>
        <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Parked Sales</Text>
                    <TouchableOpacity onPress={() => setShowParkedModal(false)}>
                        <Ionicons name="close" size={24} color="#64748b" />
                    </TouchableOpacity>
                </View>
                <FlatList
                    data={parkedSales}
                    keyExtractor={item => item.id}
                    ListEmptyComponent={<Text style={styles.emptyText}>No parked sales.</Text>}
                    renderItem={({ item }) => (
                        <View style={styles.parkedItem}>
                            <View style={{flex: 1}}>
                                <Text style={styles.parkedDate}>{new Date(item.date).toLocaleString()}</Text>
                                <Text style={styles.parkedDetails}>{item.items.length} items • ${item.total.toFixed(2)}</Text>
                            </View>
                            <View style={{flexDirection: 'row', gap: 10}}>
                                <TouchableOpacity onPress={() => restoreSale(item)} style={styles.restoreBtn}>
                                    <Ionicons name="refresh" size={20} color="white" />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => deleteParkedSale(item.id)} style={styles.deleteBtn}>
                                    <Ionicons name="trash" size={20} color="white" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                />
            </View>
        </View>
      </Modal>

      <Modal visible={showRecentModal} animationType="slide" transparent onRequestClose={() => setShowRecentModal(false)}>
        <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Recent Sales</Text>
                    <TouchableOpacity onPress={() => setShowRecentModal(false)}>
                        <Ionicons name="close" size={24} color="#64748b" />
                    </TouchableOpacity>
                </View>
                <FlatList
                    data={recentSales}
                    keyExtractor={item => item._id}
                    ListEmptyComponent={<Text style={styles.emptyText}>No recent sales found.</Text>}
                    renderItem={({ item }) => (
                        <View style={styles.parkedItem}>
                            <View style={{flex: 1}}>
                                <Text style={styles.parkedDate}>
                                  {new Date(item.date).toLocaleString()} 
                                  {item.refunded && <Text style={{color: '#ef4444'}}> (Refunded)</Text>}
                                </Text>
                                <Text style={styles.parkedDetails}>{item.items?.length || 0} items • ${item.totalUSD?.toFixed(2)}</Text>
                            </View>
                            {!item.refunded && (
                              <TouchableOpacity onPress={() => handleRefund(item._id)} style={[styles.deleteBtn, { backgroundColor: '#f59e0b' }]}>
                                  <Text style={{color: 'white', fontWeight: 'bold', fontSize: 12}}>Refund</Text>
                              </TouchableOpacity>
                            )}
                        </View>
                    )}
                />
            </View>
        </View>
      </Modal>

      {/* FOOTER */}
      <View style={styles.footer}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Grand Total</Text>
          <Text style={styles.totalValue}>{symbol()} {convert(totalUSD).toFixed(2)}</Text>
        </View>

        <TouchableOpacity style={styles.payBtn} onPress={handleCheckout} disabled={loading}>
          {loading ? <ActivityIndicator color="white" /> : (
            <View style={styles.payBtnContent}>
                <Text style={styles.payText}>Complete Payment</Text>
                <Ionicons name="chevron-forward" size={20} color="white" />
            </View>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, backgroundColor: 'white' },
  title: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
  rateBadge: { backgroundColor: '#eff6ff', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 20, borderWidth: 1, borderColor: '#dbeafe' },
  rateText: { fontSize: 12, color: '#1e40af', fontWeight: 'bold' },
  rateTimeText: { fontSize: 8, color: '#64748b', textAlign: 'center', marginTop: 2 },
  
  currencySelector: { flexDirection: 'row', backgroundColor: 'white', paddingBottom: 15, paddingHorizontal: 20, gap: 10 },
  currBtn: { flex: 1, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
  currBtnActive: { backgroundColor: '#1e40af', borderColor: '#1e40af' },
  currBtnText: { fontWeight: 'bold', color: '#64748b', fontSize: 13 },
  currBtnTextActive: { color: 'white' },

  searchBox: { flexDirection: 'row', alignItems: 'center', margin: 20, padding: 12, backgroundColor: 'white', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  input: { flex: 1, marginLeft: 10, fontSize: 16, color: '#1e293b' },
  dropdown: { position: 'absolute', top: 75, left: 20, right: 20, backgroundColor: 'white', borderRadius: 12, elevation: 8, zIndex: 3000, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 },
  dropItem: { padding: 15, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dropName: { fontWeight: 'bold', color: '#1e293b' },
  dropSub: { fontSize: 11, color: '#94a3b8' },
  dropPrice: { color: '#1e40af', fontWeight: 'bold' },

  cartItem: { flexDirection: 'row', backgroundColor: 'white', padding: 16, borderRadius: 15, marginBottom: 12, alignItems: 'center', borderWidth: 1, borderColor: '#f1f5f9' },
  itemName: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  itemPrice: { color: '#64748b', fontSize: 13, marginTop: 2 },
  qtyBox: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  qtyText: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', minWidth: 20, textAlign: 'center' },

  footer: { padding: 25, backgroundColor: 'white', borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  totalLabel: { fontSize: 18, color: '#64748b', fontWeight: '600' },
  totalValue: { fontSize: 26, fontWeight: '900', color: '#1e293b' },
  payBtn: { backgroundColor: '#1e40af', padding: 18, borderRadius: 15, alignItems: 'center' },
  payBtnContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  payText: { color: 'white', fontSize: 17, fontWeight: 'bold' },
  emptyText: { textAlign: 'center', marginTop: 50, color: '#94a3b8', fontSize: 15 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { 
    backgroundColor: 'white', 
    borderRadius: 16, 
    padding: 20, 
    maxHeight: '80%', 
    width: '100%', 
    maxWidth: 500,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  closeModalButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 10,
    padding: 5,
  },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  modalBtn: { flex: 1, padding: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cancelBtn: { backgroundColor: '#f1f5f9' },
  confirmBtn: { backgroundColor: '#1e40af' },
  editBtn: { backgroundColor: '#f59e0b' },
  btnText: { fontWeight: 'bold', fontSize: 16 },
  deleteAction: {
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: 15,
    marginLeft: 10,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1500,
  },
  camera: { flex: 1 },
  cameraOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  closeButton: { position: 'absolute', top: 50, right: 20, padding: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 },
  scanFrame: { width: 250, height: 250, borderWidth: 2, borderColor: 'white', backgroundColor: 'transparent', marginBottom: 20 },
  textScanFrame: { width: '80%', height: 120, borderColor: '#10b981', borderStyle: 'dashed' },
  scanText: { color: 'white', fontSize: 18, fontWeight: 'bold', marginBottom: 30 },
  shutterButton: { width: 70, height: 70, borderRadius: 35, backgroundColor: 'white', justifyContent: 'center', alignItems: 'center', position: 'absolute', bottom: 50 },
  shutterInner: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: 'black' },
  headerIconBtn: { padding: 8, backgroundColor: '#f1f5f9', borderRadius: 8 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  parkedItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  parkedDate: { fontWeight: 'bold', color: '#1e293b', marginBottom: 4 },
  parkedDetails: { color: '#64748b', fontSize: 12 },
  restoreBtn: { backgroundColor: '#10b981', padding: 8, borderRadius: 8 },
  deleteBtn: { backgroundColor: '#ef4444', padding: 8, borderRadius: 8 },
});