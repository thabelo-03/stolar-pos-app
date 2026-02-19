import { useCallback, useState } from 'react';
import { API_BASE_URL } from './api';
import { useActiveShop } from './use-active-shop';

export function useProducts() {
  const { shopId, loading: shopLoading } = useActiveShop();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchProducts = useCallback(async () => {
    if (shopLoading) return [];
    
    setLoading(true);
    try {
      let url = `${API_BASE_URL}/products`;
      if (shopId) {
        url += `?shopId=${shopId}`;
      }
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
            setProducts(data);
            return data;
        }
      }
      setProducts([]);
      return [];
    } catch (error) {
      console.log("Error fetching products", error);
      return [];
    } finally {
      setLoading(false);
    }
  }, [shopId, shopLoading]);

  return { products, loading, fetchProducts, setProducts };
}