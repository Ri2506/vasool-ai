import React, { useState } from 'react';
import {
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';

import { Avatar } from '@/components/common/Avatar';
import { Badge } from '@/components/common/Badge';
import { ELCard } from '@/components/common/ELCard';
import { GradientButton } from '@/components/common/GradientButton';
import { ProgressBar } from '@/components/common/ProgressBar';
import { EL, Common, Radii, Space, Touch, Type } from '@/theme/emeraldLedger';
import type { OwnerStackParamList } from '@/navigation/types';
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
import { generateReportHtml, sharePdf } from '@/utils/pdfExport';

type Tab = 'daily' | 'lines' | 'outstanding';

type Nav = NativeStackNavigationProp<OwnerStackParamList>;

export function ReportsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
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

  const handleSharePdf = async () => {
    let html = '';
    if (tab === 'daily' && daily) {
      html = generateReportHtml('Daily Summary', ['Date', 'Collected', 'Expenses', 'Net'],
        daily.map((r) => [formatDateShort(new Date(r.date)), formatRupees(r.total_collected), formatRupees(r.total_expenses), formatRupees(r.total_collected - r.total_expenses)]));
    } else if (tab === 'lines' && lines) {
      html = generateReportHtml('Line Summary', ['Line', 'Borrowers', 'Due', 'Collected'],
        lines.map((r) => [r.line_name, String(r.borrower_count), formatRupees(r.total_due), formatRupees(r.total_collected)]));
    } else if (tab === 'outstanding' && outstanding) {
      html = generateReportHtml('Outstanding Report', ['Borrower', 'Principal', 'Paid', 'Status'],
        outstanding.map((r) => [r.borrower_name, formatRupees(r.principal), formatRupees(r.total_paid), r.status]));
    }
    if (html) await sharePdf(html, `VasoolAI-${tab}-report`);
  };

  return (
    <SafeAreaView style={Common.screen}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.title}>{t('nav.reports')}</Text>
          <GradientButton
            title={t('common.share_pdf')}
            variant="secondary"
            onPress={handleSharePdf}
            icon={<MaterialCommunityIcons name="file-pdf-box" size={16} color={EL.primary} />}
          />
        </View>
      </View>

      {/* Nippu Report link */}
      <Pressable
        style={styles.nippuLink}
        onPress={() => navigation.navigate('NippuReport')}
      >
        <MaterialCommunityIcons name="alert-circle-outline" size={16} color={EL.nippu} />
        <Text style={styles.nippuLinkText}>{'\u0BA8\u0BBF\u0BAA\u0BCD\u0BAA\u0BC1'} Report</Text>
        <MaterialCommunityIcons name="chevron-right" size={16} color={EL.nippu} />
      </Pressable>

      {/* Tab selector */}
      <View style={styles.tabs}>
        {(['daily', 'lines', 'outstanding'] as Tab[]).map((t) => {
          const active = tab === t;
          return (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              style={[styles.tab, active && styles.tabActive]}
            >
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                {t === 'daily' ? 'Daily' : t === 'lines' ? 'Lines' : 'Outstanding'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {tab === 'daily' && <DailyTab data={daily ?? []} />}
      {tab === 'lines' && <LinesTab data={lines ?? []} />}
      {tab === 'outstanding' && <OutstandingTab data={outstanding ?? []} />}
    </SafeAreaView>
  );
}

function DailyTab({ data }: { data: DailySummaryRow[] }) {
  if (data.length === 0) return <EmptyCard text="No collection data yet. Start collecting to see daily summaries." />;
  return (
    <FlatList
      data={data}
      keyExtractor={(_, i) => String(i)}
      contentContainerStyle={{ padding: Space.xl }}
      renderItem={({ item }) => (
        <ELCard style={styles.reportCard}>
          <Text style={styles.cardDate}>{formatDateShort(new Date(item.date))}</Text>
          <ReportRow label="Collected" value={formatRupees(item.total_collected)} />
          <ReportRow label="Collections" value={String(item.collection_count)} />
          {item.total_expenses > 0 ? (
            <ReportRow label="Expenses" value={`-${formatRupees(item.total_expenses)}`} valueColor={EL.nippu} />
          ) : null}
          <ReportRow label="Net" value={formatRupees(item.total_collected - item.total_expenses)} valueColor={EL.primary} bold />
        </ELCard>
      )}
    />
  );
}

function LinesTab({ data }: { data: LineSummaryRow[] }) {
  if (data.length === 0) return <EmptyCard text="No lines yet. Create lines to see the patti-note view." />;
  return (
    <FlatList
      data={data}
      keyExtractor={(item) => item.line_id}
      contentContainerStyle={{ padding: Space.xl }}
      renderItem={({ item }) => {
        const pct = item.total_due > 0 ? item.total_collected / item.total_due : 0;
        return (
          <ELCard style={styles.reportCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.cardDate}>{item.line_name}</Text>
              <Badge label={item.line_type} variant="info" />
            </View>
            <Text style={[Type.bodySm, { marginTop: Space.xs }]}>{item.borrower_count} borrowers</Text>
            <ReportRow label="Due today" value={formatRupees(item.total_due)} />
            <ReportRow label="Collected" value={formatRupees(item.total_collected)} />
            <View style={{ marginTop: Space.sm }}>
              <ProgressBar progress={pct} />
            </View>
          </ELCard>
        );
      }}
    />
  );
}

function OutstandingTab({ data }: { data: OutstandingRow[] }) {
  if (data.length === 0) return <EmptyCard text="No active loans. Outstanding report will appear once loans are created." />;
  return (
    <FlatList
      data={data}
      keyExtractor={(item) => item.loan_id}
      contentContainerStyle={{ padding: Space.xl }}
      renderItem={({ item }) => {
        const pct = item.total_repayment > 0 ? item.total_paid / item.total_repayment : 0;
        return (
          <ELCard style={styles.reportCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Avatar name={item.borrower_name} size={36} />
              <View style={{ marginLeft: Space.md, flex: 1 }}>
                <Text style={styles.cardDate}>{item.borrower_name}</Text>
                {item.borrower_phone ? <Text style={Type.bodySm}>{item.borrower_phone}</Text> : null}
              </View>
              <Badge label={item.status} variant={item.status === 'overdue' ? 'danger' : 'success'} />
            </View>
            <View style={{ marginTop: Space.md }}>
              <ReportRow label="Principal" value={formatRupees(item.principal)} />
              <ReportRow label="Paid" value={formatRupees(item.total_paid)} />
              <ReportRow label="Outstanding" value={formatRupees(item.outstanding)} valueColor={EL.nippu} bold />
            </View>
            <View style={{ marginTop: Space.sm }}>
              <ProgressBar progress={pct} />
            </View>
          </ELCard>
        );
      }}
    />
  );
}

function ReportRow({ label, value, valueColor, bold }: { label: string; value: string; valueColor?: string; bold?: boolean }) {
  return (
    <View style={styles.cardRow}>
      <Text style={[Type.bodyMd, { color: EL.onSurfaceSec }, bold && { fontWeight: '700' }]}>{label}</Text>
      <Text style={[Type.bodyMd, bold && { fontWeight: '700' }, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  );
}

function EmptyCard({ text }: { text: string }) {
  return (
    <ELCard style={{ margin: Space.xl }}>
      <Text style={Type.bodySm}>{text}</Text>
    </ELCard>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: Space.xl, paddingTop: Space.lg },
  title: { ...Type.displayMd },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: Space.xl,
    marginTop: Space.md,
    marginBottom: Space.sm,
    gap: Space.sm,
  },
  tab: {
    paddingHorizontal: Space.lg,
    paddingVertical: Space.sm,
    borderRadius: Radii.pill,
    minHeight: Touch.min,
    justifyContent: 'center',
    backgroundColor: EL.surfaceHigh,
  },
  tabActive: { backgroundColor: EL.primary },
  tabLabel: { ...Type.labelMd, color: EL.onSurfaceSec, fontWeight: '600' },
  tabLabelActive: { color: EL.white },
  reportCard: { marginBottom: Space.md },
  cardDate: { ...Type.titleMd, marginBottom: Space.xs },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Space.sm },
  nippuLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    marginHorizontal: Space.xl,
    marginTop: Space.md,
    backgroundColor: EL.nippuContainer,
    borderRadius: Radii.md,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.md,
  },
  nippuLinkText: {
    ...Type.labelLg,
    color: EL.nippu,
    flex: 1,
  },
});
