import React, { useState } from 'react';
import {
  Alert,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { NumberPad } from '@/components/common/NumberPad';
import { EL, Common, Radii, Space, Touch, Type } from '@/theme/emeraldLedger';
import { createExpense, getTodayExpenseTotal } from '@/db/repos/expenses';
import type { ExpenseCategory } from '@/db/types';
import { useAuthStore } from '@/store/authStore';
import { formatRupees } from '@/utils/format';

const CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'petrol', label: 'Petrol' },
  { value: 'food', label: 'Food' },
  { value: 'travel', label: 'Travel' },
  { value: 'phone', label: 'Phone' },
  { value: 'other', label: 'Other' },
];

export function AgentExpenseScreen() {
  const { t } = useTranslation();
  const orgId = useAuthStore((s) => s.user?.orgId ?? null);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const qc = useQueryClient();

  const { data: todayTotal } = useQuery({
    queryKey: ['agentExpenseTotal', orgId],
    enabled: !!orgId,
    queryFn: () => getTodayExpenseTotal(orgId!),
  });

  const addMut = useMutation({
    mutationFn: (input: { category: ExpenseCategory; amount: number }) =>
      createExpense({ orgId: orgId!, userId, ...input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agentExpenseTotal', orgId] });
      qc.invalidateQueries({ queryKey: ['agentExpTotal', orgId] }); // AgentSummaryScreen
    },
  });

  const [category, setCategory] = useState<ExpenseCategory>('petrol');
  const [amount, setAmount] = useState('');
  const [saved, setSaved] = useState(false);

  const handleAdd = async () => {
    const n = Number(amount);
    if (n <= 0) return;
    try {
      await addMut.mutateAsync({ category, amount: n });
      setAmount('');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      Alert.alert(t('common.error_generic'), e?.message ?? '');
    }
  };

  return (
    <SafeAreaView style={Common.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Expenses</Text>
        <Text style={styles.todayTotal}>Today: {formatRupees(todayTotal ?? 0)}</Text>
      </View>

      {saved ? (
        <View style={styles.savedBanner}>
          <Text style={styles.savedText}>{'\u2713'} Saved</Text>
        </View>
      ) : null}

      {/* Category chips */}
      <View style={styles.chipRow}>
        {CATEGORIES.map((c) => {
          const active = category === c.value;
          return (
            <Pressable
              key={c.value}
              onPress={() => setCategory(c.value)}
              style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
            >
              <Text style={[styles.chipLabel, active && { color: EL.white }]}>{c.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Quick amounts */}
      <View style={styles.chipRow}>
        {[50, 100, 200, 500].map((v) => {
          const active = Number(amount) === v;
          return (
            <Pressable
              key={v}
              onPress={() => setAmount(String(v))}
              style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
            >
              <Text style={[styles.chipLabel, active && { color: EL.white }]}>{'\u20B9'}{v}</Text>
            </Pressable>
          );
        })}
      </View>

      <NumberPad
        value={amount}
        onChange={setAmount}
        onConfirm={handleAdd}
        confirmLabel="Add"
        disabled={addMut.isPending}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { padding: Space.xl },
  title: { ...Type.displayMd },
  todayTotal: { ...Type.bodySm, color: EL.onSurfaceSec, marginTop: Space.xs },
  savedBanner: {
    backgroundColor: EL.primaryFixed,
    padding: Space.md,
    alignItems: 'center',
    marginHorizontal: Space.xl,
    borderRadius: Radii.md,
    marginBottom: Space.md,
  },
  savedText: { ...Type.labelLg, color: EL.primary },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Space.xl,
    marginBottom: Space.sm,
    gap: Space.sm,
  },
  chip: {
    paddingHorizontal: Space.lg,
    paddingVertical: 10,
    borderRadius: Radii.pill,
    minHeight: Touch.min,
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: EL.primary },
  chipInactive: { backgroundColor: EL.surfaceHigh },
  chipLabel: { ...Type.labelMd, fontWeight: '600', color: EL.onSurface },
});
