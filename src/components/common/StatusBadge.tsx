import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { EL, Radii, Space, Type } from '@/theme/emeraldLedger';

export type BorrowerStatusType = 'nadapu' | 'nippu' | 'completed' | 'none';

const STATUS_CONFIG: Record<BorrowerStatusType, { bg: string; fg: string; en: string; ta: string }> = {
  nadapu: { bg: EL.primaryFixed, fg: EL.onPrimaryFixed, en: 'On Schedule', ta: '\u0BA8\u0B9F\u0BAA\u0BCD\u0BAA\u0BC1' },
  nippu: { bg: '#ba5551', fg: EL.white, en: 'Overdue', ta: '\u0BA8\u0BBF\u0BAA\u0BCD\u0BAA\u0BC1' },
  completed: { bg: EL.completedContainer, fg: EL.completed, en: 'Completed', ta: '\u0BAE\u0BC1\u0B9F\u0BBF\u0BA8\u0BCD\u0BA4\u0BA4\u0BC1' },
  none: { bg: 'transparent', fg: EL.onSurfaceMuted, en: '-', ta: '-' },
};

interface Props {
  status: BorrowerStatusType;
}

export function StatusBadge({ status }: Props) {
  const { i18n } = useTranslation();
  const config = STATUS_CONFIG[status];
  const label = i18n.language === 'ta' ? config.ta : config.en;

  if (status === 'none') return null;

  return (
    <View style={[styles.pill, { backgroundColor: config.bg }]}>
      <Text style={[styles.label, { color: config.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: Space.md,
    paddingVertical: Space.xs,
    borderRadius: Radii.pill,
  },
  label: {
    ...Type.labelSm,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
