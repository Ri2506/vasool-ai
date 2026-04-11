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
import { GradientButton } from '@/components/common/GradientButton';
import { NumberPad } from '@/components/common/NumberPad';
import { EL, Common, Glass, Radii, Shadows, Space, Touch, Type } from '@/theme/emeraldLedger';
import { createExpense, listExpenses } from '@/db/repos/expenses';
import type { ExpenseCategory, ExpenseRow } from '@/db/types';
import { useAuthStore } from '@/store/authStore';
import { formatDateShort, formatRupees } from '@/utils/format';

const CATEGORIES: { value: ExpenseCategory; label: string; emoji: string; variant: BadgeVariant }[] = [
  { value: 'petrol', label: 'Petrol', emoji: '\u26FD', variant: 'warn' },
  { value: 'food', label: 'Food', emoji: '\uD83C\uDF5B', variant: 'info' },
  { value: 'travel', label: 'Travel', emoji: '\uD83D\uDE97', variant: 'neutral' },
  { value: 'phone', label: 'Phone', emoji: '\uD83D\uDCF1', variant: 'success' },
  { value: 'other', label: 'Other', emoji: '', variant: 'neutral' },
];

const QUICK_AMOUNTS = [50, 100, 200, 500];

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
      <View style={styles.logCard}>
        <View style={styles.logLeft}>
          <View style={styles.logIcon}>
            <Text style={{ fontSize: 18 }}>{cat.emoji || '\uD83D\uDCCB'}</Text>
          </View>
          <View>
            <Text style={styles.logTitle}>{cat.label}</Text>
            <Text style={styles.logSub}>{formatDateShort(new Date(item.date))}</Text>
          </View>
        </View>
        <Text style={styles.logAmount}>{formatRupees(item.amount)}</Text>
      </View>
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
          contentContainerStyle={{ paddingHorizontal: Space.xl, paddingBottom: 120, gap: Space.sm }}
        />
      ) : (
        <View style={styles.emptyCard}>
          <Text style={Type.bodySm}>No expenses yet</Text>
        </View>
      )}

      {/* FAB */}
      <Pressable style={Common.fab} onPress={() => setShowModal(true)}>
        <MaterialCommunityIcons name="plus" size={28} color={EL.white} />
      </Pressable>

      {/* Expense Entry Bottom Sheet */}
      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <Pressable style={[Glass.dark, styles.modalBackdrop]} onPress={() => setShowModal(false)}>
          <View style={styles.modalSheet}>
            {/* Handle */}
            <View style={styles.handle} />

            <View style={styles.sheetContent}>
              {/* Header */}
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>Log Expense</Text>
                <Pressable style={styles.closeBtn} onPress={() => setShowModal(false)}>
                  <MaterialCommunityIcons name="close" size={20} color={EL.onSurfaceSec} />
                </Pressable>
              </View>

              {/* Amount Display */}
              <View style={styles.amountDisplay}>
                <Text style={styles.amountLabel}>SELECTED AMOUNT</Text>
                <View style={styles.amountRow}>
                  <Text style={styles.amountPrefix}>{'\u20B9'}</Text>
                  <Text style={styles.amountBig}>{amount || '0'}</Text>
                </View>
              </View>

              {/* Category chips */}
              <Text style={styles.chipSectionLabel}>Select Category / {'\u0BB5\u0B95\u0BC8'}</Text>
              <View style={styles.chipRow}>
                {CATEGORIES.map((c) => {
                  const active = category === c.value;
                  return (
                    <Pressable
                      key={c.value}
                      onPress={() => setCategory(c.value)}
                      style={[styles.catChip, active ? styles.catChipActive : styles.catChipInactive]}
                    >
                      {c.emoji ? <Text>{c.emoji}</Text> : null}
                      <Text style={[styles.catChipLabel, active && { color: EL.white }]}>{c.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Quick amount chips */}
              <Text style={styles.chipSectionLabel}>Quick Add / {'\u0BB5\u0BBF\u0BB0\u0BC8\u0BB5\u0BC1 \u0B9A\u0BC7\u0BB0\u0BCD'}</Text>
              <View style={styles.quickGrid}>
                {QUICK_AMOUNTS.map((v) => {
                  const active = Number(amount) === v;
                  return (
                    <Pressable
                      key={v}
                      onPress={() => setAmount(String(v))}
                      style={[styles.quickChip, active && styles.quickChipActive]}
                    >
                      <Text style={[styles.quickChipText, active && { color: EL.primary }]}>{'\u20B9'}{v}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Number Pad + Save */}
              <NumberPad
                value={amount}
                onChange={setAmount}
                onConfirm={handleAdd}
                confirmLabel={`Save Expense ${amount ? '\u20B9' + amount : ''}`}
                disabled={addMut.isPending}
              />

              <GradientButton
                title={t('common.cancel')}
                variant="secondary"
                onPress={() => setShowModal(false)}
                style={{ marginTop: Space.md }}
              />
            </View>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: Space.xl, paddingTop: Space.lg, paddingBottom: Space.md },
  title: { ...Type.displayMd },

  // Log card (list item)
  logCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: EL.surfaceCard,
    padding: Space.lg,
    borderRadius: Radii.md,
    ...Shadows.card,
  },
  logLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.lg,
  },
  logIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: EL.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: EL.onSurface,
  },
  logSub: {
    fontSize: 10,
    color: EL.onSurfaceSec,
    marginTop: 1,
  },
  logAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: EL.onSurface,
  },

  emptyCard: {
    margin: Space.xl,
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.lg,
    padding: Space.xl,
    ...Shadows.card,
  },

  // Modal
  modalBackdrop: { flex: 1, justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: EL.surfaceCard,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    ...Shadows.float,
  },
  handle: {
    width: 48,
    height: 6,
    backgroundColor: 'rgba(188,202,192,0.3)',
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: Space.lg,
  },
  sheetContent: {
    paddingHorizontal: Space.xl,
    paddingBottom: Space.xxxl,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Space.xl,
    marginBottom: Space.xl,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: EL.onSurface,
  },
  closeBtn: {
    backgroundColor: EL.surfaceHighest,
    padding: 6,
    borderRadius: Radii.pill,
  },

  // Amount display
  amountDisplay: {
    backgroundColor: EL.surfaceLow,
    borderRadius: Radii.lg,
    padding: Space.xxl,
    alignItems: 'center',
    marginBottom: Space.xxl,
  },
  amountLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: EL.primary,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: Space.sm,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xs,
  },
  amountPrefix: {
    fontSize: 24,
    fontWeight: '700',
    color: 'rgba(19,30,25,0.4)',
  },
  amountBig: {
    fontSize: 48,
    fontWeight: '800',
    color: EL.onSurface,
    letterSpacing: -2,
  },

  // Category chips
  chipSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: EL.onSurfaceSec,
    marginBottom: Space.md,
    paddingHorizontal: 4,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space.sm,
    marginBottom: Space.xxl,
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.md,
    borderRadius: Radii.pill,
  },
  catChipActive: {
    backgroundColor: EL.primary,
    ...Shadows.float,
  },
  catChipInactive: {
    backgroundColor: EL.surfaceHigh,
  },
  catChipLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: EL.onSurface,
  },

  // Quick amounts
  quickGrid: {
    flexDirection: 'row',
    gap: Space.md,
    marginBottom: Space.xxl,
  },
  quickChip: {
    flex: 1,
    paddingVertical: Space.md,
    borderWidth: 2,
    borderColor: 'rgba(188,202,192,0.2)',
    borderRadius: Radii.md,
    alignItems: 'center',
  },
  quickChipActive: {
    borderColor: EL.primary,
    backgroundColor: 'rgba(0,105,72,0.05)',
  },
  quickChipText: {
    fontSize: 14,
    fontWeight: '700',
    color: EL.onSurface,
  },
});
