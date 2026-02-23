import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import { API_BASE_URL } from '../config';

const QUEUE_KEY = 'offline_request_queue';

interface QueueItem {
  id: string;
  url: string;
  method: string;
  body: any;
  timestamp: number;
  retryCount: number;
}

export const OfflineService = {
  /**
   * Add a generic request to the offline queue
   */
  async addToQueue(url: string, method: string, body: any) {
    try {
      const item: QueueItem = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
        url,
        method,
        body,
        timestamp: Date.now(),
        retryCount: 0
      };

      const existing = await AsyncStorage.getItem(QUEUE_KEY);
      const queue: QueueItem[] = existing ? JSON.parse(existing) : [];
      
      queue.push(item);
      
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
      console.log('Request queued offline:', url);
      return true;
    } catch (error) {
      console.error('Failed to queue offline request:', error);
      return false;
    }
  },

  /**
   * Specific helper for sales (used in Cart screen)
   */
  async saveSaleLocally(saleData: any) {
    // We use the full URL for the sale endpoint
    return this.addToQueue(`${API_BASE_URL}/sales`, 'POST', saleData);
  },

  /**
   * Process the queue: Try to send all pending requests
   */
  async syncWithServer() {
    const networkState = await Network.getNetworkStateAsync();
    if (!networkState.isInternetReachable) {
        return;
    }

    try {
      const existing = await AsyncStorage.getItem(QUEUE_KEY);
      if (!existing) return;

      let queue: QueueItem[] = JSON.parse(existing);
      if (queue.length === 0) return;

      console.log(`OfflineService: Attempting to sync ${queue.length} requests...`);
      
      const remainingQueue: QueueItem[] = [];
      let syncedCount = 0;

      for (const item of queue) {
        try {
          const response = await fetch(item.url, {
            method: item.method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item.body),
          });

          if (response.ok) {
            syncedCount++;
          } else {
            // If failed, increment retry count and keep in queue (unless max retries reached)
            console.warn(`Sync failed for item ${item.id} with status ${response.status}`);
            item.retryCount = (item.retryCount || 0) + 1;
            
            if (item.retryCount < 20) { 
                remainingQueue.push(item);
            }
          }
        } catch (error) {
          // Network error during fetch, keep in queue
          remainingQueue.push(item);
        }
      }

      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remainingQueue));
      
      if (syncedCount > 0) {
        console.log(`OfflineService: Successfully synced ${syncedCount} items.`);
      }
    } catch (error) {
      console.error('OfflineService: Sync process failed:', error);
    }
  }
};