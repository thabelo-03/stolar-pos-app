import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const API_BASE = 'http://192.168.54.12:5000/api/users';

export default function ManageStaff() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchStaff = async () => {
    try {
      const res = await fetch(API_BASE);
      const data = await res.json();
      setStaff(data);
    } catch (e) { Alert.alert("Error", "Server Offline"); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchStaff(); }, []);

  const handleToggleBlock = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/${id}/status`, { method: 'PATCH' });
      if (res.ok) { fetchStaff(); }
    } catch (e) { Alert.alert("Error", "Action failed"); }
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert("Terminate Access", `Remove ${name} permanently?`, [
      { text: "Cancel" },
      { text: "DELETE", style: "destructive", onPress: async () => {
          await fetch(`${API_BASE}/${id}`, { method: 'DELETE' });
          fetchStaff();
      }}
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>Staff Command</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/home')}>
            <Ionicons name="grid-outline" size={24} color="white" />
          </TouchableOpacity>
        </View>
        <Text style={styles.subtitle}>{staff.length} Active System Users</Text>
      </View>

      {loading ? <ActivityIndicator size="large" color="#1e3a8a" style={{marginTop: 50}} /> : (
        <FlatList
          data={staff}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <View style={styles.userCard}>
              <View style={styles.userInfo}>
                <View style={[styles.avatar, item.status === 'blocked' && {backgroundColor: '#fee2e2'}]}>
                  <Text style={styles.avatarText}>{item.name[0]}</Text>
                </View>
                <View>
                  <View style={{flexDirection: 'row', alignItems: 'center'}}>
                    <Text style={styles.userName}>{item.name}</Text>
                    {item.status === 'blocked' && <View style={styles.blockBadge}><Text style={styles.blockText}>BLOCKED</Text></View>}
                  </View>
                  <Text style={styles.userRole}>{item.role.toUpperCase()}</Text>
                </View>
              </View>

              <View style={styles.actions}>
                <TouchableOpacity onPress={() => Linking.openURL(`mailto:${item.email}`)} style={styles.iconBtn}>
                  <Ionicons name="mail" size={20} color="#1e40af" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleToggleBlock(item._id)} style={styles.iconBtn}>
                  <Ionicons name={item.status === 'blocked' ? "lock-open" : "hand-left"} size={20} color="#f59e0b" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item._id, item.name)} style={styles.iconBtn}>
                  <Ionicons name="trash" size={20} color="#dc2626" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { backgroundColor: '#1e3a8a', padding: 25, paddingTop: 60, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: 'white', fontSize: 26, fontWeight: 'bold' },
  subtitle: { color: '#93c5fd', fontSize: 14 },
  userCard: { backgroundColor: 'white', marginHorizontal: 16, marginTop: 12, padding: 16, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 3 },
  userInfo: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  avatarText: { fontWeight: 'bold', color: '#1e40af', fontSize: 20 },
  userName: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
  userRole: { fontSize: 12, color: '#64748b' },
  blockBadge: { backgroundColor: '#fee2e2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 8 },
  blockText: { color: '#dc2626', fontSize: 9, fontWeight: 'bold' },
  actions: { flexDirection: 'row' },
  iconBtn: { padding: 10, marginLeft: 6, backgroundColor: '#f1f5f9', borderRadius: 12 }
});