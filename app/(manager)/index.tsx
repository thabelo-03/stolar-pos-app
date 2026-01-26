import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { API_BASE_URL } from '../config';

interface Shop {
  _id: string;
  name: string;
  location: string;
  branchCode: string;
  manager?: string;
}

interface User {
  name: string;
  email: string;
}

const ManagerIndex = () => {
  const [shops, setShops] = useState<Shop[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [menuVisible, setMenuVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingShop, setEditingShop] = useState<Shop | null>(null);
  const [editName, setEditName] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editManagerId, setEditManagerId] = useState('');
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const userId = await AsyncStorage.getItem('userId');
        if (!userId) {
          throw new Error('User not logged in');
        }

        // Fetch user data
        const userResponse = await fetch(`${API_BASE_URL}/users/${userId}`);
        if (!userResponse.ok) {
          throw new Error('Failed to fetch user data');
        }
        const userData = await userResponse.json();
        setUser(userData);

        // Fetch all shops data
        const shopResponse = await fetch(`${API_BASE_URL}/shops?managerId=${userId}`);
        if (shopResponse.ok) {
          const shopData = await shopResponse.json();
          setShops(shopData);
        } else if (shopResponse.status === 404) {
          setShops([]);
        } else {
          throw new Error('Failed to fetch shops');
        }

        // Fetch notifications for badge count
        const notifResponse = await fetch(`${API_BASE_URL}/notifications/${userId}`);
        if (notifResponse.ok) {
          const notifs = await notifResponse.json();
          const count = notifs.filter((n: any) => !n.isRead).length;
          setUnreadCount(count);
        }
      } catch (e) {
        if (e instanceof Error) {
            setError(e.message);
        } else {
            setError('An unknown error occurred');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleShopPress = (shop: Shop) => {
    router.push({
      pathname: '/(manager)/operations-hub',
      params: { shop: JSON.stringify(shop) },
    });
  };

  const handleEditPress = (shop: Shop) => {
    setEditingShop(shop);
    setEditName(shop.name);
    setEditLocation(shop.location);
    setEditManagerId(shop.manager || '');
    setEditModalVisible(true);
  };

  const saveEditShop = async () => {
    if (!editingShop) return;
    if (!editName.trim() || !editLocation.trim()) {
        Alert.alert("Error", "Name and Location are required");
        return;
    }

    setSaving(true);
    try {
        const response = await fetch(`${API_BASE_URL}/shops/${editingShop._id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: editName, location: editLocation, managerId: editManagerId }),
        });

        const data = await response.json();

        if (response.ok) {
            setShops(prev => prev.map(s => s._id === editingShop._id ? { ...s, name: editName, location: editLocation, manager: editManagerId } : s));
            setEditModalVisible(false);
            Alert.alert("Success", "Shop updated successfully");
        } else {
            Alert.alert("Error", data.message || "Failed to update shop");
        }
    } catch (e) {
        Alert.alert("Error", "Network error");
    } finally {
        setSaving(false);
    }
  };

  const handleDeleteShop = (shopId: string, shopName: string) => {
    Alert.alert(
      "Delete Shop",
      `Are you sure you want to delete ${shopName}? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const response = await fetch(`${API_BASE_URL}/shops/${shopId}`, {
                method: 'DELETE',
              });
              if (response.ok) {
                setShops(prev => prev.filter(shop => shop._id !== shopId));
              } else {
                Alert.alert("Error", "Failed to delete shop");
              }
            } catch (e) {
              Alert.alert("Error", "Network error");
            }
          }
        }
      ]
    );
  };

  const handleSignOut = () => {
    setMenuVisible(false);
    AsyncStorage.clear();
    router.replace('/(auth)/login');
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" />
        <ThemedText>Loading...</ThemedText>
      </ThemedView>
    );
  }

  if (error) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText style={styles.errorText}>Error: {error}</ThemedText>
        <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
          <Text>Go to Login</Text>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Modal
        animationType="fade"
        transparent={true}
        visible={menuVisible}
        onRequestClose={() => setMenuVisible(false)}
      >
        <TouchableOpacity style={styles.menuOverlay} onPress={() => setMenuVisible(false)}>
          <View style={styles.menuContainer}>
            <TouchableOpacity style={styles.menuItem}>
              <Ionicons name="person-circle-outline" size={24} color="#1e40af" />
              <Text style={styles.menuItemText}>Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem}>
              <Ionicons name="settings-outline" size={24} color="#1e40af" />
              <Text style={styles.menuItemText}>Settings</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={handleSignOut}>
              <Ionicons name="log-out-outline" size={24} color="#ef4444" />
              <Text style={[styles.menuItemText, { color: '#ef4444' }]}>Sign Out</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem}>
              <Ionicons name="help-circle-outline" size={24} color="#1e40af" />
              <Text style={styles.menuItemText}>Help</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Edit Shop Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={editModalVisible}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.centeredModalOverlay}>
            <View style={styles.editModalContent}>
                <Text style={styles.modalTitle}>Edit Shop</Text>
                
                <Text style={styles.label}>Shop Name</Text>
                <TextInput 
                    style={styles.input} 
                    value={editName} 
                    onChangeText={setEditName} 
                    placeholder="Shop Name"
                />

                <Text style={styles.label}>Location</Text>
                <TextInput 
                    style={styles.input} 
                    value={editLocation} 
                    onChangeText={setEditLocation} 
                    placeholder="Location"
                />

                <View style={styles.modalButtons}>
                    <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setEditModalVisible(false)}>
                        <Text style={styles.buttonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={saveEditShop} disabled={saving}>
                        {saving ? <ActivityIndicator color="#fff" /> : <Text style={[styles.buttonText, { color: '#fff' }]}>Save</Text>}
                    </TouchableOpacity>
                </View>
            </View>
        </View>
      </Modal>

      <View style={styles.header}>
        <View>
          <Text style={styles.userName}>{user?.name}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
        </View>
        <View style={styles.headerIcons}>
          <TouchableOpacity>
            <Ionicons name="notifications-outline" size={24} color="#fff" />
            {unreadCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMenuVisible(true)}>
            <Ionicons name="menu" size={24} color="#fff" style={{ marginLeft: 15 }} />
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.sectionHeader}>
        <ThemedText style={styles.title}>Shops</ThemedText>
        <TouchableOpacity 
          style={styles.addShopButton} 
          onPress={() => router.push('/(manager)/register-shop')}
        >
          <Ionicons name="add" size={20} color="white" />
          <Text style={styles.addShopButtonText}>Add Shop</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={shops}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.shopItem} onPress={() => handleShopPress(item)}>
            <View style={styles.shopItemContent}>
              <Ionicons name="storefront-outline" size={24} color="#1e40af" style={styles.shopIcon} />
              <View>
                <ThemedText style={styles.shopName}>{item.name}</ThemedText>
                <ThemedText style={styles.shopLocation}>{item.location}</ThemedText>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity onPress={() => handleEditPress(item)} style={{ padding: 8 }}>
                <Ionicons name="create-outline" size={24} color="#1e40af" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDeleteShop(item._id, item.name)} style={{ padding: 8 }}>
                <Ionicons name="trash-outline" size={24} color="#ef4444" />
              </TouchableOpacity>
              <Ionicons name="chevron-forward" size={24} color="#94a3b8" />
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={() => (
          <TouchableOpacity
            style={styles.registerShopButton}
            onPress={() => router.push('/(manager)/register-shop')}
          >
            <Ionicons name="add-circle-outline" size={24} color="#1e40af" />
            <Text style={styles.registerShopButtonText}>Register a New Shop</Text>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: '#f1f5f9',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        backgroundColor: '#1e40af', // Blue background for header
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderRadius: 10,
    },
    userName: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff', // White text for user name
    },
    userEmail: {
        fontSize: 14,
        color: '#bfdbfe', // Lighter blue for user email
    },
    headerIcons: {
        flexDirection: 'row',
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 20,
        marginBottom: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1e40af',
    },
    addShopButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1e40af',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
    },
    addShopButtonText: {
        color: 'white',
        fontWeight: 'bold',
        marginLeft: 4,
        fontSize: 14,
    },
    shopItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between', // To push the arrow to the end
        backgroundColor: '#fff',
        padding: 15,
        borderRadius: 10,
        marginBottom: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    shopItemContent: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    shopIcon: {
        marginRight: 15,
    },
    shopName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1e293b',
    },
    shopLocation: {
        fontSize: 14,
        color: '#64748b',
    },
    errorText: {
        color: 'red',
        fontSize: 16,
    },
    registerShopButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#e0f2fe',
        padding: 15,
        borderRadius: 10,
        marginTop: 20,
        borderWidth: 1,
        borderColor: '#1e40af',
    },
    registerShopButtonText: {
        marginLeft: 10,
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1e40af',
    },
    menuOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-start',
        alignItems: 'flex-end',
    },
    menuContainer: {
        backgroundColor: '#fff',
        padding: 20,
        borderRadius: 10,
        marginTop: 60,
        marginRight: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
    },
    menuItemText: {
        marginLeft: 15,
        fontSize: 16,
        color: '#1e293b',
    },
    centeredModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    editModalContent: {
        backgroundColor: 'white',
        width: '85%',
        borderRadius: 20,
        padding: 20,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 15,
        textAlign: 'center',
        color: '#1e293b',
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 5,
        color: '#334155',
    },
    input: {
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 8,
        padding: 10,
        marginBottom: 15,
        fontSize: 16,
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 10,
    },
    modalButton: {
        flex: 1,
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
        marginHorizontal: 5,
    },
    cancelButton: {
        backgroundColor: '#e2e8f0',
    },
    saveButton: {
        backgroundColor: '#1e40af',
    },
    buttonText: {
        fontWeight: 'bold',
    },
    notificationBadge: {
        position: 'absolute',
        right: -6,
        top: -6,
        backgroundColor: '#ef4444',
        borderRadius: 10,
        minWidth: 18,
        height: 18,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
        borderWidth: 1.5,
        borderColor: '#1e40af',
    },
    notificationBadgeText: {
        color: 'white',
        fontSize: 10,
        fontWeight: 'bold',
    },
});

export default ManagerIndex;
