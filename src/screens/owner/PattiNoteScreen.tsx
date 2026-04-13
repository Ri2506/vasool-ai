import React, { useState } from 'react';
import { FlatList, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';

import { ELCard } from '@/components/common/ELCard';
import { ExportSheet } from '@/components/common/ExportSheet';
import { ProgressBar } from '@/components/common/ProgressBar';
import { EL, Common, Radii, Space, Type } from '@/theme/emeraldLedger';
import { getLineSummary, type LineSummaryRow } from '@/db/repos/reports';
import { useLineStats } from '@/hooks/useLines';
import { useAuthStore } from '@/store/authStore';
import { formatRupees } from '@/utils/format';
import { buildPattiReport } from '@/utils/pdfExport';

export function PattiNoteScreen() {
  const orgId = useAuthStore((s) => s.user?.orgId ?? null);
  const { data } = useQuery({
    queryKey: ['report', 'lines', orgId],
    enabled: !!orgId,
    queryFn: () => getLineSummary(orgId!),
  });
  // Pulled separately so the export carries agent name + outstanding which
  // getLineSummary doesn't compute.
  const { data: stats } = useLineStats();
  const [showExport, setShowExport] = useState(false);

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
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Patti Note</Text>
          <Text style={styles.sub}>Line-wise collection register for today</Text>
        </View>
        <Pressable
          style={styles.exportBtn}
          onPress={() => setShowExport(true)}
          disabled={!data || data.length === 0}
        >
          <MaterialCommunityIcons name="export-variant" size={18} color={EL.primary} />
          <Text style={styles.exportBtnText}>Export</Text>
        </Pressable>
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

      <ExportSheet
        visible={showExport}
        onClose={() => setShowExport(false)}
        filename="VasoolAI-PattiNote"
        title="Export Patti Note"
        build={() => {
          // Merge today's collection summary with line stats so the export
          // is richer than the on-screen view (adds agent name + outstanding).
          const statsByLine = new Map((stats ?? []).map((s) => [s.line_id, s]));
          return buildPattiReport(
            (data ?? []).map((d) => {
              const s = statsByLine.get(d.line_id);
              return {
                line_name: d.line_name,
                borrower_count: d.borrower_count,
                total_due_today: d.total_due,
                total_collected_today: d.total_collected,
                outstanding: s?.outstanding_principal ?? 0,
                agent_name: s?.agent_name ?? null,
              };
            }),
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Space.xl,
    paddingTop: Space.xl,
    paddingBottom: Space.md,
    gap: Space.md,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Space.md,
    paddingVertical: Space.sm,
    borderRadius: Radii.pill,
    backgroundColor: 'rgba(0,105,72,0.08)',
  },
  exportBtnText: { fontSize: 12, fontWeight: '700', color: EL.primary },
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
