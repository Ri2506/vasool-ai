import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/colors';

interface Props {
  rating: number; // 0-5
  size?: number;
}

export function StarRating({ rating, size = 12 }: Props) {
  if (rating <= 0) return null;
  const filled = Math.min(5, Math.max(0, Math.round(rating)));
  const empty = 5 - filled;

  return (
    <View style={styles.container}>
      <Text style={[styles.stars, { fontSize: size }]}>
        {'★'.repeat(filled)}
      </Text>
      <Text style={[styles.emptyStars, { fontSize: size }]}>
        {'☆'.repeat(empty)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center' },
  stars: { color: Colors.warn, letterSpacing: 1 },
  emptyStars: { color: Colors.border, letterSpacing: 1 },
});
