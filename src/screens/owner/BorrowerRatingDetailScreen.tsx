import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';

import { Avatar } from '@/components/common/Avatar';
import { StarRating } from '@/components/common/StarRating';
import { EL, Common, Radii, Shadows, Space, Type } from '@/theme/emeraldLedger';
import { openDb } from '@/db';
import { useBorrower } from '@/hooks/useBorrowers';
import type { OwnerStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<OwnerStackParamList, 'BorrowerRating'>;

export function BorrowerRatingDetailScreen({ route }: Props) {
  const { id } = route.params;
  const { data: borrower } = useBorrower(id);

  const { data: stats } = useQuery({
    queryKey: ['borrower-rating-detail', id],
    enabled: !!id,
    queryFn: async () => {
      const db = await openDb();
      const now = Date.now();
      const payments = await db.getFirstAsync<{ on_time: number; total: number; missed: number }>(
        `SELECT
           SUM(CASE WHEN pe.status IN ('paid','advance_covered') THEN 1 ELSE 0 END) AS on_time,
           SUM(CASE WHEN pe.status = 'missed' THEN 1 ELSE 0 END) AS missed,
           COUNT(*) AS total
         FROM plan_entries pe JOIN loans l ON l.id = pe.loan_id
         WHERE l.borrower_id = ? AND pe.due_date < ${now}`,
        [id]
      );
      const loans = await db.getFirstAsync<{ active: number; closed: number }>(
        `SELECT
           SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) AS active,
           SUM(CASE WHEN status='closed' THEN 1 ELSE 0 END) AS closed
         FROM loans WHERE borrower_id = ?`,
        [id]
      );
      const onTime = Number(payments?.on_time ?? 0);
      const total = Number(payments?.total ?? 0);
      const pct = total > 0 ? Math.round((onTime / total) * 100) : 0;
      let rating = 0;
      if (total > 0) {
        if (pct >= 90) rating = 5;
        else if (pct >= 75) rating = 4;
        else if (pct >= 60) rating = 3;
        else if (pct >= 40) rating = 2;
        else rating = 1;
      }
      return {
        rating: rating + (pct % 10 >= 5 ? 0.5 : 0),
        displayRating: rating,
        percentage: pct,
        onTime,
        missed: Number(payments?.missed ?? 0),
        total,
        activeLoans: Number(loans?.active ?? 0),
        closedLoans: Number(loans?.closed ?? 0),
      };
    },
  });

  const ratingLabel = (stats?.displayRating ?? 0) >= 4 ? 'EXCELLENT RELIABILITY' : (stats?.displayRating ?? 0) >= 3 ? 'GOOD RELIABILITY' : 'NEEDS ATTENTION';
  const aiScore = ((stats?.percentage ?? 0) / 10).toFixed(1);

  return (
    <SafeAreaView style={Common.screen}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Hero: Rating Display */}
        <View style={styles.heroSection}>
          <View style={styles.starsRow}>
            <StarRating rating={stats?.rating ?? 0} size={36} />
          </View>
          <Text style={styles.bigRating}>
            {(stats?.rating ?? 0).toFixed(1)}
            <Text style={styles.bigRatingSuffix}>/5</Text>
          </Text>
          <Text style={styles.ratingLabel}>{ratingLabel}</Text>
        </View>

        {/* Performance Overview */}
        <View style={styles.perfCard}>
          <View style={{ gap: 4 }}>
            <Text style={styles.perfSectionLabel}>PERFORMANCE</Text>
            <Text style={styles.perfBig}>{stats?.percentage ?? 0}%</Text>
            <Text style={styles.perfSub}>On-Time Payments</Text>
          </View>
          {/* Radial progress placeholder */}
          <View style={styles.perfCircle}>
            <MaterialCommunityIcons name="lightning-bolt" size={24} color={EL.primary} />
          </View>
        </View>

        {/* Rating Factors */}
        <Text style={styles.sectionTitle}>Rating Factors</Text>

        <Factor
          icon="calendar-check"
          title="Payment Consistency"
          desc={stats?.missed === 0 ? 'Never missed a daily payment in the last 30 days' : `${stats?.missed} missed payments`}
          showCheck={stats?.missed === 0}
        />
        <Factor
          icon="trophy"
          title="Loan History"
          desc={`${stats?.closedLoans ?? 0} loans successfully closed with VasoolAI`}
        />
        <Factor
          icon="account-check"
          title="Active Engagement"
          desc={`${stats?.activeLoans ?? 0} active loan${(stats?.activeLoans ?? 0) !== 1 ? 's' : ''} currently running`}
        />

        {/* AI Health Score */}
        <View style={styles.aiCard}>
          <View style={styles.aiHeader}>
            <MaterialCommunityIcons name="chart-line" size={20} color={EL.primaryContainer} />
            <Text style={styles.aiHeaderText}>AI Health Score</Text>
          </View>
          <View style={styles.aiScoreRow}>
            <Text style={styles.aiScoreBig}>{aiScore}</Text>
            <Text style={styles.aiScoreSuffix}>/ 10</Text>
          </View>
          {/* Progress bar */}
          <View style={styles.aiProgressTrack}>
            <View style={[styles.aiProgressFill, { width: `${stats?.percentage ?? 0}%` }]} />
          </View>
          <Text style={styles.aiDesc}>
            {(stats?.percentage ?? 0) >= 80
              ? 'Very low default risk predicted by VasoolAI'
              : 'Moderate risk \u2014 monitor closely'}
          </Text>
        </View>

        {/* Performance pill — dynamic based on actual percentage */}
        <View style={[
          styles.comparisonPill,
          (stats?.percentage ?? 0) < 60 && { backgroundColor: 'rgba(155, 62, 59, 0.1)' }
        ]}>
          <MaterialCommunityIcons
            name={(stats?.percentage ?? 0) >= 80 ? 'trending-up' : (stats?.percentage ?? 0) >= 60 ? 'minus' : 'trending-down'}
            size={16}
            color={(stats?.percentage ?? 0) >= 60 ? EL.primary : EL.tertiary}
          />
          <Text style={[
            styles.comparisonText,
            (stats?.percentage ?? 0) < 60 && { color: EL.tertiary }
          ]}>
            {(stats?.percentage ?? 0) >= 80
              ? 'Excellent payment track record'
              : (stats?.percentage ?? 0) >= 60
              ? 'Steady payment history'
              : 'Payment attention needed'}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Factor({ icon, title, desc, showCheck }: { icon: string; title: string; desc: string; showCheck?: boolean }) {
  return (
    <View style={styles.factorCard}>
      <View style={styles.factorIcon}>
        <MaterialCommunityIcons name={icon as any} size={22} color={EL.primary} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={styles.factorHeader}>
          <Text style={styles.factorTitle}>{title}</Text>
          {showCheck ? (
            <MaterialCommunityIcons name="check-circle" size={18} color={EL.primary} />
          ) : null}
        </View>
        <Text style={styles.factorDesc}>{desc}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: Space.xl, paddingBottom: Space.xxxl },

  // Hero
  heroSection: {
    alignItems: 'center',
    paddingVertical: Space.xxl,
    marginBottom: Space.xxl,
  },
  starsRow: {
    marginBottom: Space.sm,
  },
  bigRating: {
    fontSize: 48,
    fontWeight: '800',
    color: EL.onSurface,
    letterSpacing: -1.5,
  },
  bigRatingSuffix: {
    fontSize: 24,
    fontWeight: '400',
    color: EL.outlineVariant,
  },
  ratingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: EL.primaryContainer,
    letterSpacing: 0.5,
    marginTop: Space.xs,
  },

  // Performance
  perfCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.xxl,
    padding: Space.xxl,
    marginBottom: Space.xxl,
    ...Shadows.card,
  },
  perfSectionLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: EL.outline,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  perfBig: {
    fontSize: 30,
    fontWeight: '700',
    color: EL.onSurface,
  },
  perfSub: {
    fontSize: 14,
    fontWeight: '500',
    color: EL.onSurfaceSec,
  },
  perfCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: EL.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Section
  sectionTitle: {
    ...Type.titleLg,
    fontWeight: '700',
    fontSize: 20,
    marginBottom: Space.lg,
    paddingHorizontal: Space.sm,
  },

  // Factor cards
  factorCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Space.lg,
    backgroundColor: EL.surfaceCard,
    padding: Space.xl,
    borderRadius: Radii.xl,
    marginBottom: Space.md,
    ...Shadows.card,
  },
  factorIcon: {
    backgroundColor: EL.secondaryContainer,
    padding: Space.md,
    borderRadius: Radii.lg,
  },
  factorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  factorTitle: {
    ...Type.labelLg,
    fontWeight: '700',
  },
  factorDesc: {
    ...Type.bodySm,
    color: EL.onSurfaceSec,
    lineHeight: 20,
  },

  // AI Health Score
  aiCard: {
    backgroundColor: EL.surfaceHighest,
    borderRadius: Radii.xxl,
    padding: Space.xl,
    marginTop: Space.md,
    marginBottom: Space.xxl,
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    marginBottom: Space.md,
  },
  aiHeaderText: {
    ...Type.titleMd,
    fontWeight: '700',
    color: EL.primaryContainer,
  },
  aiScoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Space.sm,
  },
  aiScoreBig: {
    fontSize: 36,
    fontWeight: '800',
    color: EL.onSurface,
  },
  aiScoreSuffix: {
    fontSize: 16,
    fontWeight: '700',
    color: EL.outline,
  },
  aiProgressTrack: {
    height: 8,
    backgroundColor: 'rgba(0,105,72,0.1)',
    borderRadius: Radii.pill,
    overflow: 'hidden',
    marginTop: Space.md,
  },
  aiProgressFill: {
    height: '100%',
    backgroundColor: EL.primary,
    borderRadius: Radii.pill,
  },
  aiDesc: {
    fontSize: 14,
    fontWeight: '500',
    color: EL.secondary,
    marginTop: Space.md,
  },

  // Comparison
  comparisonPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.sm,
    backgroundColor: 'rgba(0,133,93,0.1)',
    paddingHorizontal: Space.xl,
    paddingVertical: Space.md,
    borderRadius: Radii.pill,
  },
  comparisonText: {
    fontSize: 12,
    fontWeight: '700',
    color: EL.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
