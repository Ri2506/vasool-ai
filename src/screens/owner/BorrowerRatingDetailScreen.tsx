import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';

import { Avatar } from '@/components/common/Avatar';
import { ELCard } from '@/components/common/ELCard';
import { StarRating } from '@/components/common/StarRating';
import { EL, Common, Space, Type } from '@/theme/emeraldLedger';
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

  return (
    <SafeAreaView style={Common.screen}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Avatar name={borrower?.name ?? '?'} photoUri={borrower?.photo_url} size={56} />
          <Text style={styles.name}>{borrower?.name ?? ''}</Text>
        </View>

        {/* Big rating */}
        <ELCard style={styles.ratingCard}>
          <StarRating rating={stats?.displayRating ?? 0} size={22} />
          <Text style={styles.bigRating}>{(stats?.rating ?? 0).toFixed(1)}</Text>
          <Text style={styles.ratingLabel}>{ratingLabel}</Text>
        </ELCard>

        {/* Performance */}
        <ELCard style={styles.card}>
          <View style={styles.perfRow}>
            <Text style={styles.perfLabel}>PERFORMANCE</Text>
            <View style={styles.perfCircle}>
              <Text style={styles.perfPct}>{stats?.percentage ?? 0}%</Text>
            </View>
          </View>
          <Text style={styles.perfSub}>On-Time Payments</Text>
        </ELCard>

        {/* Rating factors */}
        <ELCard style={styles.card}>
          <Text style={styles.sectionTitle}>Rating Factors</Text>
          <Factor
            icon="check-circle"
            color={EL.nadapu}
            title="Payment Consistency"
            desc={stats?.missed === 0 ? 'Never missed a payment' : `${stats?.missed} missed payments`}
          />
          <Factor
            icon="history"
            color={EL.info}
            title="Loan History"
            desc={`${stats?.closedLoans ?? 0} loans successfully closed`}
          />
          <Factor
            icon="account-check"
            color={EL.completed}
            title="Reliability Score"
            desc={`${stats?.onTime ?? 0} of ${stats?.total ?? 0} payments on time`}
          />
        </ELCard>

        {/* AI Health Score */}
        <ELCard style={styles.card}>
          <View style={styles.aiRow}>
            <MaterialCommunityIcons name="robot" size={20} color={EL.primary} />
            <Text style={styles.aiLabel}>  AI Health Score</Text>
          </View>
          <Text style={styles.aiScore}>{((stats?.percentage ?? 0) / 10).toFixed(1)} / 10</Text>
          <Text style={styles.aiDesc}>
            {(stats?.percentage ?? 0) >= 80
              ? 'Very low default risk predicted by VasoolAI'
              : 'Moderate risk — monitor closely'}
          </Text>
        </ELCard>
      </ScrollView>
    </SafeAreaView>
  );
}

function Factor({ icon, color, title, desc }: { icon: string; color: string; title: string; desc: string }) {
  return (
    <View style={styles.factorRow}>
      <MaterialCommunityIcons name={icon as any} size={22} color={color} />
      <View style={styles.factorText}>
        <Text style={styles.factorTitle}>{title}</Text>
        <Text style={styles.factorDesc}>{desc}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: Space.xl, paddingBottom: Space.xxxl },
  header: { alignItems: 'center', marginBottom: Space.xl },
  name: { ...Type.titleLg, marginTop: Space.sm },
  ratingCard: { alignItems: 'center', marginBottom: Space.lg },
  bigRating: { ...Type.displayLg, fontSize: 48, color: EL.onSurface, marginTop: Space.sm },
  ratingLabel: { ...Type.labelMd, color: EL.primary, marginTop: Space.xs },
  card: { marginBottom: Space.lg },
  perfRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  perfLabel: { ...Type.labelMd },
  perfCircle: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: EL.primaryFixed, alignItems: 'center', justifyContent: 'center',
  },
  perfPct: { ...Type.titleLg, color: EL.primary },
  perfSub: { ...Type.bodySm, marginTop: Space.xs },
  sectionTitle: { ...Type.titleMd, marginBottom: Space.lg },
  factorRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: Space.lg },
  factorText: { flex: 1, marginLeft: Space.md },
  factorTitle: { ...Type.labelLg },
  factorDesc: { ...Type.bodySm, marginTop: 2 },
  aiRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Space.sm },
  aiLabel: { ...Type.titleMd, color: EL.primary },
  aiScore: { ...Type.displayMd, color: EL.primary },
  aiDesc: { ...Type.bodySm, marginTop: Space.xs },
});
