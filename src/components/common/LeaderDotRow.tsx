import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';

import { EL, Space, Type } from '@/theme/emeraldLedger';

interface Props {
  label: string;
  value: string;
  valueColor?: string;
  style?: ViewStyle;
}

/**
 * Ledger-style label...dots...value row.
 * Used in financial summaries and reports.
 */
export function LeaderDotRow({
  label,
  value,
  valueColor = EL.onSurface,
  style,
}: Props) {
  return (
    <View style={[styles.row, style]}>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.dots} />
      <Text style={[styles.value, { color: valueColor }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingVertical: Space.sm,
  },
  label: {
    ...Type.bodyMd,
    color: EL.onSurfaceSec,
    flexShrink: 1,
  },
  dots: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: EL.outlineVariant,
    borderStyle: 'dotted',
    marginHorizontal: Space.sm,
    marginBottom: 3,
  },
  value: {
    ...Type.labelLg,
    textAlign: 'right',
  },
});
