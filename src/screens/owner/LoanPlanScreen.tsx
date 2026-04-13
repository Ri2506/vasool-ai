// LoanPlanScreen — dynamic loan timeline.
//
// Shows the original schedule overlaid with what *actually* happened:
//   - Scheduled date, expected amount, principal/interest split
//   - Paid amount + paid date (may differ from scheduled)
//   - Days late (negative = early/advance)
//   - Partial top-ups visible as "₹200 of ₹500"
//   - Running outstanding balance
//
// Updates live whenever a payment is recorded (React Query invalidates
// the 'plan-timeline' key from useRecordCollection's onSuccess).

import React from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Badge, type BadgeVariant } from '@/components/common/Badge';
import { GradientButton } from '@/components/common/GradientButton';
import { EL, Common, Radii, Shadows, Space, Type } from '@/theme/emeraldLedger';
import { useLoanPlanTimeline, useUpdateLoanStatus } from '@/hooks/useLoans';
import { formatDateShort, formatRupees } from '@/utils/format';
import { generatePlanHtml, generatePromissoryNoteHtml, sharePdf } from '@/utils/pdfExport';
import { openDb } from '@/db';
import { useAuthStore } from '@/store/authStore';
import type { PlanTimelineEntry } from '@/db/repos/loans';
import type { OwnerStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<OwnerStackParamList, 'LoanPlan'>;

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  pending: 'neutral',
  paid: 'success',
  partial: 'warn',
  missed: 'danger',
  advance_covered: 'info',
};

export function LoanPlanScreen({ route }: Props) {
  const { t } = useTranslation();
  const { loanId } = route.params;
  const { data: plan, isLoading, error } = useLoanPlanTimeline(loanId);
  const updateStatus = useUpdateLoanStatus();

  // ── Loan summary stats (header card) ──
  const summary = React.useMemo(() => {
    if (!plan || plan.length === 0) return null;
    const totalScheduled = plan.reduce((s, p) => s + p.expected_amount, 0);
    const totalPaid = plan.reduce((s, p) => s + p.paid_amount, 0);
    const paidCount = plan.filter((p) => p.status === 'paid' || p.status === 'advance_covered').length;
    const partialCount = plan.filter((p) => p.status === 'partial').length;
    const missedCount = plan.filter(
      (p) => p.status === 'pending' && p.due_date < Date.now() - 86_400_000,
    ).length;
    const startDate = plan[0].due_date;
    const endDate = plan[plan.length - 1].due_date;
    // Frequency inference for the badge
    const freq =
      plan.length >= 2
        ? plan[1].due_date - plan[0].due_date > 6 * 86_400_000
          ? 'MONTHLY'
          : plan[1].due_date - plan[0].due_date > 2 * 86_400_000
          ? 'WEEKLY'
          : 'DAILY'
        : 'LOAN';
    return {
      totalScheduled,
      totalPaid,
      paidCount,
      partialCount,
      missedCount,
      startDate,
      endDate,
      freq,
      installments: plan.length,
      installmentAmount: plan[0].expected_amount,
      progress: totalScheduled > 0 ? totalPaid / totalScheduled : 0,
    };
  }, [plan]);

  const handleSharePlan = async () => {
    if (!plan || plan.length === 0) return;
    const html = generatePlanHtml(
      'Borrower',
      0,
      plan[0]?.expected_amount ?? 0,
      plan.map((p) => ({
        number: p.installment_number,
        date: p.due_date,
        amount: p.expected_amount,
        status: p.status as any,
        principalPortion: p.principal_portion,
        interestPortion: p.interest_portion,
      })),
    );
    await sharePdf(html, 'VasoolAI-Repayment-Plan');
  };

  const lenderName = useAuthStore((s) => s.user?.name ?? 'Lender');

  const handlePrintPromissoryNote = async () => {
    if (!plan || plan.length === 0) {
      Alert.alert('No loan data', 'Loan terms not loaded yet.');
      return;
    }
    try {
      const db = await openDb();
      // Fetch loan + borrower + guarantor for the note.
      const loanRow = await db.getFirstAsync<{
        id: string;
        principal: number;
        disbursed_amount: number | null;
        emi_amount: number;
        total_repayment: number;
        total_installments: number;
        start_date: number;
        expected_end_date: number | null;
        borrower_id: string;
        line_type: string | null;
      }>(
        `SELECT l.id, l.principal, l.disbursed_amount, l.emi_amount, l.total_repayment,
                l.total_installments, l.start_date, l.expected_end_date,
                l.borrower_id, ln.type AS line_type
         FROM loans l LEFT JOIN lines ln ON ln.id = l.line_id
         WHERE l.id = ?`,
        [loanId],
      );
      if (!loanRow) {
        Alert.alert('Loan not found');
        return;
      }
      const borrower = await db.getFirstAsync<{ name: string; phone: string | null; address: string | null }>(
        `SELECT name, phone, address FROM borrowers WHERE id = ?`,
        [loanRow.borrower_id],
      );
      const guarantor = await db.getFirstAsync<{ name: string; phone: string | null }>(
        `SELECT name, phone FROM guarantors WHERE loan_id = ? LIMIT 1`,
        [loanId],
      );
      const freq: 'daily' | 'weekly' | 'monthly' =
        loanRow.line_type?.startsWith('monthly') ? 'monthly' :
        loanRow.line_type?.startsWith('weekly') ? 'weekly' : 'daily';

      const html = generatePromissoryNoteHtml({
        borrowerName: borrower?.name ?? 'Borrower',
        borrowerPhone: borrower?.phone ?? null,
        borrowerAddress: borrower?.address ?? null,
        principal: loanRow.principal,
        disbursedAmount: loanRow.disbursed_amount ?? loanRow.principal,
        emiAmount: loanRow.emi_amount,
        totalRepayment: loanRow.total_repayment,
        totalInstallments: loanRow.total_installments,
        frequency: freq,
        startDate: loanRow.start_date,
        endDate: loanRow.expected_end_date,
        lenderName,
        loanId: loanRow.id,
        guarantorName: guarantor?.name ?? null,
        guarantorPhone: guarantor?.phone ?? null,
      });
      await sharePdf(html, `Promissory-Note-${borrower?.name ?? 'borrower'}`);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not generate note');
    }
  };

  const handleCloseLoan = () => {
    Alert.alert(t('loan.close_loan'), 'Close this loan? Remaining balance will be waived.', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('loan.close_loan'),
        style: 'destructive',
        onPress: () => {
          updateStatus.mutate({ id: loanId, status: 'closed' });
          Alert.alert('Loan closed!', 'This loan has been marked as complete.');
        },
      },
    ]);
  };

  // ── Each entry as a rich timeline row ──
  const renderItem = ({ item }: { item: PlanTimelineEntry }) => {
    const isPaid = item.status === 'paid' || item.status === 'advance_covered';
    const isPartial = item.status === 'partial';
    const isOverdue = item.status === 'pending' && item.due_date < Date.now() - 86_400_000;
    const status = isOverdue ? 'missed' : item.status;

    // Indicator color for the left rail
    const railColor = isPaid
      ? EL.primary
      : isPartial
      ? EL.warn
      : isOverdue
      ? EL.tertiary
      : EL.outlineVariant;

    return (
      <View style={styles.timelineRow}>
        {/* Left rail: dot + connecting line */}
        <View style={styles.railCol}>
          <View style={[styles.railDot, { backgroundColor: railColor }]}>
            {isPaid ? (
              <MaterialCommunityIcons name="check" size={12} color={EL.white} />
            ) : isPartial ? (
              <MaterialCommunityIcons name="clock" size={10} color={EL.white} />
            ) : isOverdue ? (
              <MaterialCommunityIcons name="exclamation" size={12} color={EL.white} />
            ) : (
              <Text style={styles.railDotNum}>{item.installment_number}</Text>
            )}
          </View>
          <View style={[styles.railLine, { backgroundColor: EL.surfaceMid }]} />
        </View>

        {/* Right card */}
        <View style={[styles.entryCard, isOverdue && styles.entryCardOverdue]}>
          <View style={styles.entryHeader}>
            <View style={{ flex: 1 }}>
              {/* Title row: Day number + scheduled date — always shown so the
                  owner can read the calendar directly off every entry. */}
              <Text style={styles.entryNumber}>
                Day {item.installment_number}
                <Text style={styles.entryNumberDate}>
                  {' · '}
                  {formatDateShort(new Date(item.due_date))}
                </Text>
              </Text>
              {/* Status sub-line tells the story of what actually happened */}
              {isPaid && item.last_paid_at ? (
                <Text style={styles.entryPaidLine}>
                  Paid {formatDateShort(new Date(item.last_paid_at))}
                  {item.days_late != null && item.days_late > 0
                    ? ` · ${item.days_late}d late`
                    : item.days_late != null && item.days_late < 0
                    ? ` · ${Math.abs(item.days_late)}d early`
                    : ' · on time'}
                </Text>
              ) : isPartial ? (
                <Text style={styles.entryPartialLine}>
                  Partial · {formatRupees(item.paid_amount)} of {formatRupees(item.expected_amount)}
                </Text>
              ) : isOverdue ? (
                <Text style={styles.entryOverdueLine}>
                  Overdue by {Math.floor((Date.now() - item.due_date) / 86_400_000)}d
                </Text>
              ) : (
                <Text style={styles.entryDueLine}>
                  Due {formatRupees(item.expected_amount)}
                </Text>
              )}
            </View>
            <View style={styles.entryAmountCol}>
              <Text
                style={[
                  styles.entryAmount,
                  isPaid && { color: EL.primary },
                  isOverdue && { color: EL.tertiary },
                ]}
              >
                {isPaid
                  ? formatRupees(item.paid_amount)
                  : isPartial
                  ? formatRupees(item.paid_amount)
                  : formatRupees(item.expected_amount)}
              </Text>
              <Badge
                label={t(`loan.status_${status === 'advance_covered' ? 'advance' : status}`)}
                variant={STATUS_VARIANT[status] ?? 'neutral'}
              />
            </View>
          </View>

          {/* Sub-row: principal/interest split + outstanding */}
          <View style={styles.entryFooter}>
            <Text style={styles.splitText}>
              P {formatRupees(item.principal_portion)} · I {formatRupees(item.interest_portion)}
            </Text>
            <Text style={styles.outstandingText}>
              Bal {formatRupees(item.outstanding_after)}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={Common.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Repayment Timeline</Text>
        <Text style={styles.subtitle}>{'\u0BA4\u0BBF\u0B9F\u0BCD\u0B9F\u0BAE\u0BCD'} (THITTAM)</Text>
      </View>

      {/* Summary card with progress + counts */}
      {summary ? (
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryTitle}>{formatRupees(summary.totalScheduled)}</Text>
              <View style={styles.summaryMeta}>
                <View style={styles.loanTypeBadge}>
                  <Text style={styles.loanTypeText}>{summary.freq} LOAN</Text>
                </View>
                <Text style={styles.summaryMetaText}>
                  {formatRupees(summary.installmentAmount)} {'\u2022'} {summary.installments} installments
                </Text>
              </View>
            </View>
            <View style={styles.walletIcon}>
              <MaterialCommunityIcons name="wallet" size={24} color={EL.white} />
            </View>
          </View>

          {/* Live progress bar */}
          <View style={styles.progressTrack}>
            <View
              style={[styles.progressFill, { width: `${Math.min(100, summary.progress * 100)}%` }]}
            />
          </View>
          <View style={styles.progressLegend}>
            <Text style={styles.progressLegendText}>
              {formatRupees(summary.totalPaid)} paid
            </Text>
            <Text style={[styles.progressLegendText, { color: EL.onSurfaceMuted }]}>
              of {formatRupees(summary.totalScheduled)}
            </Text>
          </View>

          {/* Stat pills */}
          <View style={styles.statsRow}>
            <StatPill icon="check-circle" label="Paid" value={summary.paidCount} color={EL.primary} />
            <StatPill icon="clock-outline" label="Partial" value={summary.partialCount} color={EL.warn} />
            <StatPill icon="alert-circle" label="Overdue" value={summary.missedCount} color={EL.tertiary} />
          </View>

          <View style={styles.summaryDates}>
            <View>
              <Text style={styles.summaryDateLabel}>START</Text>
              <Text style={styles.summaryDateValue}>{formatDateShort(new Date(summary.startDate))}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.summaryDateLabel}>END</Text>
              <Text style={[styles.summaryDateValue, { color: EL.tertiary }]}>
                {formatDateShort(new Date(summary.endDate))}
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      {/* Timeline list */}
      {isLoading ? (
        <View style={styles.loadingWrap}>
          <Text style={Type.bodySm}>{t('common.loading')}</Text>
        </View>
      ) : error ? (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="alert-circle-outline" size={36} color={EL.tertiary} />
          <Text style={styles.emptyTitle}>Couldn’t load plan</Text>
          <Text style={styles.emptySub}>
            {(error as Error)?.message ?? 'Database query failed.'}
          </Text>
        </View>
      ) : !plan || plan.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="calendar-blank-outline" size={36} color={EL.outline} />
          <Text style={styles.emptyTitle}>No installments yet</Text>
          <Text style={styles.emptySub}>
            This loan has no scheduled installments. If this is unexpected,
            try recreating the loan.
          </Text>
        </View>
      ) : (
        <FlatList
          data={plan}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Bottom action bar */}
      <View style={styles.bottomBar}>
        <GradientButton
          title="Share as PDF"
          onPress={handleSharePlan}
          icon={<MaterialCommunityIcons name="file-pdf-box" size={18} color={EL.white} />}
        />
        <View style={styles.bottomRow}>
          <Pressable style={styles.excelBtn} onPress={handlePrintPromissoryNote}>
            <MaterialCommunityIcons name="file-sign" size={18} color={EL.primary} />
            <Text style={styles.excelBtnText}>Promissory Note</Text>
          </Pressable>
          <Pressable
            style={[styles.excelBtn, { borderColor: 'rgba(155, 62, 59, 0.3)' }]}
            onPress={handleCloseLoan}
          >
            <MaterialCommunityIcons name="close-circle-outline" size={18} color={EL.tertiary} />
            <Text style={[styles.excelBtnText, { color: EL.tertiary }]}>Close Loan</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

function StatPill({
  icon,
  label,
  value,
  color,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <View style={styles.statPill}>
      <MaterialCommunityIcons name={icon} size={14} color={color} />
      <Text style={[styles.statPillValue, { color }]}>{value}</Text>
      <Text style={styles.statPillLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: Space.xl,
    paddingTop: Space.lg,
    paddingBottom: Space.sm,
  },
  title: { ...Type.displaySm, fontWeight: '800' },
  subtitle: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(0,105,72,0.7)',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: Space.xs,
  },

  // Summary card
  summaryCard: {
    marginHorizontal: Space.lg,
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.lg,
    padding: Space.lg,
    marginBottom: Space.md,
    gap: Space.md,
    ...Shadows.card,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  summaryTitle: {
    ...Type.displaySm,
    fontWeight: '700',
  },
  summaryMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    marginTop: Space.xs,
  },
  loanTypeBadge: {
    backgroundColor: 'rgba(0,133,93,0.1)',
    paddingHorizontal: Space.sm,
    paddingVertical: 2,
    borderRadius: Radii.sm,
  },
  loanTypeText: {
    fontSize: 10,
    fontWeight: '700',
    color: EL.primary,
    letterSpacing: 0.5,
  },
  summaryMetaText: {
    fontSize: 12,
    fontWeight: '500',
    color: EL.onSurfaceSec,
  },
  walletIcon: {
    backgroundColor: EL.primaryContainer,
    padding: Space.sm,
    borderRadius: Radii.md,
  },

  progressTrack: {
    height: 8,
    backgroundColor: EL.surfaceLow,
    borderRadius: Radii.pill,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: EL.primary,
    borderRadius: Radii.pill,
  },
  progressLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressLegendText: {
    fontSize: 12,
    fontWeight: '700',
    color: EL.onSurface,
  },

  statsRow: {
    flexDirection: 'row',
    gap: Space.sm,
  },
  statPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.xs,
    paddingVertical: Space.sm,
    paddingHorizontal: Space.sm,
    borderRadius: Radii.md,
    backgroundColor: EL.surfaceLow,
  },
  statPillValue: { fontSize: 14, fontWeight: '800' },
  statPillLabel: { fontSize: 11, fontWeight: '600', color: EL.onSurfaceMuted },

  summaryDates: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: Space.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(188,202,192,0.2)',
  },
  summaryDateLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: EL.outline,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  summaryDateValue: {
    fontSize: 13,
    fontWeight: '600',
    color: EL.onSurface,
    marginTop: 2,
  },

  // Timeline
  listContent: {
    paddingHorizontal: Space.lg,
    paddingTop: Space.md,
    paddingBottom: 160,
  },
  timelineRow: {
    flexDirection: 'row',
    minHeight: 80,
  },
  railCol: {
    width: 32,
    alignItems: 'center',
  },
  railDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Space.sm,
    zIndex: 1,
  },
  railDotNum: {
    fontSize: 10,
    fontWeight: '800',
    color: EL.onSurface,
  },
  railLine: {
    width: 2,
    flex: 1,
    marginTop: -2,
  },
  entryCard: {
    flex: 1,
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.lg,
    padding: Space.md,
    marginLeft: Space.sm,
    marginBottom: Space.sm,
    gap: Space.xs,
    ...Shadows.card,
  },
  entryCardOverdue: {
    backgroundColor: 'rgba(155, 62, 59, 0.06)',
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Space.md,
  },
  entryNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: EL.onSurface,
  },
  entryNumberDate: {
    fontSize: 12,
    fontWeight: '600',
    color: EL.onSurfaceMuted,
  },
  entryPaidLine: {
    fontSize: 11,
    fontWeight: '600',
    color: EL.primary,
    marginTop: 2,
  },
  entryPartialLine: {
    fontSize: 11,
    fontWeight: '600',
    color: EL.warn,
    marginTop: 2,
  },
  entryOverdueLine: {
    fontSize: 11,
    fontWeight: '600',
    color: EL.tertiary,
    marginTop: 2,
  },
  entryDueLine: {
    fontSize: 11,
    fontWeight: '500',
    color: EL.onSurfaceMuted,
    marginTop: 2,
  },
  entryAmountCol: {
    alignItems: 'flex-end',
    gap: Space.xs,
  },
  entryAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: EL.onSurface,
  },
  entryFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Space.xs,
    borderTopWidth: 1,
    borderTopColor: EL.surfaceLow,
  },
  splitText: {
    fontSize: 10,
    fontWeight: '600',
    color: EL.onSurfaceMuted,
  },
  outstandingText: {
    fontSize: 11,
    fontWeight: '700',
    color: EL.onSurfaceSec,
  },

  loadingWrap: { padding: Space.xl, alignItems: 'center' },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Space.xxl,
    paddingBottom: 120,
    gap: Space.sm,
  },
  emptyTitle: {
    ...Type.titleMd,
    fontWeight: '700',
    color: EL.onSurface,
    marginTop: Space.md,
  },
  emptySub: {
    ...Type.bodySm,
    color: EL.onSurfaceMuted,
    textAlign: 'center',
  },

  // Bottom
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Space.xl,
    paddingTop: Space.lg,
    paddingBottom: Space.xxxl,
    backgroundColor: 'rgba(240, 253, 244, 0.95)',
    gap: Space.md,
  },
  bottomRow: { flexDirection: 'row', gap: Space.sm },
  excelBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.sm,
    backgroundColor: EL.surfaceCard,
    borderWidth: 2,
    borderColor: 'rgba(0,105,72,0.2)',
    paddingVertical: Space.lg,
    borderRadius: Radii.md,
  },
  excelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: EL.primary,
  },
});
