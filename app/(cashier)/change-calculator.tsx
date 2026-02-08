import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import React, { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

export default function ChangeCalculator() {
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
      <View style={styles.header}>
        <Text style={styles.title}>Change Calculator</Text>
        <Text style={styles.subtitle}>Utilities</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.label}>Amount due</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          placeholder="0.00"
          placeholderTextColor="#94a3b8"
          value={due}
          onChangeText={setDue}
        />

        <Text style={styles.label}>Cash given</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          placeholder="0.00"
          placeholderTextColor="#94a3b8"
          value={paid}
          onChangeText={setPaid}
        />

        <TouchableOpacity style={styles.button} onPress={computeChange}>
          <Text style={styles.buttonText}>Calculate Change</Text>
        </TouchableOpacity>

        <View style={styles.result}>
          {breakdown.length === 0 ? (
            <Text style={styles.resultText}>No change or invalid amounts</Text>
          ) : (
            <>
              <Text style={styles.resultTitle}>Change breakdown</Text>
              {breakdown.map(([label, cnt]) => (
                <View style={styles.line} key={label}>
                  <Text style={styles.lineLabel}>{label}:</Text>
                  <Text style={styles.lineCount}>{cnt}</Text>
                </View>
              ))}
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    backgroundColor: '#1e3a8a',
    padding: 25,
    paddingTop: 60,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  title: {
    color: 'white',
    fontSize: 26,
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#93c5fd',
    fontSize: 14,
  },
  content: {
    padding: 20,
  },
  label: {
    fontSize: 16,
    color: '#1e3a8a',
    marginBottom: 10,
    marginTop: 20,
  },
  input: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 15,
    fontSize: 18,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  button: {
    backgroundColor: '#10b981',
    padding: 20,
    borderRadius: 15,
    marginTop: 30,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  result: {
    marginTop: 30,
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 15,
    elevation: 3,
  },
  resultText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#64748b',
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e3a8a',
    marginBottom: 15,
    textAlign: 'center',
  },
  line: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  lineLabel: {
    fontSize: 16,
    color: '#475569',
  },
  lineCount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
  },
});
