import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL } from '../app/config';

export function useActiveShop() {
  const [shopId, setShopId] = useState<string | null>(null);
  const [shopName, setShopName] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchActiveShop = useCallback(async () => {
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

      if (activeShopId) {
        try {
          const shopRes = await fetch(`${API_BASE_URL}/shops/${activeShopId}`);
          if (shopRes.ok) {
            const shopData = await shopRes.json();
            setShopName(shopData.name);
          }
        } catch (e) {}
      } else {
        setShopName(null);
      }
    } catch (error) {
      console.error("Error in useActiveShop", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActiveShop();
  }, [fetchActiveShop]);

  return { shopId, shopName, userRole, userId, loading, refreshShop: fetchActiveShop };
}