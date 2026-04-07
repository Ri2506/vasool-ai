import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { EL } from '@/theme/emeraldLedger';

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
        {'\u2605'.repeat(filled)}
      </Text>
      {empty > 0 ? (
        <Text style={[styles.emptyStars, { fontSize: size }]}>
          {'\u2606'.repeat(empty)}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center' },
  stars: { color: EL.starAmber, letterSpacing: 1 },
  emptyStars: { color: EL.outline, letterSpacing: 1 },
});
