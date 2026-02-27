import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { API_BASE_URL } from './config';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [shopSelectionVisible, setShopSelectionVisible] = useState(false);
  const [shops, setShops] = useState<any[]>([]);
  const router = useRouter();

  // Check for existing session (Auto-Login for Offline Support)
  useEffect(() => {
    const checkSession = async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        const role = await AsyncStorage.getItem('userRole');
        
        if (token && role) {
          if (role === 'admin') {
            router.replace('/(admin)/manage-staff');
          } else if (role === 'manager') {
            router.replace('/(manager)');
          } else {
            router.replace('/(tabs)');
          }
        }
      } catch (e) {
        // If error reading storage, stay on login screen
      }
    };
    checkSession();
  }, []);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        await AsyncStorage.setItem('userToken', 'logged-in');
        await AsyncStorage.setItem('userId', data.id);
        await AsyncStorage.setItem('userRole', data.role);
        await AsyncStorage.setItem('userName', data.name);
        
        // Only set shopId for cashiers. Managers must select their shop via the modal.
        if (data.role !== 'manager' && data.shopId) {
          await AsyncStorage.setItem('shopId', data.shopId);
        } else {
          await AsyncStorage.removeItem('shopId');
        }

        if (data.role === 'admin') {
          router.replace('/(admin)/manage-staff');
        } else if (data.role === 'manager') {
          // Intercept: Check if manager has shops to select from for POS mode
          try {
            const shopsRes = await fetch(`${API_BASE_URL}/shops?managerId=${data.id}`);
            const shopsData = await shopsRes.json();
            if (Array.isArray(shopsData) && shopsData.length > 0) {
              setShops(shopsData);
              setShopSelectionVisible(true);
              setLoading(false); // Stop loading to show modal
              return; // Halt redirect
            }
          } catch (e) {}
          router.replace('/(manager)'); // Fallback if no shops or error
        } else {
          router.replace('/(tabs)');
        }
      } else {
        Alert.alert('Login Failed', data.message || 'Invalid credentials');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error. Please try again.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectShop = async (shop: any) => {
    await AsyncStorage.setItem('shopId', shop._id);
    setShopSelectionVisible(false);
    router.replace('/(tabs)');
  };

  const handleSkipToDashboard = () => {
    setShopSelectionVisible(false);
    router.replace('/(manager)');
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} bounces={false} keyboardShouldPersistTaps="handled">
      
      <View style={styles.logoContainer}>
        <View style={styles.iconCircle}>
          <Image source={require('../assets/images/stolar-logo.jpeg')} style={{ width: '100%', height: '100%', borderRadius: 90, resizeMode: 'cover' }} />
        </View>
        <Text style={styles.tagline}>Smart Management & Sales Tracking</Text>
      </View>

      <View style={styles.formContainer}>
        <Text style={styles.welcomeText}>Welcome Back</Text>
        <Text style={styles.instructionText}>Sign in to continue</Text>

        <View style={styles.inputWrapper}>
          <MaterialCommunityIcons name="email-outline" size={20} color="#64748b" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Email Address"
            placeholderTextColor="#94a3b8"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        <View style={styles.inputWrapper}>
          <MaterialCommunityIcons name="lock-outline" size={20} color="#64748b" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#94a3b8"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!isPasswordVisible}
          />
          <TouchableOpacity onPress={() => setIsPasswordVisible(!isPasswordVisible)} style={{ padding: 5 }}>
            <MaterialCommunityIcons name={isPasswordVisible ? "eye-off" : "eye"} size={20} color="#64748b" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.loginButton} onPress={handleLogin} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.loginButtonText}>Login</Text>
          )}
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
            <Text style={styles.signupText}>Sign Up</Text>
          </TouchableOpacity>
        </View>
      </View>
      </ScrollView>

      {/* Shop Selection Modal for Managers */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={shopSelectionVisible}
        onRequestClose={handleSkipToDashboard}
      >
        <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Select Shop</Text>
                <Text style={styles.modalSubtitle}>Login as cashier for:</Text>
                
                <FlatList
                    data={shops}
                    keyExtractor={(item) => item._id}
                    renderItem={({ item }) => (
                        <TouchableOpacity style={styles.shopItem} onPress={() => handleSelectShop(item)}>
                            <Ionicons name="storefront" size={20} color="#1e40af" style={{marginRight: 10}} />
                            <Text style={styles.shopName}>{item.name}</Text>
                            <Ionicons name="chevron-forward" size={20} color="#cbd5e1" style={{marginLeft: 'auto'}} />
                        </TouchableOpacity>
                    )}
                    style={{maxHeight: 300, width: '100%'}}
                />

                <TouchableOpacity style={styles.dashboardButton} onPress={handleSkipToDashboard}>
                    <Text style={styles.dashboardButtonText}>Go to Manager Dashboard</Text>
                </TouchableOpacity>
            </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e3a8a',
  },
  logoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 20,
  },
  iconCircle: {
    width: 180,
    height: 180,
    backgroundColor: 'white',
    borderRadius: 90,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  appName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 14,
    color: '#bfdbfe',
    marginTop: 5,
    fontWeight: '500',
  },
  formContainer: {
    flex: 1.5,
    backgroundColor: '#f8fafc',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 30,
    paddingTop: 40,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 5,
  },
  instructionText: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 30,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    height: 55,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1e293b',
  },
  loginButton: {
    backgroundColor: '#1e40af',
    height: 55,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#1e40af',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  loginButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 30,
  },
  footerText: {
    color: '#64748b',
    fontSize: 14,
  },
  signupText: {
    color: '#1e40af',
    fontWeight: 'bold',
    fontSize: 14,
  },
  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: 'white', borderRadius: 16, padding: 20, width: '100%', maxWidth: 400 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b', marginBottom: 5, textAlign: 'center' },
  modalSubtitle: { fontSize: 14, color: '#64748b', marginBottom: 20, textAlign: 'center' },
  shopItem: { flexDirection: 'row', alignItems: 'center', padding: 15, backgroundColor: '#f8fafc', borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  shopName: { fontSize: 16, fontWeight: '600', color: '#1e293b' },
  dashboardButton: { marginTop: 10, padding: 15, alignItems: 'center', backgroundColor: '#e0f2fe', borderRadius: 12 },
  dashboardButtonText: { color: '#0284c7', fontWeight: 'bold' },
});