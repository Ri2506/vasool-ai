import React from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';

import { ELCard } from '@/components/common/ELCard';
import { ProgressBar } from '@/components/common/ProgressBar';
import { EL, Common, Space, Type } from '@/theme/emeraldLedger';
import { getTodaySummary } from '@/db/repos/collections';
import { getTodayExpenseTotal } from '@/db/repos/expenses';
import { useAuthStore } from '@/store/authStore';
import { formatRupees } from '@/utils/format';

export function AgentSummaryScreen() {
  const { t } = useTranslation();
  const orgId = useAuthStore((s) => s.user?.orgId ?? null);

  const { data: summary } = useQuery({
    queryKey: ['agentSummary', orgId],
    enabled: !!orgId,
    queryFn: () => getTodaySummary(orgId!),
    refetchInterval: 15_000,
  });

  const { data: expenseTotal } = useQuery({
    queryKey: ['agentExpTotal', orgId],
    enabled: !!orgId,
    queryFn: () => getTodayExpenseTotal(orgId!),
  });

  const done = summary?.collectionCount ?? 0;
  const dueCount = (summary?.dueCount ?? 0) + done;
  const progress = dueCount > 0 ? done / dueCount : 0;
  const netCash = (summary?.totalCollected ?? 0) - (expenseTotal ?? 0);

  return (
    <SafeAreaView style={Common.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('nav.summary')}</Text>
      </View>

      <ELCard style={styles.bigCard}>
        <Text style={styles.bigLabel}>Total collected today</Text>
        <Text style={styles.bigNumber}>{formatRupees(summary?.totalCollected ?? 0)}</Text>
      </ELCard>

      <ELCard style={styles.card}>
        <Text style={styles.cardTitle}>Visits</Text>
        <ProgressBar
          progress={progress}
          label={`${done} of ${dueCount} borrowers (${Math.round(progress * 100)}%)`}
        />
      </ELCard>

      <ELCard style={styles.card}>
        <Row label="Expenses today" value={formatRupees(expenseTotal ?? 0)} color={EL.nippu} />
        <Row label="Net cash in hand" value={formatRupees(netCash)} color={EL.primary} />
      </ELCard>
    </SafeAreaView>
  );
}

function Row({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.row}>
      <Text style={[Type.bodyMd, { color: EL.onSurfaceSec }]}>{label}</Text>
      <Text style={[Type.titleMd, { color, fontWeight: '700' }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { padding: Space.xl, paddingBottom: 0 },
  title: { ...Type.displayMd },
  bigCard: { margin: Space.xl, alignItems: 'center' },
  bigLabel: { ...Type.bodySm, color: EL.onSurfaceSec },
  bigNumber: { fontSize: 42, fontWeight: '800', color: EL.primary, marginTop: Space.sm, letterSpacing: -1 },
  card: { marginHorizontal: Space.xl, marginBottom: Space.lg },
  cardTitle: { ...Type.titleMd, marginBottom: Space.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Space.md },
});
