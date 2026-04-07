import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ELCard } from '@/components/common/ELCard';
import { EL, Common, Space, Type } from '@/theme/emeraldLedger';
import { useSmartCards } from '@/hooks/useSmartCards';
import { formatRupees } from '@/utils/format';

export function MonthlySummaryScreen() {
  const { data: smart } = useSmartCards();
  const month = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  return (
    <SafeAreaView style={Common.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{month}</Text>
        <Text style={styles.sub}>Monthly summary</Text>

        <ELCard style={styles.card}>
          <Row label="Total collected" value={formatRupees(smart?.monthCollected ?? 0)} color={EL.primary} />
          <Row label="Total lent" value={formatRupees(smart?.monthLent ?? 0)} color={EL.onSurface} />
          <Row label="Expenses" value={formatRupees(smart?.monthExpenses ?? 0)} color={EL.nippu} />
          <View style={styles.divider} />
          <Row label="Profit" value={formatRupees(smart?.monthProfit ?? 0)} color={smart && smart.monthProfit >= 0 ? EL.primary : EL.nippu} bold />
        </ELCard>

        <ELCard style={styles.card}>
          <Row label="Capital invested (all time)" value={formatRupees(smart?.totalInvested ?? 0)} color={EL.onSurface} />
          <Row label="Available to lend" value={formatRupees(smart?.availableToLend ?? 0)} color={EL.primary} />
        </ELCard>

        <ELCard style={styles.card}>
          <Row label="Next week forecast" value={formatRupees(smart?.nextWeekForecast ?? 0)} color={EL.info} />
        </ELCard>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value, color, bold }: { label: string; value: string; color: string; bold?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[Type.bodyMd, { color: EL.onSurfaceSec }, bold && { fontWeight: '700' }]}>{label}</Text>
      <Text style={[Type.titleMd, { color, fontWeight: '700' }, bold && { fontSize: 20 }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: Space.xl, paddingBottom: Space.xxxl },
  title: { ...Type.displayMd },
  sub: { ...Type.bodySm, color: EL.onSurfaceSec, marginBottom: Space.lg },
  card: { marginBottom: Space.lg },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Space.sm },
  divider: { height: 1, backgroundColor: EL.surfaceLow, marginVertical: Space.md },
});
