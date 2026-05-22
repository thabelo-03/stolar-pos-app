import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_BASE_URL } from '../config';

export default function MyShopScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { shopId } = useLocalSearchParams();
  const [shop, setShop] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchShopDetails = async () => {
      if (!shopId) {
        setLoading(false);
        return;
      }
      try {
        const response = await fetch(`${API_BASE_URL}/shops/${shopId}`);
        if (response.ok) {
          const data = await response.json();
          setShop(data);
        }
      } catch (error) {
        console.error("Error fetching shop details:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchShopDetails();
  }, [shopId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#7c3aed" />
      </View>
    );
  }

  if (!shop) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={64} color="#f43f5e" style={{ marginBottom: 15 }} />
        <Text style={styles.errorText}>Shop not found or no ID provided.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={['#4f46e5', '#7c3aed', '#9333ea']} style={[styles.header, { paddingTop: insets.top + 10 }]}>
         <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="white" />
         </TouchableOpacity>
         <Text style={styles.headerTitle}>Shop Details</Text>
         <View style={{ width: 24 }} />
      </LinearGradient>

      <View style={styles.card}>
        <View style={styles.headerRow}>
          <View style={styles.iconBox}>
            <Ionicons name="storefront" size={28} color="#7c3aed" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.shopName}>{shop.name}</Text>
            <Text style={styles.shopLocation}>{shop.location}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <Text style={styles.label}>Branch Code</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{shop.branchCode}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>Manager</Text>
          <Text style={styles.value}>{shop.manager?.name || 'N/A'}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>Contact</Text>
          <Text style={styles.value}>{shop.manager?.email || 'N/A'}</Text>
        </View>
      </View>

      <View style={styles.actionContainer}>
        <TouchableOpacity 
          style={styles.actionBtn} 
          onPress={() => router.push({ pathname: '/(manager)/operations-hub', params: { shop: JSON.stringify(shop) } })}
        >
          <Ionicons name="settings-outline" size={20} color="white" />
          <Text style={styles.actionText}>Open Operations Hub</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f3ff' },
  header: { 
    padding: 20, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    borderBottomLeftRadius: 24, 
    borderBottomRightRadius: 24 
  },
  backButton: { padding: 4 },
  headerTitle: { color: 'white', fontSize: 20, fontWeight: 'bold', letterSpacing: 0.5 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f3ff', padding: 20 },
  card: { 
    backgroundColor: 'white', 
    borderRadius: 20, 
    padding: 20, 
    margin: 20, 
    shadowColor: '#4f46e5', 
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06, 
    shadowRadius: 16, 
    elevation: 4 
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 10 },
  iconBox: { 
    width: 56, 
    height: 56, 
    borderRadius: 28, 
    backgroundColor: '#f5f3ff', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  shopName: { fontSize: 22, fontWeight: 'bold', color: '#0f172a' },
  shopLocation: { fontSize: 14, color: '#475569', marginTop: 2 },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 15 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  label: { fontSize: 14, color: '#475569', fontWeight: '600' },
  value: { fontSize: 14, color: '#0f172a', fontWeight: 'bold' },
  badge: { backgroundColor: '#f5f3ff', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#ddd6fe' },
  badgeText: { fontSize: 13, fontWeight: '700', color: '#7c3aed' },
  errorText: { fontSize: 16, color: '#f43f5e', marginBottom: 15, fontWeight: '600', textAlign: 'center' },
  backBtn: { paddingVertical: 12, paddingHorizontal: 24, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#ddd6fe' },
  backText: { color: '#7c3aed', fontWeight: 'bold' },
  actionContainer: { paddingHorizontal: 20 },
  actionBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    backgroundColor: '#7c3aed', 
    padding: 16, 
    borderRadius: 16, 
    gap: 8,
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4
  },
  actionText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
});