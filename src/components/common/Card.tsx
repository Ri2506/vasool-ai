import React from 'react';
import { StyleSheet, StyleProp, View, ViewStyle, ViewProps } from 'react-native';

import { Colors } from '@/constants/colors';
import { Radius, Spacing } from '@/constants/typography';

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
    backgroundColor: Colors.card,
    borderRadius: Radius.card,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    // Subtle shadow; low-end Android renders elevation cheaply.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
});
