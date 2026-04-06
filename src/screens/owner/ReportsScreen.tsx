import React, { useState } from 'react';
import {
  FlatList,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';

import { Avatar } from '@/components/common/Avatar';
import { Badge } from '@/components/common/Badge';
import { Card } from '@/components/common/Card';
import { ProgressBar } from '@/components/common/ProgressBar';
import { Colors } from '@/constants/colors';
import { Spacing, TouchTarget, Typography } from '@/constants/typography';
import {
  getDailySummaries,
  getLineSummary,
  getOutstandingReport,
  type DailySummaryRow,
  type LineSummaryRow,
  type OutstandingRow,
} from '@/db/repos/reports';
import { useAuthStore } from '@/store/authStore';
import { formatDateShort, formatRupees } from '@/utils/format';

type Tab = 'daily' | 'lines' | 'outstanding';

export function ReportsScreen() {
  const { t } = useTranslation();
  const orgId = useAuthStore((s) => s.user?.orgId ?? null);
  const [tab, setTab] = useState<Tab>('daily');

  const { data: daily } = useQuery({
    queryKey: ['report', 'daily', orgId],
    enabled: !!orgId,
    queryFn: () => getDailySummaries(orgId!),
  });
  const { data: lines } = useQuery({
    queryKey: ['report', 'lines', orgId],
    enabled: !!orgId,
    queryFn: () => getLineSummary(orgId!),
  });
  const { data: outstanding } = useQuery({
    queryKey: ['report', 'outstanding', orgId],
    enabled: !!orgId,
    queryFn: () => getOutstandingReport(orgId!),
  });

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('nav.reports')}</Text>
      </View>

      {/* Tab selector */}
      <View style={styles.tabs}>
        {(['daily', 'lines', 'outstanding'] as Tab[]).map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={[styles.tab, tab === t && styles.tabActive]}
          >
            <Text style={[styles.tabLabel, tab === t && styles.tabLabelActive]}>
              {t === 'daily' ? 'Daily' : t === 'lines' ? 'Lines' : 'Outstanding'}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'daily' && <DailyTab data={daily ?? []} />}
      {tab === 'lines' && <LinesTab data={lines ?? []} />}
      {tab === 'outstanding' && <OutstandingTab data={outstanding ?? []} />}
    </SafeAreaView>
  );
}

function DailyTab({ data }: { data: DailySummaryRow[] }) {
  if (data.length === 0) {
    return <EmptyCard text="No collection data yet. Start collecting to see daily summaries." />;
  }
  return (
    <FlatList
      data={data}
      keyExtractor={(_, i) => String(i)}
      contentContainerStyle={{ padding: Spacing.xl }}
      renderItem={({ item }) => (
        <Card style={styles.reportCard}>
          <Text style={styles.cardDate}>{formatDateShort(new Date(item.date))}</Text>
          <View style={styles.cardRow}>
            <Text style={styles.cardLabel}>Collected</Text>
            <Text style={styles.cardValue}>{formatRupees(item.total_collected)}</Text>
          </View>
          <View style={styles.cardRow}>
            <Text style={styles.cardLabel}>Collections</Text>
            <Text style={styles.cardValue}>{item.collection_count}</Text>
          </View>
          {item.total_expenses > 0 ? (
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>Expenses</Text>
              <Text style={[styles.cardValue, { color: Colors.danger }]}>
                -{formatRupees(item.total_expenses)}
              </Text>
            </View>
          ) : null}
          <View style={styles.cardRow}>
            <Text style={[styles.cardLabel, { fontWeight: '700' }]}>Net</Text>
            <Text style={[styles.cardValue, { fontWeight: '700', color: Colors.primary }]}>
              {formatRupees(item.total_collected - item.total_expenses)}
            </Text>
          </View>
        </Card>
      )}
    />
  );
}

function LinesTab({ data }: { data: LineSummaryRow[] }) {
  if (data.length === 0) {
    return <EmptyCard text="No lines yet. Create lines to see the patti-note view." />;
  }
  return (
    <FlatList
      data={data}
      keyExtractor={(item) => item.line_id}
      contentContainerStyle={{ padding: Spacing.xl }}
      renderItem={({ item }) => {
        const pct = item.total_due > 0 ? item.total_collected / item.total_due : 0;
        return (
          <Card style={styles.reportCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.cardDate}>{item.line_name}</Text>
              <Badge label={item.line_type} variant="info" />
            </View>
            <Text style={styles.cardLabel}>{item.borrower_count} borrowers</Text>
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>Due today</Text>
              <Text style={styles.cardValue}>{formatRupees(item.total_due)}</Text>
            </View>
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>Collected</Text>
              <Text style={styles.cardValue}>{formatRupees(item.total_collected)}</Text>
            </View>
            <ProgressBar progress={pct} />
          </Card>
        );
      }}
    />
  );
}

function OutstandingTab({ data }: { data: OutstandingRow[] }) {
  if (data.length === 0) {
    return <EmptyCard text="No active loans. Outstanding report will appear once loans are created." />;
  }
  return (
    <FlatList
      data={data}
      keyExtractor={(item) => item.loan_id}
      contentContainerStyle={{ padding: Spacing.xl }}
      renderItem={({ item }) => {
        const pct = item.total_repayment > 0 ? item.total_paid / item.total_repayment : 0;
        return (
          <Card style={styles.reportCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Avatar name={item.borrower_name} size={36} />
              <View style={{ marginLeft: Spacing.md, flex: 1 }}>
                <Text style={styles.cardDate}>{item.borrower_name}</Text>
                {item.borrower_phone ? <Text style={styles.cardLabel}>{item.borrower_phone}</Text> : null}
              </View>
              <Badge
                label={item.status}
                variant={item.status === 'overdue' ? 'danger' : 'success'}
              />
            </View>
            <View style={[styles.cardRow, { marginTop: Spacing.md }]}>
              <Text style={styles.cardLabel}>Principal</Text>
              <Text style={styles.cardValue}>{formatRupees(item.principal)}</Text>
            </View>
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>Paid</Text>
              <Text style={styles.cardValue}>{formatRupees(item.total_paid)}</Text>
            </View>
            <View style={styles.cardRow}>
              <Text style={[styles.cardLabel, { fontWeight: '700' }]}>Outstanding</Text>
              <Text style={[styles.cardValue, { fontWeight: '700', color: Colors.danger }]}>
                {formatRupees(item.outstanding)}
              </Text>
            </View>
            <ProgressBar progress={pct} />
          </Card>
        );
      }}
    />
  );
}

function EmptyCard({ text }: { text: string }) {
  return (
    <Card style={{ margin: Spacing.xl }}>
      <Text style={{ ...Typography.body, color: Colors.textSec }}>{text}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg },
  title: { ...Typography.display, color: Colors.text },
  tabs: { flexDirection: 'row', paddingHorizontal: Spacing.xl, marginTop: Spacing.md },
  tab: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    minHeight: TouchTarget.min,
    justifyContent: 'center',
  },
  tabActive: { borderBottomColor: Colors.primary },
  tabLabel: { ...Typography.body, color: Colors.textMuted, fontWeight: '600' },
  tabLabelActive: { color: Colors.primary },
  reportCard: { marginBottom: Spacing.md },
  cardDate: { ...Typography.title, color: Colors.text, marginBottom: 4 },
  cardLabel: { ...Typography.caption, color: Colors.textSec },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  cardValue: { ...Typography.body, color: Colors.text },
});
