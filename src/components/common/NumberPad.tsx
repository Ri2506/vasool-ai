import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { EL, Radii, Shadows, Space, Type } from '@/theme/emeraldLedger';

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
  ['', '0', '\u232B'],
];

export function NumberPad({ value, onChange, onConfirm, confirmLabel = 'Collect', disabled }: Props) {
  const handleKey = (key: string) => {
    if (key === '\u232B') {
      onChange(value.slice(0, -1));
    } else if (key !== '') {
      if (value.length < 8) {
        onChange(value + key);
      }
    }
  };

  return (
    <View style={styles.container}>
      {/* Display */}
      <View style={styles.display}>
        <Text style={styles.rupee}>\u20B9</Text>
        <Text style={styles.amount}>{value || '0'}</Text>
      </View>
      <View style={styles.divider} />

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
                pressed && key !== '' && { backgroundColor: EL.surfaceHigh },
              ]}
            >
              <Text style={[styles.keyLabel, key === '\u232B' && { color: EL.onSurfaceMuted }]}>
                {key}
              </Text>
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
          {confirmLabel} \u20B9{value || '0'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: Space.md },
  display: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    paddingVertical: Space.xl,
  },
  rupee: {
    ...Type.displayMd,
    color: EL.primary,
    fontWeight: '700',
    marginRight: 4,
  },
  amount: {
    fontSize: 48,
    fontWeight: '800',
    color: EL.primary,
    letterSpacing: -1,
  },
  divider: {
    width: 48,
    height: 3,
    backgroundColor: 'rgba(5, 150, 105, 0.2)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: Space.xl,
  },
  row: { flexDirection: 'row', justifyContent: 'center' },
  key: {
    width: 72,
    height: 64,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 4,
  },
  keyEmpty: { backgroundColor: 'transparent' },
  keyLabel: {
    fontSize: 24,
    fontWeight: '600',
    color: EL.onSurface,
  },
  confirm: {
    backgroundColor: EL.primary,
    borderRadius: Radii.md,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Space.lg,
    ...Shadows.card,
  },
  confirmDisabled: { opacity: 0.5 },
  confirmLabel: {
    ...Type.labelLg,
    color: EL.white,
    fontSize: 16,
  },
});
