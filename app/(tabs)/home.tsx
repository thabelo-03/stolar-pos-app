import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { API_BASE_URL } from './api';

export default function CashierHome() {
  const router = useRouter();
  const { name, role } = useLocalSearchParams();
  const cashierName = Array.isArray(name) ? name[0] : name;
  const userRole = Array.isArray(role) ? role[0] : role;
  const [isLinked, setIsLinked] = useState(false);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [shopName, setShopName] = useState('Loading...');

  // Password Protection
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [password, setPassword] = useState('');
  const [verifying, setVerifying] = useState(false);
  const pendingAction = useRef<(() => void) | null>(null);

  const requestPassword = async (action: () => void) => {
    pendingAction.current = action;
    setPassword('');
    setVerifying(false);

    // Try Biometrics First
    const bioEnabled = await AsyncStorage.getItem('biometricEnabled');
    if (bioEnabled === 'true') {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (hasHardware && isEnrolled) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Manager Approval Required',
          fallbackLabel: 'Use Password',
        });
        if (result.success) return action();
      }
    }

    setPasswordVisible(true);
  };

  const handlePasswordSubmit = async () => {
    if (!password) return;
    setVerifying(true);
    try {
      const userId = await AsyncStorage.getItem('userId');
      const response = await fetch(`${API_BASE_URL}/auth/verify-manager`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cashierId: userId, password }),
      });
      
      const data = await response.json();
      if (response.ok && data.success) {
        setPasswordVisible(false);
        pendingAction.current?.();
      } else {
        Alert.alert("Error", data.message || "Incorrect Password");
      }
    } catch (e) {
      Alert.alert("Error", "Network error");
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    const checkShopLink = async () => {
      try {
        const userId = await AsyncStorage.getItem('userId');
        if (userId) {
          const response = await fetch(`${API_BASE_URL}/users/${userId}`);
          if (response.ok) {
            const userData = await response.json();
            if (userData.shopId) {
              setIsLinked(true);
              setHasPendingRequest(false);
              const shopRes = await fetch(`${API_BASE_URL}/shops/${userData.shopId}`);
              if (shopRes.ok) {
                const shopData = await shopRes.json();
                setShopName(shopData.name || 'Unknown Shop');
              } else {
                setShopName('Shop Not Found');
              }
            } else {
              setShopName('No Shop Linked');
              // Check for pending request
              const reqRes = await fetch(`${API_BASE_URL}/shops/cashier-request/${userId}`);
              if (reqRes.ok) {
                const reqData = await reqRes.json();
                if (reqData) setHasPendingRequest(true);
              }
            }
          } else {
            setShopName('User Error');
          }
        } else {
          setShopName('Not Logged In');
        }
      } catch (e) {
        console.log("Error checking shop link", e);
        setShopName('Offline');
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
            <Text style={styles.statusSub}>{cashierName || 'CASHIER'} • Shop: {shopName} <Ionicons name="checkmark-circle" size={14} color="#4ade80" /> Online</Text>
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
              
              <TouchableOpacity style={styles.actionRow} onPress={() => router.push('/(cashier)/my-shop')}>
                <View style={[styles.iconBox, { backgroundColor: '#e0f2fe' }]}>
                  <Ionicons name="storefront" size={20} color="#0284c7" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionTitle}>{isLinked ? "My Shop" : "Link Shop"}</Text>
                  <Text style={styles.actionSub}>{isLinked ? "View Details" : "Connect to Branch"}</Text>
                </View>
                {hasPendingRequest && !isLinked && (
                  <View style={styles.pendingBadge}>
                    <Text style={styles.pendingBadgeText}>Pending</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionRow} onPress={() => router.push('/(tabs)/daily-summary')}>
                <View style={[styles.iconBox, { backgroundColor: '#eef2ff' }]}>
                  <Ionicons name="document-text" size={20} color="#6366f1" />
                </View>
                <View>
                  <Text style={styles.actionTitle}>Daily Summary</Text>
                  <Text style={styles.actionSub}>Daily Summary</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionRow} onPress={() => requestPassword(() => router.push('/(tabs)/profit-report'))}>
                <View style={[styles.iconBox, { backgroundColor: '#dcfce7' }]}>
                  <Ionicons name="trending-up" size={20} color="#16a34a" />
                </View>
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={styles.actionTitle}>Profit Report</Text>
                    <Ionicons name="lock-closed" size={12} color="#f59e0b" style={{ marginLeft: 4 }} />
                  </View>
                  <Text style={styles.actionSub}>Margins & Revenue</Text>
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
                onPress={() => requestPassword(() => router.push('/(tabs)/add-stock'))}
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

      {/* Password Modal */}
      <Modal visible={passwordVisible} transparent animationType="fade" onRequestClose={() => setPasswordVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.passwordContainer}>
            <Text style={styles.passwordTitle}>Manager Password</Text>
            <TextInput 
              style={styles.passwordInput} 
              secureTextEntry 
              placeholder="Enter Password"
              value={password}
              onChangeText={setPassword}
              autoFocus
              keyboardType="numeric"
            />
            <TouchableOpacity style={{ alignSelf: 'center', marginBottom: 15 }} onPress={() => requestPassword(pendingAction.current!)}>
               <Ionicons name="finger-print" size={32} color="#1e40af" />
            </TouchableOpacity>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setPasswordVisible(false)}><Text style={styles.btnText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={handlePasswordSubmit} disabled={verifying}>
                {verifying ? <ActivityIndicator color="white" size="small" /> : <Text style={[styles.btnText, {color: 'white'}]}>Confirm</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  passwordContainer: { backgroundColor: 'white', padding: 20, borderRadius: 12, width: '80%', maxWidth: 300 },
  passwordTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center', color: '#1e293b' },
  passwordInput: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 10, marginBottom: 20, fontSize: 16, textAlign: 'center' },
  modalButtons: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, padding: 12, backgroundColor: '#f1f5f9', borderRadius: 8, alignItems: 'center' },
  confirmBtn: { flex: 1, padding: 12, backgroundColor: '#1e40af', borderRadius: 8, alignItems: 'center' },
  btnText: { fontWeight: 'bold' },
  pendingBadge: { backgroundColor: '#f59e0b', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  pendingBadgeText: { color: 'white', fontSize: 10, fontWeight: 'bold' },
});