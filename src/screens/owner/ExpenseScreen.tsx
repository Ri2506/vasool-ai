import React, { useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Badge, type BadgeVariant } from '@/components/common/Badge';
import { ELCard } from '@/components/common/ELCard';
import { GradientButton } from '@/components/common/GradientButton';
import { NumberPad } from '@/components/common/NumberPad';
import { EL, Common, Glass, Radii, Shadows, Space, Touch, Type } from '@/theme/emeraldLedger';
import { createExpense, listExpenses } from '@/db/repos/expenses';
import type { ExpenseCategory, ExpenseRow } from '@/db/types';
import { useAuthStore } from '@/store/authStore';
import { formatDateShort, formatRupees } from '@/utils/format';

const CATEGORIES: { value: ExpenseCategory; label: string; variant: BadgeVariant }[] = [
  { value: 'petrol', label: 'Petrol', variant: 'warn' },
  { value: 'food', label: 'Food', variant: 'info' },
  { value: 'travel', label: 'Travel', variant: 'neutral' },
  { value: 'phone', label: 'Phone', variant: 'success' },
  { value: 'other', label: 'Other', variant: 'neutral' },
];

export function ExpenseScreen() {
  const { t } = useTranslation();
  const orgId = useAuthStore((s) => s.user?.orgId ?? null);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const qc = useQueryClient();

  const { data: expenses } = useQuery({
    queryKey: ['expenses', orgId],
    enabled: !!orgId,
    queryFn: () => listExpenses(orgId!),
  });

  const addMut = useMutation({
    mutationFn: (input: { category: ExpenseCategory; amount: number }) =>
      createExpense({ orgId: orgId!, userId, ...input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses', orgId] }),
  });

  const [showModal, setShowModal] = useState(false);
  const [category, setCategory] = useState<ExpenseCategory>('petrol');
  const [amount, setAmount] = useState('');

  const handleAdd = async () => {
    const n = Number(amount);
    if (n <= 0) return;
    try {
      await addMut.mutateAsync({ category, amount: n });
      setAmount('');
      setShowModal(false);
    } catch (e: any) {
      Alert.alert(t('common.error_generic'), e?.message ?? '');
    }
  };

  const renderExpense = ({ item }: { item: ExpenseRow }) => {
    const cat = CATEGORIES.find((c) => c.value === item.category) ?? CATEGORIES[4];
    return (
      <ELCard style={styles.row}>
        <View style={styles.rowInner}>
          <Badge label={cat.label} variant={cat.variant} />
          <Text style={styles.rowDate}>{formatDateShort(new Date(item.date))}</Text>
          <Text style={styles.rowAmount}>{formatRupees(item.amount)}</Text>
        </View>
      </ELCard>
    );
  };

  return (
    <SafeAreaView style={Common.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Expenses</Text>
      </View>

      {expenses && expenses.length > 0 ? (
        <FlatList
          data={expenses}
          keyExtractor={(e) => e.id}
          renderItem={renderExpense}
          contentContainerStyle={{ padding: Space.xl, paddingBottom: 120 }}
        />
      ) : (
        <ELCard style={{ margin: Space.xl }}>
          <Text style={Type.bodySm}>No expenses yet</Text>
        </ELCard>
      )}

      {/* FAB */}
      <Pressable style={Common.fab} onPress={() => setShowModal(true)}>
        <MaterialCommunityIcons name="plus" size={28} color={EL.white} />
      </Pressable>

      {/* Add Expense Modal */}
      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <Pressable style={[Glass.dark, styles.modalBackdrop]} onPress={() => setShowModal(false)}>
          <View style={[Glass.container, styles.modalSheet]}>
            <Text style={styles.modalTitle}>Add expense</Text>

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

            {/* Quick amount chips */}
            <View style={styles.chipRow}>
              {[50, 100, 200, 500, 1000].map((v) => {
                const active = Number(amount) === v;
                return (
                  <Pressable
                    key={v}
                    onPress={() => setAmount(String(v))}
                    style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
                  >
                    <Text style={[styles.chipLabel, active && { color: EL.white }]}>\u20B9{v}</Text>
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

            <GradientButton
              title={t('common.cancel')}
              variant="secondary"
              onPress={() => setShowModal(false)}
              style={{ marginTop: Space.md, marginHorizontal: Space.md }}
            />
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: Space.xl, paddingTop: Space.lg, paddingBottom: Space.md },
  title: { ...Type.displayMd },
  row: { marginBottom: Space.sm },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowDate: { ...Type.bodySm, color: EL.onSurfaceMuted, flex: 1, marginLeft: Space.md },
  rowAmount: { ...Type.titleMd, fontWeight: '700' },

  modalBackdrop: { flex: 1, justifyContent: 'flex-end' },
  modalSheet: {
    borderTopLeftRadius: Radii.xl + 4,
    borderTopRightRadius: Radii.xl + 4,
    padding: Space.xl,
    paddingBottom: Space.xxxl,
  },
  modalTitle: { ...Type.displaySm, marginBottom: Space.lg },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm, marginBottom: Space.md },
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
