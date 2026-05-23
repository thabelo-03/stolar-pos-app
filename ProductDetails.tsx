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
  dark?: boolean;
}

export function ProductDetails({ product, dark = false }: ProductDetailsProps) {
  const isLowStock = product.stockQuantity <= (product.minStockLevel || 5);

  const containerStyle = [
    styles.container,
    dark && styles.darkContainer
  ];

  const nameStyle = [
    styles.name,
    dark && styles.darkText
  ];

  const badgeStyle = [
    styles.badge,
    dark && styles.darkBadge
  ];

  const badgeTextStyle = [
    styles.badgeText,
    dark && styles.darkBadgeText
  ];

  const labelStyle = [
    styles.label,
    dark && styles.darkLabel
  ];

  const valueStyle = [
    styles.value,
    dark && styles.darkText,
    isLowStock && styles.lowStock
  ];

  const priceStyle = [
    styles.price,
    dark && styles.darkPrice
  ];

  const dividerStyle = [
    styles.divider,
    dark && styles.darkDivider
  ];

  return (
    <View style={containerStyle}>
      <View style={styles.header}>
        <Text style={nameStyle}>{product.name}</Text>
        <View style={badgeStyle}>
          <Text style={badgeTextStyle}>{product.category}</Text>
        </View>
      </View>

      <View style={styles.row}>
        <Ionicons name="barcode-outline" size={20} color={dark ? "#94a3b8" : "#64748b"} />
        <Text style={labelStyle}>Barcode:</Text>
        <Text style={valueStyle}>{product.barcode}</Text>
      </View>

      <View style={styles.row}>
        <Ionicons name="pricetag-outline" size={20} color={dark ? "#94a3b8" : "#64748b"} />
        <Text style={labelStyle}>Price:</Text>
        <Text style={priceStyle}>
          {product.currency || '$'} {Number(product.price).toFixed(2)}
        </Text>
      </View>

      <View style={dividerStyle} />

      <View style={styles.row}>
        <Ionicons name="cube-outline" size={20} color={dark ? "#94a3b8" : "#64748b"} />
        <Text style={labelStyle}>Stock:</Text>
        <Text style={valueStyle}>
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
  darkContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowOpacity: 0,
    elevation: 0,
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
  darkText: {
    color: '#f1f5f9',
  },
  badge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  darkBadge: {
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    borderColor: 'rgba(6, 182, 212, 0.25)',
  },
  badgeText: { fontSize: 12, color: '#1e40af', fontWeight: '600' },
  darkBadgeText: { color: '#06b6d4' },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  label: { fontSize: 14, color: '#64748b', marginLeft: 8, marginRight: 8, width: 60 },
  darkLabel: { color: '#94a3b8' },
  value: { fontSize: 14, color: '#334155', fontWeight: '500' },
  price: { fontSize: 16, color: '#1e40af', fontWeight: 'bold' },
  darkPrice: { color: '#06b6d4' },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 8 },
  darkDivider: { backgroundColor: 'rgba(255, 255, 255, 0.08)' },
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
