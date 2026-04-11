import React, { useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { GradientButton } from '@/components/common/GradientButton';
import { EL, Common, Glass, Radii, Shadows, Space, Touch, Type } from '@/theme/emeraldLedger';
import { createInvestment, listInvestments, getTotalInvested } from '@/db/repos/investments';
import type { InvestmentRow } from '@/db/types';
import { useAuthStore } from '@/store/authStore';
import { formatDateShort, formatRupees } from '@/utils/format';

export function InvestmentScreen() {
  const orgId = useAuthStore((s) => s.user?.orgId ?? null);
  const qc = useQueryClient();

  const { data: investments } = useQuery({
    queryKey: ['investments', orgId],
    enabled: !!orgId,
    queryFn: () => listInvestments(orgId!),
  });

  const { data: totalInvested } = useQuery({
    queryKey: ['investments-total', orgId],
    enabled: !!orgId,
    queryFn: () => getTotalInvested(orgId!),
  });

  const addMut = useMutation({
    mutationFn: (input: { amount: number; source: string; notes: string }) =>
      createInvestment({ orgId: orgId!, ...input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['investments', orgId] });
      qc.invalidateQueries({ queryKey: ['investments-total', orgId] });
    },
  });

  const [showModal, setShowModal] = useState(false);
  const [amount, setAmount] = useState('');
  const [source, setSource] = useState('');
  const [notes, setNotes] = useState('');

  const handleAdd = async () => {
    const n = Number(amount);
    if (n <= 0) return;
    try {
      await addMut.mutateAsync({ amount: n, source, notes });
      setAmount('');
      setSource('');
      setNotes('');
      setShowModal(false);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? '');
    }
  };

  const renderItem = ({ item }: { item: InvestmentRow }) => (
    <View style={styles.txCard}>
      <View style={styles.txLeft}>
        <View style={styles.txIcon}>
          <MaterialCommunityIcons
            name={item.source?.toLowerCase().includes('bank') ? 'bank' : item.source?.toLowerCase().includes('personal') ? 'account' : 'handshake'}
            size={24}
            color={EL.primary}
          />
        </View>
        <View>
          <Text style={styles.txTitle}>{item.source || 'Investment'}</Text>
          <Text style={styles.txSub}>{item.notes || 'Capital contribution'}</Text>
        </View>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.txAmount}>{formatRupees(item.amount)}</Text>
        <Text style={styles.txDate}>{formatDateShort(new Date(item.date))}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={Common.screen}>
      {/* Hero Section */}
      <View style={styles.heroCard}>
        <Text style={styles.heroLabel}>CURRENT ALLOCATION</Text>
        <Text style={styles.heroTitle}>Capital Invested</Text>
        <Text style={styles.heroAmount}>{formatRupees(totalInvested ?? 0)}</Text>
        <Text style={styles.heroSub}>Total Portfolio</Text>

        {/* Growth Stats */}
        <View style={styles.heroStats}>
          <View style={styles.heroStatCard}>
            <Text style={styles.heroStatLabel}>Entries</Text>
            <Text style={styles.heroStatValue}>{investments?.length ?? 0}</Text>
          </View>
          <View style={styles.heroStatCard}>
            <Text style={styles.heroStatLabel}>Avg Size</Text>
            <Text style={styles.heroStatValue}>
              {investments && investments.length > 0
                ? formatRupees(Math.round((totalInvested ?? 0) / investments.length))
                : '\u20B90'}
            </Text>
          </View>
        </View>
      </View>

      {/* Transaction History Header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Transaction History</Text>
      </View>

      {investments && investments.length > 0 ? (
        <FlatList
          data={investments}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: Space.xl, paddingBottom: 120, gap: Space.md }}
        />
      ) : (
        <View style={styles.emptyCard}>
          <Text style={Type.bodySm}>No investments recorded yet</Text>
        </View>
      )}

      {/* FAB */}
      <Pressable style={styles.fab} onPress={() => setShowModal(true)}>
        <MaterialCommunityIcons name="plus" size={28} color={EL.white} />
      </Pressable>

      {/* Add Modal */}
      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <Pressable style={[Glass.dark, styles.backdrop]} onPress={() => setShowModal(false)}>
          <View style={[Glass.container, styles.sheet]}>
            <Text style={styles.sheetTitle}>Add investment</Text>

            <Text style={styles.label}>Amount</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={(v) => setAmount(v.replace(/\D/g, ''))}
              keyboardType="number-pad"
              placeholder={'\u20B9'}
              placeholderTextColor={EL.onSurfaceMuted}
            />

            <Text style={styles.label}>Source (optional)</Text>
            <TextInput
              style={styles.input}
              value={source}
              onChangeText={setSource}
              placeholder="Own funds, bank loan, etc."
              placeholderTextColor={EL.onSurfaceMuted}
            />

            <Text style={styles.label}>Notes (optional)</Text>
            <TextInput
              style={[styles.input, { minHeight: 60, textAlignVertical: 'top', paddingTop: Space.md }]}
              value={notes}
              onChangeText={setNotes}
              multiline
              placeholderTextColor={EL.onSurfaceMuted}
            />

            <View style={styles.btnRow}>
              <GradientButton title="Cancel" variant="secondary" onPress={() => setShowModal(false)} style={{ flex: 1, marginRight: Space.sm }} />
              <GradientButton title="Save" onPress={handleAdd} loading={addMut.isPending} style={{ flex: 1, marginLeft: Space.sm }} />
            </View>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Hero
  heroCard: {
    margin: Space.xxl,
    backgroundColor: EL.surfaceCard,
    borderRadius: 32,
    padding: Space.xxl,
    ...Shadows.card,
  },
  heroLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: EL.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroTitle: {
    ...Type.displayLg,
    fontWeight: '800',
    marginTop: Space.sm,
  },
  heroAmount: {
    fontSize: 42,
    fontWeight: '800',
    color: EL.primary,
    letterSpacing: -1.5,
    marginTop: Space.sm,
  },
  heroSub: {
    fontSize: 14,
    color: 'rgba(0,105,72,0.6)',
    fontWeight: '500',
  },
  heroStats: {
    flexDirection: 'row',
    gap: Space.md,
    marginTop: Space.xxl,
  },
  heroStatCard: {
    flex: 1,
    backgroundColor: EL.surfaceLow,
    padding: Space.lg,
    borderRadius: Radii.lg,
  },
  heroStatLabel: {
    fontSize: 12,
    color: EL.outline,
    fontWeight: '600',
  },
  heroStatValue: {
    fontSize: 20,
    fontWeight: '700',
    color: EL.primary,
    marginTop: 2,
  },

  // Section
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Space.xl,
    marginBottom: Space.md,
  },
  sectionTitle: {
    ...Type.displaySm,
    fontSize: 22,
    fontWeight: '700',
  },

  // Transaction card
  txCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: EL.surfaceCard,
    padding: Space.xl,
    borderRadius: Radii.lg,
    ...Shadows.card,
  },
  txLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.lg,
  },
  txIcon: {
    width: 48,
    height: 48,
    borderRadius: Radii.md,
    backgroundColor: 'rgba(0,133,93,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  txTitle: {
    ...Type.titleMd,
    fontWeight: '700',
    fontSize: 16,
  },
  txSub: {
    fontSize: 14,
    color: EL.outline,
    marginTop: 2,
  },
  txAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: EL.onSurface,
  },
  txDate: {
    fontSize: 12,
    color: EL.outline,
    marginTop: 2,
  },

  // Empty
  emptyCard: {
    margin: Space.xl,
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.lg,
    padding: Space.xl,
    ...Shadows.card,
  },

  // FAB
  fab: {
    position: 'absolute',
    right: Space.xxl,
    bottom: Space.xxl + 60,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: EL.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.float,
  },

  // Sheet
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: Radii.xl + 4,
    borderTopRightRadius: Radii.xl + 4,
    padding: Space.xl,
    paddingBottom: Space.xxxl,
  },
  sheetTitle: { ...Type.displaySm, marginBottom: Space.lg },
  label: { ...Type.labelMd, color: EL.onSurfaceSec, marginBottom: Space.sm, marginTop: Space.lg },
  input: {
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.sm + 2,
    paddingHorizontal: Space.lg,
    minHeight: Touch.min,
    ...Type.bodyMd,
    color: EL.onSurface,
    ...Shadows.card,
  },
  btnRow: { flexDirection: 'row', marginTop: Space.xl },
});
