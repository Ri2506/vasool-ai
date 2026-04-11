import React from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Avatar } from '@/components/common/Avatar';
import { GradientButton } from '@/components/common/GradientButton';
import { StarRating } from '@/components/common/StarRating';
import { EL, Common, Radii, Shadows, Space, Type } from '@/theme/emeraldLedger';
import { formatRupees } from '@/utils/format';
import { useLoansForBorrower } from '@/hooks/useLoans';
import type { OwnerStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<OwnerStackParamList, 'LoanCelebration'>;

/**
 * Full-screen loan completion celebration.
 * Matches stitch/loan_completion_celebration design.
 */
export function LoanCelebrationScreen({ route, navigation }: Props) {
  const { borrowerName, principal, totalPaid, installments, rating, borrowerId } = route.params;
  const { data: loans } = useLoansForBorrower(borrowerId);
  const completedLoanCount = loans ? loans.filter((l) => l.status === 'closed').length : 1;
  const onTimePercent = rating >= 4 ? 98 : rating >= 3 ? 75 : 50;

  return (
    <SafeAreaView style={[Common.screen, styles.container]}>
      {/* Central Icon */}
      <View style={styles.checkCircle}>
        <MaterialCommunityIcons name="check-circle" size={48} color={EL.white} />
      </View>

      <Text style={styles.title}>{'\uD83C\uDF89'} Loan Complete!</Text>
      <Text style={styles.sub}>
        {borrowerName}'s daily loan of <Text style={{ fontWeight: '700', color: EL.onSurface }}>{formatRupees(principal)}</Text> is fully paid!
      </Text>

      {/* Payment status card */}
      <View style={styles.card}>
        <View style={styles.statusHeader}>
          <View style={{ gap: 4 }}>
            <Text style={styles.statusLabel}>Payments Status</Text>
            <Text style={styles.statusBig}>{installments}/{installments} payments</Text>
          </View>
          <View style={styles.completedPill}>
            <Text style={styles.completedText}>{'\u0BA8\u0B9F\u0BAA\u0BCD\u0BAA\u0BC1'}</Text>
          </View>
        </View>
        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: '100%' }]} />
        </View>
        <Text style={styles.collectedText}>
          Total collected: <Text style={{ fontWeight: '700', color: EL.onSurface }}>{formatRupees(totalPaid)}</Text>
        </Text>
      </View>

      {/* Rating Card */}
      <View style={styles.ratingCard}>
        <View style={{ gap: 4 }}>
          <Text style={styles.statusLabel}>Borrower Health</Text>
          <View style={styles.ratingRow}>
            <Text style={styles.ratingLabel}>Rating:</Text>
            <StarRating rating={rating} size={20} />
          </View>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.onTimeBig}>{onTimePercent}%</Text>
          <Text style={styles.onTimeLabel}>ON-TIME</Text>
        </View>
      </View>

      {/* Borrower avatar + history */}
      <View style={styles.borrowerHistory}>
        <Avatar name={borrowerName} size={48} />
        {completedLoanCount != null && completedLoanCount > 0 ? (
          <Text style={styles.historyText}>
            History with VasoolAI: {completedLoanCount} loan{completedLoanCount > 1 ? 's' : ''} completed
          </Text>
        ) : null}
      </View>

      {/* Action buttons */}
      <View style={styles.buttons}>
        <GradientButton
          title={`Offer New Loan to ${borrowerName.split(' ')[0]}`}
          onPress={() => {
            navigation.popToTop();
            navigation.navigate('NewLoan', { borrowerId });
          }}
          style={{ marginBottom: Space.md }}
        />
        <View style={styles.secondaryBtn}>
          <GradientButton
            title="Back to Home"
            variant="secondary"
            onPress={() => navigation.popToTop()}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Space.xl,
  },

  // Check circle
  checkCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: EL.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Space.xl,
    ...Shadows.float,
  },

  title: {
    ...Type.displaySm,
    color: EL.primary,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: Space.sm,
  },
  sub: {
    ...Type.bodyMd,
    color: EL.onSurfaceSec,
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 22,
    marginBottom: Space.xxl,
  },

  // Payment card
  card: {
    width: '100%',
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.lg,
    padding: Space.xl,
    marginBottom: Space.lg,
    ...Shadows.card,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: EL.outline,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  statusBig: {
    fontSize: 20,
    fontWeight: '800',
    color: EL.primary,
  },
  completedPill: {
    backgroundColor: EL.primaryFixed,
    paddingHorizontal: Space.md,
    paddingVertical: Space.xs,
    borderRadius: Radii.pill,
  },
  completedText: {
    fontSize: 12,
    fontWeight: '700',
    color: EL.onSurface,
    textTransform: 'uppercase',
  },
  progressTrack: {
    height: 8,
    backgroundColor: EL.surfaceHighest,
    borderRadius: Radii.pill,
    overflow: 'hidden',
    marginTop: Space.lg,
  },
  progressFill: {
    height: '100%',
    backgroundColor: EL.primary,
    borderRadius: Radii.pill,
  },
  collectedText: {
    ...Type.bodyMd,
    color: EL.onSurfaceSec,
    marginTop: Space.lg,
  },

  // Rating card
  ratingCard: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(217, 230, 221, 0.5)',
    borderRadius: Radii.lg,
    padding: Space.xl,
    marginBottom: Space.xxl,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    marginTop: Space.xs,
  },
  ratingLabel: {
    ...Type.labelLg,
    fontWeight: '700',
  },
  onTimeBig: {
    fontSize: 24,
    fontWeight: '800',
    color: EL.primary,
  },
  onTimeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: EL.outline,
    textTransform: 'uppercase',
  },

  // Borrower history
  borrowerHistory: {
    alignItems: 'center',
    gap: Space.sm,
    marginBottom: Space.xxl,
  },
  historyText: {
    ...Type.bodySm,
    color: EL.onSurfaceSec,
    fontWeight: '500',
  },

  // Buttons
  buttons: { width: '100%' },
  secondaryBtn: {},
});
