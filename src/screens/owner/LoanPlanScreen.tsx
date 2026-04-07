import React from 'react';
import {
  Alert,
  FlatList,
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
  missed: 'rgba(155, 62, 59, 0.04)',
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
        <Text style={[styles.col3, item.status === 'missed' && { color: EL.danger }]}>
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
        <Text style={styles.title}>{t('loan.plan_title')}</Text>
        <Text style={styles.subtitle}>{'\u0BA4\u0BBF\u0B9F\u0BCD\u0B9F\u0BAE\u0BCD'} (THITTAM)</Text>
      </View>

      {/* Table */}
      <View style={styles.tableWrap}>
        {/* Table header */}
        <View style={styles.tableHeader}>
          <Text style={[styles.headerCell, styles.col1]}>#</Text>
          <Text style={[styles.headerCell, styles.col2]}>{t('loan.due_date')}</Text>
          <Text style={[styles.headerCell, styles.col3]}>{t('loan.amount')}</Text>
          <Text style={[styles.headerCell, styles.col4]}>Balance</Text>
          <Text style={[styles.headerCell, styles.col5]}>{t('loan.status')}</Text>
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
          title={t('common.share_pdf')}
          onPress={handleSharePlan}
          icon={<MaterialCommunityIcons name="file-pdf-box" size={18} color={EL.white} />}
        />
        <GradientButton
          title={t('loan.close_loan')}
          variant="secondary"
          onPress={handleCloseLoan}
          style={{ marginTop: Space.sm }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: Space.xl,
    paddingTop: Space.lg,
    paddingBottom: Space.md,
  },
  title: { ...Type.displaySm },
  subtitle: {
    ...Type.labelSm,
    color: EL.primary,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: Space.xs,
    opacity: 0.7,
  },
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
    backgroundColor: EL.surfaceHigh,
  },
  headerCell: {
    ...Type.labelSm,
    color: EL.onSurfaceMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontSize: 10,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: Space.lg,
    paddingHorizontal: Space.md,
    alignItems: 'center',
  },
  col1: { width: 30, ...Type.bodySm, color: EL.onSurfaceSec, fontWeight: '500' },
  col2: { flex: 1, ...Type.bodySm, color: EL.onSurface, fontWeight: '600' },
  col3: { flex: 0.8, ...Type.bodySm, color: EL.onSurface, fontWeight: '700', textAlign: 'right' },
  col4: { flex: 0.8, ...Type.bodySm, color: EL.onSurfaceMuted, textAlign: 'right' },
  col5: { width: 80, alignItems: 'flex-end' },
  loadingWrap: { padding: Space.xl },

  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Space.xl,
    paddingTop: Space.lg,
    paddingBottom: Space.xxxl,
    backgroundColor: 'rgba(250, 252, 251, 0.95)',
  },
});
