import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, ViewStyle } from 'react-native';

import { Colors } from '@/constants/colors';
import { Radius, Spacing } from '@/constants/typography';

interface Props {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({
  width = '100%',
  height = 16,
  borderRadius = Radius.button,
  style,
}: Props) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.base,
        { width: width as any, height, borderRadius, opacity },
        style,
      ]}
    />
  );
}

/** Pre-built skeleton for a list item row (avatar + 2 lines). */
export function SkeletonRow() {
  return (
    <View style={styles.row}>
      <Skeleton width={44} height={44} borderRadius={22} />
      <View style={styles.rowText}>
        <Skeleton width="60%" height={14} />
        <Skeleton width="40%" height={10} style={{ marginTop: 8 }} />
      </View>
    </View>
  );
}

/** Pre-built skeleton for a card. */
export function SkeletonCard() {
  return (
    <View style={styles.card}>
      <Skeleton width="50%" height={14} />
      <Skeleton width="30%" height={24} style={{ marginTop: 8 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: Colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  rowText: { flex: 1, marginLeft: Spacing.md },
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.card,
    padding: Spacing.lg,
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
});
