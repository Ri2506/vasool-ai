import React, { useState } from 'react';
import {
  Alert, FlatList, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { GradientButton } from '@/components/common/GradientButton';
import { EL, Common, Glass, Radii, Shadows, Space, Touch, Type } from '@/theme/emeraldLedger';
import { createDeposit, listDeposits, getTotalDeposits } from '@/db/repos/deposits';
import type { DepositRow } from '@/db/types';
import { useAuthStore } from '@/store/authStore';
import { formatDateShort, formatRupees } from '@/utils/format';

export function DepositScreen() {
  const orgId = useAuthStore((s) => s.user?.orgId ?? null);
  const qc = useQueryClient();

  const { data: deposits } = useQuery({
    queryKey: ['deposits', orgId], enabled: !!orgId,
    queryFn: () => listDeposits(orgId!),
  });
  const { data: total } = useQuery({
    queryKey: ['deposits-total', orgId], enabled: !!orgId,
    queryFn: () => getTotalDeposits(orgId!),
  });

  const addMut = useMutation({
    mutationFn: (input: { depositorName: string; depositorPhone: string; amount: number; interestRate: number }) =>
      createDeposit({ orgId: orgId!, ...input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deposits', orgId] });
      qc.invalidateQueries({ queryKey: ['deposits-total', orgId] });
    },
  });

  const [show, setShow] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [rate, setRate] = useState('');

  const handleAdd = async () => {
    if (!name.trim() || !amount) return;
    try {
      await addMut.mutateAsync({ depositorName: name, depositorPhone: phone, amount: Number(amount), interestRate: Number(rate) || 0 });
      setName(''); setPhone(''); setAmount(''); setRate(''); setShow(false);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to save deposit');
    }
  };

  // Compute average rate
  const avgRate = deposits && deposits.length > 0
    ? (deposits.reduce((s, d) => s + (d.interest_rate ?? 0), 0) / deposits.length).toFixed(2)
    : '0';

  const renderItem = ({ item }: { item: DepositRow }) => {
    const isOverdue = false; // Could check maturity date logic
    return (
      <View style={styles.depositCard}>
        {/* Header row */}
        <View style={styles.depositHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.depositName}>{item.depositor_name}</Text>
            <View style={styles.statusBadge}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Active</Text>
            </View>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.depositAmountLabel}>Principal Amount</Text>
            <Text style={styles.depositAmount}>{formatRupees(item.amount)}</Text>
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>INTEREST RATE</Text>
            <Text style={styles.statValue}>
              {item.interest_rate}% <Text style={styles.statUnit}>/ month</Text>
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>START DATE</Text>
            <Text style={styles.statValue}>{formatDateShort(new Date(item.start_date))}</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.depositFooter}>
          {item.depositor_phone ? (
            <View style={styles.footerLeft}>
              <MaterialCommunityIcons name="clock-outline" size={14} color={EL.outline} />
              <Text style={styles.footerText}>{item.depositor_phone}</Text>
            </View>
          ) : (
            <View />
          )}
          <Pressable
            style={styles.historyBtn}
            onPress={() => Alert.alert(
              item.depositor_name,
              `Amount: ${formatRupees(item.amount)}\nInterest rate: ${item.interest_rate ?? 0}%\nDate: ${new Date(item.created_at).toLocaleDateString('en-IN')}${item.depositor_phone ? '\nPhone: ' + item.depositor_phone : ''}`
            )}
          >
            <Text style={styles.historyBtnText}>Details</Text>
            <MaterialCommunityIcons name="chevron-right" size={14} color={EL.primary} />
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={Common.screen}>
      {/* Hero Summary Card */}
      <View style={styles.heroCard}>
        <Text style={styles.heroLabel}>Total Managed Funds</Text>
        <Text style={styles.heroAmount}>{formatRupees(total ?? 0)}</Text>
        <View style={styles.heroStats}>
          <View style={styles.heroStatPill}>
            <Text style={styles.heroStatLabel}>ACTIVE DEPOSITS</Text>
            <Text style={styles.heroStatValue}>{deposits?.length ?? 0} Ledger Entries</Text>
          </View>
          <View style={styles.heroStatPill}>
            <Text style={styles.heroStatLabel}>AVG RATE</Text>
            <Text style={styles.heroStatValue}>{avgRate}% / mo</Text>
          </View>
        </View>
      </View>

      {/* Search & Section header */}
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Deposits</Text>
          <Text style={styles.sectionSub}>Managing current capital inflows and maturity schedules.</Text>
        </View>
      </View>

      <FlatList
        data={deposits ?? []}
        keyExtractor={(d) => d.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: Space.xl, paddingBottom: 120 }}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <MaterialCommunityIcons name="file-plus-outline" size={24} color={EL.primary} />
            </View>
            <Text style={styles.emptyTitle}>Manage more assets</Text>
            <Text style={styles.emptySub}>Quickly add private lenders or capital deposits to your ledger.</Text>
          </View>
        }
      />

      {/* FAB */}
      <Pressable style={styles.fab} onPress={() => setShow(true)}>
        <MaterialCommunityIcons name="plus" size={28} color={EL.white} />
      </Pressable>

      {/* Add Modal */}
      <Modal visible={show} transparent animationType="slide" onRequestClose={() => setShow(false)}>
        <Pressable style={[Glass.dark, { flex: 1, justifyContent: 'flex-end' }]} onPress={() => setShow(false)}>
          <View style={[Glass.container, styles.sheet]}>
            <Text style={styles.sheetTitle}>Add Deposit</Text>
            <Input label="Depositor Name" value={name} onChange={setName} />
            <Input label="Phone" value={phone} onChange={(v) => setPhone(v.replace(/\D/g, '').slice(0, 10))} keyboard="number-pad" />
            <Input label="Amount (\u20B9)" value={amount} onChange={(v) => setAmount(v.replace(/\D/g, ''))} keyboard="number-pad" />
            <Input label="Interest Rate (%)" value={rate} onChange={(v) => setRate(v.replace(/[^\d.]/g, ''))} keyboard="number-pad" />
            <View style={styles.btnRow}>
              <GradientButton title="Cancel" variant="secondary" onPress={() => setShow(false)} style={{ flex: 1, marginRight: Space.sm }} />
              <GradientButton title="Save Deposit" onPress={handleAdd} loading={addMut.isPending} style={{ flex: 1, marginLeft: Space.sm }} />
            </View>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function Input({ label, value, onChange, keyboard }: { label: string; value: string; onChange: (v: string) => void; keyboard?: 'number-pad' }) {
  return (
    <View style={{ marginTop: Space.lg }}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        keyboardType={keyboard}
        placeholderTextColor={EL.onSurfaceMuted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Hero
  heroCard: {
    margin: Space.xxl,
    marginTop: Space.xxl,
    backgroundColor: EL.surfaceLow,
    borderRadius: Radii.xxl,
    padding: Space.xxxl,
  },
  heroLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: EL.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Space.sm,
  },
  heroAmount: {
    ...Type.displayLg,
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: -1.5,
  },
  heroStats: {
    flexDirection: 'row',
    gap: Space.md,
    marginTop: Space.xl,
  },
  heroStatPill: {
    backgroundColor: 'rgba(217, 230, 221, 0.5)',
    paddingHorizontal: Space.lg,
    paddingVertical: Space.sm,
    borderRadius: Radii.md,
  },
  heroStatLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: EL.secondary,
    textTransform: 'uppercase',
  },
  heroStatValue: {
    fontSize: 16,
    fontWeight: '700',
    color: EL.primary,
    marginTop: 2,
  },

  // Section
  sectionHeader: {
    paddingHorizontal: Space.xl,
    marginBottom: Space.lg,
  },
  sectionTitle: {
    ...Type.displaySm,
  },
  sectionSub: {
    ...Type.bodySm,
    color: EL.outline,
    marginTop: 2,
  },

  // Deposit card
  depositCard: {
    backgroundColor: EL.surfaceCard,
    borderRadius: 32,
    padding: Space.xl,
    marginBottom: Space.xl,
    minHeight: 220,
    ...Shadows.card,
  },
  depositHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  depositName: {
    ...Type.titleLg,
    fontWeight: '700',
    fontSize: 20,
    marginBottom: Space.xs,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: EL.primaryFixed,
    paddingHorizontal: Space.md,
    paddingVertical: Space.xs,
    borderRadius: Radii.pill,
    alignSelf: 'flex-start',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: EL.primary,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    color: EL.onSurface,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  depositAmountLabel: {
    fontSize: 12,
    color: EL.outline,
    fontWeight: '500',
  },
  depositAmount: {
    fontSize: 22,
    fontWeight: '800',
    color: EL.primary,
    letterSpacing: -0.5,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: Space.md,
    marginTop: Space.xxl,
  },
  statCard: {
    flex: 1,
    backgroundColor: EL.surfaceLow,
    padding: Space.md,
    borderRadius: Radii.lg,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: EL.outline,
    textTransform: 'uppercase',
    marginBottom: Space.xs,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: EL.onSurfaceSec,
  },
  statUnit: {
    fontSize: 10,
    fontWeight: '400',
    color: EL.outline,
  },

  // Footer
  depositFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Space.lg,
    paddingTop: Space.lg,
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
  },
  footerText: {
    fontSize: 12,
    fontWeight: '600',
    color: EL.outline,
  },
  historyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xs,
  },
  historyBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: EL.primary,
  },

  // Empty
  emptyCard: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(188, 202, 192, 0.3)',
    borderRadius: 32,
    padding: Space.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 220,
    opacity: 0.6,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: EL.surfaceHighest,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Space.lg,
  },
  emptyTitle: { ...Type.titleMd, fontWeight: '700' },
  emptySub: { ...Type.bodySm, color: EL.outline, marginTop: Space.xs, textAlign: 'center', paddingHorizontal: Space.xxxl },

  // FAB
  fab: {
    position: 'absolute',
    right: Space.xxl,
    bottom: Space.xxl + 80,
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: EL.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.float,
  },

  // Sheet
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Space.xl,
    paddingBottom: Space.xxxl,
  },
  sheetTitle: { ...Type.displaySm, marginBottom: Space.sm },
  inputLabel: { ...Type.labelMd, marginBottom: Space.xs },
  input: {
    backgroundColor: EL.surfaceLow,
    borderRadius: Radii.sm,
    paddingHorizontal: Space.lg,
    minHeight: Touch.min,
    ...Type.bodyMd,
    color: EL.onSurface,
    marginTop: Space.xs,
  },
  btnRow: { flexDirection: 'row', marginTop: Space.xxl },
});
