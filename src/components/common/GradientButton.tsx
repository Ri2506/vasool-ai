import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

import { EL, Radii, Space, Touch, Type } from '@/theme/emeraldLedger';

interface Props {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
}

/**
 * Emerald Ledger gradient button. Primary uses emerald gradient (approximated
 * as solid with pressed darkening since RN doesn't have CSS gradients).
 * On web, we apply real CSS gradient via style override.
 */
export function GradientButton({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  style,
}: Props) {
  const isDisabled = disabled || loading;
  const config = VARIANTS[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: pressed && !isDisabled ? config.pressed : config.bg },
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={config.text} />
      ) : (
        <View style={styles.content}>
          {icon ? <View style={styles.icon}>{icon}</View> : null}
          <Text style={[styles.label, { color: config.text }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

const VARIANTS = {
  primary: {
    bg: EL.primary,
    pressed: EL.primaryContainer,
    text: EL.white,
  },
  secondary: {
    bg: EL.surfaceHighest,
    pressed: EL.surfaceHigh,
    text: EL.primary,
  },
  danger: {
    bg: EL.tertiary,
    pressed: EL.tertiaryContainer,
    text: EL.white,
  },
};

const styles = StyleSheet.create({
  base: {
    minHeight: Touch.min,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Space.xxl,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: Space.sm,
  },
  label: {
    ...Type.labelLg,
  },
  disabled: {
    opacity: 0.5,
  },
});
