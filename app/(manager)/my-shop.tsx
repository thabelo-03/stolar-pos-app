import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { API_BASE_URL } from '../config';

export default function MyShopScreen() {
  const router = useRouter();
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
        <ActivityIndicator size="large" color="#1e40af" />
      </View>
    );
  }

  if (!shop) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Shop not found or no ID provided.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
         <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="white" />
         </TouchableOpacity>
         <Text style={styles.headerTitle}>Shop Details</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.headerRow}>
          <View style={styles.iconBox}>
            <Ionicons name="storefront" size={32} color="#1e40af" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.shopName}>{shop.name}</Text>
            <Text style={styles.shopLocation}>{shop.location}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <Text style={styles.label}>Branch Code</Text>
          <Text style={styles.value}>{shop.branchCode}</Text>
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
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { backgroundColor: '#1e40af', padding: 20, paddingTop: 50, flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  backButton: { marginRight: 15 },
  headerTitle: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: 'white', borderRadius: 16, padding: 20, margin: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 10 },
  iconBox: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center' },
  shopName: { fontSize: 22, fontWeight: 'bold', color: '#1e293b' },
  shopLocation: { fontSize: 14, color: '#64748b' },
  divider: { height: 1, backgroundColor: '#e2e8f0', marginVertical: 15 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  label: { fontSize: 14, color: '#64748b', fontWeight: '600' },
  value: { fontSize: 14, color: '#1e293b', fontWeight: 'bold' },
  errorText: { fontSize: 16, color: '#ef4444', marginBottom: 10 },
  backBtn: { padding: 10, backgroundColor: '#e2e8f0', borderRadius: 8 },
  backText: { color: '#1e293b', fontWeight: 'bold' },
  actionContainer: { paddingHorizontal: 20 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1e40af', padding: 16, borderRadius: 12, gap: 8 },
  actionText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
});