import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useState } from 'react';
import { API_BASE_URL } from '../app/config';

export function useNotifications() {
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const userId = await AsyncStorage.getItem('userId');
      if (userId) {
        const response = await fetch(`${API_BASE_URL}/notifications/${userId}`);
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data)) {
            const count = data.filter((n: any) => !n.isRead).length;
            setUnreadCount(count);
          }
        }
      }
    } catch (e) {
      // Silent fail
    }
  }, []);

  return { unreadCount, fetchUnreadCount };
}