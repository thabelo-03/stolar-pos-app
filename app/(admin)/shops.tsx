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

interface Shop {
  _id: string;
  name: string;
  category?: string;
  manager?: {
    name: string;
    email: string;
    subscriptionStatus?: string;
  } | string;
}

export default function ShopsList() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [shops, setShops] = useState<Shop[]>([]);
  const [filteredShops, setFilteredShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchShops = async () => {
    try {
      if (!refreshing) setLoading(true);
      // Fetch shops
      const shopsRes = await fetch(`${API_BASE_URL}/shops`);
      const shopsData = await shopsRes.json();
      
      // Fetch users to map managers
      const usersRes = await fetch(`${API_BASE_URL}/users`);
      const usersData = await usersRes.json();
      
      const userMap = new Map();
      if (Array.isArray(usersData)) {
        usersData.forEach((u: any) => userMap.set(u._id, u));
      }

      if (Array.isArray(shopsData)) {
        const enriched = shopsData.map((s: any) => {
          const managerId = typeof s.manager === 'object' ? s.manager?._id : s.manager;
          const managerUser = userMap.get(managerId);
          return {
            ...s,
            manager: managerUser ? {
              name: managerUser.name,
              email: managerUser.email,
              subscriptionStatus: managerUser.subscriptionStatus || 'active'
            } : { name: 'Unknown Manager', email: 'N/A', subscriptionStatus: 'expired' }
          };
        });
        setShops(enriched);
        setFilteredShops(enriched);
      }
    } catch (e) {
      console.error("Failed to fetch shops:", e);
      Alert.alert("Error", "Could not fetch registered shops.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchShops();
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredShops(shops);
    } else {
      const q = searchTerm.toLowerCase();
      const filtered = shops.filter(s => 
        s.name.toLowerCase().includes(q) || 
        (s.category && s.category.toLowerCase().includes(q)) ||
        (s.manager && typeof s.manager === 'object' && s.manager.name && s.manager.name.toLowerCase().includes(q))
      );
      setFilteredShops(filtered);
    }
  }, [searchTerm, shops]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchShops();
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
            .status-active {
              color: #10b981;
              font-weight: 700;
            }
            .status-expired {
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
            <h1 class="header-title">System Shops Report</h1>
            <div class="header-subtitle">Generated on ${new Date().toLocaleString()}</div>
          </div>
          
          <div class="meta-grid">
            <div class="meta-card">
              <div class="meta-label">Search Query</div>
              <div class="meta-value">${searchTerm.trim() || 'None'}</div>
            </div>
            <div class="meta-card">
              <div class="meta-label">Total Registered Shops</div>
              <div class="meta-value">${filteredShops.length}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Shop Name</th>
                <th>Category</th>
                <th>Manager</th>
                <th>Manager Email</th>
                <th>Subscription</th>
              </tr>
            </thead>
            <tbody>
              ${filteredShops.map(item => {
                const mgrName = item.manager && typeof item.manager === 'object' ? item.manager.name : 'Unknown';
                const mgrEmail = item.manager && typeof item.manager === 'object' ? item.manager.email : 'N/A';
                const subStatus = item.manager && typeof item.manager === 'object' ? item.manager.subscriptionStatus || 'active' : 'active';
                return `
                  <tr>
                    <td style="font-weight: 600; color: #0f172a;">${item.name}</td>
                    <td style="color: #64748b;">${item.category || 'General'}</td>
                    <td>${mgrName}</td>
                    <td>${mgrEmail}</td>
                    <td class="${subStatus === 'active' ? 'status-active' : 'status-expired'}">${subStatus.toUpperCase()}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
          
          <div class="footer">
            Stolar POS System • Master Shops Directory
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

  const renderShopItem = ({ item }: { item: Shop }) => {
    const mgrName = item.manager && typeof item.manager === 'object' ? item.manager.name : 'Unknown';
    const mgrEmail = item.manager && typeof item.manager === 'object' ? item.manager.email : 'N/A';
    const subStatus = item.manager && typeof item.manager === 'object' ? item.manager.subscriptionStatus || 'active' : 'active';

    return (
      <TouchableOpacity 
        style={styles.card}
        onPress={() => router.push({
          pathname: '/(admin)/shop-reports',
          params: { shopId: item._id, shopName: item.name }
        })}
      >
        <View style={styles.cardHeader}>
          <View style={styles.iconContainer}>
            <Ionicons name="storefront-outline" size={22} color="#0ea5e9" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.shopName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.categoryText}>{item.category || 'Retail Shop'}</Text>
          </View>
          <View style={[
            styles.badge, 
            { backgroundColor: subStatus === 'active' ? '#ecfdf5' : '#fef2f2' }
          ]}>
            <Text style={[
              styles.badgeText, 
              { color: subStatus === 'active' ? '#10b981' : '#ef4444' }
            ]}>
              {subStatus.toUpperCase()}
            </Text>
          </View>
        </View>
        
        <View style={styles.divider} />
        
        <View style={styles.cardFooter}>
          <View>
            <Text style={styles.managerLabel}>MANAGER</Text>
            <Text style={styles.managerName}>{mgrName}</Text>
            <Text style={styles.managerEmail}>{mgrEmail}</Text>
          </View>
          <View style={styles.viewReportBtn}>
            <Text style={styles.viewReportText}>Reports</Text>
            <Ionicons name="chevron-forward" size={14} color="#0ea5e9" />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

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
            <Text style={styles.title}>Registered Shops</Text>
            <Text style={styles.subtitle}>{filteredShops.length} active stores in system</Text>
          </View>
          <TouchableOpacity onPress={handleExportPDF} style={styles.backButton}>
            <Ionicons name="document-text-outline" size={24} color="white" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#94a3b8" />
          <TextInput
            placeholder="Search shops or managers..."
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
          data={filteredShops}
          keyExtractor={(item) => item._id}
          renderItem={renderShopItem}
          contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0ea5e9']} tintColor="#0ea5e9" />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="storefront-outline" size={64} color="#bae6fd" style={{ marginBottom: 16 }} />
              <Text style={styles.emptyText}>No registered shops found</Text>
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
  title: { fontSize: 20, fontWeight: 'bold', color: 'white', letterSpacing: 0.5 },
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

  // Cards
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
  shopName: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  categoryText: { fontSize: 12, color: '#64748b', marginTop: 2 },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 'auto',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 12 },
  
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  managerLabel: { fontSize: 9, fontWeight: '800', color: '#94a3b8', letterSpacing: 0.5, marginBottom: 2 },
  managerName: { fontSize: 13, fontWeight: '700', color: '#334155' },
  managerEmail: { fontSize: 11, color: '#64748b', marginTop: 1 },
  viewReportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 4,
  },
  viewReportText: { fontSize: 12, fontWeight: '700', color: '#0ea5e9' },

  // Empty State
  emptyState: { alignItems: 'center', marginTop: 80 },
  emptyText: { fontSize: 15, color: '#94a3b8', fontWeight: '600' },
});
