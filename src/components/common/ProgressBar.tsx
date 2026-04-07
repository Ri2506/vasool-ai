import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { EL, Radii, Type, Space } from '@/theme/emeraldLedger';

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
    ...Type.labelSm,
    color: EL.onSurfaceSec,
    marginBottom: Space.xs,
  },
  track: {
    height: 8,
    backgroundColor: EL.surfaceHigh,
    borderRadius: Radii.pill,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: EL.primary,
    borderRadius: Radii.pill,
  },
});
