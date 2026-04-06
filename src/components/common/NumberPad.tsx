import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/colors';
import { Radius, Spacing, Typography } from '@/constants/typography';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onConfirm: () => void;
  confirmLabel?: string;
  disabled?: boolean;
}

const KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['', '0', '⌫'],
];

export function NumberPad({ value, onChange, onConfirm, confirmLabel = 'Collect', disabled }: Props) {
  const handleKey = (key: string) => {
    if (key === '⌫') {
      onChange(value.slice(0, -1));
    } else if (key !== '') {
      // Max 8 digits (₹99,99,999)
      if (value.length < 8) {
        onChange(value + key);
      }
    }
  };

  return (
    <View style={styles.container}>
      {/* Display */}
      <View style={styles.display}>
        <Text style={styles.rupee}>₹</Text>
        <Text style={styles.amount}>{value || '0'}</Text>
      </View>

      {/* Keys */}
      {KEYS.map((row, ri) => (
        <View key={ri} style={styles.row}>
          {row.map((key, ki) => (
            <Pressable
              key={ki}
              onPress={() => handleKey(key)}
              disabled={key === ''}
              style={({ pressed }) => [
                styles.key,
                key === '' && styles.keyEmpty,
                pressed && key !== '' && { backgroundColor: Colors.primaryLight },
              ]}
            >
              <Text style={styles.keyLabel}>{key}</Text>
            </Pressable>
          ))}
        </View>
      ))}

      {/* Confirm */}
      <Pressable
        onPress={onConfirm}
        disabled={disabled || !value || value === '0'}
        style={({ pressed }) => [
          styles.confirm,
          (disabled || !value) && styles.confirmDisabled,
          pressed && { opacity: 0.85 },
        ]}
      >
        <Text style={styles.confirmLabel}>
          {confirmLabel} ₹{value || '0'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: Spacing.md },
  display: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
  },
  rupee: { ...Typography.display, color: Colors.textMuted, marginRight: 4 },
  amount: { fontSize: 36, fontWeight: '700', color: Colors.text },
  row: { flexDirection: 'row', justifyContent: 'center' },
  key: {
    width: 80,
    height: 56,
    borderRadius: Radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 4,
    backgroundColor: Colors.white,
  },
  keyEmpty: { backgroundColor: 'transparent' },
  keyLabel: { fontSize: 24, fontWeight: '600', color: Colors.text },
  confirm: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.button,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
  },
  confirmDisabled: { opacity: 0.5 },
  confirmLabel: { ...Typography.title, color: Colors.white, fontSize: 18 },
});
