import React, { useState } from 'react';
import {
  Alert,
  Keyboard,
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
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { EL, Common, Radii, Shadows, Space, Fonts } from '@/theme/emeraldLedger';
import { createExpense, getTodayExpenseTotal, listExpenses } from '@/db/repos/expenses';
import { getTodaySummary } from '@/db/repos/collections';
import type { ExpenseCategory, ExpenseRow } from '@/db/types';
import { useAuthStore } from '@/store/authStore';
import { formatRupees } from '@/utils/format';

const CATEGORY_ICON: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  petrol: 'gas-station',
  food: 'silverware-fork-knife',
  travel: 'car',
  phone: 'cellphone',
  other: 'cash',
};

const CATEGORIES: { value: ExpenseCategory; label: string; emoji: string }[] = [
  { value: 'petrol', label: 'Petrol', emoji: '\u26FD' },
  { value: 'food', label: 'Food', emoji: '\uD83C\uDF5B' },
  { value: 'travel', label: 'Travel', emoji: '\uD83D\uDE97' },
  { value: 'phone', label: 'Phone', emoji: '\uD83D\uDCF1' },
  { value: 'other', label: 'Other', emoji: '' },
];

const QUICK_AMOUNTS = [50, 100, 200, 500];

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

  const { data: collectionSummary } = useQuery({
    queryKey: ['agentCollSummary', orgId],
    enabled: !!orgId,
    queryFn: () => getTodaySummary(orgId!),
  });

  const { data: recentExpenses } = useQuery({
    queryKey: ['agentRecentExpenses', orgId],
    enabled: !!orgId,
    queryFn: () => listExpenses(orgId!),
  });

  const addMut = useMutation({
    mutationFn: (input: { category: ExpenseCategory; amount: number }) =>
      createExpense({ orgId: orgId!, userId, ...input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agentExpenseTotal', orgId] });
      qc.invalidateQueries({ queryKey: ['agentExpTotal', orgId] });
      qc.invalidateQueries({ queryKey: ['agentRecentExpenses', orgId] });
    },
  });

  const [category, setCategory] = useState<ExpenseCategory>('petrol');
  const [amount, setAmount] = useState('200');
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

  const numericAmount = Number(amount) || 0;

  return (
    <SafeAreaView style={Common.screen}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Dashboard Summary */}
        <View style={styles.dashGrid}>
          <View style={styles.dashMainCard}>
            <Text style={styles.dashMainLabel}>Today's Collections</Text>
            <Text style={styles.dashMainValue}>{formatRupees(collectionSummary?.totalCollected ?? 0)}</Text>
            <View style={styles.dashMainRow}>
              <View style={styles.schedulePill}>
                <Text style={styles.schedulePillText}>On Schedule / {'\u0BA8\u0B9F\u0BAA\u0BCD\u0BAA\u0BC1'}</Text>
              </View>
              <Text style={styles.pendingText}>{collectionSummary?.dueCount ?? 0}/{(collectionSummary?.dueCount ?? 0) + (collectionSummary?.collectionCount ?? 0)} Pending</Text>
            </View>
          </View>
          <View style={styles.dashSmallRow}>
            <View style={styles.dashSmallCard}>
              <Text style={styles.dashSmallLabel}>TOTAL EXPENSES</Text>
              <Text style={styles.dashSmallValue}>{formatRupees(todayTotal ?? 0)}</Text>
            </View>
            <View style={styles.dashSmallCard}>
              <Text style={styles.dashSmallLabel}>COLLECTED</Text>
              <Text style={styles.dashSmallValue}>{collectionSummary?.collectionCount ?? 0}</Text>
            </View>
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.recentSection}>
          <View style={styles.recentHeader}>
            <Text style={styles.recentTitle}>Recent Logs</Text>
            <Text style={styles.viewAllText}>View All</Text>
          </View>
          {(recentExpenses ?? []).slice(0, 5).map((exp: ExpenseRow) => (
            <View key={exp.id} style={styles.recentItem}>
              <View style={styles.recentItemLeft}>
                <View style={styles.recentIcon}>
                  <MaterialCommunityIcons name={CATEGORY_ICON[exp.category] ?? 'cash'} size={20} color={EL.primary} />
                </View>
                <View>
                  <Text style={styles.recentItemTitle}>{exp.category}</Text>
                  <Text style={styles.recentItemSub}>{new Date(exp.date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</Text>
                </View>
              </View>
              <Text style={styles.recentItemAmount}>{formatRupees(exp.amount)}</Text>
            </View>
          ))}
          {(!recentExpenses || recentExpenses.length === 0) && (
            <Text style={{ fontSize: 13, color: EL.onSurfaceMuted, padding: Space.lg }}>No expenses logged yet</Text>
          )}
        </View>

        {/* Expense Entry — inline (was absolute bottom sheet; moved in so keyboard doesn't cover it) */}
        <View style={styles.entryCard}>
          <View style={styles.sheetHeaderRow}>
            <Text style={styles.sheetTitle}>Log Expense</Text>
            <Pressable onPress={() => Keyboard.dismiss()} hitSlop={8}>
              <MaterialCommunityIcons name="keyboard-close" size={22} color={EL.onSurfaceMuted} />
            </Pressable>
          </View>

          {/* Amount Input */}
          <View style={styles.amountDisplay}>
            <Text style={styles.amountLabel}>AMOUNT</Text>
            <View style={styles.amountRow}>
              <Text style={styles.amountCurrency}>{'\u20B9'}</Text>
              <TextInput
                style={styles.amountValue}
                value={amount}
                onChangeText={(v) => setAmount(v.replace(/\D/g, '').slice(0, 7))}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor="rgba(19, 30, 25, 0.2)"
                returnKeyType="done"
                onSubmitEditing={() => Keyboard.dismiss()}
              />
            </View>
          </View>

          {saved && (
            <View style={styles.savedBanner}>
              <Text style={styles.savedText}>{'\u2713'} Saved</Text>
            </View>
          )}

          {/* Category Chips */}
          <View style={styles.chipSection}>
            <Text style={styles.chipSectionLabel}>Select Category / {'\u0BB5\u0B95\u0BC8'}</Text>
            <View style={styles.chipRow}>
              {CATEGORIES.map((c) => {
                const active = category === c.value;
                return (
                  <Pressable
                    key={c.value}
                    onPress={() => { Keyboard.dismiss(); setCategory(c.value); }}
                    style={[styles.categoryChip, active ? styles.categoryChipActive : styles.categoryChipInactive]}
                  >
                    {c.emoji ? <Text style={styles.chipEmoji}>{c.emoji}</Text> : null}
                    <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>
                      {c.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Quick Amount Chips */}
          <View style={styles.chipSection}>
            <Text style={styles.chipSectionLabel}>Quick Add / {'\u0BB5\u0BBF\u0BB0\u0BC8\u0BB5\u0BC1'} {'\u0B9A\u0BC7\u0BB0\u0BCD'}</Text>
            <View style={styles.quickAmountGrid}>
              {QUICK_AMOUNTS.map((v) => {
                const active = numericAmount === v;
                return (
                  <Pressable
                    key={v}
                    onPress={() => { Keyboard.dismiss(); setAmount(String(v)); }}
                    style={[styles.quickAmountBtn, active && styles.quickAmountBtnActive]}
                  >
                    <Text style={[styles.quickAmountText, active && styles.quickAmountTextActive]}>
                      {'\u20B9'}{v}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Confirm Button */}
          <Pressable
            style={({ pressed }) => [styles.confirmBtn, pressed && { opacity: 0.95, transform: [{ scale: 0.98 }] }]}
            onPress={() => { Keyboard.dismiss(); handleAdd(); }}
            disabled={addMut.isPending}
          >
            <Text style={styles.confirmBtnText}>
              Save Expense {formatRupees(numericAmount)}
            </Text>
            <MaterialCommunityIcons name="check" size={20} color={EL.white} />
          </Pressable>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: Space.lg,
    paddingTop: Space.lg,
    paddingBottom: Space.xxxl + 40,
  },

  // New inline entry card (replaces the absolute bottom sheet)
  entryCard: {
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.xxl,
    padding: Space.xl,
    marginTop: Space.xl,
    ...Shadows.card,
  },

  // Dashboard
  dashGrid: {
    gap: Space.lg,
    marginBottom: Space.xl,
  },
  dashMainCard: {
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.lg,
    padding: Space.xl,
  },
  dashMainLabel: {
    fontFamily: Fonts.body,
    fontSize: 14,
    fontWeight: '500',
    color: EL.onSurfaceSec,
    marginBottom: Space.xs,
  },
  dashMainValue: {
    fontFamily: Fonts.headline,
    fontSize: 36,
    fontWeight: '800',
    color: EL.primary,
    letterSpacing: -0.5,
  },
  dashMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    marginTop: Space.lg,
  },
  schedulePill: {
    backgroundColor: EL.primaryFixed,
    paddingHorizontal: Space.md,
    paddingVertical: Space.xs,
    borderRadius: Radii.pill,
  },
  schedulePillText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    fontWeight: '700',
    color: EL.onPrimaryFixed,
  },
  pendingText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: EL.onSurfaceSec,
  },
  dashSmallRow: {
    flexDirection: 'row',
    gap: Space.lg,
  },
  dashSmallCard: {
    flex: 1,
    backgroundColor: EL.surfaceLow,
    borderRadius: Radii.lg,
    padding: Space.lg,
  },
  dashSmallLabel: {
    fontFamily: Fonts.body,
    fontSize: 10,
    fontWeight: '700',
    color: EL.onSurfaceSec,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  dashSmallValue: {
    fontFamily: Fonts.headline,
    fontSize: 20,
    fontWeight: '700',
    color: EL.onSurface,
  },

  // Recent
  recentSection: {
    gap: Space.lg,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recentTitle: {
    fontFamily: Fonts.headline,
    fontSize: 15,
    fontWeight: '700',
    color: EL.onSurface,
  },
  viewAllText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    fontWeight: '700',
    color: EL.primary,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.md,
    padding: Space.lg,
  },
  recentItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.lg,
  },
  recentIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: EL.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentItemTitle: {
    fontFamily: Fonts.body,
    fontSize: 14,
    fontWeight: '700',
    color: EL.onSurface,
  },
  recentItemSub: {
    fontFamily: Fonts.body,
    fontSize: 10,
    color: EL.onSurfaceSec,
  },
  recentItemAmount: {
    fontFamily: Fonts.body,
    fontSize: 14,
    fontWeight: '700',
    color: EL.onSurface,
  },

  // Bottom Sheet
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: EL.surfaceCard,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    shadowColor: 'rgba(0, 33, 20, 0.15)',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 1,
    shadowRadius: 30,
    elevation: 10,
  },
  handleRow: {
    alignItems: 'center',
    paddingVertical: Space.lg,
  },
  handle: {
    width: 48,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(188, 202, 192, 0.3)',
  },
  sheetContent: {
    paddingHorizontal: Space.xl,
    paddingBottom: Space.xxxl,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Space.xl,
  },
  sheetTitle: {
    fontFamily: Fonts.headline,
    fontSize: 20,
    fontWeight: '800',
    color: EL.onSurface,
  },

  // Amount display
  amountDisplay: {
    backgroundColor: EL.surfaceLow,
    borderRadius: Radii.lg,
    padding: Space.xxl,
    marginBottom: Space.xl,
    alignItems: 'center',
  },
  amountLabel: {
    fontFamily: Fonts.body,
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
    justifyContent: 'center',
    gap: 2,
  },
  amountCurrency: {
    fontFamily: Fonts.headline,
    fontSize: 24,
    fontWeight: '700',
    color: 'rgba(19, 30, 25, 0.4)',
  },
  amountValue: {
    fontFamily: Fonts.headline,
    fontSize: 56,
    fontWeight: '800',
    color: EL.onSurface,
    letterSpacing: -2,
  },

  // Saved banner
  savedBanner: {
    backgroundColor: EL.primaryFixed,
    padding: Space.md,
    alignItems: 'center',
    borderRadius: Radii.md,
    marginBottom: Space.lg,
  },
  savedText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    fontWeight: '600',
    color: EL.primary,
  },

  // Chips
  chipSection: {
    marginBottom: Space.xl,
  },
  chipSectionLabel: {
    fontFamily: Fonts.body,
    fontSize: 12,
    fontWeight: '700',
    color: EL.onSurfaceSec,
    marginBottom: Space.lg,
    paddingLeft: 2,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space.sm,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.md,
    borderRadius: Radii.pill,
  },
  categoryChipActive: {
    backgroundColor: EL.primary,
    shadowColor: 'rgba(0, 105, 72, 0.2)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 3,
  },
  categoryChipInactive: {
    backgroundColor: EL.surfaceHigh,
  },
  chipEmoji: {
    fontSize: 14,
  },
  categoryChipText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    fontWeight: '700',
    color: EL.onSurface,
  },
  categoryChipTextActive: {
    color: EL.white,
  },

  // Quick amounts
  quickAmountGrid: {
    flexDirection: 'row',
    gap: Space.md,
  },
  quickAmountBtn: {
    flex: 1,
    paddingVertical: Space.md,
    borderRadius: Radii.md,
    borderWidth: 2,
    borderColor: 'rgba(188, 202, 192, 0.2)',
    alignItems: 'center',
  },
  quickAmountBtnActive: {
    borderColor: EL.primary,
    backgroundColor: 'rgba(0, 105, 72, 0.05)',
  },
  quickAmountText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    fontWeight: '700',
    color: EL.onSurface,
  },
  quickAmountTextActive: {
    color: EL.primary,
  },

  // Confirm button
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: EL.primary,
    height: 64,
    borderRadius: Radii.lg,
    gap: Space.sm,
    marginTop: Space.sm,
    shadowColor: 'rgba(0, 105, 72, 0.3)',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 30,
    elevation: 6,
  },
  confirmBtnText: {
    fontFamily: Fonts.headline,
    fontSize: 18,
    fontWeight: '700',
    color: EL.white,
  },
});
