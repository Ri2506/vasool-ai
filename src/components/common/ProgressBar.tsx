import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/colors';
import { Radius, Typography } from '@/constants/typography';

interface Props {
  /** 0 to 1 */
  progress: number;
  label?: string;
}

export function ProgressBar({ progress, label }: Props) {
  const clamped = Math.max(0, Math.min(1, progress));
  return (
    <View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${clamped * 100}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    ...Typography.caption,
    color: Colors.textSec,
    marginBottom: 6,
  },
  track: {
    height: 10,
    backgroundColor: Colors.border,
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: Radius.pill,
  },
});
