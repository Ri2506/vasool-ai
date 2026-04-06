import React, { useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Colors } from '@/constants/colors';
import { Radius, Spacing, TouchTarget, Typography } from '@/constants/typography';
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
    <Card style={styles.row}>
      <View style={styles.rowHeader}>
        <Text style={styles.rowAmount}>{formatRupees(item.amount)}</Text>
        <Text style={styles.rowDate}>{formatDateShort(new Date(item.date))}</Text>
      </View>
      {item.source ? <Text style={styles.rowSub}>{item.source}</Text> : null}
      {item.notes ? <Text style={styles.rowSub}>{item.notes}</Text> : null}
    </Card>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Capital invested</Text>
        <Text style={styles.total}>{formatRupees(totalInvested ?? 0)}</Text>
      </View>

      {investments && investments.length > 0 ? (
        <FlatList
          data={investments}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: Spacing.xl, paddingBottom: 120 }}
        />
      ) : (
        <Card style={{ margin: Spacing.xl }}>
          <Text style={styles.empty}>No investments recorded yet</Text>
        </Card>
      )}

      <View style={styles.fab}>
        <Button title="+ Add investment" onPress={() => setShowModal(true)} />
      </View>

      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Add investment</Text>
            <Text style={styles.label}>Amount</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={(v) => setAmount(v.replace(/\D/g, ''))}
              keyboardType="number-pad"
              placeholder="₹"
              placeholderTextColor={Colors.textMuted}
            />
            <Text style={styles.label}>Source (optional)</Text>
            <TextInput
              style={styles.input}
              value={source}
              onChangeText={setSource}
              placeholder="Own funds, bank loan, etc."
              placeholderTextColor={Colors.textMuted}
            />
            <Text style={styles.label}>Notes (optional)</Text>
            <TextInput
              style={[styles.input, { minHeight: 60 }]}
              value={notes}
              onChangeText={setNotes}
              multiline
              placeholderTextColor={Colors.textMuted}
            />
            <View style={styles.btnRow}>
              <Button title="Cancel" variant="secondary" onPress={() => setShowModal(false)} style={{ flex: 1, marginRight: 8 }} />
              <Button title="Save" onPress={handleAdd} loading={addMut.isPending} style={{ flex: 1, marginLeft: 8 }} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: { padding: Spacing.xl },
  title: { ...Typography.display, color: Colors.text },
  total: { ...Typography.display, color: Colors.primary, fontSize: 32, marginTop: Spacing.sm },
  row: { marginBottom: Spacing.md },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowAmount: { ...Typography.title, color: Colors.text },
  rowDate: { ...Typography.caption, color: Colors.textSec },
  rowSub: { ...Typography.caption, color: Colors.textSec, marginTop: 4 },
  empty: { ...Typography.body, color: Colors.textSec },
  fab: { position: 'absolute', left: Spacing.xl, right: Spacing.xl, bottom: Spacing.xl },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.xl, paddingBottom: Spacing.xxl },
  sheetTitle: { ...Typography.display, color: Colors.text, marginBottom: Spacing.lg },
  label: { ...Typography.caption, color: Colors.textSec, marginBottom: Spacing.sm, marginTop: Spacing.md },
  input: {
    backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.button, paddingHorizontal: Spacing.md, minHeight: TouchTarget.min,
    ...Typography.body, color: Colors.text,
  },
  btnRow: { flexDirection: 'row', marginTop: Spacing.xl },
});
