import React from 'react';
import { FlatList, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { ELCard } from '@/components/common/ELCard';
import { ProgressBar } from '@/components/common/ProgressBar';
import { EL, Common, Space, Type } from '@/theme/emeraldLedger';
import { getLineSummary, type LineSummaryRow } from '@/db/repos/reports';
import { useAuthStore } from '@/store/authStore';
import { formatRupees } from '@/utils/format';

export function PattiNoteScreen() {
  const orgId = useAuthStore((s) => s.user?.orgId ?? null);
  const { data } = useQuery({
    queryKey: ['report', 'lines', orgId],
    enabled: !!orgId,
    queryFn: () => getLineSummary(orgId!),
  });

  const renderItem = ({ item }: { item: LineSummaryRow }) => {
    const pct = item.total_due > 0 ? item.total_collected / item.total_due : 0;
    return (
      <ELCard style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.lineName}>{item.line_name}</Text>
          <Text style={styles.lineType}>{item.line_type}</Text>
        </View>
        <ProgressBar progress={pct} />
        <View style={styles.row}>
          <Text style={styles.stat}>Due: {formatRupees(item.total_due)}</Text>
          <Text style={[styles.stat, { color: EL.primary, fontWeight: '700' }]}>
            Collected: {formatRupees(item.total_collected)}
          </Text>
        </View>
        <Text style={styles.borrowerCount}>
          {item.borrower_count} borrower{item.borrower_count !== 1 ? 's' : ''}
        </Text>
      </ELCard>
    );
  };

  return (
    <SafeAreaView style={Common.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Patti Note</Text>
        <Text style={styles.sub}>Line-wise collection register for today</Text>
      </View>
      {data && data.length > 0 ? (
        <FlatList
          data={data}
          keyExtractor={(item) => item.line_id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: Space.lg, paddingBottom: 100 }}
        />
      ) : (
        <ELCard style={{ margin: Space.xl }}>
          <Text style={Type.bodySm}>No lines created yet. Create lines to see the Patti Note.</Text>
        </ELCard>
      )}
    </SafeAreaView>
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
  lineName: { ...Type.titleMd, fontWeight: '700' },
  lineType: { ...Type.labelSm, color: EL.primary, textTransform: 'uppercase' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Space.md,
  },
  stat: { fontSize: 13, fontWeight: '500', color: EL.onSurfaceSec },
  borrowerCount: { fontSize: 12, color: EL.onSurfaceMuted, marginTop: Space.sm },
});
