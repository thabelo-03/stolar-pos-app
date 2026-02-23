import { useColorScheme } from '@/hooks/use-color-scheme';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import 'react-native-reanimated';

// ⭐ NEW IMPORTS (ICON FIX)
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';

// Import your Offline Service
import { API_BASE_URL } from './config';
import { OfflineService } from './services/offlineService';

export const unstable_settings = {
  initialRouteName: '(auth)', 
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [isOffline, setIsOffline] = useState(false);

  // ⭐ NEW — preload Ionicons font (FIXES X icons)
  const [fontsLoaded] = useFonts({
    ...Ionicons.font,
  });

  // --- AUTO-SYNC LOGIC ---
  useEffect(() => {
    console.log("Stolar POS: Checking for pending sales...");
    OfflineService.syncWithServer();

    const syncTimer = setInterval(() => {
      OfflineService.syncWithServer();
    }, 60000); 

    return () => clearInterval(syncTimer);
  }, []);

  // --- OFFLINE CHECKER ---
  const checkReachability = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      await fetch(API_BASE_URL, { method: 'HEAD', signal: controller.signal });
      clearTimeout(timeoutId);
      setIsOffline(false);
      
      // Trigger sync when connection is confirmed
      OfflineService.syncWithServer();
    } catch (e) {
      setIsOffline(true);
    }
  }, []);

  useEffect(() => {
    checkReachability();
    const timer = setInterval(checkReachability, 15000);
    return () => clearInterval(timer);
  }, [checkReachability]);

  // ⭐ IMPORTANT — don't render app until icons ready
  if (!fontsLoaded) return null;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack initialRouteName="(auth)">
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(cashier)" options={{ headerShown: false }} />
        <Stack.Screen name="(manager)" options={{ headerShown: false }} /> 
        <Stack.Screen name="(admin)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      {isOffline && (
        <View style={styles.offlineBanner}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="cloud-offline" size={20} color="white" style={{ marginRight: 8 }} />
            <Text style={styles.offlineText}>Offline Mode</Text>
          </View>
          <TouchableOpacity style={styles.retryButton} onPress={checkReachability}>
            <Text style={styles.retryText}>Retry</Text>
            <Ionicons name="refresh" size={16} color="white" />
          </TouchableOpacity>
        </View>
      )}
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  offlineBanner: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 35,
    left: 20,
    right: 20,
    backgroundColor: '#ef4444',
    padding: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 9999,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  offlineText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  retryButton: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  retryText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
});