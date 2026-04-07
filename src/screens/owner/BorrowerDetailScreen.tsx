import React from 'react';
import {
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
import { Badge } from '@/components/common/Badge';
import { ELCard } from '@/components/common/ELCard';
import { GradientButton } from '@/components/common/GradientButton';
import { ProgressBar } from '@/components/common/ProgressBar';
import { StarRating } from '@/components/common/StarRating';
import { EL, Common, Radii, Space, Type } from '@/theme/emeraldLedger';
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
      <ScrollView contentContainerStyle={styles.content}>
        {/* ── Profile Header Card ── */}
        <ELCard style={styles.profileCard}>
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
                  <View style={{ marginTop: Space.xs }}>
                    <StarRating rating={st.rating} size={16} />
                  </View>
                ) : null}
              </View>
            </View>
            {/* Call / Chat actions */}
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
                    onPress={() => Linking.openURL(`https://wa.me/91${borrower.phone}`)}
                  >
                    <MaterialCommunityIcons name="whatsapp" size={20} color="#25D366" />
                  </Pressable>
                </>
              ) : null}
            </View>
          </View>

          {/* Status pill */}
          {borrowerStatus !== 'none' ? (
            <View style={styles.statusRow}>
              <View style={[styles.statusPill, {
                backgroundColor: borrowerStatus === 'nadapu'
                  ? 'rgba(5, 150, 105, 0.12)'
                  : 'rgba(220, 38, 38, 0.12)',
              }]}>
                <View style={[styles.pulseDot, {
                  backgroundColor: borrowerStatus === 'nadapu' ? EL.primary : EL.nippu,
                }]} />
                <Text style={[styles.statusPillText, {
                  color: borrowerStatus === 'nadapu' ? EL.primary : EL.nippu,
                }]}>
                  {borrowerStatus === 'nadapu' ? '\u0BA8\u0B9F\u0BAA\u0BCD\u0BAA\u0BC1 / On Schedule' : '\u0BA8\u0BBF\u0BAA\u0BCD\u0BAA\u0BC1 / Overdue'}
                </Text>
              </View>
            </View>
          ) : null}

          {/* Address */}
          {borrower.address ? (
            <Text style={styles.profileAddress}>{borrower.address}</Text>
          ) : null}
        </ELCard>

        {/* ── AI Contextual Tip ── */}
        {tip ? (
          <View style={[styles.tipCard, { backgroundColor: TIP_BG[tip.variant] }]}>
            <MaterialCommunityIcons
              name="head-lightbulb-outline"
              size={18}
              color={TIP_FG[tip.variant]}
            />
            <Text style={[styles.tipText, { color: TIP_FG[tip.variant] }]}>
              {tip.text}
            </Text>
          </View>
        ) : null}

        {/* ── Edit button ── */}
        <GradientButton
          title={t('borrowers.edit')}
          variant="secondary"
          onPress={() => navigation.navigate('BorrowerEdit', { id: borrower.id })}
          icon={<MaterialCommunityIcons name="pencil-outline" size={18} color={EL.primary} />}
          style={{ marginHorizontal: Space.xl, marginBottom: Space.lg }}
        />

        {/* ── Active Loans Section ── */}
        <View style={styles.sectionHeader}>
          <Text style={Type.titleLg}>
            {t('borrowers.loans')} {loans ? `(${loans.length})` : ''}
          </Text>
        </View>

        {loans && loans.length > 0 ? (
          loans.map((loan) => {
            // Compute paid count from collections
            const loanCollections = tipData?.collections.filter(c => c.loan_id === loan.id) ?? [];
            const paidDays = loanCollections.length;
            const progress = loan.total_installments > 0
              ? Math.min(1, paidDays / loan.total_installments)
              : 0;

            return (
              <ELCard key={loan.id} style={styles.loanCard}>
                <View style={styles.loanTop}>
                  <View>
                    <Text style={styles.loanType}>
                      {loan.product_description ?? 'DAILY THANDAL'}
                    </Text>
                    <Text style={styles.loanAmount}>{formatRupees(loan.principal)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.loanDueLabel}>
                      DAILY DUE
                    </Text>
                    <Text style={styles.loanDueAmount}>{formatRupees(loan.emi_amount)}</Text>
                  </View>
                </View>

                {/* Progress */}
                <View style={styles.loanProgress}>
                  <View style={styles.loanProgressHeader}>
                    <Text style={Type.bodySm}>
                      Day {paidDays}/{loan.total_installments}
                    </Text>
                    <Text style={[Type.bodySm, { color: EL.primary }]}>
                      {formatRupees(loan.emi_amount * Math.max(0, loan.total_installments - paidDays))} remaining
                    </Text>
                  </View>
                  <ProgressBar progress={progress} />
                </View>

                {/* Actions row */}
                <View style={styles.loanActions}>
                  <Pressable
                    onPress={() => navigation.navigate('LoanPlan', { loanId: loan.id })}
                    style={styles.loanLink}
                  >
                    <Text style={styles.loanLinkText}>
                      View Plan
                    </Text>
                    <MaterialCommunityIcons name="chevron-right" size={16} color={EL.primary} />
                  </Pressable>
                  <Badge
                    label={loan.status}
                    variant={
                      loan.status === 'active' ? 'success'
                        : loan.status === 'overdue' ? 'danger'
                          : 'neutral'
                    }
                  />
                </View>

                {loan.status === 'closed' ? (
                  <GradientButton
                    title="Renew loan"
                    onPress={() => navigation.navigate('NewLoan', { borrowerId: borrower!.id })}
                    style={{ marginTop: Space.md }}
                  />
                ) : null}
              </ELCard>
            );
          })
        ) : (
          <ELCard style={{ marginHorizontal: Space.xl }}>
            <Text style={Type.bodySm}>{t('borrowers.no_loans')}</Text>
          </ELCard>
        )}

        {/* Spacer for bottom buttons */}
        <View style={{ height: 160 }} />
      </ScrollView>

      {/* ── Bottom Fixed Actions ── */}
      <View style={styles.bottomActions}>
        <GradientButton
          title="Record Payment"
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
            }
          }}
          icon={<MaterialCommunityIcons name="plus-circle" size={20} color={EL.white} />}
        />
        <GradientButton
          title={'+ ' + t('borrowers.new_loan')}
          variant="secondary"
          onPress={() => navigation.navigate('NewLoan', { borrowerId: borrower.id })}
          icon={<MaterialCommunityIcons name="receipt" size={18} color={EL.primary} />}
          style={{ marginTop: Space.sm }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: Space.md,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Profile card
  profileCard: {
    marginHorizontal: Space.xl,
    marginBottom: Space.lg,
    borderRadius: Radii.xl,
    padding: Space.xxl,
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
    bottom: -2,
    right: -2,
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
    gap: 2,
  },
  profileName: {
    ...Type.displaySm,
    fontSize: 20,
    fontWeight: '700',
  },
  profilePhone: {
    ...Type.bodyMd,
    color: EL.primary,
    fontWeight: '500',
  },
  profileActions: {
    gap: Space.sm,
  },
  actionCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: EL.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusRow: {
    marginTop: Space.xl,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: Space.md,
    paddingVertical: Space.sm,
    borderRadius: Radii.pill,
    gap: Space.sm,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusPillText: {
    ...Type.labelMd,
    fontWeight: '600',
    fontSize: 13,
  },
  profileAddress: {
    ...Type.bodySm,
    color: EL.onSurfaceMuted,
    marginTop: Space.md,
  },

  // AI tip
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: Space.xl,
    marginBottom: Space.lg,
    padding: Space.lg,
    borderRadius: Radii.lg,
    gap: Space.sm,
  },
  tipText: {
    ...Type.bodySm,
    fontWeight: '500',
    flex: 1,
    lineHeight: 18,
  },

  // Section
  sectionHeader: {
    paddingHorizontal: Space.xl,
    marginBottom: Space.md,
  },

  // Loan card
  loanCard: {
    marginHorizontal: Space.xl,
    marginBottom: Space.md,
  },
  loanTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  loanType: {
    ...Type.labelSm,
    color: EL.onSurfaceMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  loanAmount: {
    ...Type.titleLg,
    fontWeight: '700',
    marginTop: Space.xs,
  },
  loanDueLabel: {
    ...Type.labelSm,
    color: EL.onSurfaceMuted,
    letterSpacing: 0.5,
  },
  loanDueAmount: {
    ...Type.titleMd,
    color: EL.primary,
    fontWeight: '700',
    marginTop: Space.xs,
  },
  loanProgress: {
    marginTop: Space.lg,
    gap: Space.sm,
  },
  loanProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  loanActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Space.lg,
  },
  loanLink: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loanLinkText: {
    ...Type.labelLg,
    color: EL.primary,
  },

  // Bottom actions
  bottomActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Space.xl,
    paddingTop: Space.lg,
    paddingBottom: Space.xxxl,
    backgroundColor: 'rgba(250, 252, 251, 0.92)',
  },
});
