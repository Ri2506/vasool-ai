import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/common/Card';
import { Colors } from '@/constants/colors';
import { Spacing, Typography } from '@/constants/typography';
import { useSmartCards } from '@/hooks/useSmartCards';
import { formatRupees } from '@/utils/format';

export function MonthlySummaryScreen() {
  const { data: smart } = useSmartCards();

  const month = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>{month}</Text>
        <Text style={styles.sub}>Monthly summary</Text>

        <Card style={styles.card}>
          <Row label="Total collected" value={formatRupees(smart?.monthCollected ?? 0)} color={Colors.primary} />
          <Row label="Total lent" value={formatRupees(smart?.monthLent ?? 0)} color={Colors.text} />
          <Row label="Expenses" value={formatRupees(smart?.monthExpenses ?? 0)} color={Colors.danger} />
          <View style={styles.divider} />
          <Row label="Profit" value={formatRupees(smart?.monthProfit ?? 0)} color={smart && smart.monthProfit >= 0 ? Colors.primary : Colors.danger} bold />
        </Card>

        <Card style={styles.card}>
          <Row label="Capital invested (all time)" value={formatRupees(smart?.totalInvested ?? 0)} color={Colors.text} />
          <Row label="Available to lend" value={formatRupees(smart?.availableToLend ?? 0)} color={Colors.primary} />
        </Card>

        <Card style={styles.card}>
          <Row label="Next week forecast" value={formatRupees(smart?.nextWeekForecast ?? 0)} color={Colors.info} />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value, color, bold }: { label: string; value: string; color: string; bold?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, { color }, bold && { fontSize: 20 }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  container: { padding: Spacing.xl, paddingBottom: Spacing.xxl },
  title: { ...Typography.display, color: Colors.text },
  sub: { ...Typography.body, color: Colors.textSec, marginBottom: Spacing.lg },
  card: { marginBottom: Spacing.lg },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.sm },
  rowLabel: { ...Typography.body, color: Colors.textSec },
  rowValue: { ...Typography.title, fontWeight: '700' },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.md },
});
