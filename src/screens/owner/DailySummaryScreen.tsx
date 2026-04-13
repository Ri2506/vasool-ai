// DailySummaryScreen — per-day financial picture across the last 30 days.
//
// Shows collection (cash/account split), expenses, new loans disbursed, and
// net cash flow. The owner uses this to reconcile "where did the money go
// today?" — especially important when they take cash from the office to
// hand out as a new loan.

import React, { useState } from 'react';
import { FlatList, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';

import { ELCard } from '@/components/common/ELCard';
import { ExportSheet } from '@/components/common/ExportSheet';
import { EL, Common, Radii, Space, Type } from '@/theme/emeraldLedger';
import { getDailySummaries, type DailySummaryRow } from '@/db/repos/reports';
import { useAuthStore } from '@/store/authStore';
import { formatDateShort, formatRupees } from '@/utils/format';
import { buildDailySummaryReport } from '@/utils/pdfExport';

export function DailySummaryScreen() {
  const orgId = useAuthStore((s) => s.user?.orgId ?? null);
  const { data } = useQuery({
    queryKey: ['report', 'daily', orgId],
    enabled: !!orgId,
    queryFn: () => getDailySummaries(orgId!),
  });
  const [showExport, setShowExport] = useState(false);

  const renderItem = ({ item }: { item: DailySummaryRow }) => {
    const netPositive = item.net_cash_flow >= 0;
    return (
      <ELCard style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.dateText}>{formatDateShort(new Date(item.date))}</Text>
          <View style={styles.netBadge}>
            <MaterialCommunityIcons
              name={netPositive ? 'trending-up' : 'trending-down'}
              size={14}
              color={netPositive ? EL.primary : EL.nippu}
            />
            <Text style={[styles.netText, { color: netPositive ? EL.primary : EL.nippu }]}>
              {netPositive ? '+' : ''}
              {formatRupees(item.net_cash_flow)}
            </Text>
          </View>
        </View>

        {/* Inflow section */}
        {item.total_collected > 0 || item.principal_returned > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>INFLOW</Text>
            {item.total_collected > 0 ? (
              <>
                <Row label={`Collections (${item.collection_count})`} value={item.total_collected} positive />
                {item.cash_collected > 0 ? (
                  <Row sub label="• Cash" value={item.cash_collected} />
                ) : null}
                {item.account_collected > 0 ? (
                  <Row sub label="• Account" value={item.account_collected} />
                ) : null}
              </>
            ) : null}
            {item.principal_returned > 0 ? (
              <Row label="Principal returns" value={item.principal_returned} positive />
            ) : null}
          </View>
        ) : null}

        {/* Outflow section */}
        {item.loans_disbursed_count > 0 || item.total_expenses > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>OUTFLOW</Text>
            {item.loans_disbursed_count > 0 ? (
              <Row
                label={`New loans (${item.loans_disbursed_count})`}
                value={item.loans_disbursed_amount}
                negative
              />
            ) : null}
            {item.total_expenses > 0 ? (
              <Row label="Expenses" value={item.total_expenses} negative />
            ) : null}
          </View>
        ) : null}
      </ELCard>
    );
  };

  return (
    <SafeAreaView style={Common.screen}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Daily Summary</Text>
          <Text style={styles.sub}>Last 30 days — collections, expenses, loans disbursed</Text>
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
          keyExtractor={(item) => String(item.date)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: Space.lg, paddingBottom: 100 }}
        />
      ) : (
        <ELCard style={{ margin: Space.xl }}>
          <Text style={Type.bodySm}>
            No activity yet. Start collecting or give out a new loan to see daily summaries.
          </Text>
        </ELCard>
      )}

      <ExportSheet
        visible={showExport}
        onClose={() => setShowExport(false)}
        filename="VasoolAI-DailySummary"
        title="Export daily summary"
        build={() => buildDailySummaryReport(data ?? [])}
      />
    </SafeAreaView>
  );
}

function Row({
  label,
  value,
  positive,
  negative,
  sub,
}: {
  label: string;
  value: number;
  positive?: boolean;
  negative?: boolean;
  sub?: boolean;
}) {
  const color = positive ? EL.primary : negative ? EL.nippu : EL.onSurfaceSec;
  return (
    <View style={[styles.row, sub && styles.subRow]}>
      <Text style={[styles.rowLabel, sub && styles.subLabel]}>{label}</Text>
      <Text style={[styles.rowValue, { color }]}>
        {negative ? '−' : ''}
        {formatRupees(Math.abs(value))}
      </Text>
    </View>
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
  header: { padding: Space.xl, paddingBottom: Space.md },
  title: { ...Type.displaySm },
  sub: { ...Type.bodySm, color: EL.onSurfaceSec, marginTop: 2 },
  card: { marginBottom: Space.md, gap: Space.md },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: { ...Type.titleMd, fontWeight: '700' },
  netBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xs,
    paddingHorizontal: Space.sm,
    paddingVertical: Space.xs,
    borderRadius: Radii.pill,
    backgroundColor: EL.surfaceLow,
  },
  netText: { fontSize: 14, fontWeight: '800' },
  section: {
    gap: Space.xs,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: EL.onSurfaceMuted,
    marginBottom: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  subRow: {
    paddingLeft: Space.md,
  },
  rowLabel: {
    fontSize: 14,
    color: EL.onSurface,
    fontWeight: '500',
  },
  subLabel: {
    fontSize: 12,
    color: EL.onSurfaceMuted,
    fontWeight: '400',
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '700',
  },
});
