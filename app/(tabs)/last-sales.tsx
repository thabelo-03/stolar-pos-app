import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Platform, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '../../components/themed-text';
import { ThemedView } from '../../components/themed-view';
import { useThemeColor } from '../../hooks/use-theme-color';
import { API_BASE_URL } from './api';

export default function LastSalesScreen() {
  const router = useRouter();
  const textColor = useThemeColor({}, 'text');
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showRefundedOnly, setShowRefundedOnly] = useState(false);
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [filterByDate, setFilterByDate] = useState(false);

  const fetchSales = async (pageNumber = 1) => {
    try {
      // Attempt to fetch from API
      const response = await fetch(`${API_BASE_URL}/sales/recent?limit=10&page=${pageNumber}`);
      const data = await response.json();
      
      if (response.ok && Array.isArray(data)) {
        if (data.length < 10) setHasMore(false);
        setPage(pageNumber);

        if (pageNumber === 1) {
          setSales(data);
        } else {
          setSales((prev) => [...prev, ...data]);
        }
      } else {
        // Fallback mock data for demonstration
        throw new Error('API not ready');
      }
    } catch (error) {
      if (pageNumber === 1) {
        // Mock data if API fails
        setSales([
          { id: '1', time: '10:30 AM', date: new Date().toISOString(), total: 25.50, items: '2x Coffee, Bagel' },
          { id: '2', time: '11:15 AM', date: new Date().toISOString(), total: 12.00, items: 'Sandwich' },
          { id: '3', time: '12:45 PM', date: new Date().toISOString(), total: 8.50, items: 'Green Tea, Cookie' },
          { id: '4', time: '01:20 PM', date: new Date().toISOString(), total: 45.00, items: 'Lunch Special x3' },
          { id: '5', time: '02:10 PM', date: new Date().toISOString(), total: 5.00, items: 'Espresso' },
        ]);
      }
      setHasMore(false);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSales(1);
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchSales(1);
  };

  const onChangeDate = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setDate(selectedDate);
      setFilterByDate(true);
    }
  };

  const filteredSales = useMemo(() => {
    let data = sales;

    if (showRefundedOnly) {
      data = data.filter(item => item.status === 'refunded');
    }

    if (filterByDate) {
      const target = date.toDateString();
      data = data.filter(item => item.date && new Date(item.date).toDateString() === target);
    }

    if (!searchQuery) return data;
    const lowerText = searchQuery.toLowerCase();
    return data.filter((item) => {
      // Handle items as array (from DB) or string (mock data)
      const itemsString = Array.isArray(item.items) 
        ? item.items.map((i: any) => i.name).join(' ').toLowerCase()
        : (item.items || '').toLowerCase();

      return itemsString.includes(lowerText) ||
      (item.time && item.time.toLowerCase().includes(lowerText)) ||
      ((item.total || item.amount || item.totalUSD || 0).toString().includes(lowerText));
    });
  }, [sales, searchQuery, showRefundedOnly, filterByDate, date]);

  const stats = useMemo(() => {
    const total = filteredSales.reduce((acc, curr) => acc + (curr.total || curr.amount || curr.totalUSD || 0), 0);
    return {
      total,
      count: filteredSales.length,
      avg: filteredSales.length ? total / filteredSales.length : 0
    };
  }, [filteredSales]);

  const handleLoadMore = () => {
    if (!loadingMore && hasMore && searchQuery === '') {
      setLoadingMore(true);
      fetchSales(page + 1);
    }
  };

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={textColor} />
      </View>
    );
  };

  const handleRefund = (saleId: string) => {
    Alert.alert(
      'Confirm Refund',
      'Are you sure you want to refund this sale? Stock will be restored.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Refund',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${API_BASE_URL}/sales/${saleId}/refund`, {
                method: 'POST',
              });
              const data = await response.json();
              if (response.ok) {
                Alert.alert('Success', 'Sale refunded successfully');
                fetchSales(1); // Refresh list
              } else {
                Alert.alert('Error', data.message || 'Failed to refund sale');
              }
            } catch (error) {
              Alert.alert('Error', 'Could not connect to server');
            }
          }
        }
      ]
    );
  };

  const getPaymentIcon = (method: string) => {
    const m = (method || '').toLowerCase();
    if (m.includes('card')) return 'card-outline';
    if (m.includes('cash')) return 'cash-outline';
    return 'wallet-outline';
  };

  return (
    <ThemedView style={styles.container}>
      {/* Header Section */}
      <View style={styles.header}>
        <View style={styles.topRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Sales History</Text>
          <View style={{ width: 24 }} /> 
        </View>

        {/* Stats Cards */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Revenue</Text>
            <Text style={styles.statValue}>${stats.total.toFixed(2)}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Sales</Text>
            <Text style={styles.statValue}>{stats.count}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Average</Text>
            <Text style={styles.statValue}>${stats.avg.toFixed(2)}</Text>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#64748b" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search receipts..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Chips */}
        <View style={styles.filterRow}>
          <TouchableOpacity 
            style={[styles.filterChip, !showRefundedOnly && !filterByDate && styles.activeFilterChip]} 
            onPress={() => {
              setShowRefundedOnly(false);
              setFilterByDate(false);
            }}
          >
            <Text style={[styles.filterText, !showRefundedOnly && !filterByDate && styles.activeFilterText]}>All Sales</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.filterChip, showRefundedOnly && styles.activeFilterChip]} 
            onPress={() => setShowRefundedOnly(true)}
          >
            <Text style={[styles.filterText, showRefundedOnly && styles.activeFilterText]}>Refunded Only</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.filterChip, filterByDate && styles.activeFilterChip, { flexDirection: 'row', alignItems: 'center', gap: 6 }]} 
            onPress={() => setShowDatePicker(true)}
          >
            <Ionicons name="calendar-outline" size={16} color={filterByDate ? "#1e40af" : "#bfdbfe"} />
            <Text style={[styles.filterText, filterByDate && styles.activeFilterText]}>
              {filterByDate ? date.toLocaleDateString() : 'Date'}
            </Text>
          </TouchableOpacity>
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={date}
            mode="date"
            display="default"
            onChange={onChangeDate}
          />
        )}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={textColor} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={filteredSales}
          keyExtractor={(item) => item.id || item._id || Math.random().toString()}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={textColor} />}
          renderItem={({ item }) => {
            const isRefunded = item.status === 'refunded';
            const itemCount = Array.isArray(item.items) ? item.items.length : 1;
            
            return (
              <View style={[styles.card, isRefunded && styles.refundedCard]}>
                <View style={styles.cardLeft}>
                  <View style={[styles.iconCircle, isRefunded ? styles.iconRefunded : styles.iconSuccess]}>
                    <Ionicons name={isRefunded ? "return-up-back" : "receipt-outline"} size={20} color={isRefunded ? "#ef4444" : "#10b981"} />
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {Array.isArray(item.items) 
                        ? item.items.map((i: any) => i.name).join(', ')
                        : (item.items || 'Unknown Items')}
                    </Text>
                    <Text style={styles.cardSub}>
                      {itemCount} item{itemCount !== 1 ? 's' : ''} • {item.time || (item.date ? new Date(item.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Just now')}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardRight}>
                  <Text style={[styles.amountText, isRefunded && styles.refundedText]}>
                    ${Number(item.total || item.amount || item.totalUSD || 0).toFixed(2)}
                  </Text>
                  {!isRefunded ? (
                    <TouchableOpacity onPress={() => handleRefund(item.id || item._id)} style={styles.miniRefundBtn}>
                      <Text style={styles.miniRefundText}>Refund</Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={styles.refundedBadge}>REFUNDED</Text>
                  )}
                </View>
              </View>
            );
          }}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<ThemedText style={{ textAlign: 'center', marginTop: 20 }}>No recent sales found.</ThemedText>}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.2}
          ListFooterComponent={renderFooter}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    backgroundColor: '#1e40af',
    paddingTop: 50,
    paddingBottom: 25,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    marginBottom: 10,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  backButton: { padding: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: 'white' },
  
  statsRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 16, padding: 15, justifyContent: 'space-between', marginBottom: 20 },
  statCard: { alignItems: 'center', flex: 1 },
  statLabel: { color: '#bfdbfe', fontSize: 12, fontWeight: '600', marginBottom: 4 },
  statValue: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 10 },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, fontSize: 16, color: '#1e293b', height: '100%' },

  list: { padding: 20, gap: 12, paddingBottom: 40 },
  
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  refundedCard: { backgroundColor: '#fef2f2', borderColor: '#fee2e2', borderWidth: 1 },
  cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 },
  iconCircle: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  iconSuccess: { backgroundColor: '#ecfdf5' },
  iconRefunded: { backgroundColor: '#fef2f2' },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: 'bold', color: '#1e293b', marginBottom: 2 },
  cardSub: { fontSize: 12, color: '#64748b' },
  cardRight: { alignItems: 'flex-end' },
  amountText: { fontSize: 16, fontWeight: 'bold', color: '#1e293b', marginBottom: 4 },
  refundedText: { color: '#ef4444', textDecorationLine: 'line-through', opacity: 0.6 },
  miniRefundBtn: { backgroundColor: '#f1f5f9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  miniRefundText: { fontSize: 11, fontWeight: '600', color: '#64748b' },
  refundedBadge: { fontSize: 10, fontWeight: 'bold', color: '#ef4444', backgroundColor: '#fee2e2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },

  footerLoader: { paddingVertical: 20, alignItems: 'center' },

  filterRow: { flexDirection: 'row', marginTop: 15, gap: 10 },
  filterChip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)' },
  activeFilterChip: { backgroundColor: 'white' },
  filterText: { color: '#bfdbfe', fontSize: 13, fontWeight: '600' },
  activeFilterText: { color: '#1e40af' },
});