import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_BASE_URL } from '../config';

// Define a type for safety
interface Product {
  _id: string;
  name: string;
  price: number;
  stockQuantity: number;
  category?: string;
}

export default function AllProducts() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/products`);
      const data = await res.json();
      
      if (Array.isArray(data)) {
        setProducts(data);
        setFilteredProducts(data); // Initialize filtered list
      }
    } catch (e) {
      console.error("Failed to fetch products:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // Handle Search Filtering
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredProducts(products);
    } else {
      const lowerTerm = searchTerm.toLowerCase();
      const filtered = products.filter(p => 
        p.name.toLowerCase().includes(lowerTerm) || 
        (p.category && p.category.toLowerCase().includes(lowerTerm))
      );
      setFilteredProducts(filtered);
    }
  }, [searchTerm, products]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchProducts();
  }, []);

  const handleExportPDF = async () => {
    const html = `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Outfit:wght@400;600;800&display=swap" rel="stylesheet">
          <style>
            body { 
              font-family: 'Inter', -apple-system, sans-serif; 
              padding: 24px; 
              color: #1e293b;
              background-color: #ffffff;
              margin: 0;
            }
            .header-banner {
              background: linear-gradient(135deg, #0284c7 0%, #0ea5e9 100%);
              border-radius: 16px;
              padding: 24px;
              color: #ffffff;
              margin-bottom: 24px;
              box-shadow: 0 4px 12px rgba(14, 165, 233, 0.15);
            }
            .header-title {
              font-family: 'Outfit', sans-serif;
              font-size: 22px;
              font-weight: 800;
              margin: 0;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .header-subtitle {
              font-size: 13px;
              color: rgba(255, 255, 255, 0.85);
              margin-top: 6px;
              font-weight: 500;
            }
            
            .meta-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 16px;
              margin-bottom: 28px;
            }
            .meta-card {
              border: 1px solid #e2e8f0;
              border-radius: 14px;
              padding: 12px;
              background-color: #f8fafc;
              text-align: center;
            }
            .meta-label {
              font-size: 9px;
              font-weight: 700;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 4px;
            }
            .meta-value {
              font-size: 14px;
              font-weight: 800;
              color: #0f172a;
            }

            table { 
              width: 100%; 
              border-collapse: collapse; 
              font-size: 11px;
              margin-top: 20px;
            }
            th { 
              background-color: #f8fafc; 
              color: #475569; 
              font-weight: 700; 
              text-transform: uppercase;
              letter-spacing: 0.5px;
              font-size: 10px;
              border-bottom: 2px solid #cbd5e1;
              padding: 10px 8px;
              text-align: left;
            }
            td { 
              border-bottom: 1px solid #f1f5f9; 
              padding: 10px 8px; 
              color: #334155;
            }
            tr:nth-child(even) td { 
              background-color: #fafbfb; 
            }
            .price-text {
              font-weight: 600;
              color: #0f172a;
            }
            .low-stock {
              color: #ef4444;
              font-weight: 700;
            }
            
            .footer { 
              margin-top: 48px; 
              text-align: center; 
              font-size: 10px; 
              color: #94a3b8; 
              border-top: 1px solid #f1f5f9;
              padding-top: 16px;
              font-weight: 500;
            }
          </style>
        </head>
        <body>
          <div class="header-banner">
            <h1 class="header-title">System Inventory Report</h1>
            <div class="header-subtitle">Generated on ${new Date().toLocaleString()}</div>
          </div>
          
          <div class="meta-grid">
            <div class="meta-card">
              <div class="meta-label">Search Query</div>
              <div class="meta-value">${searchTerm.trim() || 'None'}</div>
            </div>
            <div class="meta-card">
              <div class="meta-label">Total Items Listed</div>
              <div class="meta-value">${filteredProducts.length}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Product Name</th>
                <th>Category</th>
                <th>Stock level</th>
                <th style="text-align: right;">Unit Price</th>
              </tr>
            </thead>
            <tbody>
              ${filteredProducts.map(item => `
                <tr>
                  <td style="font-weight: 600; color: #0f172a;">${item.name}</td>
                  <td style="color: #64748b;">${item.category || 'General'}</td>
                  <td class="${item.stockQuantity < 10 ? 'low-stock' : ''}">
                    ${item.stockQuantity === 0 ? "OUT OF STOCK" : `${item.stockQuantity} units`}
                  </td>
                  <td style="text-align: right;" class="price-text">R ${item.price.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="footer">
            Stolar POS System • Master Inventory Audit
          </div>
        </body>
      </html>
    `;
    try {
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (error) { 
      Alert.alert('Error', 'Failed to generate PDF'); 
    }
  };

  const renderProductItem = ({ item }: { item: Product }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.iconContainer}>
          <Ionicons name="cube-outline" size={22} color="#0ea5e9" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.categoryText}>{item.category || 'General'}</Text>
        </View>
        <Text style={styles.price}>R{item.price.toFixed(2)}</Text>
      </View>
      
      <View style={styles.divider} />
      
      <View style={styles.cardFooter}>
        <Text style={[
          styles.stockText, 
          item.stockQuantity < 10 && styles.lowStockText // Red if low stock
        ]}>
          {item.stockQuantity === 0 ? "Out of Stock" : `${item.stockQuantity} in stock`}
        </Text>
        <Ionicons 
          name="chevron-forward" 
          size={16} 
          color="#cbd5e1" 
        />
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Header Section */}
      <LinearGradient 
        colors={['#0284c7', '#0ea5e9', '#38bdf8']} 
        start={{ x: 0, y: 0 }} 
        end={{ x: 1, y: 1 }} 
        style={[styles.header, { paddingTop: insets.top + 15 }]}
      >
        <View style={styles.headerTopRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>System Inventory</Text>
            <Text style={styles.subtitle}>{filteredProducts.length} items registered</Text>
          </View>
          <TouchableOpacity onPress={handleExportPDF} style={styles.backButton}>
            <Ionicons name="document-text-outline" size={24} color="white" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#94a3b8" />
          <TextInput
            placeholder="Search products..."
            placeholderTextColor="#94a3b8"
            style={styles.searchInput}
            value={searchTerm}
            onChangeText={setSearchTerm}
            autoCapitalize="none"
          />
          {searchTerm.length > 0 && (
            <Ionicons 
              name="close-circle" 
              size={20} 
              color="#cbd5e1" 
              onPress={() => setSearchTerm('')} 
            />
          )}
        </View>
      </LinearGradient>

      {/* Content Section */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0ea5e9" />
        </View>
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item._id}
          renderItem={renderProductItem}
          contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0ea5e9']} tintColor="#0ea5e9" />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="basket-outline" size={64} color="#bae6fd" style={{ marginBottom: 16 }} />
              <Text style={styles.emptyText}>No products found</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f9ff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  // Header
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: "#0284c7",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: { padding: 8, backgroundColor: 'rgba(255, 255, 255, 0.2)', borderRadius: 12, marginRight: 15 },
  title: { fontSize: 22, fontWeight: 'bold', color: 'white', letterSpacing: 0.5 },
  subtitle: { fontSize: 13, color: 'rgba(255, 255, 255, 0.8)', marginTop: 2 },
  
  // Search Bar
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 50,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#0f172a',
  },

  // Product Card
  card: {
    backgroundColor: 'white',
    borderRadius: 20,
    marginBottom: 16,
    padding: 16,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  iconContainer: {
    width: 44, height: 44,
    backgroundColor: '#f0f9ff',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  productName: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  categoryText: { fontSize: 12, color: '#64748b', marginTop: 2 },
  price: { fontSize: 16, fontWeight: '800', color: '#10b981' },
  
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 12 },
  
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stockText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  lowStockText: { color: '#f43f5e' }, // Red Color for low stock

  // Empty State
  emptyState: { alignItems: 'center', marginTop: 80 },
  emptyText: { fontSize: 15, color: '#94a3b8', fontWeight: '600' },
});