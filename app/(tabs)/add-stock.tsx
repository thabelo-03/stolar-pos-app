import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Button, StyleSheet, TextInput, TouchableOpacity } from 'react-native';

import { ThemedText } from '../../components/themed-text';
import { ThemedView } from '../../components/themed-view';
import { useThemeColor } from '../../hooks/use-theme-color';
import { API_BASE_URL } from './api';

export default function AddStockScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const isEditMode = params.mode === 'edit';

  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [loading, setLoading] = useState(false);
  
  const textColor = useThemeColor({}, 'text');
  const placeholderColor = '#888';

  useEffect(() => {
    if (isEditMode) {
      setItemName(params.name as string);
      setQuantity(params.quantity ? String(params.quantity) : '');
    }
  }, [params]);

  const handleSave = async () => {
    if (!itemName || !quantity) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const url = isEditMode 
        ? `${API_BASE_URL}/inventory/${params.id}`
        : `${API_BASE_URL}/inventory`;
      
      const method = isEditMode ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: itemName, quantity: Number(quantity) }),
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert('Success', isEditMode ? 'Stock updated successfully' : 'Stock added successfully');
        router.back();
      } else if (response.status === 409) {
        Alert.alert('Duplicate Item', 'An item with this name already exists.');
      } else {
        Alert.alert('Error', data.message || 'Failed to add stock');
      }
    } catch (error) {
      Alert.alert('Network Error', 'Could not connect to server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="arrow-back" size={24} color={textColor} />
      </TouchableOpacity>
      <ThemedText type="title">{isEditMode ? 'Edit Stock' : 'Add Stock'}</ThemedText>
      
      <ThemedView style={styles.form}>
        <ThemedView>
          <ThemedText type="defaultSemiBold">Item Name</ThemedText>
          <TextInput 
            style={[styles.input, { color: textColor, borderColor: textColor }]}
            value={itemName}
            onChangeText={setItemName}
            placeholder="e.g. Apple"
            placeholderTextColor={placeholderColor}
          />
        </ThemedView>

        <ThemedView>
          <ThemedText type="defaultSemiBold">Quantity</ThemedText>
          <TextInput 
            style={[styles.input, { color: textColor, borderColor: textColor }]}
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={placeholderColor}
          />
        </ThemedView>

        {loading ? (
          <ActivityIndicator size="large" color={textColor} />
        ) : (
          <Button title={isEditMode ? "Update Stock" : "Save Stock"} onPress={handleSave} />
        )}
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  backButton: {
    marginBottom: 16,
  },
  form: {
    marginTop: 24,
    gap: 20,
  },
  input: {
    borderWidth: 1,
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    opacity: 0.8,
  },
});