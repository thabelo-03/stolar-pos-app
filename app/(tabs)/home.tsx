import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function CashierHome() {
  const router = useRouter();
  const { name } = useLocalSearchParams();
  const cashierName = Array.isArray(name) ? name[0] : name;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1e40af" />
      
      {/* 1. Top Header Section */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.brandTitle}>Stolarr POS</Text>
            <Text style={styles.statusSub}>{cashierName || 'CASHIER'} • Shop: Main Mall <Ionicons name="checkmark-circle" size={14} color="#4ade80" /> Online</Text>
          </View>
          <TouchableOpacity style={styles.notificationBtn}>
            <Ionicons name="notifications" size={26} color="white" />
            <View style={styles.notificationBadge}><Text style={styles.badgeText}>1</Text></View>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* 2. Large Start Selling Button */}
        <TouchableOpacity 
          style={styles.heroButton}
          onPress={() => router.push('/(pos)/scan')}
        >
          <MaterialCommunityIcons name="barcode-scan" size={40} color="white" />
          <View style={styles.heroTextContainer}>
            <Text style={styles.heroTitle}>START SELLING</Text>
            <Text style={styles.heroSubtitle}>SCAN / SEARCH</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.mainGrid}>
          {/* 3. Left Side: Start Selling Card */}
          <View style={[styles.card, styles.leftCard]}>
             <TouchableOpacity 
               style={styles.miniHeroButton}
               onPress={() => router.push('/(pos)/scan')}
             >
                <MaterialCommunityIcons name="barcode-scan" size={24} color="white" />
                <Text style={styles.miniHeroTitle}>START SELLING</Text>
                <Text style={styles.miniHeroSub}>SCAN / SEARCH</Text>
             </TouchableOpacity>
          </View>

          {/* 4. Right Side: Quick Actions & Add Stock */}
          <View style={styles.rightColumn}>
            
            {/* Quick Actions Card */}
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>Quick Actions</Text>
              
              <TouchableOpacity style={styles.actionRow} onPress={() => router.push('/(tabs)/daily-summary')}>
                <View style={[styles.iconBox, { backgroundColor: '#eef2ff' }]}>
                  <Ionicons name="document-text" size={20} color="#6366f1" />
                </View>
                <View>
                  <Text style={styles.actionTitle}>Daily Summary</Text>
                  <Text style={styles.actionSub}>Daily Summary</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionRow} onPress={() => router.push('/(tabs)/last-sales')}>
                <View style={[styles.iconBox, { backgroundColor: '#fffbeb' }]}>
                  <Ionicons name="receipt" size={20} color="#f59e0b" />
                </View>
                <View>
                  <Text style={styles.actionTitle}>My Last 10 Sales</Text>
                  <Text style={styles.actionSub}>Receipts</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Add Stock Card */}
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>Add Stock</Text>
              <TouchableOpacity style={styles.addStockBtn} onPress={() => router.push('/(tabs)/add-stock')}>
                <View style={styles.addStockIcon}>
                   <Ionicons name="add-circle" size={24} color="#059669" />
                </View>
                <View>
                  <Text style={styles.actionTitle}>Add Stock</Text>
                  <Text style={styles.actionSub}>Adjust Inventory</Text>
                </View>
              </TouchableOpacity>
              <View style={styles.lockRow}>
                <Ionicons name="lock-closed" size={12} color="#f59e0b" />
                <Text style={styles.lockText}>Password Required</Text>
              </View>
            </View>

          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { 
    backgroundColor: '#1e40af', 
    height: 160, 
    borderBottomLeftRadius: 40, 
    borderBottomRightRadius: 40,
    paddingHorizontal: 25,
    paddingTop: 40
  },
  headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brandTitle: { color: 'white', fontSize: 32, fontWeight: 'bold' },
  statusSub: { color: '#bfdbfe', fontSize: 14, marginTop: 4 },
  notificationBtn: { backgroundColor: 'rgba(255,255,255,0.2)', padding: 10, borderRadius: 12 },
  notificationBadge: { position: 'absolute', top: -5, right: -5, backgroundColor: '#ef4444', borderRadius: 10, width: 20, height: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#1e40af' },
  badgeText: { color: 'white', fontSize: 10, fontWeight: 'bold' },
  
  scrollContent: { padding: 20, marginTop: -40 },
  
  heroButton: { 
    backgroundColor: '#10b981', 
    borderRadius: 30, 
    padding: 30, 
    flexDirection: 'row', 
    alignItems: 'center', 
    elevation: 8,
    marginBottom: 20 
  },
  heroTextContainer: { marginLeft: 20 },
  heroTitle: { color: 'white', fontSize: 24, fontWeight: 'bold', letterSpacing: 1 },
  heroSubtitle: { color: '#d1fae5', fontSize: 14, fontWeight: '600' },

  mainGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  leftCard: { width: '45%', justifyContent: 'center', alignItems: 'center', minHeight: 400 },
  miniHeroButton: { backgroundColor: '#10b981', borderRadius: 20, padding: 15, width: '90%', alignItems: 'center' },
  miniHeroTitle: { color: 'white', fontWeight: 'bold', fontSize: 14, textAlign: 'center', marginTop: 5 },
  miniHeroSub: { color: 'white', fontSize: 10, opacity: 0.8 },

  rightColumn: { width: '52%' },
  card: { backgroundColor: 'white', borderRadius: 25, padding: 15, marginBottom: 15, elevation: 2 },
  sectionLabel: { fontSize: 16, fontWeight: 'bold', color: '#1e293b', marginBottom: 15 },
  actionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  iconBox: { padding: 10, borderRadius: 12, marginRight: 12 },
  actionTitle: { fontSize: 14, fontWeight: 'bold', color: '#1e293b' },
  actionSub: { fontSize: 12, color: '#64748b' },

  addStockBtn: { backgroundColor: '#f0fdf4', padding: 12, borderRadius: 15, flexDirection: 'row', alignItems: 'center' },
  addStockIcon: { marginRight: 10 },
  lockRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingLeft: 5 },
  lockText: { fontSize: 11, color: '#64748b', marginLeft: 5 },
});