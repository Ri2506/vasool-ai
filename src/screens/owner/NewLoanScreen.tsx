import React, { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Colors } from '@/constants/colors';
import { Radius, Spacing, TouchTarget, Typography } from '@/constants/typography';
import { useLines } from '@/hooks/useLines';
import { useCreateLoan } from '@/hooks/useLoans';
import { useBorrower } from '@/hooks/useBorrowers';
import { computeLoan, suggestEmi } from '@/utils/loanCalc';
import { formatDateShort, formatRupees } from '@/utils/format';
import type { LineType } from '@/db/types';
import type { OwnerStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<OwnerStackParamList, 'NewLoan'>;

export function NewLoanScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const { borrowerId } = route.params;
  const { data: borrower } = useBorrower(borrowerId);
  const { data: lines } = useLines();
  const createLoan = useCreateLoan();

  const [principal, setPrincipal] = useState('');
  const [emiAmount, setEmiAmount] = useState('');
  const [emiTouched, setEmiTouched] = useState(false); // true once user manually edits EMI
  const [installments, setInstallments] = useState('');
  const [lineId, setLineId] = useState<string | null>(null);

  const selectedLine = lines?.find((l) => l.id === lineId);
  const lineType: LineType = selectedLine?.type ?? 'daily';

  // Live summary whenever the user has all three numbers
  const summary = useMemo(() => {
    const p = Number(principal);
    const e = Number(emiAmount);
    const n = Number(installments);
    if (p > 0 && e > 0 && n > 0) {
      return computeLoan({
        principal: p,
        emiAmount: e,
        totalInstallments: n,
        lineType,
        startDate: new Date(),
      });
    }
    return null;
  }, [principal, emiAmount, installments, lineType]);

  // Auto-suggest EMI whenever principal or installments change,
  // UNLESS the user has manually edited the EMI field.
  const handlePrincipalChange = (v: string) => {
    const clean = v.replace(/\D/g, '');
    setPrincipal(clean);
    if (clean && installments && !emiTouched) {
      setEmiAmount(String(suggestEmi(Number(clean), Number(installments))));
    }
  };

  const handleInstallmentsChange = (v: string) => {
    const clean = v.replace(/\D/g, '');
    setInstallments(clean);
    if (principal && clean && !emiTouched) {
      setEmiAmount(String(suggestEmi(Number(principal), Number(clean))));
    }
  };

  const handleEmiChange = (v: string) => {
    setEmiTouched(true);
    setEmiAmount(v.replace(/\D/g, ''));
  };

  const handleCreate = async () => {
    if (!summary) {
      Alert.alert(t('common.error_generic'), 'Please fill principal, EMI, and installments');
      return;
    }
    if (!lineId) {
      Alert.alert(t('common.error_generic'), 'Please pick a line');
      return;
    }
    try {
      const result = await createLoan.mutateAsync({
        borrowerId,
        lineId,
        principal: Number(principal),
        emiAmount: Number(emiAmount),
        totalInstallments: Number(installments),
        lineType,
        startDate: new Date(),
      });
      navigation.replace('LoanPlan', { loanId: result.loan.id });
    } catch (e: any) {
      Alert.alert(t('common.error_generic'), e?.message ?? '');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.title}>{t('loan.title')}</Text>
          {borrower ? <Text style={styles.sub}>{borrower.name}</Text> : null}

          <Field
            label={t('loan.principal')}
            value={principal}
            onChangeText={handlePrincipalChange}
            prefix="₹"
          />
          <Field
            label={t('loan.installments')}
            value={installments}
            onChangeText={handleInstallmentsChange}
          />
          <Field
            label={t('loan.emi')}
            value={emiAmount}
            onChangeText={handleEmiChange}
            prefix="₹"
          />

          <Text style={styles.fieldLabel}>{t('loan.line')}</Text>
          <View style={styles.lineGrid}>
            {(lines ?? []).map((line) => (
              <Pressable
                key={line.id}
                onPress={() => setLineId(line.id)}
                style={[
                  styles.lineChip,
                  lineId === line.id && styles.lineChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.lineChipLabel,
                    lineId === line.id && styles.lineChipLabelActive,
                  ]}
                >
                  {line.name}
                </Text>
                <Text
                  style={[
                    styles.lineChipType,
                    lineId === line.id && styles.lineChipLabelActive,
                  ]}
                >
                  {t(`lines.type_${line.type}`)}
                </Text>
              </Pressable>
            ))}
          </View>
          {lines && lines.length === 0 ? (
            <Text style={styles.hint}>No lines yet — create one in the Lines tab.</Text>
          ) : null}

          {summary ? (
            <Card style={{ marginTop: Spacing.lg }}>
              <Text style={styles.summaryTitle}>{t('loan.summary')}</Text>
              <Row
                label={t('loan.total_repay')}
                value={formatRupees(summary.totalRepayment)}
              />
              <Row label={t('loan.interest')} value={formatRupees(summary.interest)} />
              <Row
                label={t('loan.ends_on')}
                value={formatDateShort(new Date(summary.expectedEndDate))}
              />
            </Card>
          ) : null}

          <Button
            title={t('loan.create')}
            onPress={handleCreate}
            loading={createLoan.isPending}
            style={{ marginTop: Spacing.lg }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  prefix?: string;
}

function Field({ label, value, onChangeText, prefix }: FieldProps) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputRow}>
        {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          keyboardType="number-pad"
          placeholderTextColor={Colors.textMuted}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  container: { padding: Spacing.xl, paddingBottom: Spacing.xxl },
  title: { ...Typography.display, color: Colors.text },
  sub: { ...Typography.body, color: Colors.textSec, marginBottom: Spacing.lg },
  fieldWrap: { marginBottom: Spacing.md },
  fieldLabel: {
    ...Typography.caption,
    color: Colors.textSec,
    marginBottom: Spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    minHeight: TouchTarget.min,
  },
  prefix: {
    ...Typography.title,
    color: Colors.text,
    marginRight: Spacing.sm,
  },
  input: { flex: 1, ...Typography.title, color: Colors.text },
  lineGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: Spacing.md },
  lineChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: Spacing.sm,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.white,
    minHeight: TouchTarget.min,
    justifyContent: 'center',
  },
  lineChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  lineChipLabel: { ...Typography.body, color: Colors.text, fontWeight: '600' },
  lineChipLabelActive: { color: Colors.white },
  lineChipType: { ...Typography.caption, color: Colors.textSec, marginTop: 2 },
  hint: { ...Typography.caption, color: Colors.textMuted },
  summaryTitle: { ...Typography.title, color: Colors.text, marginBottom: Spacing.md },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
  },
  rowLabel: { ...Typography.body, color: Colors.textSec },
  rowValue: { ...Typography.body, color: Colors.text, fontWeight: '700' },
});
