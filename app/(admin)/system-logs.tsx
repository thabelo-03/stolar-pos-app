import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  FlatList,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface LogEntry {
  id: string;
  level: 'info' | 'warning' | 'error' | 'success';
  timestamp: string;
  message: string;
}

const LOG_MESSAGES = {
  info: [
    'Stock sync completed — 217 records updated',
    'Cloud backup triggered automatically (3.2 MB)',
    'Terminal printer status: READY',
    'Cashier session started on Terminal #2',
    'WebSocket client connected from 192.168.1.44',
    'Sales report dispatched to administrator',
    'Subscription check: Active (183 days remaining)',
    'Database optimization complete (0.3ms avg query)',
    'Offline queue flushed — 6 transactions synced',
    'Barcode scan registered: EAN-13 #6001070000001',
  ],
  warning: [
    'High DB connection pool usage (18/20)',
    'Minor network latency jitter detected (480ms)',
    'Scanner lens calibration overdue',
    'Low battery on Terminal #3 (14%)',
    'Slow response from replica cluster (720ms)',
    'Cash drawer opened without receipt generation',
  ],
  error: [
    'Failed to connect to thermal printer on port 9100',
    'DB write lock contention on table sales_records',
    'POST /api/payments/verify — 503 Service Unavailable',
    'Auth error: Invalid session token for cashier_04',
    'Failed sync after 3 retries — queuing offline',
  ],
  success: [
    'Payment verified and committed — R450.00',
    'Inventory reconciliation completed successfully',
    'Manager subscription renewed — 30 days added',
    'Shop registration completed for "Main Street Store"',
  ],
};

const LEVEL_CONFIG = {
  info:    { color: '#38bdf8', prefix: 'INFO ', short: 'INF' },
  success: { color: '#10b981', prefix: 'OK   ', short: 'OK ' },
  warning: { color: '#f59e0b', prefix: 'WARN ', short: 'WRN' },
  error:   { color: '#ef4444', prefix: 'ERROR', short: 'ERR' },
};

const INITIAL_LOGS: LogEntry[] = [
  { id: '1', level: 'success', timestamp: '15:34:08', message: 'Server started on port 8080 (Production)' },
  { id: '2', level: 'info', timestamp: '15:34:12', message: 'SQLite database sync — 184 products loaded' },
  { id: '3', level: 'info', timestamp: '15:34:28', message: 'Cashier Sarah Connor logged in (Terminal #2)' },
  { id: '4', level: 'warning', timestamp: '15:35:02', message: 'Slow response from backup cluster (420ms)' },
  { id: '5', level: 'info', timestamp: '15:35:10', message: 'Offline queue flushed — 4 transactions synced' },
  { id: '6', level: 'error', timestamp: '15:35:45', message: 'POST /api/payments/verify — Timeout (10000ms)' },
  { id: '7', level: 'info', timestamp: '15:36:01', message: 'Stock update: Sprite 330ml (-1 unit, sale #9403)' },
  { id: '8', level: 'success', timestamp: '15:36:05', message: 'Cash drawer opened — Receipt #9403 printed' },
  { id: '9', level: 'info', timestamp: '15:36:12', message: 'Manager: Profit-loss report generated (shop #1)' },
  { id: '10', level: 'warning', timestamp: '15:36:44', message: 'Camera permission requested by device scanner' },
  { id: '11', level: 'info', timestamp: '15:37:02', message: 'WebSocket: Client #82 connected (192.168.1.12)' },
  { id: '12', level: 'error', timestamp: '15:37:15', message: 'Auth error: Invalid session for cashier_04' },
];

export default function SystemLogs() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [logs, setLogs] = useState<LogEntry[]>(INITIAL_LOGS);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'info' | 'warning' | 'error' | 'success'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [isLive, setIsLive] = useState(true);
  const cursorAnim = useRef(new Animated.Value(1)).current;
  const listRef = useRef<FlatList>(null);

  // Blinking cursor
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(cursorAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
        Animated.timing(cursorAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Simulated live feed
  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => {
      if (Math.random() < 0.4) {
        setLogs(prev => {
          const newEntry = generateLog();
          return [newEntry, ...prev].slice(0, 60);
        });
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [isLive]);

  const generateLog = (): LogEntry => {
    const levels: (keyof typeof LOG_MESSAGES)[] = ['info', 'info', 'info', 'success', 'warning', 'error'];
    const level = levels[Math.floor(Math.random() * levels.length)];
    const opts = LOG_MESSAGES[level];
    const msg = opts[Math.floor(Math.random() * opts.length)];
    const now = new Date();
    return {
      id: `${Date.now()}-${Math.random()}`,
      level,
      timestamp: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`,
      message: msg,
    };
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setLogs(prev => [generateLog(), generateLog(), generateLog(), ...prev].slice(0, 60));
      setRefreshing(false);
    }, 800);
  }, []);

  const handleClearLogs = () => {
    Alert.alert('Clear Console', 'Clear the current session log history?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => setLogs([]) },
    ]);
  };

  const getFilteredLogs = () => {
    let result = logs;
    if (activeTab !== 'all') result = result.filter(l => l.level === activeTab);
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(l => l.message.toLowerCase().includes(q) || l.timestamp.includes(q) || l.level.includes(q));
    }
    return result;
  };

  const handleExportPDF = async () => {
    const activeLogs = getFilteredLogs();
    const html = `
      <html><head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          body { font-family: 'Courier New', monospace; padding: 24px; color: #c9d1d9; background: #0d1117; margin: 0; }
          .header { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
          .header h1 { font-size: 16px; font-weight: 700; margin: 0; color: #58a6ff; text-transform: uppercase; letter-spacing: 1px; }
          .header p { font-size: 11px; color: #8b949e; margin-top: 6px; }
          .counts { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
          .count-pill { background: #161b22; border: 1px solid #30363d; border-radius: 6px; padding: 6px 12px; font-size: 10px; font-weight: 700; }
          table { width: 100%; border-collapse: collapse; font-size: 10px; }
          th { color: #8b949e; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; font-size: 9px; border-bottom: 1px solid #30363d; padding: 8px 6px; text-align: left; }
          td { border-bottom: 1px solid #161b22; padding: 7px 6px; }
          .lvl-info { color: #38bdf8; }
          .lvl-success { color: #10b981; }
          .lvl-warning { color: #f59e0b; }
          .lvl-error { color: #ef4444; }
          .footer { margin-top: 30px; text-align: center; font-size: 9px; color: #8b949e; border-top: 1px solid #30363d; padding-top: 12px; }
        </style>
      </head><body>
        <div class="header">
          <h1>System Audit Log</h1>
          <p>Generated ${new Date().toLocaleString()} · Filter: ${activeTab.toUpperCase()} · Query: "${searchTerm || 'none'}"</p>
        </div>
        <div class="counts">
          <div class="count-pill" style="color:#38bdf8">INFO: ${logs.filter(l=>l.level==='info').length}</div>
          <div class="count-pill" style="color:#10b981">OK: ${logs.filter(l=>l.level==='success').length}</div>
          <div class="count-pill" style="color:#f59e0b">WARN: ${logs.filter(l=>l.level==='warning').length}</div>
          <div class="count-pill" style="color:#ef4444">ERROR: ${logs.filter(l=>l.level==='error').length}</div>
        </div>
        <table>
          <thead><tr><th>Time</th><th>Level</th><th>Message</th></tr></thead>
          <tbody>
            ${activeLogs.map(l => `<tr>
              <td style="color:#8b949e">${l.timestamp}</td>
              <td class="lvl-${l.level}">${LEVEL_CONFIG[l.level].prefix}</td>
              <td style="color:#c9d1d9">${l.message}</td>
            </tr>`).join('')}
          </tbody>
        </table>
        <div class="footer">Stolar POS · System Diagnostics Audit</div>
      </body></html>
    `;
    try {
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch { Alert.alert('Error', 'Failed to export logs'); }
  };

  const filteredLogs = getFilteredLogs();
  const counts = {
    info: logs.filter(l => l.level === 'info').length,
    success: logs.filter(l => l.level === 'success').length,
    warning: logs.filter(l => l.level === 'warning').length,
    error: logs.filter(l => l.level === 'error').length,
  };

  const renderLogLine = ({ item, index }: { item: LogEntry; index: number }) => {
    const cfg = LEVEL_CONFIG[item.level];
    const isFirst = index === 0;
    return (
      <View style={[styles.logLine, isFirst && isLive && styles.logLineNew]}>
        <Text style={styles.logTs}>{item.timestamp}</Text>
        <Text style={[styles.logLevel, { color: cfg.color }]}>{cfg.short}</Text>
        <Text style={[styles.logMsg, { color: item.level === 'error' ? '#fca5a5' : item.level === 'warning' ? '#fde68a' : item.level === 'success' ? '#6ee7b7' : '#94a3b8' }]} numberOfLines={2}>
          {item.message}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color="#475569" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.headerTitle}>System Logs</Text>
              {isLive && (
                <View style={styles.liveBadge}>
                  <Animated.View style={[styles.liveDot, { opacity: cursorAnim }]} />
                  <Text style={styles.liveBadgeText}>LIVE</Text>
                </View>
              )}
            </View>
            <Text style={styles.headerSub}>{filteredLogs.length} events · {logs.length} total</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={[styles.headerBtn, { borderColor: isLive ? 'rgba(16,185,129,0.4)' : 'rgba(245,158,11,0.4)' }]}
              onPress={() => setIsLive(!isLive)}
            >
              <Ionicons name={isLive ? 'pause' : 'play'} size={16} color={isLive ? '#10b981' : '#f59e0b'} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerBtn} onPress={handleExportPDF}>
              <Ionicons name="document-text-outline" size={16} color="#475569" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.headerBtn, { borderColor: 'rgba(239,68,68,0.3)' }]} onPress={handleClearLogs}>
              <Ionicons name="trash-outline" size={16} color="#f87171" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Event Counter Pills */}
        <View style={styles.counterRow}>
          {Object.entries(counts).map(([level, count]) => {
            const cfg = LEVEL_CONFIG[level as keyof typeof LEVEL_CONFIG];
            return (
              <TouchableOpacity
                key={level}
                style={[styles.counterPill, activeTab === level && { borderColor: cfg.color + '60', backgroundColor: cfg.color + '15' }]}
                onPress={() => setActiveTab(prev => prev === level ? 'all' : level as any)}
              >
                <View style={[styles.counterDot, { backgroundColor: cfg.color }]} />
                <Text style={[styles.counterText, { color: activeTab === level ? cfg.color : '#334155' }]}>
                  {cfg.short}: {count}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Search */}
        <View style={styles.searchBox}>
          <Text style={styles.promptSymbol}>$</Text>
          <TextInput
            placeholder="grep terminal events..."
            placeholderTextColor="#1e293b"
            style={styles.searchInput}
            value={searchTerm}
            onChangeText={setSearchTerm}
            autoCapitalize="none"
          />
          <Animated.Text style={[styles.cursor, { opacity: cursorAnim }]}>▮</Animated.Text>
          {searchTerm.length > 0 && (
            <TouchableOpacity onPress={() => setSearchTerm('')}>
              <Ionicons name="close-circle" size={14} color="#334155" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Terminal Feed ── */}
      <View style={styles.terminalBody}>
        {/* Terminal bar */}
        <View style={styles.terminalBar}>
          <View style={styles.termDot} /><View style={[styles.termDot, { backgroundColor: '#f59e0b' }]} /><View style={[styles.termDot, { backgroundColor: '#10b981' }]} />
          <Text style={styles.termBarTitle}>stolar-pos — admin@master ~ /logs</Text>
        </View>

        <FlatList
          ref={listRef}
          data={filteredLogs}
          keyExtractor={item => item.id}
          renderItem={renderLogLine}
          contentContainerStyle={{ paddingBottom: 80 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" colors={['#3b82f6']} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>~ no events matched query</Text>
            </View>
          }
        />
      </View>

      {/* FAB - scroll to top */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}
      >
        <LinearGradient colors={['#1e3a5f', '#0c2340']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fabGradient}>
          <Ionicons name="arrow-up" size={16} color="#38bdf8" />
          <Text style={styles.fabText}>Latest</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020b14' },

  // Header (dark panel)
  header: { backgroundColor: '#0d1117', paddingHorizontal: 14, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#161b22' },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  backBtn: { padding: 7, backgroundColor: '#161b22', borderRadius: 8, marginRight: 10, borderWidth: 1, borderColor: '#21262d' },
  headerTitle: { color: '#c9d1d9', fontSize: 17, fontWeight: '700', fontFamily: 'monospace' },
  headerSub: { color: '#484f58', fontSize: 10, marginTop: 2, fontFamily: 'monospace' },
  headerBtn: { width: 34, height: 34, borderRadius: 8, backgroundColor: '#161b22', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#21262d' },

  // Live badge
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(16,185,129,0.12)', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)' },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#10b981' },
  liveBadgeText: { color: '#10b981', fontSize: 9, fontWeight: '800', fontFamily: 'monospace' },

  // Counter pills
  counterRow: { flexDirection: 'row', gap: 6, marginBottom: 10, flexWrap: 'wrap' },
  counterPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: '#161b22', borderWidth: 1, borderColor: '#21262d' },
  counterDot: { width: 5, height: 5, borderRadius: 3 },
  counterText: { fontSize: 10, fontWeight: '700', fontFamily: 'monospace' },

  // Search / prompt
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0d1117', borderRadius: 8, paddingHorizontal: 10, height: 38, borderWidth: 1, borderColor: '#21262d' },
  promptSymbol: { color: '#10b981', fontSize: 13, fontWeight: '800', fontFamily: 'monospace', marginRight: 8 },
  searchInput: { flex: 1, color: '#c9d1d9', fontSize: 12, fontFamily: 'monospace' },
  cursor: { color: '#10b981', fontSize: 14, fontFamily: 'monospace' },

  // Terminal
  terminalBody: { flex: 1, backgroundColor: '#010409' },
  terminalBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#161b22', paddingHorizontal: 12, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#21262d', gap: 6 },
  termDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#ef4444' },
  termBarTitle: { color: '#484f58', fontSize: 10, fontFamily: 'monospace', marginLeft: 8, flex: 1, textAlign: 'center' },

  // Log line
  logLine: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 12, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#0d1117' },
  logLineNew: { backgroundColor: 'rgba(56,189,248,0.03)' },
  logTs: { color: '#484f58', fontSize: 10, fontFamily: 'monospace', width: 62, marginTop: 1 },
  logLevel: { fontSize: 10, fontFamily: 'monospace', fontWeight: '700', width: 36, marginTop: 1 },
  logMsg: { flex: 1, fontSize: 11, fontFamily: 'monospace', lineHeight: 16, marginLeft: 4 },

  // Empty
  emptyState: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#334155', fontSize: 12, fontFamily: 'monospace' },

  // FAB
  fab: { position: 'absolute', bottom: 20, right: 16, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#21262d' },
  fabGradient: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 16, gap: 6 },
  fabText: { color: '#38bdf8', fontWeight: '700', fontSize: 12, fontFamily: 'monospace' },
});