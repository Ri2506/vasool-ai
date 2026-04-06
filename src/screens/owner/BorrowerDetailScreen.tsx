import React from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Avatar } from '@/components/common/Avatar';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Colors } from '@/constants/colors';
import { Spacing, Typography } from '@/constants/typography';
import { useBorrower } from '@/hooks/useBorrowers';
import { useLoansForBorrower } from '@/hooks/useLoans';
import { formatDateShort, formatRupees } from '@/utils/format';
import type { OwnerStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<OwnerStackParamList, 'BorrowerDetail'>;

export function BorrowerDetailScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const { id } = route.params;
  const { data: borrower } = useBorrower(id);
  const { data: loans } = useLoansForBorrower(id);

  if (!borrower) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <Text style={styles.title}>{t('common.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.profile}>
          <Avatar name={borrower.name} size={64} />
          <View style={{ flex: 1, marginLeft: Spacing.md }}>
            <Text style={styles.name}>{borrower.name}</Text>
            {borrower.phone ? (
              <Text style={styles.sub}>{borrower.phone}</Text>
            ) : null}
            {borrower.address ? (
              <Text style={styles.sub}>{borrower.address}</Text>
            ) : null}
          </View>
        </View>

        <Button
          title={t('borrowers.edit')}
          variant="secondary"
          onPress={() => navigation.navigate('BorrowerEdit', { id: borrower.id })}
          style={{ marginTop: Spacing.lg }}
        />

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('borrowers.loans')}</Text>
        </View>

        {loans && loans.length > 0 ? (
          loans.map((loan) => (
            <Card key={loan.id} style={{ marginBottom: Spacing.md }}>
              <View style={styles.loanRow}>
                <Text style={styles.loanPrincipal}>
                  {formatRupees(loan.principal)}
                </Text>
                <Badge
                  label={loan.status}
                  variant={
                    loan.status === 'active'
                      ? 'success'
                      : loan.status === 'overdue'
                        ? 'danger'
                        : 'neutral'
                  }
                />
              </View>
              <Text style={styles.loanSub}>
                EMI {formatRupees(loan.emi_amount)} × {loan.total_installments}
              </Text>
              <Text style={styles.loanSub}>
                {formatDateShort(new Date(loan.start_date))} →{' '}
                {formatDateShort(new Date(loan.expected_end_date))}
              </Text>
              <Button
                title={t('loan.view_plan')}
                variant="secondary"
                onPress={() => navigation.navigate('LoanPlan', { loanId: loan.id })}
                style={{ marginTop: Spacing.md }}
              />
              {loan.status === 'closed' ? (
                <Button
                  title="Renew loan"
                  onPress={() =>
                    navigation.navigate('NewLoan', { borrowerId: borrower!.id })
                  }
                  style={{ marginTop: Spacing.sm }}
                />
              ) : null}
            </Card>
          ))
        ) : (
          <Card>
            <Text style={styles.emptyLoans}>{t('borrowers.no_loans')}</Text>
          </Card>
        )}

        <Button
          title={'+ ' + t('borrowers.new_loan')}
          onPress={() => navigation.navigate('NewLoan', { borrowerId: borrower.id })}
          style={{ marginTop: Spacing.lg }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  container: { padding: Spacing.xl, paddingBottom: Spacing.xxl },
  title: { ...Typography.display, color: Colors.text },
  profile: { flexDirection: 'row', alignItems: 'center' },
  name: { ...Typography.display, color: Colors.text },
  sub: { ...Typography.body, color: Colors.textSec, marginTop: 2 },
  sectionHeader: { marginTop: Spacing.xl, marginBottom: Spacing.md },
  sectionTitle: { ...Typography.title, color: Colors.text },
  loanRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  loanPrincipal: { ...Typography.title, color: Colors.text },
  loanSub: { ...Typography.caption, color: Colors.textSec, marginTop: 4 },
  emptyLoans: { ...Typography.body, color: Colors.textSec },
});
