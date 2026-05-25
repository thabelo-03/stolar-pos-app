import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL } from '../app/config';

// Global state store for active shop
let activeShopState: {
  shopId: string | null;
  shopName: string | null;
  userRole: string | null;
  userId: string | null;
  loading: boolean;
} = {
  shopId: null,
  shopName: null,
  userRole: null,
  userId: null,
  loading: true,
};

const listeners = new Set<(state: typeof activeShopState) => void>();

function updateGlobalState(newState: Partial<typeof activeShopState>) {
  activeShopState = { ...activeShopState, ...newState };
  listeners.forEach((listener) => listener(activeShopState));
}

export async function refreshActiveShopGlobal() {
  updateGlobalState({ loading: true });
  try {
    const storedUserId = await AsyncStorage.getItem('userId');
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

    let shopName: string | null = null;
    if (activeShopId) {
      try {
        const shopRes = await fetch(`${API_BASE_URL}/shops/${activeShopId}`);
        if (shopRes.ok) {
          const shopData = await shopRes.json();
          shopName = shopData.name;
        }
      } catch (e) {}
    }

    updateGlobalState({
      userId: storedUserId,
      shopId: activeShopId,
      userRole: role,
      shopName,
      loading: false,
    });
  } catch (error) {
    console.error("Error in refreshActiveShopGlobal", error);
    updateGlobalState({ loading: false });
  }
}

// Initial fetch
refreshActiveShopGlobal();

export function useActiveShop() {
  const [state, setState] = useState(activeShopState);

  useEffect(() => {
    setState(activeShopState);
    const listener = (newState: typeof activeShopState) => {
      setState(newState);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return {
    shopId: state.shopId,
    shopName: state.shopName,
    userRole: state.userRole,
    userId: state.userId,
    loading: state.loading,
    refreshShop: refreshActiveShopGlobal,
  };
}