import React from 'react';
import {
  Alert,
  Linking,
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
import { useLoansForBorrower } from '@/hooks/useLoans';
import { generateBorrowerTip, type TipVariant } from '@/utils/aiTips';
import { formatRupees } from '@/utils/format';
import type { CollectionRow, PlanEntryRow } from '@/db/types';
import type { OwnerStackParamList } from '@/navigation/types';

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

  // Recent payments from collections
  const recentPayments = React.useMemo(() => {
    if (!tipData?.collections) return [];
    return [...tipData.collections]
      .sort((a, b) => b.created_at - a.created_at)
      .slice(0, 5);
  }, [tipData?.collections]);

  if (!borrower) {
    return (
      <SafeAreaView style={Common.screen}>
        <View style={styles.loadingWrap}>
          <Text style={Type.titleMd}>{t('common.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

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
                    onPress={() => Linking.openURL(`https://wa.me/91${borrower.phone}`)}
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

        {/* ── Active Loans Section ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {t('borrowers.loans')} {loans ? `(${loans.length})` : ''}
          </Text>
        </View>

        {loans && loans.length > 0 ? (
          loans.map((loan, index) => {
            // Compute paid count from collections
            const loanCollections = tipData?.collections.filter(c => c.loan_id === loan.id) ?? [];
            const paidDays = loanCollections.length;
            const progress = loan.total_installments > 0
              ? Math.min(1, paidDays / loan.total_installments)
              : 0;
            const isSecondary = index > 0;

            return (
              <View
                key={loan.id}
                style={[
                  styles.loanCard,
                  isSecondary && styles.loanCardSecondary,
                ]}
              >
                <View style={styles.loanTop}>
                  <View>
                    <Text style={styles.loanType}>
                      {loan.product_description ?? 'DAILY THANDAL'}
                    </Text>
                    <Text style={styles.loanAmount}>{formatRupees(loan.principal)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.loanDueLabel}>DAILY DUE</Text>
                    <Text style={styles.loanDueAmount}>{formatRupees(loan.emi_amount)}</Text>
                  </View>
                </View>

                {/* Progress */}
                {!isSecondary ? (
                  <View style={styles.loanProgress}>
                    <View style={styles.loanProgressHeader}>
                      <Text style={styles.progressDayText}>
                        Day {paidDays}/{loan.total_installments}
                      </Text>
                      <Text style={[styles.progressDayText, { color: EL.primary }]}>
                        {formatRupees(loan.emi_amount * Math.max(0, loan.total_installments - paidDays))} remaining
                      </Text>
                    </View>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
                    </View>
                  </View>
                ) : null}

                {/* Actions row */}
                <View style={styles.loanActions}>
                  <Pressable
                    onPress={() => navigation.navigate('LoanPlan', { loanId: loan.id })}
                    style={styles.loanLink}
                  >
                    <Text style={styles.loanLinkText}>View Plan</Text>
                    <MaterialCommunityIcons name="chevron-right" size={16} color={EL.primary} />
                  </Pressable>
                  {!isSecondary ? (
                    <Text style={styles.nextDueText}>Next due: {st?.days_overdue ? `${st.days_overdue}d overdue` : 'On schedule'}</Text>
                  ) : null}
                </View>

                {loan.status === 'closed' ? (
                  <GradientButton
                    title="Renew loan"
                    onPress={() => navigation.navigate('NewLoan', { borrowerId: borrower!.id })}
                    style={{ marginTop: Space.md }}
                  />
                ) : null}
              </View>
            );
          })
        ) : (
          <View style={styles.emptyLoanCard}>
            <Text style={Type.bodySm}>{t('borrowers.no_loans')}</Text>
          </View>
        )}

        {/* ── Recent Payments Timeline ── */}
        {recentPayments.length > 0 ? (
          <View style={styles.paymentsSection}>
            <Text style={styles.sectionTitle}>Recent Payments</Text>
            <View style={styles.timeline}>
              {/* Vertical connector line */}
              <View style={styles.timelineConnector} />

              {recentPayments.map((payment, index) => {
                const isMissed = payment.amount === 0;
                const date = new Date(payment.created_at);
                const dateStr = `${date.toLocaleString('en', { month: 'short' })} ${date.getDate()}`;

                return (
                  <View key={payment.id ?? index} style={styles.timelineItem}>
                    <View style={[
                      styles.timelineDot,
                      {
                        backgroundColor: isMissed ? '#ba1a1a' : EL.primary,
                      },
                      index === 0 && !isMissed && styles.timelineDotGlow,
                      index === 0 && isMissed && styles.timelineDotGlowError,
                    ]} />
                    <View style={styles.timelineContent}>
                      <View style={styles.timelineRow}>
                        <Text style={[
                          styles.timelineAmount,
                          isMissed && { color: '#ba1a1a' },
                        ]}>
                          {isMissed ? 'Missed' : formatRupees(payment.amount)}
                        </Text>
                        <Text style={styles.timelineDate}>{dateStr}</Text>
                      </View>
                      {payment.amount > 0 && index === 0 && (payment as any).collected_by ? (
                        <Text style={styles.timelineAgent}>Agent: {(payment as any).collected_by}</Text>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* Spacer for bottom buttons */}
        <View style={{ height: 180 }} />
      </ScrollView>

      {/* ── Bottom Fixed Actions ── */}
      <View style={styles.bottomActions}>
        <View style={styles.bottomBtnGroup}>
          <Pressable
            style={({ pressed }) => [
              styles.recordPaymentBtn,
              pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] },
            ]}
            onPress={() => {
              if (loans?.[0]) {
                navigation.navigate('Collect', {
                  item: {
                    plan_entry_id: '',
                    loan_id: loans[0].id,
                    borrower_id: borrower.id,
                    borrower_name: borrower.name,
                    borrower_phone: borrower.phone ?? null,
                    line_name: null,
                    line_type: null,
                    expected_amount: loans[0].emi_amount,
                    installment_number: 0,
                    due_date: Date.now(),
                    loan_principal: loans[0].principal,
                    loan_emi: loans[0].emi_amount,
                    loan_status: loans[0].status,
                  },
                });
              } else {
                Alert.alert('No active loan', 'Create a loan first to record payments.');
              }
            }}
          >
            <MaterialCommunityIcons name="plus-circle" size={20} color={EL.white} />
            <Text style={styles.recordPaymentLabel}>Record Payment</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.newLoanBtn,
              pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] },
            ]}
            onPress={() => navigation.navigate('NewLoan', { borrowerId: borrower.id })}
          >
            <MaterialCommunityIcons name="receipt" size={18} color={EL.primary} />
            <Text style={styles.newLoanLabel}>New Loan</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.newLoanBtn,
              pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] },
            ]}
            onPress={() => navigation.navigate('Documents', { borrowerId: borrower.id })}
          >
            <MaterialCommunityIcons name="file-document-outline" size={18} color={EL.primary} />
            <Text style={styles.newLoanLabel}>Docs</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
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
    marginBottom: Space.lg,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 18,
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
    left: 7,
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
    width: 16,
    height: 16,
    borderRadius: 8,
    marginTop: 4,
    zIndex: 1,
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

  // Bottom actions
  bottomActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Space.xxl,
    paddingTop: Space.lg,
    paddingBottom: Space.xxxl + 16,
  },
  bottomBtnGroup: {
    gap: Space.md,
  },
  recordPaymentBtn: {
    height: 56,
    borderRadius: Radii.lg,
    backgroundColor: EL.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.sm,
    ...Shadows.float,
  },
  recordPaymentLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: EL.white,
  },
  newLoanBtn: {
    height: 56,
    borderRadius: Radii.lg,
    backgroundColor: EL.surfaceCard,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.sm,
  },
  newLoanLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: EL.primary,
  },
});
