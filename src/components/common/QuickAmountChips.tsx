import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { EL, Radii, Shadows, Space, Touch, Type } from '@/theme/emeraldLedger';
import { formatRupees } from '@/utils/format';

interface Props {
  emiAmount: number;
  onSelect: (amount: number) => void;
  selected?: number | null;
}

export function QuickAmountChips({ emiAmount, onSelect, selected }: Props) {
  const chips = buildChips(emiAmount);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {chips.map((amount) => {
        const active = selected === amount;
        return (
          <Pressable
            key={amount}
            onPress={() => onSelect(amount)}
            style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
          >
            <Text style={[styles.label, active ? styles.labelActive : styles.labelInactive]}>
              {formatRupees(amount)}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function buildChips(emi: number): number[] {
  const set = new Set<number>();
  const half = Math.round(emi / 2);
  if (half > 0 && half !== emi) set.add(half);
  set.add(emi);
  set.add(emi * 2);
  for (const round of [100, 200, 250, 500, 1000, 2000, 5000]) {
    if (round >= half * 0.5 && round <= emi * 3 && !set.has(round)) {
      set.add(round);
    }
  }
  return Array.from(set).sort((a, b) => a - b).slice(0, 6);
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Space.lg,
    paddingVertical: Space.sm,
    gap: Space.sm,
  },
  chip: {
    paddingHorizontal: Space.xl,
    paddingVertical: 10,
    borderRadius: Radii.pill,
    minHeight: Touch.min,
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: EL.primary,
    ...Shadows.card,
  },
  chipInactive: {
    backgroundColor: EL.surfaceHigh,
  },
  label: {
    ...Type.labelMd,
    fontWeight: '600',
  },
  labelActive: {
    color: EL.white,
  },
  labelInactive: {
    color: EL.onSurfaceSec,
  },
});
