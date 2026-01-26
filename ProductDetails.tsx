import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface Product {
  name: string;
  barcode: string;
  category: string;
  price: number;
  currency?: string;
  stockQuantity: number;
  minStockLevel?: number;
}

interface ProductDetailsProps {
  product: Product;
}

export function ProductDetails({ product }: ProductDetailsProps) {
  const isLowStock = product.stockQuantity <= (product.minStockLevel || 5);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.name}>{product.name}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{product.category}</Text>
        </View>
      </View>

      <View style={styles.row}>
        <Ionicons name="barcode-outline" size={20} color="#64748b" />
        <Text style={styles.label}>Barcode:</Text>
        <Text style={styles.value}>{product.barcode}</Text>
      </View>

      <View style={styles.row}>
        <Ionicons name="pricetag-outline" size={20} color="#64748b" />
        <Text style={styles.label}>Price:</Text>
        <Text style={styles.price}>
          {product.currency || '$'} {Number(product.price).toFixed(2)}
        </Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.row}>
        <Ionicons name="cube-outline" size={20} color="#64748b" />
        <Text style={styles.label}>Stock:</Text>
        <Text style={[styles.value, isLowStock && styles.lowStock]}>
          {product.stockQuantity} units
        </Text>
        {isLowStock && (
          <View style={styles.alertBadge}>
            <Text style={styles.alertText}>Low Stock</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    flex: 1,
    marginRight: 8,
  },
  badge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  badgeText: { fontSize: 12, color: '#1e40af', fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  label: { fontSize: 14, color: '#64748b', marginLeft: 8, marginRight: 8, width: 60 },
  value: { fontSize: 14, color: '#334155', fontWeight: '500' },
  price: { fontSize: 16, color: '#1e40af', fontWeight: 'bold' },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 8 },
  lowStock: { color: '#ef4444', fontWeight: 'bold' },
  alertBadge: {
    marginLeft: 'auto',
    backgroundColor: '#fef2f2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fee2e2',
  },
  alertText: { fontSize: 10, color: '#ef4444', fontWeight: 'bold' },
});
