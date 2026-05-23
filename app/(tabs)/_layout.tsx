import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Tabs, useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { useActiveShop } from '@/hooks/use-active-shop';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { API_BASE_URL } from '../config';

export default function TabLayout() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const [lowStockCount, setLowStockCount] = useState<number | undefined>(undefined);
  const [isLocked, setIsLocked] = useState(false);
  const { shopId } = useActiveShop();

  const fetchLowStock = useCallback(async () => {
    if (!shopId) return;
    try {
      const response = await fetch(`${API_BASE_URL}/products?shopId=${shopId}`);
      const data = await response.json();
      if (response.ok && Array.isArray(data)) {
        // Count items with quantity less than 5
        const count = data.filter((item: any) => {
          const qty = item.stockQuantity !== undefined ? Number(item.stockQuantity) : (Number(item.quantity) || 0);
          return qty < 5;
        }).length;
        setLowStockCount(count > 0 ? count : undefined);
      }
    } catch (error) {
      // Silently fail for badge updates
    }
  }, [shopId]);

  useFocusEffect(
    useCallback(() => {
      checkSubscriptionStatus();
      fetchLowStock();
    }, [fetchLowStock])
  );

  const checkSubscriptionStatus = async () => {
    try {
      const userId = await AsyncStorage.getItem('userId');
      if (!userId) return;

      // 1. Determine Active Shop ID (AsyncStorage priority for Managers)
      let activeShopId = await AsyncStorage.getItem('shopId');

      if (!activeShopId) {
        // Fallback: Get User to find shop (Cashier linked in DB)
        const userRes = await fetch(`${API_BASE_URL}/users/${userId}`);
        if (!userRes.ok) return;
        const user = await userRes.json();
        activeShopId = user.shopId;
      }

      // 2. If linked to a shop, check that shop's manager
      if (activeShopId) {
        const shopRes = await fetch(`${API_BASE_URL}/shops/${activeShopId}`);
        if (shopRes.ok) {
          const shop = await shopRes.json();
          // If manager exists and is expired -> LOCK OUT
          if (shop.manager && shop.manager.subscriptionStatus === 'expired') {
            setIsLocked(true);
          }
        }
      }
    } catch (e) {
      console.error("Subscription check failed", e);
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.clear();
    router.replace('/(auth)/login');
  };

  return (
    <>
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#06b6d4',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.35)',
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarShowLabel: true,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          position: 'absolute',
          bottom: 20,
          left: 16,
          right: 16,
          borderRadius: 26,
          height: 72,
          paddingBottom: 10,
          paddingTop: 10,
          backgroundColor: 'rgba(10, 15, 30, 0.94)',
          borderTopWidth: 1,
          borderTopColor: 'rgba(255,255,255,0.08)',
          elevation: 20,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.4,
          shadowRadius: 20,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          marginBottom: 2,
          letterSpacing: 0.3,
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
      
      {/* Explicitly hide notifications tab */}
      <Tabs.Screen
        name="notifications"
        options={{ href: null }}
      />
      
      {/* New: Recent Actions (Hidden) */}
      <Tabs.Screen
        name="recent-actions"
        options={{ href: null, title: 'Actions' }}
      />

      {/* New: Profile Settings Tab (Hidden) */}
      <Tabs.Screen
        name="profile-settings"
        options={{
          href: null,
          title: 'Settings',
        }}
      />
    </Tabs>

    {/* GLOBAL LOCKOUT MODAL */}
    <Modal visible={isLocked} transparent={false} animationType="none">
      <View style={styles.lockoutContainer}>
        <Ionicons name="lock-closed" size={80} color="#ef4444" />
        <Text style={styles.lockoutTitle}>Access Denied</Text>
        <Text style={styles.lockoutText}>
          The Shop you are trying to access has not paid its subscription.
        </Text>
        <Text style={styles.lockoutSubText}>
          Please contact your manager to renew the subscription.
        </Text>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  lockoutContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0f1e', padding: 30 },
  lockoutTitle: { fontSize: 28, fontWeight: '800', color: '#f43f5e', marginTop: 20, marginBottom: 10 },
  lockoutText: { fontSize: 16, color: '#e2e8f0', textAlign: 'center', marginBottom: 10 },
  lockoutSubText: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 40 },
  logoutBtn: { backgroundColor: '#f43f5e', paddingHorizontal: 40, paddingVertical: 15, borderRadius: 30, shadowColor: '#f43f5e', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
  logoutText: { color: 'white', fontWeight: '800', fontSize: 16 }
});
