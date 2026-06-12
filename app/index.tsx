import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Image, StyleSheet, Text, View } from 'react-native';

export default function Index() {
  const router = useRouter();
  const [statusText, setStatusText] = useState('Initializing POS environment...');

  // Animation values
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const textFadeAnim = useRef(new Animated.Value(1)).current;

  // Function to fade text out and in when changing status
  const changeStatus = (newText: string) => {
    Animated.sequence([
      Animated.timing(textFadeAnim, { toValue: 0.3, duration: 150, useNativeDriver: true }),
      Animated.timing(textFadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
    setTimeout(() => setStatusText(newText), 150);
  };

  useEffect(() => {
    // Entrance bounce scale animation
    Animated.spring(scaleAnim, {
      toValue: 1,
      damping: 14,
      stiffness: 90,
      useNativeDriver: true,
    }).start();

    // Constant pulsing animation for the outer ring
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.98, duration: 1200, useNativeDriver: true }),
      ])
    ).start();

    let targetRoute = '/(auth)/login';

    const checkSession = async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        const role = await AsyncStorage.getItem('userRole');
        const userId = await AsyncStorage.getItem('userId');

        if (token && role && userId) {
          if (role === 'admin') {
            targetRoute = '/(admin)/admin-dashboard';
          } else if (role === 'manager') {
            targetRoute = '/(manager)';
          } else {
            targetRoute = '/(tabs)';
          }
        }
      } catch (e) {
        // Default back to login on error
      }
    };

    // Premium status text cycle for startup feel
    const timers = [
      setTimeout(() => changeStatus('Checking local cache...'), 500),
      setTimeout(() => changeStatus('Establishing secure tunnel...'), 1000),
      setTimeout(() => changeStatus('Syncing workspace...'), 1500),
      setTimeout(() => changeStatus('Access granted. Welcome!'), 2000),
    ];

    // Guarantee a minimum display of 2200ms to let the user appreciate the splash and text transitions
    Promise.all([
      checkSession(),
      new Promise((resolve) => setTimeout(resolve, 2200)),
    ]).then(() => {
      router.replace(targetRoute as any);
    });

    return () => {
      timers.forEach((t) => clearTimeout(t));
    };
  }, []);

  // Combined scale for the logo ring
  const logoScale = Animated.multiply(scaleAnim, pulseAnim);

  return (
    <LinearGradient
      colors={['#060d1f', '#0f172a', '#1a2744']}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      {/* Glowing background orbs for premium visual depth */}
      <View style={styles.orbBlue} />
      <View style={styles.orbCyan} />

      <View style={styles.content}>
        {/* Pulsing Logo Ring */}
        <Animated.View style={[styles.logoRing, { transform: [{ scale: logoScale }] }]}>
          <View style={styles.logoInner}>
            <Image
              source={require('../assets/images/stolar-logo.jpeg')}
              style={styles.logoImage}
            />
          </View>
        </Animated.View>

        {/* Brand Header */}
        <Text style={styles.brandName}>STOLAR POS</Text>
        <Text style={styles.brandTagline}>Management & Retail System</Text>

        {/* Dynamic Status Indicator */}
        <View style={styles.statusBox}>
          <ActivityIndicator size="small" color="#06b6d4" style={styles.spinner} />
          <Animated.Text style={[styles.statusText, { opacity: textFadeAnim }]}>
            {statusText}
          </Animated.Text>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    zIndex: 1,
  },
  // Glowing ambient backdrops
  orbBlue: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(37,99,235,0.08)',
  },
  orbCyan: {
    position: 'absolute',
    bottom: -50,
    left: -50,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(6,182,212,0.06)',
  },
  // Glowing brand logo container
  logoRing: {
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 2,
    borderColor: 'rgba(6,182,212,0.4)',
    padding: 8,
    marginBottom: 24,
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 6,
  },
  logoInner: {
    flex: 1,
    borderRadius: 57,
    overflow: 'hidden',
    backgroundColor: 'white',
  },
  logoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 57,
  },
  brandName: {
    fontSize: 26,
    fontWeight: '900',
    color: '#f1f5f9',
    letterSpacing: 4,
    marginBottom: 6,
  },
  brandTagline: {
    fontSize: 13,
    color: '#64748b',
    letterSpacing: 0.5,
    marginBottom: 36,
  },
  // Dynamic status display
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 10,
  },
  spinner: {
    marginRight: 2,
  },
  statusText: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '600',
  },
});