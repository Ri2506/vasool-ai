import React from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { ELCard } from '@/components/common/ELCard';
import { GradientButton } from '@/components/common/GradientButton';
import { StarRating } from '@/components/common/StarRating';
import { EL, Common, Radii, Space, Type } from '@/theme/emeraldLedger';
import { formatRupees } from '@/utils/format';
import type { OwnerStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<OwnerStackParamList, 'LoanCelebration'>;

/**
 * Full-screen loan completion celebration.
 * Matches stitch/loan_completion_celebration design.
 */
export function LoanCelebrationScreen({ route, navigation }: Props) {
  const { borrowerName, principal, totalPaid, installments, rating, borrowerId } = route.params;

  return (
    <SafeAreaView style={[Common.screen, styles.container]}>
      {/* Big checkmark */}
      <View style={styles.checkCircle}>
        <MaterialCommunityIcons name="check" size={48} color={EL.white} />
      </View>

      <Text style={styles.emoji}>🎉</Text>
      <Text style={styles.title}>Loan Complete!</Text>
      <Text style={styles.sub}>
        {borrowerName}'s loan of {formatRupees(principal)} is fully paid!
      </Text>

      {/* Payment status card */}
      <ELCard style={styles.card}>
        <Text style={Type.labelMd}>PAYMENT STATUS</Text>
        <View style={styles.statusRow}>
          <Text style={styles.statusBig}>{installments}/{installments}</Text>
          <View style={styles.completedPill}>
            <Text style={styles.completedText}>Completed</Text>
          </View>
        </View>
        <Text style={Type.bodySm}>Total collected: {formatRupees(totalPaid)}</Text>
      </ELCard>

      {/* Borrower health card */}
      <ELCard style={styles.card}>
        <Text style={Type.labelMd}>BORROWER HEALTH</Text>
        <View style={styles.healthRow}>
          <View>
            <Text style={Type.bodySm}>Rating</Text>
            <StarRating rating={rating} size={16} />
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[Type.displaySm, { color: EL.primary }]}>
              {rating >= 4 ? '98%' : rating >= 3 ? '75%' : '50%'}
            </Text>
            <Text style={Type.labelSm}>On-Time</Text>
          </View>
        </View>
      </ELCard>

      <View style={styles.buttons}>
        <GradientButton
          title={`Offer New Loan to ${borrowerName.split(' ')[0]}`}
          onPress={() => {
            navigation.popToTop();
            navigation.navigate('NewLoan', { borrowerId });
          }}
          style={{ marginBottom: Space.md }}
        />
        <GradientButton
          title="Back to Home"
          variant="secondary"
          onPress={() => navigation.popToTop()}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', padding: Space.xl },
  checkCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: EL.primary, alignItems: 'center', justifyContent: 'center',
    marginBottom: Space.lg,
  },
  emoji: { fontSize: 32, marginBottom: Space.sm },
  title: { ...Type.displayLg, textAlign: 'center' },
  sub: { ...Type.bodyMd, color: EL.onSurfaceSec, textAlign: 'center', marginTop: Space.sm, marginBottom: Space.xxl },
  card: { width: '100%', marginBottom: Space.lg },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Space.sm },
  statusBig: { ...Type.displayMd },
  completedPill: { backgroundColor: EL.primaryFixed, paddingHorizontal: Space.md, paddingVertical: Space.xs, borderRadius: Radii.pill },
  completedText: { ...Type.labelMd, color: EL.primary },
  healthRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Space.md },
  buttons: { width: '100%', marginTop: Space.xl },
});
