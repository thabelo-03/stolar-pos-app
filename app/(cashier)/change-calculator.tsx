import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';

export default function ChangeCalculator() {
  const insets = useSafeAreaInsets();
  const [due, setDue] = useState('');
  const [paid, setPaid] = useState('');
  const [breakdown, setBreakdown] = useState<Array<[string, number]>>([]);

  const parseToCents = (s: string) => {
    const normalized = s.replace(/[^0-9\.]/g, '');
    const f = parseFloat(normalized || '0');
    return Math.round(f * 100);
  };

  const computeChange = () => {
    const dueC = parseToCents(due);
    const paidC = parseToCents(paid);
    let change = paidC - dueC;
    if (change <= 0) {
      setBreakdown([]);
      return;
    }

    const denoms = [10000, 5000, 2000, 1000, 500, 100, 25, 10, 5, 1];
    const labels = ['$100', '$50', '$20', '$10', '$5', '$1', '25¢', '10¢', '5¢', '1¢'];
    const out: Array<[string, number]> = [];

    for (let i = 0; i < denoms.length; i++) {
      const d = denoms[i];
      if (change >= d) {
        const cnt = Math.floor(change / d);
        change = change - cnt * d;
        out.push([labels[i], cnt]);
      }
    }

    setBreakdown(out);
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0a0f1e', '#162444']} style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Text style={styles.title}>Change Calculator</Text>
        <Text style={styles.subtitle}>Cockpit POS Utility</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.formCard}>
          <Text style={styles.label}>Amount Due</Text>
          <View style={styles.inputWrapper}>
            <Text style={styles.currencySymbol}>$</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              placeholder="0.00"
              placeholderTextColor="#64748b"
              value={due}
              onChangeText={setDue}
            />
          </View>

          <Text style={styles.label}>Cash Received</Text>
          <View style={styles.inputWrapper}>
            <Text style={styles.currencySymbol}>$</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              placeholder="0.00"
              placeholderTextColor="#64748b"
              value={paid}
              onChangeText={setPaid}
            />
          </View>

          <TouchableOpacity style={styles.button} onPress={computeChange}>
            <LinearGradient 
              colors={['#0891b2', '#06b6d4']} 
              start={{ x: 0, y: 0 }} 
              end={{ x: 1, y: 0 }} 
              style={styles.gradientButton}
            >
              <Text style={styles.buttonText}>Calculate Change</Text>
              <Ionicons name="calculator-outline" size={20} color="white" />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={styles.result}>
          {breakdown.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="cash-outline" size={32} color="#64748b" style={{ marginBottom: 10 }} />
              <Text style={styles.resultText}>No change or invalid amounts entered</Text>
            </View>
          ) : (
            <>
              <Text style={styles.resultTitle}>Change Breakdown</Text>
              {breakdown.map(([label, cnt]) => (
                <View style={styles.line} key={label}>
                  <Text style={styles.lineLabel}>{label}</Text>
                  <Text style={styles.lineCount}>{cnt}</Text>
                </View>
              ))}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.bg },
  header: {
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  title: {
    color: Colors.dark.text,
    fontSize: 22,
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#06b6d4',
    fontSize: 13,
    marginTop: 4,
    fontWeight: '600',
  },
  content: {
    padding: 20,
    gap: 20,
  },
  formCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    padding: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
    marginBottom: 8,
    marginTop: 10,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    height: 50,
    marginBottom: 10,
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#06b6d4',
    marginLeft: 15,
    marginRight: 5,
  },
  input: {
    flex: 1,
    fontSize: 18,
    color: Colors.dark.text,
    height: '100%',
  },
  button: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 20,
  },
  gradientButton: {
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  result: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    padding: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  resultText: {
    textAlign: 'center',
    fontSize: 15,
    color: Colors.dark.textSecondary,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#06b6d4',
    marginBottom: 15,
    textAlign: 'center',
  },
  line: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  lineLabel: {
    fontSize: 16,
    color: Colors.dark.text,
    fontWeight: '500',
  },
  lineCount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#06b6d4',
  },
});
