import React from 'react';
import { StyleSheet, StyleProp, View, ViewStyle, ViewProps } from 'react-native';

import { EL, Radii, Shadows, Space } from '@/theme/emeraldLedger';

interface Props extends ViewProps {
  style?: StyleProp<ViewStyle>;
}

export function Card({ style, children, ...rest }: Props) {
  return (
    <View style={[styles.card, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.lg,
    padding: Space.lg,
    ...Shadows.card,
  },
});
