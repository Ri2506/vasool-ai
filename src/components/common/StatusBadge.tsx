import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Colors } from '@/constants/colors';
import { Typography } from '@/constants/typography';

export type BorrowerStatusType = 'nadapu' | 'nippu' | 'completed' | 'none';

const STATUS_CONFIG: Record<BorrowerStatusType, { color: string; en: string; ta: string }> = {
  nadapu: { color: Colors.primary, en: 'On Schedule', ta: 'நடப்பு' },
  nippu: { color: Colors.danger, en: 'Overdue', ta: 'நிப்பு' },
  completed: { color: Colors.info, en: 'Completed', ta: 'முடிந்தது' },
  none: { color: Colors.textMuted, en: '-', ta: '-' },
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
    <View style={styles.container}>
      <View style={[styles.dot, { backgroundColor: config.color }]} />
      <Text style={[styles.label, { color: config.color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 4 },
  label: { ...Typography.caption, fontWeight: '700' },
});
