import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function RegisterShop() {
  const router = useRouter();
  const params = useLocalSearchParams(); 
  
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);

  // We use a fallback to ensure managerId is never just "undefined"
  const managerId = params.managerId || params.id || null;

  const handleRegisterShop = async () => {
    // 1. Basic Validation
    if (!name.trim() || !location.trim()) {
      Alert.alert("Input Required", "Please provide both Shop Name and Location.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('http://192.168.54.12:5000/api/shops/register', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json' 
        },
        body: JSON.stringify({ 
            name: name.trim(), 
            location: location.trim(), 
            managerId: managerId 
        }), 
      });

      const data = await response.json();
      console.log("Response Data:", data);

      // 2. Logic to handle the success
      if (response.ok || data.success) {
        setLoading(false); // Stop loader before showing alert
        
        Alert.alert(
          "Success!", 
          `Shop: ${name}\nBranch Code: ${data.branchCode}`,
          [
            { 
              text: "Enter Operations Hub", 
              onPress: () => {
                // FORCE NAVIGATE: If hub fails, go to tabs
                router.replace({
                  pathname: '/(tabs)/home', 
                  params: { role: 'manager', branch: data.branchCode }
                });
              } 
            }
          ],
          { cancelable: false }
        );
      } else {
        setLoading(false);
        Alert.alert("Registration Failed", data.message || "Server rejected the request.");
      }
    } catch (e) {
      setLoading(false);
      console.error("Fetch Error:", e);
      Alert.alert("Connection Error", "Is the server running at 192.168.54.12:5000?");
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View style={styles.iconCircle}>
            <Ionicons name="business" size={50} color="#1e40af" />
        </View>
        <Text style={styles.title}>Branch Establishment</Text>
        <Text style={styles.subtitle}>Set up Danger Dumani's new shop branch</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Shop Name</Text>
        <View style={styles.inputContainer}>
            <Ionicons name="storefront" size={20} color="#64748b" style={styles.icon} />
            <TextInput 
              placeholder="e.g. Stolar Bulawayo East" 
              style={styles.input} 
              value={name} 
              onChangeText={setName} 
            />
        </View>

        <Text style={styles.label}>Shop Location</Text>
        <View style={styles.inputContainer}>
            <Ionicons name="location" size={20} color="#64748b" style={styles.icon} />
            <TextInput 
              placeholder="e.g. 12th Avenue, CBD" 
              style={styles.input} 
              value={location} 
              onChangeText={setLocation} 
            />
        </View>

        <TouchableOpacity 
          style={[styles.btn, loading && { backgroundColor: '#94a3b8' }]} 
          onPress={handleRegisterShop}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.btnText}>Launch Shop Branch</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#f8fafc', padding: 25 },
  header: { alignItems: 'center', marginTop: 50, marginBottom: 40 },
  iconCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center', elevation: 4 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#1e3a8a', marginTop: 20 },
  subtitle: { color: '#64748b', fontSize: 14, marginTop: 5 },
  form: { width: '100%' },
  label: { fontSize: 14, fontWeight: '600', color: '#1e293b', marginBottom: 8, marginLeft: 5 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderRadius: 12, paddingHorizontal: 15, marginBottom: 20, borderWidth: 1, borderColor: '#e2e8f0', elevation: 1 },
  icon: { marginRight: 10 },
  input: { flex: 1, paddingVertical: 15, fontSize: 16, color: '#1e293b' },
  btn: { backgroundColor: '#1e40af', paddingVertical: 18, borderRadius: 15, alignItems: 'center', marginTop: 10, elevation: 5 },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 18 }
});