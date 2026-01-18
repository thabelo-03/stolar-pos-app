import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import { API_BASE_URL } from '../config'; // Ensure this points to your computer's IP

const PENDING_SALES_KEY = '@stolar_pending_sales';

export const OfflineService = {
  // 1. Save a sale to the phone's memory
  saveSaleLocally: async (saleData: any) => {
    try {
      const existing = await AsyncStorage.getItem(PENDING_SALES_KEY);
      const queue = existing ? JSON.parse(existing) : [];

      // Create a unique fingerprint for this offline sale
      const offlineSale = {
        ...saleData,
        offlineId: `off-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        createdAt: new Date().toISOString(),
        synced: false,
      };

      queue.push(offlineSale);
      await AsyncStorage.setItem(PENDING_SALES_KEY, JSON.stringify(queue));
      console.log("📍 Sale stored locally. Queue size:", queue.length);
      return true;
    } catch (error) {
      console.error("Local storage failed:", error);
      return false;
    }
  },

  // 2. Push all stored sales to Danger's MongoDB
  syncWithServer: async () => {
    const state = await Network.getNetworkStateAsync();
    
    // Only proceed if internet is actually reachable
    if (!state.isInternetReachable) {
      console.log("📵 No internet. Sync skipped.");
      return;
    }

    const existing = await AsyncStorage.getItem(PENDING_SALES_KEY);
    if (!existing) return;

    let queue = JSON.parse(existing);
    if (queue.length === 0) return;

    console.log(`🔄 Syncing ${queue.length} sales to Stolar Server...`);

    for (const sale of [...queue]) {
      try {
        const response = await fetch(`${API_BASE_URL}/sales/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sale),
        });

        if (response.ok) {
          // Remove from queue if server accepts it
          queue = queue.filter((item: any) => item.offlineId !== sale.offlineId);
          await AsyncStorage.setItem(PENDING_SALES_KEY, JSON.stringify(queue));
          console.log(`✅ Synced sale: ${sale.offlineId}`);
        }
      } catch (error) {
        console.log("❌ Sync failed for one item. Waiting for better signal.");
        break; // Stop and try again later if the server is unreachable
      }
    }
  },

  // 3. Helper to see how many sales are waiting
  getQueueCount: async () => {
    const existing = await AsyncStorage.getItem(PENDING_SALES_KEY);
    return existing ? JSON.parse(existing).length : 0;
  }
};