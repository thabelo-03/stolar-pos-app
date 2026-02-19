import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { API_BASE_URL } from './api';

export function useActiveShop() {
  const [shopId, setShopId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchActiveShop = async () => {
    setLoading(true);
    try {
      const storedUserId = await AsyncStorage.getItem('userId');
      setUserId(storedUserId);

      let activeShopId = await AsyncStorage.getItem('shopId');
      let role = await AsyncStorage.getItem('userRole');

      if (storedUserId && (!activeShopId || !role)) {
        try {
          const userRes = await fetch(`${API_BASE_URL}/users/${storedUserId}`);
          if (userRes.ok) {
            const user = await userRes.json();
            if (!activeShopId) activeShopId = user.shopId;
            if (!role) role = user.role;
          }
        } catch (e) {
          console.log("Error fetching user details in useActiveShop");
        }
      }

      setShopId(activeShopId);
      setUserRole(role);
    } catch (error) {
      console.error("Error in useActiveShop", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveShop();
  }, []);

  return { shopId, userRole, userId, loading, refreshShop: fetchActiveShop };
}