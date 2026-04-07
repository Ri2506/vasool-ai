import React from 'react';
import { StyleProp, StyleSheet, View, ViewProps, ViewStyle } from 'react-native';

import { EL, Radii, Shadows, Space } from '@/theme/emeraldLedger';

interface Props extends ViewProps {
  style?: StyleProp<ViewStyle>;
  variant?: 'card' | 'section' | 'elevated';
}

/**
 * Emerald Ledger card — NO borders. Depth via tonal layering only.
 */
export function ELCard({ style, variant = 'card', children, ...rest }: Props) {
  return (
    <View style={[styles[variant], style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.lg,
    padding: Space.xl,
    ...Shadows.card,
  },
  section: {
    backgroundColor: EL.surfaceLow,
    borderRadius: Radii.lg,
    padding: Space.xl,
  },
  elevated: {
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.lg,
    padding: Space.xl,
    ...Shadows.float,
  },
});
