import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
} from 'react-native';

import { Colors } from '@/constants/colors';
import { Radius, TouchTarget, Typography } from '@/constants/typography';

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
    minHeight: TouchTarget.min,
    paddingHorizontal: 20,
    borderRadius: Radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...Typography.title,
  },
  disabled: {
    opacity: 0.5,
  },
});

const variantStyles = {
  primary: {
    container: { backgroundColor: Colors.primary },
    labelColor: Colors.white,
  },
  secondary: {
    container: {
      backgroundColor: Colors.white,
      borderWidth: 1,
      borderColor: Colors.primary,
    },
    labelColor: Colors.primary,
  },
  danger: {
    container: { backgroundColor: Colors.danger },
    labelColor: Colors.white,
  },
} as const;
