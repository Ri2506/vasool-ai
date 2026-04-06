import React from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';

import { Card } from '@/components/common/Card';
import { ProgressBar } from '@/components/common/ProgressBar';
import { Colors } from '@/constants/colors';
import { Spacing, Typography } from '@/constants/typography';
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

  const totalDue = (summary?.totalExpected ?? 0) + (summary?.totalCollected ?? 0);
  const done = summary?.collectionCount ?? 0;
  const dueCount = (summary?.dueCount ?? 0) + done;
  const progress = dueCount > 0 ? done / dueCount : 0;
  const netCash = (summary?.totalCollected ?? 0) - (expenseTotal ?? 0);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('nav.summary')}</Text>
      </View>

      {/* Big collected number */}
      <Card style={styles.bigCard}>
        <Text style={styles.bigLabel}>Total collected today</Text>
        <Text style={styles.bigNumber}>{formatRupees(summary?.totalCollected ?? 0)}</Text>
      </Card>

      {/* Progress */}
      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Visits</Text>
        <ProgressBar
          progress={progress}
          label={`${done} of ${dueCount} borrowers (${Math.round(progress * 100)}%)`}
        />
      </Card>

      {/* Expenses + net cash */}
      <Card style={styles.card}>
        <Row label="Expenses today" value={formatRupees(expenseTotal ?? 0)} color={Colors.danger} />
        <Row label="Net cash in hand" value={formatRupees(netCash)} color={Colors.primary} />
      </Card>
    </SafeAreaView>
  );
}

function Row({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: { padding: Spacing.xl, paddingBottom: 0 },
  title: { ...Typography.display, color: Colors.text },
  bigCard: { margin: Spacing.xl, alignItems: 'center' },
  bigLabel: { ...Typography.body, color: Colors.textSec },
  bigNumber: { fontSize: 42, fontWeight: '700', color: Colors.primary, marginTop: Spacing.sm },
  card: { marginHorizontal: Spacing.xl, marginBottom: Spacing.lg },
  cardTitle: { ...Typography.title, color: Colors.text, marginBottom: Spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.md },
  rowLabel: { ...Typography.body, color: Colors.textSec },
  rowValue: { ...Typography.title },
});
