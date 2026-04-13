// TopUpLoanScreen — add principal to an existing interest-only loan.
//
// Thandal owners frequently top-up a trusted borrower mid-cycle instead of
// closing the current loan and opening a new one. This screen:
//   1. Loads the existing loan
//   2. Takes the top-up amount
//   3. Shows the new principal and new per-installment interest side-by-side
//   4. Calls topUpLoan() which inserts a negative principal_return and
//      updates pending plan entries' interest.
//
// Only interest-only loans are eligible. For principal+interest loans we
// tell the owner to close + start a new loan (the math for mid-schedule
// principal change is messy and surprises people).

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
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { GradientButton } from '@/components/common/GradientButton';
import { EL, Common, Radii, Shadows, Space, Type } from '@/theme/emeraldLedger';
import { formatRupees } from '@/utils/format';
import { getLoanById } from '@/db/repos/loans';
import { topUpLoan } from '@/db/repos/principalReturns';
import { useAuthStore } from '@/store/authStore';
import type { OwnerStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<OwnerStackParamList, 'TopUp'>;

const QUICK_AMOUNTS = [5000, 10000, 25000, 50000];

export function TopUpLoanScreen({ route, navigation }: Props) {
  const { loanId } = route.params;
  const orgId = useAuthStore((s) => s.user?.orgId ?? '');
  const qc = useQueryClient();

  const [amountStr, setAmountStr] = useState('');

  const { data: loan, isLoading } = useQuery({
    queryKey: ['loan', loanId],
    queryFn: () => getLoanById(loanId),
    enabled: !!loanId,
  });

  const topUp = useMutation({
    mutationFn: (amount: number) => topUpLoan(orgId, loanId, amount, 'Top-up'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loan', loanId] });
      qc.invalidateQueries({ queryKey: ['plan', loanId] });
      qc.invalidateQueries({ queryKey: ['loans', orgId, 'active'] });
      qc.invalidateQueries({ queryKey: ['borrower-summary', orgId] });
      qc.invalidateQueries({ queryKey: ['borrower-list-summaries', orgId] });
      qc.invalidateQueries({ queryKey: ['dueToday', orgId] });
      qc.invalidateQueries({ queryKey: ['todaySummary', orgId] });
    },
  });

  const parsedAmount = Number(amountStr) || 0;

  // Preview: compute new principal + new per-installment interest
  const preview = useMemo(() => {
    if (!loan || parsedAmount <= 0) return null;
    const oldPrincipal = loan.principal;
    const newPrincipal = oldPrincipal + parsedAmount;
    const newDisbursed = (loan.disbursed_amount ?? oldPrincipal) + parsedAmount;

    // Prefer stored rate; fall back to emi/principal for legacy rows
    const rate =
      loan.interest_rate && loan.interest_rate > 0
        ? loan.interest_rate
        : oldPrincipal > 0
        ? loan.emi_amount / oldPrincipal
        : 0;
    const newEmi = rate > 0 ? Math.max(1, Math.round(newPrincipal * rate)) : loan.emi_amount;
    return { oldPrincipal, newPrincipal, oldEmi: loan.emi_amount, newEmi, newDisbursed };
  }, [loan, parsedAmount]);

  const isInterestOnly = loan?.repayment_type === 'interest_only';

  const handleConfirm = () => {
    if (!loan || parsedAmount <= 0) return;
    Alert.alert(
      'Confirm top-up',
      `Add ${formatRupees(parsedAmount)} to this loan?\n\nNew principal: ${formatRupees(
        preview!.newPrincipal
      )}\nNew per-installment: ${formatRupees(preview!.newEmi)}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              await topUp.mutateAsync(parsedAmount);
              Alert.alert('Top-up recorded', `${formatRupees(parsedAmount)} added.`, [
                { text: 'OK', onPress: () => navigation.goBack() },
              ]);
            } catch (e) {
              const msg = e instanceof Error ? e.message : 'Top-up failed';
              Alert.alert('Error', msg);
            }
          },
        },
      ]
    );
  };

  if (isLoading || !loan) {
    return (
      <SafeAreaView style={Common.screen}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={22} color={EL.onSurface} />
          </Pressable>
          <Text style={Type.titleLg}>Top-up loan</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={Type.bodySm}>Loading loan…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isInterestOnly) {
    return (
      <SafeAreaView style={Common.screen}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={22} color={EL.onSurface} />
          </Pressable>
          <Text style={Type.titleLg}>Top-up loan</Text>
        </View>
        <View style={[styles.notice, Shadows.card]}>
          <MaterialCommunityIcons name="information-outline" size={28} color={EL.warn} />
          <Text style={[Type.titleMd, { marginTop: Space.md, textAlign: 'center' }]}>
            Top-up unavailable
          </Text>
          <Text style={[Type.bodySm, { color: EL.onSurfaceMuted, textAlign: 'center', marginTop: Space.xs }]}>
            Top-up is only supported for interest-only loans. For principal + interest loans,
            close this loan first and start a new one with the combined amount.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={Common.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ padding: Space.lg, gap: Space.lg }} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
              <MaterialCommunityIcons name="arrow-left" size={22} color={EL.onSurface} />
            </Pressable>
            <Text style={Type.titleLg}>Top-up loan</Text>
          </View>

          {/* Existing loan details */}
          <View style={[styles.card, Shadows.card]}>
            <Text style={[Type.labelSm, { color: EL.onSurfaceMuted }]}>CURRENT LOAN</Text>
            <View style={styles.row}>
              <Text style={[Type.bodySm, { color: EL.onSurfaceSec }]}>Principal</Text>
              <Text style={Type.titleMd}>{formatRupees(loan.principal)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={[Type.bodySm, { color: EL.onSurfaceSec }]}>Per installment</Text>
              <Text style={Type.titleMd}>{formatRupees(loan.emi_amount)}</Text>
            </View>
          </View>

          {/* Amount input */}
          <View style={[styles.card, Shadows.card]}>
            <Text style={[Type.labelSm, { color: EL.onSurfaceMuted, marginBottom: Space.sm }]}>
              TOP-UP AMOUNT
            </Text>
            <View style={styles.inputWrap}>
              <Text style={styles.currencyPrefix}>₹</Text>
              <TextInput
                value={amountStr}
                onChangeText={setAmountStr}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={EL.onSurfaceMuted}
                style={styles.amountInput}
              />
            </View>
            <View style={styles.quickRow}>
              {QUICK_AMOUNTS.map((q) => (
                <Pressable key={q} onPress={() => setAmountStr(String(q))} style={styles.chip}>
                  <Text style={styles.chipText}>+{formatRupees(q)}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Preview */}
          {preview ? (
            <View style={[styles.card, Shadows.card]}>
              <Text style={[Type.labelSm, { color: EL.onSurfaceMuted }]}>AFTER TOP-UP</Text>
              <View style={styles.row}>
                <Text style={[Type.bodySm, { color: EL.onSurfaceSec }]}>New principal</Text>
                <Text style={[Type.titleMd, { color: EL.primary }]}>
                  {formatRupees(preview.newPrincipal)}
                </Text>
              </View>
              <View style={styles.row}>
                <Text style={[Type.bodySm, { color: EL.onSurfaceSec }]}>New per-installment</Text>
                <Text style={[Type.titleMd, { color: EL.primary }]}>
                  {formatRupees(preview.newEmi)}
                </Text>
              </View>
              <View style={styles.diffRow}>
                <MaterialCommunityIcons name="arrow-up-bold" size={14} color={EL.primary} />
                <Text style={[Type.labelSm, { color: EL.primary }]}>
                  {formatRupees(preview.newEmi - preview.oldEmi)} more per installment
                </Text>
              </View>
            </View>
          ) : null}

          <GradientButton
            title="Confirm top-up"
            onPress={handleConfirm}
            disabled={!preview || topUp.isPending}
            loading={topUp.isPending}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: EL.surfaceCard,
  },
  card: {
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.lg,
    padding: Space.lg,
    gap: Space.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radii.md,
    backgroundColor: EL.surfaceLow,
    paddingHorizontal: Space.md,
  },
  currencyPrefix: {
    fontSize: 24,
    color: EL.primary,
    marginRight: Space.sm,
    fontWeight: '600',
  },
  amountInput: {
    flex: 1,
    fontSize: 28,
    fontWeight: '600',
    color: EL.onSurface,
    paddingVertical: Space.md,
  },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space.sm,
    marginTop: Space.sm,
  },
  chip: {
    paddingHorizontal: Space.md,
    paddingVertical: Space.sm,
    borderRadius: Radii.pill,
    backgroundColor: EL.primaryFixed,
  },
  chipText: {
    color: EL.onPrimaryFixed,
    fontWeight: '600',
    fontSize: 13,
  },
  diffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xs,
    marginTop: Space.xs,
  },
  notice: {
    margin: Space.lg,
    padding: Space.xl,
    borderRadius: Radii.lg,
    backgroundColor: EL.surfaceCard,
    alignItems: 'center',
  },
});
