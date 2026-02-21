import { useCallback, useState } from 'react';
import { API_BASE_URL } from './api';
import { useActiveShop } from './use-active-shop';

interface FetchSalesOptions {
  page?: number;
  limit?: number;
  startDate?: Date;
  endDate?: Date;
  refunded?: boolean;
  endpoint?: 'recent' | 'all';
}

export function useSales() {
  const { shopId, userRole, userId, loading: shopLoading } = useActiveShop();
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const fetchSales = useCallback(async (options: FetchSalesOptions = {}) => {
    if (shopLoading) return null;

    const { 
      page = 1, 
      limit = 20, 
      startDate, 
      endDate, 
      refunded, 
      endpoint = 'recent' 
    } = options;

    setLoading(true);

    try {
      const baseUrl = endpoint === 'recent' ? `${API_BASE_URL}/sales/recent` : `${API_BASE_URL}/sales`;
      const params: string[] = [];
      
      if (endpoint === 'recent') {
        params.push(`limit=${limit}`);
        params.push(`page=${page}`);
      }

      if (userId) {
        if (shopId && userRole !== 'admin') params.push(`shopId=${shopId}`);
        if (userRole === 'cashier') params.push(`cashierId=${userId}`);
      }

      if (refunded) params.push(`refunded=true`);
      
      if (startDate && endDate) {
         const start = new Date(startDate); start.setHours(0,0,0,0);
         const end = new Date(endDate); end.setHours(23,59,59,999);
         params.push(`startDate=${start.toISOString()}`);
         params.push(`endDate=${end.toISOString()}`);
      }

      const finalUrl = `${baseUrl}?${params.join('&')}`;
      const response = await fetch(finalUrl);
      const data = await response.json();

      if (response.ok && Array.isArray(data)) {
        if (endpoint === 'recent') {
           setHasMore(data.length >= limit);
           setSales(prev => page === 1 ? data : [...prev, ...data]);
        } else {
           setSales(data);
        }
        return data;
      }
      return null;
    } catch (e) {
      console.log("Error fetching sales", e);
      return null;
    } finally {
      setLoading(false);
    }
  }, [shopId, userRole, userId, shopLoading]);

  return { sales, loading, fetchSales, hasMore, setSales };
}