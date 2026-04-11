import React from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { EL, Glass, Radii, Space, Type } from '@/theme/emeraldLedger';

interface Props {
  title: string;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  style?: ViewStyle;
}

/**
 * Sticky glassmorphic header bar — Emerald Ledger aesthetic.
 * Tonal glass background with optional back button and right action slot.
 */
export function GlassHeader({ title, onBack, rightAction, style }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        Glass.container,
        { paddingTop: insets.top + Space.sm },
        style,
      ]}
    >
      <View style={styles.row}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            hitSlop={8}
            style={({ pressed }) => [
              styles.backBtn,
              pressed && styles.backBtnPressed,
            ]}
          >
            <MaterialCommunityIcons
              name="arrow-left"
              size={24}
              color={EL.onSurface}
            />
          </Pressable>
        ) : (
          <View style={styles.backPlaceholder} />
        )}

        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>

        {rightAction ?? <View style={styles.backPlaceholder} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 40,
    paddingHorizontal: Space.lg,
    paddingBottom: Space.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnPressed: {
    backgroundColor: EL.surfaceHigh,
  },
  backPlaceholder: {
    width: 40,
  },
  title: {
    ...Type.titleLg,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: Space.sm,
  },
});
