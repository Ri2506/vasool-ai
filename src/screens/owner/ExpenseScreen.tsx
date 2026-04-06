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
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Badge, type BadgeVariant } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { NumberPad } from '@/components/common/NumberPad';
import { Colors } from '@/constants/colors';
import { Radius, Spacing, TouchTarget, Typography } from '@/constants/typography';
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
      <View style={styles.row}>
        <Badge label={cat.label} variant={cat.variant} />
        <View style={styles.rowBody}>
          <Text style={styles.rowDate}>{formatDateShort(new Date(item.date))}</Text>
        </View>
        <Text style={styles.rowAmount}>{formatRupees(item.amount)}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Expenses</Text>
      </View>

      {expenses && expenses.length > 0 ? (
        <FlatList
          data={expenses}
          keyExtractor={(e) => e.id}
          renderItem={renderExpense}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          contentContainerStyle={{ paddingBottom: 120 }}
        />
      ) : (
        <Card style={{ margin: Spacing.xl }}>
          <Text style={styles.emptyTitle}>No expenses yet</Text>
        </Card>
      )}

      <View style={styles.fab}>
        <Button title="+ Add expense" onPress={() => setShowModal(true)} />
      </View>

      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Add expense</Text>

            {/* Category chips */}
            <View style={styles.catRow}>
              {CATEGORIES.map((c) => (
                <Pressable
                  key={c.value}
                  onPress={() => setCategory(c.value)}
                  style={[
                    styles.catChip,
                    category === c.value && styles.catChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.catLabel,
                      category === c.value && styles.catLabelActive,
                    ]}
                  >
                    {c.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Quick amount chips */}
            <View style={styles.catRow}>
              {[50, 100, 200, 500, 1000].map((v) => (
                <Pressable
                  key={v}
                  onPress={() => setAmount(String(v))}
                  style={[
                    styles.catChip,
                    Number(amount) === v && styles.catChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.catLabel,
                      Number(amount) === v && styles.catLabelActive,
                    ]}
                  >
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

            <Button
              title={t('common.cancel')}
              variant="secondary"
              onPress={() => setShowModal(false)}
              style={{ marginTop: Spacing.md, marginHorizontal: Spacing.md }}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, paddingBottom: Spacing.md },
  title: { ...Typography.display, color: Colors.text },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.white,
    minHeight: TouchTarget.min,
  },
  rowBody: { flex: 1, marginLeft: Spacing.md },
  rowDate: { ...Typography.caption, color: Colors.textSec },
  rowAmount: { ...Typography.title, color: Colors.text },
  sep: { height: 1, backgroundColor: Colors.border },
  emptyTitle: { ...Typography.body, color: Colors.textSec },
  fab: { position: 'absolute', left: Spacing.xl, right: Spacing.xl, bottom: Spacing.xl },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.bg,
    borderTopLeftRadius: Radius.card * 2,
    borderTopRightRadius: Radius.card * 2,
    padding: Spacing.xl,
    paddingBottom: Spacing.xxl,
  },
  modalTitle: { ...Typography.display, color: Colors.text, marginBottom: Spacing.lg },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: Spacing.md },
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
