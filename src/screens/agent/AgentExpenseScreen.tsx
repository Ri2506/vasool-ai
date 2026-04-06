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

import { Badge } from '@/components/common/Badge';
import { NumberPad } from '@/components/common/NumberPad';
import { Colors } from '@/constants/colors';
import { Radius, Spacing, TouchTarget, Typography } from '@/constants/typography';
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agentExpenseTotal'] }),
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
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Expenses</Text>
        <Text style={styles.todayTotal}>
          Today: {formatRupees(todayTotal ?? 0)}
        </Text>
      </View>

      {saved ? (
        <View style={styles.savedBanner}>
          <Text style={styles.savedText}>✓ Saved</Text>
        </View>
      ) : null}

      {/* Category chips */}
      <View style={styles.catRow}>
        {CATEGORIES.map((c) => (
          <Pressable
            key={c.value}
            onPress={() => setCategory(c.value)}
            style={[styles.catChip, category === c.value && styles.catChipActive]}
          >
            <Text style={[styles.catLabel, category === c.value && styles.catLabelActive]}>
              {c.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Quick amounts */}
      <View style={styles.catRow}>
        {[50, 100, 200, 500].map((v) => (
          <Pressable
            key={v}
            onPress={() => setAmount(String(v))}
            style={[styles.catChip, Number(amount) === v && styles.catChipActive]}
          >
            <Text style={[styles.catLabel, Number(amount) === v && styles.catLabelActive]}>
              ₹{v}
            </Text>
          </Pressable>
        ))}
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
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: { padding: Spacing.xl },
  title: { ...Typography.display, color: Colors.text },
  todayTotal: { ...Typography.body, color: Colors.textSec, marginTop: 4 },
  savedBanner: {
    backgroundColor: Colors.primaryLight,
    padding: Spacing.md,
    alignItems: 'center',
    marginHorizontal: Spacing.xl,
    borderRadius: 8,
    marginBottom: Spacing.md,
  },
  savedText: { ...Typography.title, color: Colors.primary },
  catRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  catChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    marginRight: Spacing.sm,
    marginBottom: Spacing.sm,
    minHeight: TouchTarget.min,
    justifyContent: 'center',
  },
  catChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  catLabel: { ...Typography.body, fontWeight: '600', color: Colors.text },
  catLabelActive: { color: Colors.white },
});
