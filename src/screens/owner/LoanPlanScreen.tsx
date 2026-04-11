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
import { usePlanEntries, useUpdateLoanStatus } from '@/hooks/useLoans';
import { formatDateShort, formatRupees } from '@/utils/format';
import { generatePlanHtml, sharePdf } from '@/utils/pdfExport';
import type { PlanEntryRow, PlanEntryStatus } from '@/db/types';
import type { OwnerStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<OwnerStackParamList, 'LoanPlan'>;

const STATUS_VARIANT: Record<PlanEntryStatus, BadgeVariant> = {
  pending: 'neutral',
  paid: 'success',
  partial: 'warn',
  missed: 'danger',
  advance_covered: 'info',
};

const STATUS_BG: Record<PlanEntryStatus, string> = {
  pending: 'transparent',
  paid: 'transparent',
  partial: 'transparent',
  missed: 'rgba(155, 62, 59, 0.05)',
  advance_covered: 'rgba(192, 237, 211, 0.2)',
};

export function LoanPlanScreen({ route }: Props) {
  const { t } = useTranslation();
  const { loanId } = route.params;
  const { data: plan, isLoading } = usePlanEntries(loanId);
  const updateStatus = useUpdateLoanStatus();

  const handleSharePlan = async () => {
    if (!plan || plan.length === 0) return;
    const html = generatePlanHtml('Borrower', 0, plan[0]?.expected_amount ?? 0,
      plan.map((p) => ({ number: p.installment_number, date: p.due_date, amount: p.expected_amount, status: p.status })));
    await sharePdf(html, 'VasoolAI-Repayment-Plan');
  };

  const handleCloseLoan = () => {
    Alert.alert(t('loan.close_loan'), 'Close this loan? Remaining balance will be waived.', [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('loan.close_loan'), style: 'destructive', onPress: () => {
        updateStatus.mutate({ id: loanId, status: 'closed' });
        Alert.alert('Loan closed!', 'This loan has been marked as complete.');
      }},
    ]);
  };

  // Compute running balance
  const planWithBalance = React.useMemo(() => {
    if (!plan) return [];
    let balance = 0;
    if (plan.length > 0) {
      balance = plan.length * plan[0].expected_amount;
    }
    return plan.map((entry) => {
      balance -= entry.expected_amount;
      return { ...entry, balance };
    });
  }, [plan]);

  const renderItem = ({ item }: { item: PlanEntryRow & { balance: number } }) => {
    const isPending = item.status === 'pending';
    return (
      <View style={[styles.row, { backgroundColor: STATUS_BG[item.status], opacity: isPending ? 0.5 : 1 }]}>
        <Text style={styles.col1}>{String(item.installment_number).padStart(2, '0')}</Text>
        <Text style={styles.col2}>{formatDateShort(new Date(item.due_date))}</Text>
        <Text style={[styles.col3, item.status === 'missed' && { color: EL.tertiary }]}>
          {formatRupees(item.expected_amount)}
        </Text>
        <Text style={styles.col4}>{formatRupees(item.balance)}</Text>
        <View style={styles.col5}>
          <Badge
            label={t(`loan.status_${item.status === 'advance_covered' ? 'advance' : item.status}`)}
            variant={STATUS_VARIANT[item.status]}
          />
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={Common.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Repayment Plan</Text>
        <Text style={styles.subtitle}>{'\u0BA4\u0BBF\u0B9F\u0BCD\u0B9F\u0BAE\u0BCD'} (THITTAM)</Text>
      </View>

      {/* Loan Summary Card */}
      {plan && plan.length > 0 ? (
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryTitle}>
                {formatRupees(plan.length * plan[0].expected_amount)}
              </Text>
              <View style={styles.summaryMeta}>
                <View style={styles.loanTypeBadge}>
                  <Text style={styles.loanTypeText}>
                    {plan.length >= 2
                      ? ((plan[1].due_date - plan[0].due_date) > 6 * 86400000 ? 'MONTHLY' : (plan[1].due_date - plan[0].due_date) > 2 * 86400000 ? 'WEEKLY' : 'DAILY')
                      : 'LOAN'} LOAN
                  </Text>
                </View>
                <Text style={styles.summaryMetaText}>
                  {formatRupees(plan[0].expected_amount)} {'\u2022'} {plan.length} installments
                </Text>
              </View>
            </View>
            <View style={styles.walletIcon}>
              <MaterialCommunityIcons name="wallet" size={24} color={EL.white} />
            </View>
          </View>
          <View style={styles.summaryDates}>
            <View>
              <Text style={styles.summaryDateLabel}>START DATE</Text>
              <Text style={styles.summaryDateValue}>{formatDateShort(new Date(plan[0].due_date))}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.summaryDateLabel}>END DATE</Text>
              <Text style={[styles.summaryDateValue, { color: EL.tertiary }]}>
                {formatDateShort(new Date(plan[plan.length - 1].due_date))}
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      {/* Ledger Table */}
      <View style={styles.ledgerHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm }}>
          <MaterialCommunityIcons name="format-list-bulleted" size={16} color={EL.primary} />
          <Text style={styles.ledgerTitle}>Ledger View</Text>
        </View>
        <Text style={styles.ledgerCount}>{plan?.length ?? 0} Installments</Text>
      </View>

      <View style={styles.tableWrap}>
        {/* Table header */}
        <View style={styles.tableHeader}>
          <Text style={[styles.headerCell, styles.col1]}>#</Text>
          <Text style={[styles.headerCell, styles.col2]}>Date</Text>
          <Text style={[styles.headerCell, styles.col3]}>Amount</Text>
          <Text style={[styles.headerCell, styles.col4]}>Balance</Text>
          <Text style={[styles.headerCell, styles.col5]}>Status</Text>
        </View>

        {isLoading ? (
          <View style={styles.loadingWrap}>
            <Text style={Type.bodySm}>{t('common.loading')}</Text>
          </View>
        ) : (
          <FlatList
            data={planWithBalance}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: 160 }}
          />
        )}
      </View>

      {/* Bottom actions */}
      <View style={styles.bottomBar}>
        <GradientButton
          title="Share as PDF"
          onPress={handleSharePlan}
          icon={<MaterialCommunityIcons name="file-pdf-box" size={18} color={EL.white} />}
        />
        <Pressable style={styles.excelBtn} onPress={handleSharePlan}>
          <MaterialCommunityIcons name="table" size={18} color={EL.primary} />
          <Text style={styles.excelBtnText}>Share as Excel</Text>
        </Pressable>
        <Pressable
          style={[styles.excelBtn, { borderColor: 'rgba(155, 62, 59, 0.3)' }]}
          onPress={handleCloseLoan}
        >
          <MaterialCommunityIcons name="close-circle-outline" size={18} color={EL.tertiary} />
          <Text style={[styles.excelBtnText, { color: EL.tertiary }]}>Close Loan</Text>
        </Pressable>
      </View>
    </SafeAreaView>
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
    padding: Space.xl,
    marginBottom: Space.lg,
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
    fontSize: 12,
    fontWeight: '600',
    color: EL.primary,
    letterSpacing: 0.5,
  },
  summaryMetaText: {
    fontSize: 14,
    fontWeight: '500',
    color: EL.onSurfaceSec,
  },
  walletIcon: {
    backgroundColor: EL.primaryContainer,
    padding: Space.sm,
    borderRadius: Radii.md,
  },
  summaryDates: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Space.xl,
    paddingTop: Space.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(188,202,192,0.1)',
  },
  summaryDateLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: EL.outline,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  summaryDateValue: {
    fontSize: 14,
    fontWeight: '600',
    color: EL.onSurface,
    marginTop: 2,
  },

  // Ledger
  ledgerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Space.xl,
    marginBottom: Space.md,
  },
  ledgerTitle: {
    ...Type.titleMd,
    fontWeight: '700',
    color: EL.onSurfaceSec,
  },
  ledgerCount: {
    fontSize: 10,
    fontWeight: '700',
    color: EL.outline,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },

  // Table
  tableWrap: {
    flex: 1,
    marginHorizontal: Space.lg,
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.xl,
    overflow: 'hidden',
    ...Shadows.card,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: Space.md,
    paddingHorizontal: Space.md,
    backgroundColor: 'rgba(222,235,227,0.5)',
  },
  headerCell: {
    fontSize: 10,
    fontWeight: '700',
    color: EL.outline,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: Space.lg,
    paddingHorizontal: Space.md,
    alignItems: 'center',
  },
  col1: { width: 30, fontSize: 12, fontWeight: '500', color: EL.onSurfaceSec },
  col2: { flex: 1, fontSize: 12, fontWeight: '600', color: EL.onSurface },
  col3: { flex: 0.8, fontSize: 12, fontWeight: '700', color: EL.onSurface, textAlign: 'right' },
  col4: { flex: 0.8, fontSize: 12, fontWeight: '500', color: EL.outline, textAlign: 'right' },
  col5: { width: 80, alignItems: 'flex-end' },
  loadingWrap: { padding: Space.xl },

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
  excelBtn: {
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
