import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { API_BASE_URL } from './api';

export default function CashierHome() {
  const router = useRouter();
  const { name, role } = useLocalSearchParams();
  const cashierName = Array.isArray(name) ? name[0] : name;
  const userRole = Array.isArray(role) ? role[0] : role;
  const [isLinked, setIsLinked] = useState(false);

  useEffect(() => {
    const checkShopLink = async () => {
      try {
        const userId = await AsyncStorage.getItem('userId');
        if (userId) {
          const response = await fetch(`${API_BASE_URL}/users/${userId}`);
          const userData = await response.json();
          if (userData.shopId) setIsLinked(true);
        }
      } catch (e) {
        console.log("Error checking shop link", e);
      }
    };
    checkShopLink();
  }, []);

  const handleLogout = () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to log out?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Logout", 
          style: "destructive",
          onPress: () => router.replace('/(auth)/login') 
        }
      ]
    );
  };

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
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity style={styles.notificationBtn} onPress={() => router.push('/(tabs)/profile-settings')}>
              <Ionicons name="settings-outline" size={26} color="white" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.notificationBtn} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={26} color="white" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.notificationBtn}>
              <Ionicons name="notifications" size={26} color="white" />
              <View style={styles.notificationBadge}><Text style={styles.badgeText}>1</Text></View>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* 2. Large Start Selling Button */}
        <TouchableOpacity 
          style={styles.heroButton}
          onPress={() => router.push('/(tabs)/scan')}
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
               onPress={() => router.push('/(tabs)/scan')}
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

              <TouchableOpacity style={styles.actionRow} onPress={() => router.push('/(cashier)/link-shop')}>
                <View style={[styles.iconBox, { backgroundColor: '#eef2ff' }]}>
                  <Ionicons name="link" size={20} color="#6366f1" />
                </View>
                <View>
                  <Text style={styles.actionTitle}>Link Shop</Text>
                  <Text style={styles.actionSub}>Connect to a shop</Text>
                </View>
              </TouchableOpacity>

              {(userRole === 'admin' || userRole === 'manager') && (
              <TouchableOpacity style={styles.actionRow} onPress={() => router.push('/(tabs)/last-sales')}>
                <View style={[styles.iconBox, { backgroundColor: '#fffbeb' }]}>
                  <Ionicons name="receipt" size={20} color="#f59e0b" />
                </View>
                <View>
                  <Text style={styles.actionTitle}>My Last 10 Sales</Text>
                  <Text style={styles.actionSub}>Receipts</Text>
                </View>
              </TouchableOpacity>
              )}
            </View>

            {/* Add Stock Card */}
            <View style={[styles.card, !isLinked && { opacity: 0.6 }]}>
              <Text style={styles.sectionLabel}>Add Stock</Text>
              <TouchableOpacity 
                style={[styles.addStockBtn, !isLinked && { backgroundColor: '#e2e8f0' }]} 
                onPress={() => router.push('/(tabs)/add-stock')}
                disabled={!isLinked}
              >
                <View style={styles.addStockIcon}>
                   <Ionicons name="add-circle" size={24} color={isLinked ? "#059669" : "#94a3b8"} />
                </View>
                <View>
                  <Text style={[styles.actionTitle, !isLinked && { color: '#64748b' }]}>Add Stock</Text>
                  <Text style={styles.actionSub}>{isLinked ? 'Adjust Inventory' : 'Link Shop Required'}</Text>
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