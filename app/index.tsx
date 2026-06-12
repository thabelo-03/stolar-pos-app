import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    const checkSession = async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        const role = await AsyncStorage.getItem('userRole');
        const userId = await AsyncStorage.getItem('userId');

        if (token && role && userId) {
          if (role === 'admin') {
            router.replace('/(admin)/admin-dashboard');
          } else if (role === 'manager') {
            router.replace('/(manager)');
          } else {
            router.replace('/(tabs)');
          }
        } else {
          router.replace('/(auth)/login');
        }
      } catch (e) {
        router.replace('/(auth)/login');
      }
    };
    checkSession();
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#060d1f' }}>
      <ActivityIndicator size="large" color="#06b6d4" />
    </View>
  );
}