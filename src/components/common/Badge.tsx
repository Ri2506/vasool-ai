import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/colors';
import { Radius, Typography } from '@/constants/typography';

export type BadgeVariant = 'success' | 'danger' | 'warn' | 'info' | 'neutral';

interface Props {
  label: string;
  variant?: BadgeVariant;
}

const map: Record<BadgeVariant, { bg: string; fg: string }> = {
  success: { bg: Colors.primaryLight, fg: Colors.primaryDark },
  danger: { bg: Colors.dangerLight, fg: Colors.danger },
  warn: { bg: Colors.warnLight, fg: Colors.warn },
  info: { bg: Colors.infoLight, fg: Colors.info },
  neutral: { bg: Colors.border, fg: Colors.textSec },
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
    borderRadius: Radius.pill,
    alignSelf: 'flex-start',
  },
  label: {
    ...Typography.caption,
    fontWeight: '600',
  },
});
