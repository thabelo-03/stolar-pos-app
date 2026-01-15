import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React, { useEffect, useState } from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { API_BASE_URL } from './api';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const [lowStockCount, setLowStockCount] = useState<number | undefined>(undefined);

  useEffect(() => {
    const fetchLowStock = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/inventory`);
        const data = await response.json();
        if (response.ok && Array.isArray(data)) {
          // Count items with quantity less than 5
          const count = data.filter((item: any) => Number(item.quantity) < 5).length;
          setLowStockCount(count > 0 ? count : undefined);
        }
      } catch (error) {
        // Silently fail for badge updates
      }
    };

    fetchLowStock();
  }, []);

  return (
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
  );
}
