import { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL } from './api';
import { useActiveShop } from './use-active-shop';

export function useRates() {
  const { shopId, loading: shopLoading } = useActiveShop();
  const [rates, setRates] = useState<{ ZAR: number; ZiG: number; updatedAt?: string }>({ ZAR: 19.2, ZiG: 26.5 });
  const [loading, setLoading] = useState(false);

  const fetchRates = useCallback(async () => {
    if (shopLoading) return;
    
    setLoading(true);
    try {
      let endpoint = `${API_BASE_URL}/shops/rates`;
      if (shopId) {
        endpoint = `${API_BASE_URL}/shops/rates/${shopId}`;
      }

      const response = await fetch(endpoint); 
      if (response.ok) {
        const data = await response.json();
        if (data.rates) {
          setRates(data.rates);
        }
      }
    } catch (error) {
      console.log("Using default fallback rates due to connectivity.");
    } finally {
      setLoading(false);
    }
  }, [shopId, shopLoading]);

  useEffect(() => {
    fetchRates();
  }, [fetchRates]);

  return { rates, loading, fetchRates };
}