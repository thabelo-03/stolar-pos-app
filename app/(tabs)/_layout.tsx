import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Tabs, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { API_BASE_URL } from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function TabLayout() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const [lowStockCount, setLowStockCount] = useState<number | undefined>(undefined);

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
    const requestPermissions = async () => {
      await Notifications.requestPermissionsAsync();
    };

    const fetchLowStock = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/products`);
        const data = await response.json();
        if (response.ok && Array.isArray(data)) {
          // Count items with quantity less than 5
          const count = data.filter((item: any) => Number(item.quantity) < 5).length;
          setLowStockCount(count > 0 ? count : undefined);

          if (count > 0) {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: "Low Stock Alert ⚠️",
                body: `You have ${count} items running low on stock. Check Inventory.`,
              },
              trigger: null,
            });
          }
        }
      } catch (error) {
        // Silently fail for badge updates
      }
    };

    requestPermissions();
    fetchLowStock();
  }, []);

  return (
    <>
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#1e40af',
        tabBarInactiveTintColor: '#64748b',
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarShowLabel: true,
        tabBarStyle: {
          height: 70,
          paddingBottom: 5,
          paddingTop: 10,
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#e2e8f0',
          elevation: 10,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          marginBottom: 2,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => <Ionicons size={24} name={focused ? "home" : "home-outline"} color={color} />,
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: 'Inventory',
          tabBarIcon: ({ color, focused }) => <Ionicons size={24} name={focused ? "cube" : "cube-outline"} color={color} />,
          tabBarBadge: lowStockCount,
        }}
      />
      <Tabs.Screen
        name="daily-summary"
        options={{
          href: null,
          title: 'Summary',
          tabBarIcon: ({ color, focused }) => <Ionicons size={24} name={focused ? "bar-chart" : "bar-chart-outline"} color={color} />,
        }}
      />
      
      {/* New: Cart Tab */}
      <Tabs.Screen
        name="cart"
        options={{
          title: 'Cart',
          tabBarIcon: ({ color, focused }) => <Ionicons size={24} name={focused ? "cart" : "cart-outline"} color={color} />,
        }}
      />

      {/* New: Scan Tab */}
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan',
          tabBarIcon: ({ color, focused }) => <Ionicons size={24} name={focused ? "qr-code" : "qr-code-outline"} color={color} />,
        }}
      />

      {/* Modified: Last Sales Tab */}
      <Tabs.Screen
        name="last-sales"
        options={{
          title: 'Sales', // Changed title to 'Sales' for brevity
          tabBarIcon: ({ color, focused }) => <Ionicons size={24} name={focused ? "receipt" : "receipt-outline"} color={color} />,
          // Removed href: null to make it visible in the tab bar
        }}
      />
      
      {/* New: Add Stock Tab */}
      <Tabs.Screen
        name="add-stock"
        options={{
          title: 'Add Stock',
          tabBarIcon: ({ color, focused }) => <Ionicons size={24} name={focused ? "add-circle" : "add-circle-outline"} color={color} />,
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            requestPassword(() => router.push('/(tabs)/add-stock'));
          },
        }}
      />
      
      {/* New: Profit Report Tab */}
      <Tabs.Screen
        name="profit-report"
        options={{
          href: null,
          title: 'Profit',
          tabBarIcon: ({ color, focused }) => <Ionicons size={24} name={focused ? "trending-up" : "trending-up-outline"} color={color} />,
        }}
      />
      
      {/* New: Profile Settings Tab (Hidden) */}
      <Tabs.Screen
        name="profile-settings"
        options={{
          href: null,
          title: 'Settings',
        }}
      />
      
      {/* Hidden: Home (Duplicate/Arrow as per user) */}
      <Tabs.Screen
        name="home" // This corresponds to app/(tabs)/home.tsx
        options={{
          href: null, // Hide it from the tab bar
          title: 'Home Hidden', // Give it a distinct title for debugging if needed
        }}
      />
    </Tabs>

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
    </>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  passwordContainer: { backgroundColor: 'white', padding: 20, borderRadius: 12, width: '80%', maxWidth: 300 },
  passwordTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center', color: '#1e293b' },
  passwordInput: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 10, marginBottom: 20, fontSize: 16, textAlign: 'center' },
  modalButtons: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, padding: 12, backgroundColor: '#f1f5f9', borderRadius: 8, alignItems: 'center' },
  confirmBtn: { flex: 1, padding: 12, backgroundColor: '#1e40af', borderRadius: 8, alignItems: 'center' },
  btnText: { fontWeight: 'bold' },
});
