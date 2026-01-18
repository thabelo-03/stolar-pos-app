import { Stack } from 'expo-router';
import React from 'react';

export default function ManagerLayout() {
  return (
    <Stack
      screenOptions={{
        // Global header styling for all manager screens
        headerStyle: {
          backgroundColor: '#1e40af',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        headerShown: false, // We hide by default because we built custom headers
      }}
    >
      {/* 'index' refers to your Manager Dashboard (the hub) */}
      <Stack.Screen 
        name="index" 
        options={{ title: 'Manager Home' }} 
      />

      {/* This MUST match your filename 'operation-hub.tsx' exactly */}
      <Stack.Screen 
        name="operations-hub" 
        options={{ 
          headerShown: true, 
          title: 'Operation Hub',
          headerBackTitle: 'Back' 
        }} 
      />

      <Stack.Screen 
        name="register-shop" 
        options={{ 
          headerShown: true, 
          title: 'Register New Shop' 
        }} 
      />

      <Stack.Screen 
        name="profit-loss" 
        options={{ 
          headerShown: true, 
          title: 'Profit Reports' 
        }} 
      />

      <Stack.Screen 
        name="inventory" 
        options={{ 
          headerShown: false, 
          title: 'Inventory' 
        }} 
      />

      <Stack.Screen 
        name="add-stock" 
        options={{ 
          headerShown: false, 
          title: 'Add Stock' 
        }} 
      />
    </Stack>
  );
}