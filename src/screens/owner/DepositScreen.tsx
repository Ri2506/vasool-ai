import React, { useState } from 'react';
import {
  Alert, FlatList, Modal, SafeAreaView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { ELCard } from '@/components/common/ELCard';
import { GradientButton } from '@/components/common/GradientButton';
import { EL, Common, Glass, Radii, Space, Touch, Type } from '@/theme/emeraldLedger';
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
    await addMut.mutateAsync({ depositorName: name, depositorPhone: phone, amount: Number(amount), interestRate: Number(rate) || 0 });
    setName(''); setPhone(''); setAmount(''); setRate(''); setShow(false);
  };

  const renderItem = ({ item }: { item: DepositRow }) => (
    <ELCard style={styles.depositCard}>
      <View style={styles.depositRow}>
        <View style={{ flex: 1 }}>
          <Text style={Type.titleMd}>{item.depositor_name}</Text>
          {item.depositor_phone ? <Text style={Type.bodySm}>{item.depositor_phone}</Text> : null}
          <Text style={[Type.labelSm, { marginTop: Space.xs }]}>
            {item.interest_rate}% • {formatDateShort(new Date(item.start_date))}
          </Text>
        </View>
        <Text style={styles.depositAmount}>{formatRupees(item.amount)}</Text>
      </View>
    </ELCard>
  );

  return (
    <SafeAreaView style={Common.screen}>
      <View style={styles.header}>
        <Text style={Type.labelMd}>TOTAL DEPOSITS</Text>
        <Text style={styles.totalAmount}>{formatRupees(total ?? 0)}</Text>
        <Text style={Type.bodySm}>{deposits?.length ?? 0} depositors • {deposits?.[0]?.interest_rate ?? 0}% avg</Text>
      </View>

      <FlatList
        data={deposits ?? []}
        keyExtractor={(d) => d.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: Space.xl, paddingBottom: 120 }}
        ListHeaderComponent={<Text style={[Type.titleMd, { marginBottom: Space.lg }]}>Deposits</Text>}
      />

      <View style={Common.fab}>
        <MaterialCommunityIcons name="plus" size={28} color={EL.white} onPress={() => setShow(true)} />
      </View>

      <Modal visible={show} transparent animationType="slide" onRequestClose={() => setShow(false)}>
        <View style={[Glass.dark, { flex: 1, justifyContent: 'flex-end' }]}>
          <View style={[Glass.container, styles.sheet]}>
            <Text style={Type.displaySm}>Add Deposit</Text>
            <Input label="Depositor Name" value={name} onChange={setName} />
            <Input label="Phone" value={phone} onChange={(v) => setPhone(v.replace(/\D/g, '').slice(0, 10))} keyboard="number-pad" />
            <Input label="Amount (₹)" value={amount} onChange={(v) => setAmount(v.replace(/\D/g, ''))} keyboard="number-pad" />
            <Input label="Interest Rate (%)" value={rate} onChange={(v) => setRate(v.replace(/[^\d.]/g, ''))} keyboard="number-pad" />
            <View style={styles.btnRow}>
              <GradientButton title="Cancel" variant="secondary" onPress={() => setShow(false)} style={{ flex: 1, marginRight: Space.sm }} />
              <GradientButton title="Save Deposit" onPress={handleAdd} loading={addMut.isPending} style={{ flex: 1, marginLeft: Space.sm }} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Input({ label, value, onChange, keyboard }: { label: string; value: string; onChange: (v: string) => void; keyboard?: 'number-pad' }) {
  return (
    <View style={{ marginTop: Space.lg }}>
      <Text style={Type.labelMd}>{label}</Text>
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
  header: { alignItems: 'center', padding: Space.xl, paddingTop: Space.xxxl },
  totalAmount: { ...Type.displayLg, color: EL.onSurface, marginTop: Space.xs },
  depositCard: { marginBottom: Space.lg },
  depositRow: { flexDirection: 'row', alignItems: 'center' },
  depositAmount: { ...Type.displaySm, color: EL.onSurface },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Space.xl, paddingBottom: Space.xxxl },
  input: {
    backgroundColor: EL.surfaceLow, borderRadius: Radii.sm,
    paddingHorizontal: Space.lg, minHeight: Touch.min,
    ...Type.bodyMd, color: EL.onSurface, marginTop: Space.xs,
  },
  btnRow: { flexDirection: 'row', marginTop: Space.xxl },
});
