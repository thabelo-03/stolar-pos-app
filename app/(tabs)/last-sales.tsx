import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Print from 'expo-print';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Platform, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '../../components/themed-text';
import { ThemedView } from '../../components/themed-view';
import { useThemeColor } from '../../hooks/use-theme-color';
import { API_BASE_URL } from '../config';
import { useActiveShop } from '@/hooks/use-active-shop';
import { useSales } from '@/hooks/use-sales';
import { useRates } from '@/hooks/use-rates';

export default function LastSalesScreen() {
  const router = useRouter();
  const textColor = useThemeColor({}, 'text');
  // Removed local sales/loading state in favor of hook
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showRefundedOnly, setShowRefundedOnly] = useState(false);
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<'start' | 'end'>('start');
  const [filterByDate, setFilterByDate] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundReason, setRefundReason] = useState('');
  const [refundTargetId, setRefundTargetId] = useState<string | null>(null);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const insets = useSafeAreaInsets();

  const flatListRef = useRef<FlatList>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const [currency, setCurrency] = useState<'USD' | 'ZAR' | 'ZiG'>('USD');
  const { shopId, loading: shopLoading } = useActiveShop();
  const { sales, loading, fetchSales: fetchSalesHook, hasMore, setSales } = useSales();
  const { rates } = useRates();

  const convert = (amount: number) => {
    if (currency === 'ZAR') return amount * rates.ZAR;
    if (currency === 'ZiG') return amount * rates.ZiG;
    return amount;
  };

  const symbol = currency === 'USD' ? '$' : currency === 'ZAR' ? 'R' : 'ZiG';

  const loadSales = async (pageNumber = 1) => {
    if (shopLoading && pageNumber === 1) return;
    if (pageNumber > 1) setLoadingMore(true);

    await fetchSalesHook({
      page: pageNumber,
      limit: 10,
      refunded: showRefundedOnly,
      startDate: filterByDate ? startDate : undefined,
      endDate: filterByDate ? endDate : undefined,
      endpoint: 'recent'
    });
    
    setPage(pageNumber);
    setLoadingMore(false);
    setRefreshing(false);
  };

  useEffect(() => {
    if (!shopLoading) {
      loadSales(1);
    }
  }, [showRefundedOnly, filterByDate, startDate, endDate, shopLoading, shopId]);

  const onRefresh = () => {
    setRefreshing(true);
    loadSales(1);
  };

  const onChangeDate = (event: any, selectedDate?: Date) => {
    setShowPicker(Platform.OS === 'ios');
    if (selectedDate) {
      if (pickerMode === 'start') {
        setStartDate(selectedDate);
        if (selectedDate > endDate) setEndDate(selectedDate);
      } else {
        setEndDate(selectedDate);
        if (selectedDate < startDate) setStartDate(selectedDate);
      }
      setFilterByDate(true);
    }
  };

  const openPicker = (mode: 'start' | 'end') => {
    setPickerMode(mode);
    setShowPicker(true);
  };

  const filteredSales = useMemo(() => {
    let data = sales;

    if (showRefundedOnly) {
      data = data.filter(item => item.refunded);
    }

    if (filterByDate) {
      const start = new Date(startDate); start.setHours(0,0,0,0);
      const end = new Date(endDate); end.setHours(23,59,59,999);
      // Server handles main filtering, but we keep this for consistency with loaded data
      data = data.filter(item => {
        if (!item.date) return false;
        const d = new Date(item.date);
        return d >= start && d <= end;
      });
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
  }, [sales, searchQuery, showRefundedOnly, filterByDate, startDate, endDate]);

  const stats = useMemo(() => {
    const total = filteredSales.reduce((acc, curr) => acc + convert(curr.total || curr.amount || curr.totalUSD || 0), 0);
    return {
      total,
      count: filteredSales.length,
      avg: filteredSales.length ? total / filteredSales.length : 0
    };
  }, [filteredSales, currency, rates]);

  const handleLoadMore = () => {
    if (!loadingMore && hasMore && searchQuery === '') {
      setLoadingMore(true);
      loadSales(page + 1);
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
    setRefundTargetId(saleId);
    setRefundReason('');
    setShowRefundModal(true);
  };

  const confirmRefund = async () => {
    if (!refundTargetId) return;
    try {
      const response = await fetch(`${API_BASE_URL}/sales/${refundTargetId}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: refundReason })
      });
      const data = await response.json();
      if (response.ok) {
        Alert.alert('Success', 'Sale refunded successfully');
        loadSales(1); 
        setShowRefundModal(false);
      } else {
        Alert.alert('Error', data.message || 'Failed to refund sale');
      }
    } catch (error) { Alert.alert('Error', 'Could not connect to server'); }
  };

  const getPaymentIcon = (method: string) => {
    const m = (method || '').toLowerCase();
    if (m.includes('card')) return 'card-outline';
    if (m.includes('cash')) return 'cash-outline';
    return 'wallet-outline';
  };

  const handleSalePress = (sale: any) => {
    setSelectedSale(sale);
    setDetailsModalVisible(true);
  };

  const handleShareReceipt = async () => {
    if (!selectedSale) return;

    const html = `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; color: #333; }
            h1 { text-align: center; margin-bottom: 5px; color: #1e40af; }
            .subtitle { text-align: center; color: #666; margin-bottom: 20px; font-size: 14px; }
            .divider { border-bottom: 1px dashed #ccc; margin: 20px 0; }
            .item-row { display: flex; justify-content: space-between; margin-bottom: 8px; }
            .item-name { font-weight: bold; }
            .total-row { display: flex; justify-content: space-between; font-weight: bold; font-size: 18px; margin-top: 10px; }
            .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #999; }
          </style>
        </head>
        <body>
          <h1>Stolar POS</h1>
          <div class="subtitle">
            Date: ${new Date(selectedSale.date).toLocaleString()}<br>
            Receipt #: ${selectedSale.id || selectedSale._id}<br>
            Cashier: ${selectedSale.cashierName || 'N/A'}
          </div>
          
          <div class="divider"></div>

          ${(selectedSale.items || []).map((item: any) => `
            <div class="item-row">
              <div>
                <div class="item-name">${item.name}</div>
                <div style="font-size: 12px; color: #666;">${item.quantity} x $${Number(item.price).toFixed(2)}</div>
              </div>
              <div>$${(Number(item.price) * Number(item.quantity)).toFixed(2)}</div>
            </div>
          `).join('')}

          <div class="divider"></div>

          <div class="total-row">
            <div>Total</div>
            <div>$${Number(selectedSale.total || selectedSale.amount || selectedSale.totalUSD || 0).toFixed(2)}</div>
          </div>
          
          <div class="footer">
            Thank you for your business!
          </div>
        </body>
      </html>
    `;

    try {
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (error) {
      Alert.alert('Error', 'Failed to share receipt');
    }
  };

  return (
    <ThemedView style={styles.container}>
      {/* Header Section */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
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
            <Text style={styles.statValue}>{symbol} {stats.total.toFixed(2)}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Sales</Text>
            <Text style={styles.statValue}>{stats.count}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Average</Text>
            <Text style={styles.statValue}>{symbol} {stats.avg.toFixed(2)}</Text>
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
            style={[styles.filterChip, { backgroundColor: '#e0f2fe', borderColor: '#bae6fd' }]} 
            onPress={() => setCurrency(prev => prev === 'USD' ? 'ZAR' : prev === 'ZAR' ? 'ZiG' : 'USD')}
          >
            <Text style={[styles.filterText, { color: '#0284c7' }]}>{currency}</Text>
          </TouchableOpacity>

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
          
          {!filterByDate ? (
            <TouchableOpacity 
              style={[styles.filterChip, { flexDirection: 'row', alignItems: 'center', gap: 6 }]} 
              onPress={() => {
                setFilterByDate(true);
                setStartDate(new Date());
                setEndDate(new Date());
              }}
            >
              <Ionicons name="calendar-outline" size={16} color="#bfdbfe" />
              <Text style={styles.filterText}>Date Range</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity style={[styles.filterChip, styles.activeFilterChip]} onPress={() => openPicker('start')}>
                <Text style={[styles.filterText, styles.activeFilterText]}>
                  {startDate.toLocaleDateString(undefined, {month:'numeric', day:'numeric'})}
                </Text>
              </TouchableOpacity>
              <Text style={{color: '#bfdbfe', alignSelf: 'center'}}>-</Text>
              <TouchableOpacity style={[styles.filterChip, styles.activeFilterChip]} onPress={() => openPicker('end')}>
                <Text style={[styles.filterText, styles.activeFilterText]}>
                  {endDate.toLocaleDateString(undefined, {month:'numeric', day:'numeric'})}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {showPicker && (
          <DateTimePicker
            value={pickerMode === 'start' ? startDate : endDate}
            mode="date"
            display="default"
            onChange={onChangeDate}
          />
        )}
      </View>

      {loading && page === 1 ? (
        <ActivityIndicator size="large" color={textColor} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          ref={flatListRef}
          data={filteredSales}
          keyExtractor={(item) => item.id || item._id || Math.random().toString()}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={textColor} />}
          renderItem={({ item }) => {
            const isRefunded = item.refunded;
            const itemCount = Array.isArray(item.items) ? item.items.length : 1;
            
            return (
              <TouchableOpacity 
                style={[styles.card, isRefunded && styles.refundedCard]} 
                onPress={() => handleSalePress(item)}
                activeOpacity={0.7}
              >
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
                      {itemCount} item{itemCount !== 1 ? 's' : ''} • {item.date ? new Date(item.date).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : (item.time || 'Just now')}
                      {item.cashierName ? ` • ${item.cashierName}` : ''}
                    </Text>
                    {isRefunded && item.refundReason && (
                      <Text style={styles.refundReason}>Reason: {item.refundReason}</Text>
                    )}
                  </View>
                </View>

                <View style={styles.cardRight}>
                  <Text style={[styles.amountText, isRefunded && styles.refundedText]}>
                    {symbol} {convert(Number(item.total || item.amount || item.totalUSD || 0)).toFixed(2)}
                  </Text>
                  {!isRefunded ? (
                    <TouchableOpacity onPress={() => handleRefund(item.id || item._id)} style={styles.miniRefundBtn}>
                      <Text style={styles.miniRefundText}>Refund</Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={styles.refundedBadge}>REFUNDED</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<ThemedText style={{ textAlign: 'center', marginTop: 20 }}>No recent sales found.</ThemedText>}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.2}
          ListFooterComponent={renderFooter}
          onScroll={(e) => setShowScrollTop(e.nativeEvent.contentOffset.y > 300)}
          scrollEventThrottle={16}
        />
      )}

      {showScrollTop && (
        <TouchableOpacity 
          style={styles.scrollTopButton} 
          onPress={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })}
        >
          <Ionicons name="arrow-up" size={24} color="white" />
        </TouchableOpacity>
      )}

      <Modal visible={showRefundModal} animationType="fade" transparent onRequestClose={() => setShowRefundModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Process Refund</Text>
            
            {refundTargetId && (() => {
              const sale = sales.find(s => (s.id || s._id) === refundTargetId);
              if (sale && sale.items && Array.isArray(sale.items)) {
                return (
                  <View style={{ maxHeight: 150, width: '100%', marginBottom: 10 }}>
                    <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#94a3b8', marginBottom: 5 }}>ITEMS</Text>
                    <FlatList
                      data={sale.items}
                      keyExtractor={(item, index) => index.toString()}
                      renderItem={({ item }) => (
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                          <Text style={{ fontSize: 14, color: '#334155', flex: 1 }} numberOfLines={1}>
                            {item.quantity} x {item.name}
                          </Text>
                          <Text style={{ fontSize: 14, fontWeight: '600', color: '#1e293b' }}>
                            {symbol} {convert(Number(item.price || 0) * Number(item.quantity || 0)).toFixed(2)}
                          </Text>
                        </View>
                      )}
                    />
                    <View style={{ height: 1, backgroundColor: '#e2e8f0', marginVertical: 10 }} />
                  </View>
                );
              }
              return null;
            })()}

            <Text style={{marginBottom: 15, color: '#64748b'}}>Stock will be restored automatically.</Text>
            
            <Text style={{fontWeight: '600', marginBottom: 5, color: '#1e293b'}}>Reason for Refund</Text>
            <TextInput
              style={styles.refundInput}
              placeholder="e.g. Defective item, Customer changed mind"
              value={refundReason}
              onChangeText={setRefundReason}
              multiline
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setShowRefundModal(false)}><Text style={styles.btnText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#ef4444' }]} onPress={confirmRefund}><Text style={[styles.btnText, {color: 'white'}]}>Confirm Refund</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Sale Details Modal */}
      <Modal visible={detailsModalVisible} animationType="fade" transparent onRequestClose={() => setDetailsModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15}}>
              <Text style={styles.modalTitle}>Receipt Details</Text>
              <TouchableOpacity onPress={() => setDetailsModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            {selectedSale && (
              <>
                <View style={{marginBottom: 15}}>
                  <Text style={{color: '#64748b', fontSize: 14, marginBottom: 4}}>
                    {selectedSale.date ? new Date(selectedSale.date).toLocaleString() : 'Unknown Date'}
                  </Text>
                  <Text style={{color: '#64748b', fontSize: 14, marginBottom: 4}}>
                    Method: {selectedSale.paymentMethod || 'Cash'}
                  </Text>
                  {selectedSale.cashierName && (
                    <Text style={{color: '#64748b', fontSize: 14}}>
                      Cashier: {selectedSale.cashierName}
                    </Text>
                  )}
                </View>

                <View style={{borderBottomWidth: 1, borderBottomColor: '#e2e8f0', marginBottom: 10}} />

                <FlatList
                  data={selectedSale.items || []}
                  keyExtractor={(item, index) => index.toString()}
                  renderItem={({ item }) => (
                    <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8}}>
                      <View style={{flex: 1, marginRight: 10}}>
                        <Text style={{fontWeight: '600', color: '#1e293b'}}>{item.name}</Text>
                        <Text style={{fontSize: 12, color: '#64748b'}}>{item.quantity} x {symbol} {convert(Number(item.price || 0)).toFixed(2)}</Text>
                      </View>
                      <Text style={{fontWeight: 'bold', color: '#1e293b'}}>
                        {symbol} {convert(Number(item.price || 0) * Number(item.quantity || 0)).toFixed(2)}
                      </Text>
                    </View>
                  )}
                  style={{marginBottom: 15}}
                />

                <View style={{borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
                  <Text style={{fontSize: 18, fontWeight: 'bold', color: '#1e293b'}}>Total</Text>
                  <Text style={{fontSize: 24, fontWeight: 'bold', color: '#1e40af'}}>
                    {symbol} {convert(Number(selectedSale.total || selectedSale.amount || selectedSale.totalUSD || 0)).toFixed(2)}
                  </Text>
                </View>
                
                {selectedSale.refunded && (
                   <View style={{marginTop: 15, padding: 10, backgroundColor: '#fee2e2', borderRadius: 8}}>
                     <Text style={{color: '#ef4444', fontWeight: 'bold', textAlign: 'center'}}>REFUNDED</Text>
                     {selectedSale.refundReason && <Text style={{color: '#ef4444', textAlign: 'center', fontSize: 12, marginTop: 4}}>{selectedSale.refundReason}</Text>}
                   </View>
                )}

                <TouchableOpacity style={styles.shareBtn} onPress={handleShareReceipt}>
                  <Ionicons name="share-social-outline" size={20} color="white" style={{ marginRight: 8 }} />
                  <Text style={styles.shareBtnText}>Share Receipt</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    backgroundColor: '#1e40af',
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

  list: { padding: 20, gap: 12, paddingBottom: 120 },
  
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
  refundReason: { fontSize: 11, color: '#ef4444', marginTop: 4, fontStyle: 'italic' },
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

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: 'white', borderRadius: 16, padding: 20, width: '100%', maxWidth: 400 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginBottom: 5 },
  refundInput: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 10, height: 80, textAlignVertical: 'top', fontSize: 16, marginBottom: 20 },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalBtn: { flex: 1, padding: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cancelBtn: { backgroundColor: '#f1f5f9' },
  btnText: { fontWeight: 'bold', fontSize: 16, color: '#64748b' },
  shareBtn: { 
    backgroundColor: '#1e40af', 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: 15, 
    borderRadius: 12, 
    marginTop: 20 
  },
  shareBtnText: { 
    color: 'white', 
    fontWeight: 'bold', 
    fontSize: 16 
  },
  scrollTopButton: {
    position: 'absolute',
    bottom: 110,
    right: 20,
    backgroundColor: '#1e40af',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84,
  },
});