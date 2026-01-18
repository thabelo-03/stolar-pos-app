import { useColorScheme } from '@/hooks/use-color-scheme';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react'; // Added useEffect
import 'react-native-reanimated';

// Import your Offline Service
import { OfflineService } from './services/offlineService';

export const unstable_settings = {
  initialRouteName: '(auth)', 
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  // --- NEW: AUTO-SYNC LOGIC ---
  useEffect(() => {
    // 1. Initial attempt to sync when app first launches
    console.log("Stolar POS: Checking for pending sales...");
    OfflineService.syncWithServer();

    // 2. Background Watcher: Check for connection/sync every 60 seconds
    const syncTimer = setInterval(() => {
      OfflineService.syncWithServer();
    }, 60000); 

    return () => clearInterval(syncTimer);
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack initialRouteName="(auth)">
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(cashier)" options={{ headerShown: false }} />
        <Stack.Screen name="(manager)" options={{ headerShown: false }} /> 
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}