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

import { ELCard } from '@/components/common/ELCard';
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
    <ELCard style={styles.row}>
      <View style={styles.rowHeader}>
        <Text style={styles.rowAmount}>{formatRupees(item.amount)}</Text>
        <Text style={styles.rowDate}>{formatDateShort(new Date(item.date))}</Text>
      </View>
      {item.source ? <Text style={styles.rowSub}>{item.source}</Text> : null}
      {item.notes ? <Text style={styles.rowSub}>{item.notes}</Text> : null}
    </ELCard>
  );

  return (
    <SafeAreaView style={Common.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Capital invested</Text>
        <Text style={styles.total}>{formatRupees(totalInvested ?? 0)}</Text>
      </View>

      {investments && investments.length > 0 ? (
        <FlatList
          data={investments}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: Space.xl, paddingBottom: 120 }}
        />
      ) : (
        <ELCard style={{ margin: Space.xl }}>
          <Text style={Type.bodySm}>No investments recorded yet</Text>
        </ELCard>
      )}

      {/* FAB */}
      <Pressable style={Common.fab} onPress={() => setShowModal(true)}>
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
              placeholder="\u20B9"
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
  header: { padding: Space.xl },
  title: { ...Type.displaySm },
  total: { ...Type.displayLg, color: EL.primary, marginTop: Space.sm },
  row: { marginBottom: Space.md },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowAmount: { ...Type.titleMd, fontWeight: '700' },
  rowDate: { ...Type.labelSm, color: EL.onSurfaceMuted },
  rowSub: { ...Type.bodySm, color: EL.onSurfaceSec, marginTop: Space.xs },

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
