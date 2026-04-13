import React from 'react';
import { FlatList, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { ELCard } from '@/components/common/ELCard';
import { EL, Common, Radii, Shadows, Space, Type } from '@/theme/emeraldLedger';
import { getDailySummaries, type DailySummaryRow } from '@/db/repos/reports';
import { useAuthStore } from '@/store/authStore';
import { formatDateShort, formatRupees } from '@/utils/format';

export function DailySummaryScreen() {
  const orgId = useAuthStore((s) => s.user?.orgId ?? null);
  const { data } = useQuery({
    queryKey: ['report', 'daily', orgId],
    enabled: !!orgId,
    queryFn: () => getDailySummaries(orgId!),
  });

  const renderItem = ({ item }: { item: DailySummaryRow }) => {
    const net = item.total_collected - item.total_expenses;
    return (
      <ELCard style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.dateText}>{formatDateShort(new Date(item.date))}</Text>
          <Text style={[styles.netText, { color: net >= 0 ? EL.primary : EL.nippu }]}>
            {formatRupees(net)}
          </Text>
        </View>
        <View style={styles.row}>
          <Stat label="Collected" value={formatRupees(item.total_collected)} color={EL.primary} />
          <Stat label="Expenses" value={formatRupees(item.total_expenses)} color={EL.tertiary} />
          <Stat label="Count" value={String(item.collection_count)} color={EL.onSurface} />
        </View>
      </ELCard>
    );
  };

  return (
    <SafeAreaView style={Common.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Daily Summary</Text>
        <Text style={styles.sub}>Last 30 days collection breakdown</Text>
      </View>
      {data && data.length > 0 ? (
        <FlatList
          data={data}
          keyExtractor={(item) => String(item.date)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: Space.lg, paddingBottom: 100 }}
        />
      ) : (
        <ELCard style={{ margin: Space.xl }}>
          <Text style={Type.bodySm}>No collection data yet. Start collecting to see daily summaries.</Text>
        </ELCard>
      )}
    </SafeAreaView>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { padding: Space.xl, paddingBottom: Space.md },
  title: { ...Type.displaySm },
  sub: { ...Type.bodySm, color: EL.onSurfaceSec, marginTop: 2 },
  card: { marginBottom: Space.md },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Space.md,
  },
  dateText: { ...Type.titleMd, fontWeight: '700' },
  netText: { ...Type.titleMd, fontWeight: '800' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { alignItems: 'center' },
  statLabel: { fontSize: 11, fontWeight: '600', color: EL.onSurfaceMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { fontSize: 16, fontWeight: '700', marginTop: 2 },
});
