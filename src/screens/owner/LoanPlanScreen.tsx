import React from 'react';
import {
  Alert,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Badge, type BadgeVariant } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Colors } from '@/constants/colors';
import { Spacing, Typography } from '@/constants/typography';
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

export function LoanPlanScreen({ route }: Props) {
  const { t } = useTranslation();
  const { loanId } = route.params;
  const { data: plan, isLoading } = usePlanEntries(loanId);

  const renderItem = ({ item }: { item: PlanEntryRow }) => (
    <View style={styles.row}>
      <Text style={styles.col1}>{item.installment_number}</Text>
      <Text style={styles.col2}>{formatDateShort(new Date(item.due_date))}</Text>
      <Text style={styles.col3}>{formatRupees(item.expected_amount)}</Text>
      <View style={styles.col4}>
        <Badge
          label={t(`loan.status_${item.status === 'advance_covered' ? 'advance' : item.status}`)}
          variant={STATUS_VARIANT[item.status]}
        />
      </View>
    </View>
  );

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
        Alert.alert('🎉 Loan closed!', 'This loan has been marked as complete.');
      }},
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('loan.plan_title')}</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: Spacing.sm }}>
          <Button title={t('common.share_pdf')} variant="secondary" onPress={handleSharePlan} />
          <Button title={t('loan.close_loan')} variant="danger" onPress={handleCloseLoan} />
        </View>
      </View>

      <Card style={styles.tableCard}>
        <View style={styles.headerRow}>
          <Text style={[styles.headerCell, styles.col1]}>{t('loan.inst_number')}</Text>
          <Text style={[styles.headerCell, styles.col2]}>{t('loan.due_date')}</Text>
          <Text style={[styles.headerCell, styles.col3]}>{t('loan.amount')}</Text>
          <Text style={[styles.headerCell, styles.col4]}>{t('loan.status')}</Text>
        </View>

        {isLoading ? (
          <Text style={styles.loading}>{t('common.loading')}</Text>
        ) : (
          <FlatList
            data={plan ?? []}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            ItemSeparatorComponent={() => <View style={styles.sep} />}
          />
        )}
      </Card>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  title: { ...Typography.display, color: Colors.text },
  tableCard: {
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.xl,
    padding: 0,
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    padding: Spacing.md,
    backgroundColor: Colors.primaryLight,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  headerCell: {
    ...Typography.caption,
    color: Colors.primaryDark,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    padding: Spacing.md,
    alignItems: 'center',
  },
  col1: { width: 40, ...Typography.body, color: Colors.text },
  col2: { flex: 1, ...Typography.body, color: Colors.text },
  col3: { flex: 1, ...Typography.body, color: Colors.text, fontWeight: '600' },
  col4: { width: 90, alignItems: 'flex-end' },
  sep: { height: 1, backgroundColor: Colors.border },
  loading: { padding: Spacing.lg, ...Typography.body, color: Colors.textSec },
});
