import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
} from 'react-native';

import { EL, Radii, Touch, Type } from '@/theme/emeraldLedger';

export type ButtonVariant = 'primary' | 'secondary' | 'danger';

interface Props {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
}: Props) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant].container,
        pressed && !isDisabled && { opacity: 0.85 },
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variantStyles[variant].labelColor} />
      ) : (
        <Text style={[styles.label, { color: variantStyles[variant].labelColor }]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: Touch.min,
    paddingHorizontal: 20,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...Type.labelLg,
  },
  disabled: {
    opacity: 0.5,
  },
});

const variantStyles = {
  primary: {
    container: { backgroundColor: EL.primary },
    labelColor: EL.white,
  },
  secondary: {
    container: {
      backgroundColor: EL.surfaceLow,
    },
    labelColor: EL.primary,
  },
  danger: {
    container: { backgroundColor: EL.nippu },
    labelColor: EL.white,
  },
} as const;
