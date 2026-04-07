import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { EL, Radii, Type } from '@/theme/emeraldLedger';

export type BadgeVariant = 'success' | 'danger' | 'warn' | 'info' | 'neutral';

interface Props {
  label: string;
  variant?: BadgeVariant;
}

const map: Record<BadgeVariant, { bg: string; fg: string }> = {
  success: { bg: EL.primaryFixed, fg: EL.primary },
  danger: { bg: EL.nippuContainer, fg: EL.nippu },
  warn: { bg: EL.warnContainer, fg: EL.warn },
  info: { bg: EL.infoContainer, fg: EL.info },
  neutral: { bg: EL.surfaceHigh, fg: EL.onSurfaceSec },
};

export function Badge({ label, variant = 'neutral' }: Props) {
  const { bg, fg } = map[variant];
  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <Text style={[styles.label, { color: fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radii.pill,
    alignSelf: 'flex-start',
  },
  label: {
    ...Type.labelSm,
    fontWeight: '600',
  },
});
