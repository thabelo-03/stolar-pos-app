import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';

const API_BASE_URL = 'http://your-api-url'; // Replace with your actual API base URL

// Define a type for safety
interface Product {
  _id: string;
  name: string;
  price: number;
  stockQuantity: number;
  category?: string;
}

export default function AllProducts() {
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

  const renderProductItem = ({ item }: { item: Product }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.iconContainer}>
          <Ionicons name="cube-outline" size={24} color="#3b82f6" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.categoryText}>{item.category || 'General'}</Text>
        </View>
        <Text style={styles.price}>${item.price.toFixed(2)}</Text>
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
      <View style={styles.header}>
        <Text style={styles.title}>Inventory</Text>
        <Text style={styles.subtitle}>{filteredProducts.length} items available</Text>
        
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
      </View>

      {/* Content Section */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1e3a8a" />
        </View>
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item._id}
          renderItem={renderProductItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1e3a8a']} />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="basket-outline" size={64} color="#cbd5e1" />
              <Text style={styles.emptyText}>No products found</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  // Header
  header: {
    backgroundColor: '#1e3a8a',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  title: { fontSize: 28, fontWeight: '800', color: 'white' },
  subtitle: { fontSize: 14, color: '#bfdbfe', marginTop: 4, marginBottom: 16 },
  
  // Search Bar
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 50,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#1e293b',
  },

  // Product Card
  card: {
    backgroundColor: 'white',
    borderRadius: 20,
    marginBottom: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  iconContainer: {
    width: 48, height: 48,
    backgroundColor: '#eff6ff',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  productName: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  categoryText: { fontSize: 13, color: '#64748b', marginTop: 2 },
  price: { fontSize: 18, fontWeight: '800', color: '#059669' },
  
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 12 },
  
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stockText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  lowStockText: { color: '#ef4444' }, // Red Color for low stock

  // Empty State
  emptyState: { alignItems: 'center', marginTop: 80 },
  emptyText: { marginTop: 16, fontSize: 16, color: '#94a3b8', fontWeight: '500' },
});