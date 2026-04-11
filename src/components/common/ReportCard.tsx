import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { EL, Radii, Shadows, Space, Type } from '@/theme/emeraldLedger';

interface Props {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  iconBg?: string;
  iconColor?: string;
  title: string;
  subtitle: string;
  onPress?: () => void;
  style?: ViewStyle;
}

/**
 * Report grid card — icon circle + title + subtitle.
 * Used in the Reports Hub 2-column grid layout.
 */
export function ReportCard({
  icon,
  iconBg = EL.primaryFixed + '4D', // 30% opacity
  iconColor = EL.primary,
  title,
  subtitle,
  onPress,
  style,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        pressed && styles.pressed,
        style,
      ]}
    >
      <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
        <MaterialCommunityIcons name={icon} size={22} color={iconColor} />
      </View>
      <View style={styles.textGroup}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.lg,
    padding: Space.lg,
    gap: Space.md,
    ...Shadows.card,
  },
  pressed: {
    backgroundColor: EL.surfaceLow,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textGroup: {
    gap: 2,
  },
  title: {
    ...Type.labelLg,
    fontWeight: '700',
  },
  subtitle: {
    ...Type.labelSm,
    color: EL.onSurfaceMuted,
    lineHeight: 16,
  },
});
