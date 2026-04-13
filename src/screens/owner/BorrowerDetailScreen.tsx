import React from 'react';
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';

import { Avatar } from '@/components/common/Avatar';
import { GradientButton } from '@/components/common/GradientButton';
import { StarRating } from '@/components/common/StarRating';
import { EL, Common, Glass, Radii, Shadows, Space, Type } from '@/theme/emeraldLedger';
import { openDb } from '@/db';
import { useBorrower } from '@/hooks/useBorrowers';
import { useBorrowerStatuses } from '@/hooks/useBorrowerStatus';
import { useLoansForBorrower, useUpdateLoanStatus } from '@/hooks/useLoans';
import { useBorrowerSummary, type LoanSummary } from '@/hooks/useBorrowerSummary';
import { generateBorrowerTip, type TipVariant } from '@/utils/aiTips';
import { formatRupees } from '@/utils/format';
import type { CollectionRow, PlanEntryRow } from '@/db/types';
import type { OwnerStackParamList } from '@/navigation/types';
import { openWhatsApp } from '@/utils/whatsapp';

const TIP_BG: Record<TipVariant, string> = {
  danger: EL.nippuContainer,
  warn: EL.warnContainer,
  success: EL.primaryFixed,
  info: EL.infoContainer,
};

const TIP_FG: Record<TipVariant, string> = {
  danger: EL.nippu,
  warn: EL.warn,
  success: EL.primary,
  info: EL.info,
};

type Props = NativeStackScreenProps<OwnerStackParamList, 'BorrowerDetail'>;

export function BorrowerDetailScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const { id } = route.params;
  const { data: borrower } = useBorrower(id);
  const { data: loans } = useLoansForBorrower(id);
  const { data: summary } = useBorrowerSummary(id);
  const updateLoanStatus = useUpdateLoanStatus();
  const { data: statuses } = useBorrowerStatuses();

  const st = statuses?.[id];
  const borrowerStatus = st?.is_nippu ? 'nippu' as const : st?.rating ? 'nadapu' as const : 'none' as const;

  // Fetch plan entries + collections for AI tip
  const { data: tipData } = useQuery({
    queryKey: ['borrower-tip-data', id],
    enabled: !!loans && loans.length > 0,
    queryFn: async () => {
      const db = await openDb();
      const loanIds = (loans ?? []).map((l) => l.id);
      if (loanIds.length === 0) return { planEntries: [] as PlanEntryRow[], collections: [] as CollectionRow[] };
      const placeholders = loanIds.map(() => '?').join(',');
      const planEntries = await db.getAllAsync<PlanEntryRow>(
        `SELECT * FROM plan_entries WHERE loan_id IN (${placeholders})`, loanIds
      );
      const collections = await db.getAllAsync<CollectionRow>(
        `SELECT * FROM collections WHERE loan_id IN (${placeholders})`, loanIds
      );
      return { planEntries, collections };
    },
  });

  const tip = loans && tipData
    ? generateBorrowerTip({ loans, planEntries: tipData.planEntries, collections: tipData.collections })
    : null;

  // Recent payments — enriched with installment number, line name, agent,
  // and method so the timeline shows full context per row.
  // Joins collections → plan_entries → loans → lines → users.
  const { data: recentPayments } = useQuery({
    queryKey: ['recent-payments', id],
    enabled: !!loans && loans.length > 0,
    queryFn: async () => {
      const db = await openDb();
      const loanIds = (loans ?? []).map((l) => l.id);
      if (loanIds.length === 0) return [];
      const placeholders = loanIds.map(() => '?').join(',');
      return db.getAllAsync<{
        id: string;
        amount: number;
        expected_amount: number;
        collected_at: number;
        payment_method: string;
        is_advance: number;
        installment_number: number | null;
        plan_entry_status: string | null;
        line_name: string | null;
        agent_name: string | null;
      }>(
        `SELECT
           c.id,
           c.amount,
           c.expected_amount,
           c.collected_at,
           c.payment_method,
           c.is_advance,
           pe.installment_number,
           pe.status AS plan_entry_status,
           ln.name AS line_name,
           u.name AS agent_name
         FROM collections c
         LEFT JOIN plan_entries pe ON pe.id = c.plan_entry_id
         LEFT JOIN loans l ON l.id = c.loan_id
         LEFT JOIN lines ln ON ln.id = l.line_id
         LEFT JOIN users u ON u.id = c.agent_id
         WHERE c.loan_id IN (${placeholders})
         ORDER BY c.collected_at DESC
         LIMIT 8`,
        loanIds,
      );
    },
  });

  if (!borrower) {
    return (
      <SafeAreaView style={Common.screen}>
        <View style={styles.loadingWrap}>
          <Text style={Type.titleMd}>{t('common.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Primary CTA decider ──
  // Owner taps "Record Payment" 90% of the time, but only if there's an
  // active loan with a pending installment. The button morphs based on
  // state so we never show a useless action:
  //   - Has next due → "Record ₹X" with the amount badge
  //   - Active loan but nothing pending → "Loan up to date" (disabled)
  //   - No active loan → "Start First Loan" (jumps to NewLoan)
  const nextDueLoan = summary?.activeLoans.find((l) => l.next_plan_entry_id);
  const hasActiveLoan = (summary?.activeLoans.length ?? 0) > 0;
  const primaryAction: {
    label: string;
    icon: string;
    amount?: number;
    disabled?: boolean;
    onPress?: () => void;
  } = nextDueLoan
    ? {
        label: 'Record Payment',
        icon: 'cash-check',
        amount: nextDueLoan.next_due_amount ?? undefined,
        onPress: () => {
          navigation.navigate('Collect', {
            item: {
              plan_entry_id: nextDueLoan.next_plan_entry_id!,
              loan_id: nextDueLoan.loan.id,
              borrower_id: borrower.id,
              borrower_name: borrower.name,
              borrower_phone: borrower.phone ?? null,
              line_name: nextDueLoan.line_name,
              line_type: nextDueLoan.line_type,
              expected_amount: nextDueLoan.next_due_amount ?? nextDueLoan.loan.emi_amount,
              installment_number: nextDueLoan.paid_installments + 1,
              due_date: nextDueLoan.next_due_date ?? Date.now(),
              loan_principal: nextDueLoan.loan.principal,
              loan_emi: nextDueLoan.loan.emi_amount,
              loan_status: nextDueLoan.loan.status,
            },
          });
        },
      }
    : hasActiveLoan
    ? {
        label: 'Loan up to date',
        icon: 'check-circle',
        disabled: true,
      }
    : {
        label: 'Start First Loan',
        icon: 'cash-plus',
        onPress: () => navigation.navigate('NewLoan', { borrowerId: borrower.id }),
      };

  return (
    <SafeAreaView style={Common.screen}>
      {/* ── Sticky Header ── */}
      <View style={[Glass.container, styles.header]}>
        <View style={styles.headerLeft}>
          <Pressable
            style={styles.headerBtn}
            onPress={() => navigation.goBack()}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color={EL.onSurface} />
          </Pressable>
          <Text style={styles.headerTitle}>Borrower Profile</Text>
        </View>
        <Pressable
          style={styles.headerBtn}
          onPress={() => navigation.navigate('BorrowerEdit', { id: borrower.id })}
        >
          <MaterialCommunityIcons name="pencil" size={22} color={EL.onSurface} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* ── Profile Header Card ── */}
        <View style={styles.profileCard}>
          <View style={styles.profileTop}>
            <View style={styles.profileLeft}>
              <View style={styles.avatarWrap}>
                <Avatar name={borrower.name} size={72} photoUri={borrower.photo_url} />
                {borrowerStatus === 'nadapu' ? (
                  <View style={styles.verifiedBadge}>
                    <MaterialCommunityIcons name="check-decagram" size={14} color={EL.white} />
                  </View>
                ) : null}
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{borrower.name}</Text>
                {borrower.phone ? (
                  <Pressable onPress={() => Linking.openURL(`tel:${borrower.phone}`)}>
                    <Text style={styles.profilePhone}>{borrower.phone}</Text>
                  </Pressable>
                ) : null}
                {st?.rating ? (
                  <Pressable
                    style={{ marginTop: 4 }}
                    onPress={() => navigation.navigate('BorrowerRating', { id })}
                  >
                    <StarRating rating={st.rating} size={18} />
                  </Pressable>
                ) : null}
              </View>
            </View>
            {/* Call / SMS / WhatsApp actions */}
            <View style={styles.profileActions}>
              {borrower.phone ? (
                <>
                  <Pressable
                    style={styles.actionCircle}
                    onPress={() => Linking.openURL(`tel:${borrower.phone}`)}
                  >
                    <MaterialCommunityIcons name="phone" size={20} color={EL.primary} />
                  </Pressable>
                  <Pressable
                    style={styles.actionCircle}
                    onPress={() => Linking.openURL(`sms:${borrower.phone}`)}
                  >
                    <MaterialCommunityIcons name="message-text-outline" size={20} color={EL.primary} />
                  </Pressable>
                  <Pressable
                    style={styles.actionCircle}
                    onPress={() =>
                      openWhatsApp({
                        phone: borrower.phone!,
                        body: `Vanakkam ${borrower.name}, ${nextDueLoan ? `your next installment of ${formatRupees(nextDueLoan.next_due_amount ?? 0)} is due.` : 'just checking in.'}`,
                      })
                    }
                  >
                    <MaterialCommunityIcons name="whatsapp" size={20} color="#25D366" />
                  </Pressable>
                </>
              ) : null}
            </View>
          </View>

          {/* Meta info: address + notes + joined date */}
          {(borrower.address || borrower.notes || borrower.created_at) ? (
            <View style={styles.metaSection}>
              {borrower.address ? (
                <View style={styles.metaRow}>
                  <MaterialCommunityIcons name="map-marker-outline" size={16} color={EL.onSurfaceMuted} />
                  <Text style={styles.metaText} numberOfLines={2}>{borrower.address}</Text>
                </View>
              ) : null}
              {borrower.notes ? (
                <View style={styles.metaRow}>
                  <MaterialCommunityIcons name="note-text-outline" size={16} color={EL.onSurfaceMuted} />
                  <Text style={styles.metaText}>{borrower.notes}</Text>
                </View>
              ) : null}
              {borrower.created_at ? (
                <View style={styles.metaRow}>
                  <MaterialCommunityIcons name="calendar-outline" size={16} color={EL.onSurfaceMuted} />
                  <Text style={styles.metaText}>
                    Joined {new Date(borrower.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Status pill */}
          {borrowerStatus !== 'none' ? (
            <View style={styles.statusRow}>
              <View style={[styles.statusPill, {
                backgroundColor: borrowerStatus === 'nadapu'
                  ? 'rgba(133, 248, 196, 0.3)'
                  : 'rgba(220, 38, 38, 0.12)',
              }]}>
                <View style={[styles.pulseDot, {
                  backgroundColor: borrowerStatus === 'nadapu' ? EL.primary : EL.nippu,
                }]} />
                <Text style={[styles.statusPillText, {
                  color: borrowerStatus === 'nadapu' ? EL.onPrimaryFixed : EL.nippu,
                }]}>
                  {borrowerStatus === 'nadapu' ? '\u0BA8\u0B9F\u0BAA\u0BCD\u0BAA\u0BC1 / On Schedule' : '\u0BA8\u0BBF\u0BAA\u0BCD\u0BAA\u0BC1 / Overdue'}
                </Text>
              </View>
            </View>
          ) : null}
        </View>

        {/* ── AI Contextual Tip ── */}
        {tip ? (
          <View style={[styles.tipCard, { backgroundColor: TIP_BG[tip.variant] + '1A' }]}>
            <MaterialCommunityIcons
              name="head-lightbulb-outline"
              size={20}
              color={TIP_FG[tip.variant]}
            />
            <Text style={[styles.tipText, { color: TIP_FG[tip.variant] }]}>
              {tip.text}
            </Text>
          </View>
        ) : null}

        {/* ── Lifetime Stats Card ── */}
        {summary && summary.lifetime.totalLoansTaken > 0 ? (
          <View style={styles.lifetimeCard}>
            <Text style={styles.lifetimeLabel}>LIFETIME WITH YOU</Text>
            <View style={styles.lifetimeRow}>
              <View style={styles.lifetimeStat}>
                <Text style={styles.lifetimeValue}>{summary.lifetime.totalLoansTaken}</Text>
                <Text style={styles.lifetimeStatLabel}>Loans taken</Text>
              </View>
              <View style={styles.lifetimeStat}>
                <Text style={styles.lifetimeValue}>{formatRupees(summary.lifetime.totalLent)}</Text>
                <Text style={styles.lifetimeStatLabel}>Total lent</Text>
              </View>
              <View style={styles.lifetimeStat}>
                <Text style={[styles.lifetimeValue, { color: EL.primary }]}>
                  {formatRupees(summary.lifetime.totalInterestEarned)}
                </Text>
                <Text style={styles.lifetimeStatLabel}>Interest earned</Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* ── Active Loans Section ── */}
        {summary && summary.activeLoans.length > 0 ? (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                Active Loans ({summary.activeLoans.length})
              </Text>
              <Text style={styles.sectionTotal}>
                Outstanding: {formatRupees(summary.lifetime.totalOutstanding)}
              </Text>
            </View>
            {summary.activeLoans.map((ls) => (
              <LoanDetailCard
                key={ls.loan.id}
                summary={ls}
                onView={() => navigation.navigate('LoanPlan', { loanId: ls.loan.id })}
                onClose={() => {
                  Alert.alert(
                    'Close loan?',
                    `${formatRupees(ls.balance)} balance will be waived. This cannot be undone.`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Close Loan',
                        style: 'destructive',
                        onPress: () => updateLoanStatus.mutate({ id: ls.loan.id, status: 'closed' }),
                      },
                    ],
                  );
                }}
                onTopUp={
                  ls.loan.repayment_type === 'interest_only'
                    ? () => navigation.navigate('TopUp', { loanId: ls.loan.id })
                    : undefined
                }
              />
            ))}
          </>
        ) : null}

        {/* ── Past / Closed Loans Section ── */}
        {summary && summary.closedLoans.length > 0 ? (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                Past Loans ({summary.closedLoans.length})
              </Text>
            </View>
            {summary.closedLoans.map((ls) => (
              <LoanDetailCard
                key={ls.loan.id}
                summary={ls}
                onView={() => navigation.navigate('LoanPlan', { loanId: ls.loan.id })}
                isPast
              />
            ))}
            {/* Renew prompt at bottom of closed-loans section.
                Pass renewedFromId so the new loan is tagged as a renewal. */}
            <Pressable
              style={styles.renewBtn}
              onPress={() =>
                navigation.navigate('NewLoan', {
                  borrowerId: borrower!.id,
                  renewedFromId: summary.closedLoans[0]?.loan.id,
                })
              }
            >
              <MaterialCommunityIcons name="refresh" size={18} color={EL.primary} />
              <Text style={styles.renewBtnText}>Renew loan with {borrower?.name}</Text>
            </Pressable>
          </>
        ) : null}

        {summary && summary.activeLoans.length === 0 && summary.closedLoans.length === 0 ? (
          <View style={styles.emptyLoanCard}>
            <MaterialCommunityIcons name="cash-plus" size={32} color={EL.outline} />
            <Text style={[Type.titleMd, { marginTop: Space.sm }]}>No loans yet</Text>
            <Text style={[Type.bodySm, { marginTop: Space.xs, color: EL.onSurfaceMuted }]}>
              Tap "New Loan" below to create the first loan for {borrower?.name}.
            </Text>
          </View>
        ) : null}

        {/* ── Recent Payments Timeline ──
            Enriched per row: installment, line, method, agent, partial badge */}
        {recentPayments && recentPayments.length > 0 ? (
          <View style={styles.paymentsSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Payments</Text>
              <Text style={styles.sectionSub}>{recentPayments.length} latest</Text>
            </View>
            <View style={styles.timeline}>
              <View style={styles.timelineConnector} />
              {recentPayments.map((p, index) => {
                const date = new Date(p.collected_at);
                const dateStr = date.toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                });
                const timeStr = date.toLocaleTimeString('en-IN', {
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true,
                });
                const isPartial = p.amount < p.expected_amount;
                const isAdvance = p.is_advance === 1;
                const isAccount = p.payment_method === 'account';

                return (
                  <View key={p.id} style={styles.timelineItem}>
                    <View
                      style={[
                        styles.timelineDot,
                        {
                          backgroundColor: isPartial ? EL.warn : EL.primary,
                        },
                        index === 0 && (isPartial ? styles.timelineDotGlowError : styles.timelineDotGlow),
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={isAccount ? 'bank' : 'cash'}
                        size={12}
                        color={EL.white}
                      />
                    </View>
                    <View style={styles.timelineContent}>
                      <View style={styles.timelineRow}>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              styles.timelineAmount,
                              isPartial && { color: EL.warn },
                            ]}
                          >
                            {formatRupees(p.amount)}
                            {isPartial ? (
                              <Text style={styles.timelineExpected}>
                                {' '}/ {formatRupees(p.expected_amount)}
                              </Text>
                            ) : null}
                          </Text>
                          <Text style={styles.timelineMeta}>
                            {p.installment_number != null
                              ? `Day ${p.installment_number}`
                              : 'Payment'}
                            {p.line_name ? ` · ${p.line_name}` : ''}
                            {p.agent_name ? ` · ${p.agent_name}` : ''}
                          </Text>
                        </View>
                        <View style={styles.timelineDateCol}>
                          <Text style={styles.timelineDate}>{dateStr}</Text>
                          <Text style={styles.timelineTime}>{timeStr}</Text>
                        </View>
                      </View>
                      {/* Status chips row */}
                      <View style={styles.tagRow}>
                        {isAccount ? (
                          <View style={[styles.tag, { backgroundColor: 'rgba(37,99,235,0.1)' }]}>
                            <Text style={[styles.tagText, { color: EL.info }]}>Account</Text>
                          </View>
                        ) : (
                          <View style={[styles.tag, { backgroundColor: 'rgba(0,105,72,0.1)' }]}>
                            <Text style={[styles.tagText, { color: EL.primary }]}>Cash</Text>
                          </View>
                        )}
                        {isPartial ? (
                          <View style={[styles.tag, { backgroundColor: 'rgba(217,119,6,0.12)' }]}>
                            <Text style={[styles.tagText, { color: EL.warn }]}>Partial</Text>
                          </View>
                        ) : null}
                        {isAdvance ? (
                          <View style={[styles.tag, { backgroundColor: 'rgba(13,148,136,0.12)' }]}>
                            <Text style={[styles.tagText, { color: EL.completed }]}>Advance</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* Spacer so the last card never hides behind the sticky action bar */}
        <View style={{ height: 160 }} />
      </ScrollView>

      {/* ── Bottom Fixed Actions ──
          Layout principle:
          - Primary CTA (Record Payment / Start First Loan) takes full width
            because it's what owner taps 90% of the time.
          - Secondary actions (New Loan / Docs) live in a compact icon row
            beneath, taking equal width but visually subordinate.
          - Bar floats above content with a soft top edge so it doesn't
            compete with the cards. */}
      <View style={styles.bottomActions} pointerEvents="box-none">
        <View style={styles.bottomBar}>
          {primaryAction.disabled ? (
            <View style={[styles.primaryBtn, styles.primaryBtnDisabled]}>
              <MaterialCommunityIcons name={primaryAction.icon as any} size={20} color={EL.onSurfaceMuted} />
              <Text style={[styles.primaryLabel, { color: EL.onSurfaceMuted }]}>
                {primaryAction.label}
              </Text>
            </View>
          ) : (
            <Pressable
              style={({ pressed }) => [
                styles.primaryBtn,
                pressed && { opacity: 0.92, transform: [{ scale: 0.98 }] },
              ]}
              onPress={primaryAction.onPress}
            >
              <View style={styles.primaryLeft}>
                <MaterialCommunityIcons name={primaryAction.icon as any} size={20} color={EL.white} />
                <Text style={styles.primaryLabel}>{primaryAction.label}</Text>
              </View>
              {primaryAction.amount != null ? (
                <View style={styles.primaryAmountBadge}>
                  <Text style={styles.primaryAmountText}>{formatRupees(primaryAction.amount)}</Text>
                </View>
              ) : null}
            </Pressable>
          )}

          {/* Secondary action row */}
          <View style={styles.secondaryRow}>
            <Pressable
              style={({ pressed }) => [
                styles.secondaryBtn,
                pressed && { opacity: 0.85 },
              ]}
              onPress={() => navigation.navigate('NewLoan', { borrowerId: borrower.id })}
            >
              <MaterialCommunityIcons name="cash-plus" size={18} color={EL.primary} />
              <Text style={styles.secondaryLabel}>New Loan</Text>
            </Pressable>
            <View style={styles.secondaryDivider} />
            <Pressable
              style={({ pressed }) => [
                styles.secondaryBtn,
                pressed && { opacity: 0.85 },
              ]}
              onPress={() => navigation.navigate('Documents', { borrowerId: borrower.id })}
            >
              <MaterialCommunityIcons name="file-document-outline" size={18} color={EL.primary} />
              <Text style={styles.secondaryLabel}>Documents</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

// ─── LoanDetailCard — rich per-loan card for active / past lists ──────

interface LoanDetailCardProps {
  summary: LoanSummary;
  onView: () => void;
  onClose?: () => void;
  onTopUp?: () => void;
  isPast?: boolean;
}

function LoanDetailCard({ summary, onView, onClose, onTopUp, isPast }: LoanDetailCardProps) {
  const { loan, total_paid, balance, paid_installments, total_installments, next_due_date, last_payment_date, kind, line_name, line_type } = summary;
  const isInterestOnly = loan.repayment_type === 'interest_only';
  const progress = total_installments > 0 ? Math.min(1, paid_installments / total_installments) : 0;
  const startDate = new Date(loan.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const endDate = loan.expected_end_date
    ? new Date(loan.expected_end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : null;

  const kindLabel: Record<LoanSummary['kind'], { label: string; color: string }> = {
    original: { label: 'NEW LOAN', color: EL.primary },
    topup: { label: 'TOP-UP', color: EL.warn },
    renew: { label: 'RENEWAL', color: EL.info },
  };
  const kindInfo = kindLabel[kind];

  return (
    <View style={[styles.detailLoanCard, isPast && styles.detailLoanCardPast]}>
      {/* Header: kind badge + line name + status */}
      <View style={styles.detailLoanHeader}>
        <View style={styles.detailLoanBadgeRow}>
          <View style={[styles.kindBadge, { backgroundColor: kindInfo.color + '1A' }]}>
            <Text style={[styles.kindBadgeText, { color: kindInfo.color }]}>{kindInfo.label}</Text>
          </View>
          {line_name ? (
            <Text style={styles.detailLoanLineText}>{line_name}</Text>
          ) : null}
        </View>
        {isPast ? (
          <View style={styles.closedPill}>
            <Text style={styles.closedPillText}>CLOSED</Text>
          </View>
        ) : null}
      </View>

      {/* Big amount + repayment type */}
      <View style={styles.detailLoanAmountRow}>
        <View>
          <Text style={styles.detailLoanLabel}>DISBURSED</Text>
          <Text style={styles.detailLoanAmount}>
            {formatRupees(loan.disbursed_amount ?? loan.principal)}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.detailLoanLabel}>{isInterestOnly ? 'INTEREST/INSTALLMENT' : 'INSTALLMENT'}</Text>
          <Text style={styles.detailLoanInstallment}>
            {formatRupees(loan.emi_amount)}
            <Text style={styles.detailLoanFreq}>
              {' / '}
              {line_type === 'daily' || line_type === 'daily_interest' ? 'day'
               : line_type === 'weekly' || line_type === 'weekly_interest' ? 'wk'
               : 'mo'}
            </Text>
          </Text>
        </View>
      </View>

      {/* Paid / Balance / Progress */}
      <View style={styles.detailLoanStats}>
        <View style={styles.detailStat}>
          <Text style={styles.detailStatLabel}>Paid</Text>
          <Text style={[styles.detailStatValue, { color: EL.primary }]}>{formatRupees(total_paid)}</Text>
        </View>
        <View style={styles.detailStat}>
          <Text style={styles.detailStatLabel}>{isInterestOnly ? 'Principal due' : 'Balance'}</Text>
          <Text style={[styles.detailStatValue, { color: EL.nippu }]}>{formatRupees(balance)}</Text>
        </View>
        <View style={styles.detailStat}>
          <Text style={styles.detailStatLabel}>Progress</Text>
          <Text style={styles.detailStatValue}>
            {paid_installments}/{total_installments}
          </Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.detailProgressTrack}>
        <View style={[styles.detailProgressFill, { width: `${Math.round(progress * 100)}%` }]} />
      </View>

      {/* Date strip */}
      <View style={styles.detailDateRow}>
        <View style={styles.detailDateItem}>
          <Text style={styles.detailDateLabel}>Started</Text>
          <Text style={styles.detailDateValue}>{startDate}</Text>
        </View>
        {endDate && !isInterestOnly ? (
          <View style={styles.detailDateItem}>
            <Text style={styles.detailDateLabel}>{isPast ? 'Ended' : 'Ends'}</Text>
            <Text style={styles.detailDateValue}>{endDate}</Text>
          </View>
        ) : null}
        {next_due_date && !isPast ? (
          <View style={styles.detailDateItem}>
            <Text style={styles.detailDateLabel}>Next due</Text>
            <Text style={styles.detailDateValue}>
              {new Date(next_due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
            </Text>
          </View>
        ) : null}
        {last_payment_date ? (
          <View style={styles.detailDateItem}>
            <Text style={styles.detailDateLabel}>Last paid</Text>
            <Text style={styles.detailDateValue}>
              {new Date(last_payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Action buttons */}
      <View style={styles.detailLoanActions}>
        <Pressable onPress={onView} style={styles.detailActionLink}>
          <MaterialCommunityIcons name="format-list-bulleted" size={16} color={EL.primary} />
          <Text style={styles.detailActionLinkText}>View Plan</Text>
        </Pressable>
        {onTopUp ? (
          <Pressable onPress={onTopUp} style={styles.detailActionLink}>
            <MaterialCommunityIcons name="plus-circle" size={16} color={EL.warn} />
            <Text style={[styles.detailActionLinkText, { color: EL.warn }]}>Top-up</Text>
          </Pressable>
        ) : null}
        {onClose ? (
          <Pressable onPress={onClose} style={styles.detailActionLink}>
            <MaterialCommunityIcons name="close-circle-outline" size={16} color={EL.tertiary} />
            <Text style={[styles.detailActionLinkText, { color: EL.tertiary }]}>Close</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: Space.lg,
    paddingHorizontal: Space.xl,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Space.xl,
    paddingVertical: Space.lg,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.lg,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: EL.onSurface,
    letterSpacing: -0.3,
  },

  // Profile card
  profileCard: {
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.xxl,
    padding: Space.xxl,
    marginBottom: Space.xl,
    ...Shadows.card,
  },
  profileTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  profileLeft: {
    flexDirection: 'row',
    flex: 1,
    gap: Space.lg,
  },
  avatarWrap: {
    position: 'relative',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: EL.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: EL.white,
  },
  profileInfo: {
    flex: 1,
    gap: 4,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    color: EL.onSurface,
    lineHeight: 24,
  },
  profilePhone: {
    fontSize: 15,
    fontWeight: '500',
    color: EL.primary,
  },
  profileActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
  },
  actionCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: EL.surfaceHighest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusRow: {
    marginTop: Space.xl,
  },
  metaSection: {
    marginTop: Space.lg,
    paddingTop: Space.lg,
    borderTopWidth: 1,
    borderTopColor: EL.surfaceHighest,
    gap: Space.sm,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Space.sm,
  },
  metaText: {
    fontSize: 13,
    fontWeight: '500',
    color: EL.onSurfaceSec,
    flex: 1,
    lineHeight: 18,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: Space.md,
    paddingVertical: 6,
    borderRadius: Radii.pill,
    gap: Space.sm,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusPillText: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 13,
  },

  // AI tip
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Space.xl,
    padding: Space.lg,
    borderRadius: Radii.lg,
    gap: Space.md,
  },
  tipText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
    lineHeight: 18,
  },

  // Section
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: Space.xl,
    marginBottom: Space.sm,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: EL.onSurface,
  },

  // Loan card
  loanCard: {
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.lg,
    padding: Space.xl,
    marginBottom: Space.md,
    ...Shadows.card,
  },
  loanCardSecondary: {
    borderLeftWidth: 4,
    borderLeftColor: EL.primaryContainer,
  },
  loanTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  loanType: {
    fontSize: 12,
    fontWeight: '600',
    color: EL.onSurfaceMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  loanAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: EL.onSurface,
    marginTop: 4,
  },
  loanDueLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: EL.onSurfaceMuted,
  },
  loanDueAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: EL.primary,
    marginTop: 4,
  },
  loanProgress: {
    marginTop: Space.lg,
    gap: Space.sm,
  },
  loanProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressDayText: {
    fontSize: 13,
    fontWeight: '500',
    color: EL.onSurfaceSec,
  },
  progressTrack: {
    height: 8,
    backgroundColor: EL.surfaceHighest,
    borderRadius: Radii.pill,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: EL.primary,
    borderRadius: Radii.pill,
  },
  loanActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Space.lg,
    paddingTop: Space.sm,
  },
  loanLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  loanLinkText: {
    fontSize: 14,
    fontWeight: '700',
    color: EL.primary,
  },
  nextDueText: {
    fontSize: 12,
    color: EL.onSurfaceMuted,
    fontStyle: 'italic',
  },
  emptyLoanCard: {
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.lg,
    padding: Space.xl,
    ...Shadows.card,
  },

  // Recent payments timeline
  paymentsSection: {
    marginTop: Space.xl,
    paddingBottom: Space.lg,
  },
  timeline: {
    position: 'relative',
    marginLeft: Space.md,
    marginTop: Space.lg,
  },
  timelineConnector: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 10,
    width: 2,
    backgroundColor: EL.surfaceHighest,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Space.lg,
    marginBottom: Space.xxl,
  },
  timelineDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    marginTop: 4,
    zIndex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineDotGlow: {
    shadowColor: 'rgba(0, 105, 72, 0.4)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  timelineDotGlowError: {
    shadowColor: 'rgba(186, 26, 26, 0.3)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  timelineContent: {
    flex: 1,
    marginTop: 0,
  },
  timelineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  timelineAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: EL.onSurface,
  },
  timelineDate: {
    fontSize: 12,
    color: EL.onSurfaceMuted,
  },
  timelineAgent: {
    fontSize: 13,
    color: EL.onSurfaceSec,
    marginTop: 2,
  },
  timelineExpected: {
    fontSize: 12,
    fontWeight: '500',
    color: EL.onSurfaceMuted,
  },
  timelineMeta: {
    fontSize: 12,
    color: EL.onSurfaceMuted,
    marginTop: 2,
  },
  timelineDateCol: {
    alignItems: 'flex-end',
  },
  timelineTime: {
    fontSize: 11,
    color: EL.onSurfaceMuted,
    marginTop: 1,
  },
  tagRow: {
    flexDirection: 'row',
    gap: Space.xs,
    marginTop: Space.sm,
    flexWrap: 'wrap',
  },
  tag: {
    paddingHorizontal: Space.sm,
    paddingVertical: 2,
    borderRadius: Radii.pill,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  sectionSub: {
    fontSize: 11,
    color: EL.onSurfaceMuted,
    fontWeight: '600',
  },

  // Bottom action bar (sticky)
  bottomActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Space.lg,
    paddingTop: Space.md,
    paddingBottom: Space.xl + 12,
    // Soft fade-in from transparent to opaque so the cards appear to pass
    // beneath the bar without being abruptly cut off.
    backgroundColor: 'rgba(240, 253, 244, 0.92)',
    ...(Platform.OS === 'web'
      ? ({ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' } as any)
      : {}),
  },
  bottomBar: {
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.xl,
    padding: Space.sm,
    gap: Space.sm,
    ...Shadows.float,
  },

  // Primary CTA: gradient-filled emerald with optional amount badge
  primaryBtn: {
    height: 56,
    borderRadius: Radii.lg,
    backgroundColor: EL.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Space.lg,
  },
  primaryBtnDisabled: {
    backgroundColor: EL.surfaceMid,
  },
  primaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
  },
  primaryLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: EL.white,
  },
  primaryAmountBadge: {
    paddingHorizontal: Space.md,
    paddingVertical: 6,
    borderRadius: Radii.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  primaryAmountText: {
    fontSize: 14,
    fontWeight: '800',
    color: EL.white,
    letterSpacing: 0.3,
  },

  // Secondary actions row: ghost buttons with a vertical separator
  secondaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
  },
  secondaryBtn: {
    flex: 1,
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.sm,
  },
  secondaryLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: EL.primary,
  },
  secondaryDivider: {
    width: 1,
    height: 24,
    backgroundColor: EL.surfaceMid,
  },

  /* ── Lifetime Stats Card ── */
  lifetimeCard: {
    backgroundColor: EL.surfaceLow,
    borderRadius: Radii.lg,
    padding: Space.lg,
    marginTop: Space.lg,
    marginBottom: Space.sm,
  },
  lifetimeLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: EL.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Space.md,
  },
  lifetimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  lifetimeStat: {
    flex: 1,
  },
  lifetimeValue: {
    fontSize: 16,
    fontWeight: '800',
    color: EL.onSurface,
  },
  lifetimeStatLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: EL.onSurfaceMuted,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  /* ── Section header — extended with totals ── */
  sectionTotal: {
    fontSize: 12,
    fontWeight: '600',
    color: EL.nippu,
  },

  /* ── LoanDetailCard ── */
  detailLoanCard: {
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.lg,
    padding: Space.lg,
    marginTop: Space.md,
    ...Shadows.card,
  },
  detailLoanCardPast: {
    opacity: 0.85,
  },
  detailLoanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Space.md,
  },
  detailLoanBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    flex: 1,
  },
  kindBadge: {
    paddingHorizontal: Space.sm,
    paddingVertical: 2,
    borderRadius: Radii.sm,
  },
  kindBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  detailLoanLineText: {
    fontSize: 12,
    fontWeight: '600',
    color: EL.onSurfaceSec,
  },
  closedPill: {
    paddingHorizontal: Space.sm,
    paddingVertical: 2,
    borderRadius: Radii.sm,
    backgroundColor: EL.surfaceHighest,
  },
  closedPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: EL.onSurfaceMuted,
    letterSpacing: 0.5,
  },
  detailLoanAmountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: Space.lg,
  },
  detailLoanLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: EL.onSurfaceMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  detailLoanAmount: {
    fontSize: 24,
    fontWeight: '800',
    color: EL.onSurface,
    letterSpacing: -0.5,
  },
  detailLoanInstallment: {
    fontSize: 18,
    fontWeight: '700',
    color: EL.primary,
  },
  detailLoanFreq: {
    fontSize: 13,
    fontWeight: '500',
    color: EL.onSurfaceMuted,
  },
  detailLoanStats: {
    flexDirection: 'row',
    backgroundColor: EL.surfaceLow,
    borderRadius: Radii.md,
    padding: Space.md,
    marginBottom: Space.md,
  },
  detailStat: {
    flex: 1,
  },
  detailStatLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: EL.onSurfaceMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  detailStatValue: {
    fontSize: 14,
    fontWeight: '700',
    color: EL.onSurface,
    marginTop: 2,
  },
  detailProgressTrack: {
    height: 6,
    backgroundColor: EL.surfaceHighest,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: Space.md,
  },
  detailProgressFill: {
    height: '100%',
    backgroundColor: EL.primary,
    borderRadius: 3,
  },
  detailDateRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space.lg,
    marginBottom: Space.md,
  },
  detailDateItem: {
    flex: 1,
    minWidth: 100,
  },
  detailDateLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: EL.onSurfaceMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  detailDateValue: {
    fontSize: 12,
    fontWeight: '600',
    color: EL.onSurface,
    marginTop: 2,
  },
  detailLoanActions: {
    flexDirection: 'row',
    gap: Space.lg,
    paddingTop: Space.md,
    borderTopWidth: 1,
    borderTopColor: EL.surfaceHighest,
  },
  detailActionLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailActionLinkText: {
    fontSize: 13,
    fontWeight: '700',
    color: EL.primary,
  },

  /* ── Renew button (under closed loans) ── */
  renewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.sm,
    paddingVertical: Space.md,
    marginTop: Space.md,
    borderRadius: Radii.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(0, 105, 72, 0.4)',
  },
  renewBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: EL.primary,
  },
});
