import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/colors';
import { Radius, Spacing, TouchTarget, Typography } from '@/constants/typography';
import { formatRupees } from '@/utils/format';

interface Props {
  emiAmount: number;
  onSelect: (amount: number) => void;
  selected?: number | null;
}

/**
 * Quick amount chips per PRD §5.2: half-EMI, EMI (pre-selected), double-EMI,
 * and common round amounts. User taps one chip to pre-fill the amount.
 */
export function QuickAmountChips({ emiAmount, onSelect, selected }: Props) {
  const chips = buildChips(emiAmount);

  return (
    <View style={styles.container}>
      {chips.map((amount) => {
        const active = selected === amount;
        return (
          <Pressable
            key={amount}
            onPress={() => onSelect(amount)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>
              {formatRupees(amount)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function buildChips(emi: number): number[] {
  const set = new Set<number>();
  const half = Math.round(emi / 2);
  if (half > 0 && half !== emi) set.add(half);
  set.add(emi);
  set.add(emi * 2);
  // Common round amounts near the EMI
  for (const round of [100, 200, 250, 500, 1000, 2000, 5000]) {
    if (round >= half * 0.5 && round <= emi * 3 && !set.has(round)) {
      set.add(round);
    }
  }
  return Array.from(set).sort((a, b) => a - b).slice(0, 6);
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    marginRight: Spacing.sm,
    marginBottom: Spacing.sm,
    minHeight: TouchTarget.min,
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  label: { ...Typography.body, fontWeight: '600', color: Colors.text },
  labelActive: { color: Colors.white },
});
