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
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>Change Calculator</ThemedText>

      <ThemedText style={styles.label}>Amount due</ThemedText>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        placeholder="0.00"
        value={due}
        onChangeText={setDue}
      />

      <ThemedText style={styles.label}>Cash given</ThemedText>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        placeholder="0.00"
        value={paid}
        onChangeText={setPaid}
      />

      <TouchableOpacity style={styles.button} onPress={computeChange}>
        <ThemedText type="link" style={{ color: 'white', textAlign: 'center' }}>Calculate Change</ThemedText>
      </TouchableOpacity>

      <View style={styles.result}>
        {breakdown.length === 0 ? (
          <ThemedText type="subtitle">No change or invalid amounts</ThemedText>
        ) : (
          <>
            <ThemedText type="subtitle">Change breakdown</ThemedText>
            {breakdown.map(([label, cnt]) => (
              <ThemedText key={label} style={styles.line}>{label}: {cnt}</ThemedText>
            ))}
          </>
        )}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { marginTop: 20, marginBottom: 20 },
  label: { marginTop: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 16 },
  button: { backgroundColor: '#0a7ea4', padding: 12, borderRadius: 8, marginTop: 16 },
  result: { marginTop: 20 },
  line: { marginTop: 6 },
});
