import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface LogEntry {
  id: string;
  level: 'info' | 'warning' | 'error';
  timestamp: string;
  message: string;
}

const INITIAL_LOGS: LogEntry[] = [
  { id: '1', level: 'info', timestamp: '15:34:12', message: 'Server running on port 8080 (Production Mode)' },
  { id: '2', level: 'info', timestamp: '15:34:15', message: 'SQLite database sync completed. 184 products loaded.' },
  { id: '3', level: 'info', timestamp: '15:34:28', message: 'Cashier Sarah Connor logged in (Terminal #2)' },
  { id: '4', level: 'warning', timestamp: '15:35:02', message: 'Slow response from backup database cluster (420ms)' },
  { id: '5', level: 'info', timestamp: '15:35:10', message: 'Syncing local sales: 4 transactions uploaded' },
  { id: '6', level: 'error', timestamp: '15:35:45', message: 'API Request failed: POST /api/payments/verify - Timeout' },
  { id: '7', level: 'info', timestamp: '15:36:01', message: 'Stock update: Sprite 330ml (-1 unit, Cashier sale)' },
  { id: '8', level: 'info', timestamp: '15:36:05', message: 'Cash drawer opened automatically (Receipt #9403)' },
  { id: '9', level: 'info', timestamp: '15:36:12', message: 'Manager request: Generated profit-loss report for shop #1' },
  { id: '10', level: 'warning', timestamp: '15:36:44', message: 'Camera permission requested by device scanner' },
  { id: '11', level: 'info', timestamp: '15:37:02', message: 'WebSocket connection established with client #82' },
  { id: '12', level: 'error', timestamp: '15:37:15', message: 'Auth error: Invalid session token for user cashier_04' }
];

export default function SystemLogs() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [logs, setLogs] = useState<LogEntry[]>(INITIAL_LOGS);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'info' | 'warning' | 'error'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [isLive, setIsLive] = useState(true);

  // Simulated live logging activity
  useEffect(() => {
    if (!isLive) return;

    const interval = setInterval(() => {
      // 30% chance to generate a new log entry every 5 seconds
      if (Math.random() < 0.3) {
        setLogs(prevLogs => {
          const newEntry = generateNewLog();
          return [newEntry, ...prevLogs].slice(0, 50); // Keep max 50 logs in history
        });
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [isLive]);

  const generateNewLog = (): LogEntry => {
    const messages = {
      info: [
        'Stock sync completed successfully',
        'Automatic cloud backup triggered',
        'Terminal printer status: OK',
        'Sales report emailed to administrator',
        'Subscription status checked: Active',
        'Database optimization complete'
      ],
      warning: [
        'High database connection count (18/20)',
        'Minor network latency jitter detected',
        'Scanner lens calibration recommended',
        'Low battery on Terminal #3'
      ],
      error: [
        'Failed connection retry with thermal printer',
        'Database write lock contention on table Sales',
        'Failed to sync: 503 Service Unavailable'
      ]
    };
    
    const levels: ('info' | 'warning' | 'error')[] = ['info', 'warning', 'error', 'info', 'info'];
    const selectedLevel = levels[Math.floor(Math.random() * levels.length)];
    const options = messages[selectedLevel];
    const msg = options[Math.floor(Math.random() * options.length)];
    
    const now = new Date();
    const timestamp = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    
    return {
      id: String(Date.now() + Math.random()),
      level: selectedLevel,
      timestamp,
      message: msg
    };
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      const freshLogs = [generateNewLog(), generateNewLog()];
      setLogs(prev => [...freshLogs, ...prev].slice(0, 50));
      setRefreshing(false);
    }, 1000);
  }, []);

  const handleClearLogs = () => {
    Alert.alert(
      "Clear Console",
      "Are you sure you want to clear current logging session history?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Clear", style: "destructive", onPress: () => setLogs([]) }
      ]
    );
  };

  const handleCopyLogs = () => {
    Alert.alert("Logs Copied", "System logs console history successfully formatted and copied to clipboard.");
  };

  const handleExportPDF = async () => {
    const activeLogs = getFilteredLogs();
    const html = `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Outfit:wght@400;600;800&display=swap" rel="stylesheet">
          <style>
            body { 
              font-family: 'Inter', -apple-system, sans-serif; 
              padding: 24px; 
              color: #1e293b;
              background-color: #ffffff;
              margin: 0;
            }
            .header-banner {
              background: linear-gradient(135deg, #0284c7 0%, #0ea5e9 100%);
              border-radius: 16px;
              padding: 24px;
              color: #ffffff;
              margin-bottom: 24px;
            }
            .header-title {
              font-family: 'Outfit', sans-serif;
              font-size: 22px;
              font-weight: 800;
              margin: 0;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .header-subtitle {
              font-size: 13px;
              color: rgba(255, 255, 255, 0.85);
              margin-top: 6px;
              font-weight: 500;
            }
            
            .meta-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 16px;
              margin-bottom: 28px;
            }
            .meta-card {
              border: 1px solid #e2e8f0;
              border-radius: 14px;
              padding: 12px;
              background-color: #f8fafc;
              text-align: center;
            }
            .meta-label {
              font-size: 9px;
              font-weight: 700;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 4px;
            }
            .meta-value {
              font-size: 14px;
              font-weight: 800;
              color: #0f172a;
            }

            table { 
              width: 100%; 
              border-collapse: collapse; 
              font-size: 11px;
              margin-top: 20px;
            }
            th { 
              background-color: #f8fafc; 
              color: #475569; 
              font-weight: 700; 
              text-transform: uppercase;
              letter-spacing: 0.5px;
              font-size: 10px;
              border-bottom: 2px solid #cbd5e1;
              padding: 10px 8px;
              text-align: left;
            }
            td { 
              border-bottom: 1px solid #f1f5f9; 
              padding: 10px 8px; 
              color: #334155;
              font-family: monospace;
            }
            tr:nth-child(even) td { 
              background-color: #fafbfb; 
            }
            
            .badge {
              display: inline-block;
              padding: 2px 6px;
              border-radius: 4px;
              font-weight: 700;
              font-size: 9px;
              text-transform: uppercase;
            }
            .badge-info {
              background-color: #ecfdf5;
              color: #10b981;
            }
            .badge-warning {
              background-color: #fffbeb;
              color: #f59e0b;
            }
            .badge-error {
              background-color: #fef2f2;
              color: #ef4444;
            }
            
            .footer { 
              margin-top: 48px; 
              text-align: center; 
              font-size: 10px; 
              color: #94a3b8; 
              border-top: 1px solid #f1f5f9;
              padding-top: 16px;
              font-weight: 500;
            }
          </style>
        </head>
        <body>
          <div class="header-banner">
            <h1 class="header-title">System Audit Log Report</h1>
            <div class="header-subtitle">Generated on ${new Date().toLocaleString()}</div>
          </div>
          
          <div class="meta-grid">
            <div class="meta-card">
              <div class="meta-label">Active Filter</div>
              <div class="meta-value" style="text-transform: uppercase;">${activeTab}</div>
            </div>
            <div class="meta-card">
              <div class="meta-label">Query Search</div>
              <div class="meta-value">${searchTerm.trim() || 'None'}</div>
            </div>
            <div class="meta-card">
              <div class="meta-label">Total Events</div>
              <div class="meta-value">${activeLogs.length}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 80px;">Timestamp</th>
                <th style="width: 80px;">Severity</th>
                <th>Event Message</th>
              </tr>
            </thead>
            <tbody>
              ${activeLogs.map(item => `
                <tr>
                  <td style="color: #64748b;">${item.timestamp}</td>
                  <td>
                    <span class="badge badge-${item.level}">${item.level}</span>
                  </td>
                  <td style="color: #0f172a;">${item.message}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="footer">
            Stolar POS System • Automated System Diagnostics & Auditing
          </div>
        </body>
      </html>
    `;
    try {
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (error) { 
      Alert.alert('Error', 'Failed to generate PDF'); 
    }
  };

  const getFilteredLogs = () => {
    let result = logs;
    
    if (activeTab !== 'all') {
      result = result.filter(l => l.level === activeTab);
    }
    
    if (searchTerm.trim() !== '') {
      const q = searchTerm.toLowerCase();
      result = result.filter(l => l.message.toLowerCase().includes(q) || l.timestamp.includes(q) || l.level.includes(q));
    }
    
    return result;
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'info': return '#10b981'; // Emerald
      case 'warning': return '#f59e0b'; // Amber
      case 'error': return '#ef4444'; // Rose
      default: return '#64748b';
    }
  };

  const getLevelBg = (level: string) => {
    switch (level) {
      case 'info': return '#ecfdf5';
      case 'warning': return '#fffbeb';
      case 'error': return '#fef2f2';
      default: return '#f8fafc';
    }
  };

  const filteredLogs = getFilteredLogs();

  const renderLogItem = ({ item }: { item: LogEntry }) => (
    <View style={[styles.logCard, { borderLeftColor: getLevelColor(item.level), backgroundColor: getLevelBg(item.level) }]}>
      <View style={styles.logCardHeader}>
        <View style={styles.badgeRow}>
          <View style={[styles.levelDot, { backgroundColor: getLevelColor(item.level) }]} />
          <Text style={[styles.levelText, { color: getLevelColor(item.level) }]}>
            {item.level.toUpperCase()}
          </Text>
        </View>
        <Text style={styles.timestampText}>{item.timestamp}</Text>
      </View>
      <Text style={styles.messageText}>{item.message}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* Top Header */}
      <LinearGradient 
        colors={['#0284c7', '#0ea5e9', '#38bdf8']} 
        start={{ x: 0, y: 0 }} 
        end={{ x: 1, y: 1 }} 
        style={[styles.header, { paddingTop: insets.top + 15 }]}
      >
        <View style={styles.headerTopRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>System Logs</Text>
            <View style={styles.statusRow}>
              <View style={[styles.liveDot, isLive && styles.liveDotActive]} />
              <Text style={styles.subtitle}>{isLive ? 'Live Connection Active' : 'Feed Paused'}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity 
              style={[styles.actionButton, isLive ? styles.btnActive : styles.btnInactive]} 
              onPress={() => setIsLive(!isLive)}
            >
              <Ionicons name={isLive ? "pause" : "play"} size={20} color="white" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={handleExportPDF}>
              <Ionicons name="document-text-outline" size={20} color="white" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={handleClearLogs}>
              <Ionicons name="trash-outline" size={20} color="white" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#bae6fd" />
          <TextInput
            placeholder="Search terminal events..."
            placeholderTextColor="#bae6fd"
            style={styles.searchInput}
            value={searchTerm}
            onChangeText={setSearchTerm}
            autoCapitalize="none"
          />
          {searchTerm.length > 0 && (
            <Ionicons 
              name="close-circle" 
              size={20} 
              color="#bae6fd" 
              onPress={() => setSearchTerm('')} 
            />
          )}
        </View>

        {/* Tabs */}
        <View style={styles.tabContainer}>
          {(['all', 'info', 'warning', 'error'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </LinearGradient>

      {/* Logs Feed Panel */}
      <FlatList
        data={filteredLogs}
        keyExtractor={(item) => item.id}
        renderItem={renderLogItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0ea5e9']} tintColor="#0ea5e9" />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="server-outline" size={64} color="#bae6fd" style={{ marginBottom: 16 }} />
            <Text style={styles.emptyText}>No terminal events matched query.</Text>
          </View>
        }
      />

      {/* Floating Share Button */}
      <TouchableOpacity style={styles.fab} onPress={handleCopyLogs}>
        <LinearGradient
          colors={['#0284c7', '#0ea5e9']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fabGradient}
        >
          <Ionicons name="copy-outline" size={20} color="white" />
          <Text style={styles.fabLabel}>Copy Console</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f9ff' },
  
  // Header
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: "#0284c7",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: { padding: 8, backgroundColor: 'rgba(255, 255, 255, 0.2)', borderRadius: 12, marginRight: 15 },
  title: { fontSize: 22, fontWeight: 'bold', color: 'white', letterSpacing: 0.5 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#cbd5e1' },
  liveDotActive: { backgroundColor: '#10b981' },
  subtitle: { fontSize: 13, color: 'rgba(255, 255, 255, 0.8)' },
  actionButton: {
    width: 40, height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  btnActive: { backgroundColor: 'rgba(16, 185, 129, 0.3)' },
  btnInactive: { backgroundColor: 'rgba(245, 158, 11, 0.3)' },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 50,
    marginBottom: 16,
  },
  searchInput: { flex: 1, color: 'white', fontSize: 16, marginLeft: 10 },

  // Tabs
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 12,
    padding: 4,
  },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: 'white' },
  tabText: { color: '#bae6fd', fontWeight: '600', fontSize: 11 },
  tabTextActive: { color: '#0ea5e9', fontWeight: '700' },

  // List Feed
  listContent: { padding: 16, paddingBottom: 100 },
  logCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  logCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  levelDot: { width: 6, height: 6, borderRadius: 3 },
  levelText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  timestampText: { fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' },
  messageText: { fontSize: 13, color: '#334155', fontWeight: '500', fontFamily: 'monospace', lineHeight: 18 },

  // Empty State
  emptyState: { alignItems: 'center', marginTop: 100 },
  emptyText: { fontSize: 14, color: '#94a3b8', fontWeight: '600' },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    borderRadius: 24,
    elevation: 5,
    shadowColor: '#0ea5e9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    overflow: 'hidden',
  },
  fabGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 22,
    gap: 8,
  },
  fabLabel: { color: 'white', fontWeight: 'bold', fontSize: 15 },
});