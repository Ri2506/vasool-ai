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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Avatar } from '@/components/common/Avatar';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Colors } from '@/constants/colors';
import { Radius, Spacing, TouchTarget, Typography } from '@/constants/typography';
import {
  createAgent,
  deleteAgent,
  listAgents,
  toggleAgentActive,
  updateAgentPin,
} from '@/db/repos/agents';
import type { UserRow } from '@/db/types';
import { useAuthStore } from '@/store/authStore';

export function AgentManagementScreen() {
  const orgId = useAuthStore((s) => s.user?.orgId ?? null);
  const qc = useQueryClient();

  const { data: agents } = useQuery({
    queryKey: ['agents', orgId],
    enabled: !!orgId,
    queryFn: () => listAgents(orgId!),
  });

  const createMut = useMutation({
    mutationFn: (input: { name: string; phone: string; pin: string }) =>
      createAgent({ orgId: orgId!, ...input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agents', orgId] }),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      toggleAgentActive(id, active),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agents', orgId] }),
  });

  const pinMut = useMutation({
    mutationFn: ({ id, pin }: { id: string; pin: string }) =>
      updateAgentPin(id, pin),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agents', orgId] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteAgent(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agents', orgId] }),
  });

  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');

  const handleAdd = async () => {
    if (!name.trim()) return Alert.alert('Name is required');
    if (!/^\d{10}$/.test(phone)) return Alert.alert('Enter valid 10-digit phone');
    if (!/^\d{4}$/.test(pin)) return Alert.alert('PIN must be 4 digits');
    await createMut.mutateAsync({ name, phone, pin });
    setName('');
    setPhone('');
    setPin('');
    setShowAdd(false);
  };

  const handleChangePin = (agent: UserRow) => {
    Alert.prompt?.('New 4-digit PIN', '', (newPin: string) => {
      if (/^\d{4}$/.test(newPin)) pinMut.mutate({ id: agent.id, pin: newPin });
    }) ?? Alert.alert('Change PIN', 'Use Settings on the agent\'s device');
  };

  const handleDelete = (agent: UserRow) => {
    Alert.alert('Remove agent', `Remove ${agent.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => deleteMut.mutate(agent.id) },
    ]);
  };

  const renderAgent = ({ item }: { item: UserRow }) => (
    <Card style={styles.agentCard}>
      <View style={styles.agentRow}>
        <Avatar name={item.name} />
        <View style={styles.agentBody}>
          <Text style={styles.agentName}>{item.name}</Text>
          <Text style={styles.agentPhone}>{item.phone}</Text>
        </View>
        <Badge
          label={item.is_active ? 'Active' : 'Inactive'}
          variant={item.is_active ? 'success' : 'neutral'}
        />
      </View>
      <View style={styles.agentActions}>
        <Button
          title={item.is_active ? 'Deactivate' : 'Activate'}
          variant="secondary"
          onPress={() => toggleMut.mutate({ id: item.id, active: !item.is_active })}
          style={styles.actionBtn}
        />
        <Button
          title="Change PIN"
          variant="secondary"
          onPress={() => handleChangePin(item)}
          style={styles.actionBtn}
        />
        <Button
          title="Remove"
          variant="danger"
          onPress={() => handleDelete(item)}
          style={styles.actionBtn}
        />
      </View>
    </Card>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Agents</Text>
        <Text style={styles.sub}>Manage your collection agents</Text>
      </View>

      {agents && agents.length > 0 ? (
        <FlatList
          data={agents}
          keyExtractor={(a) => a.id}
          renderItem={renderAgent}
          contentContainerStyle={{ padding: Spacing.xl, paddingBottom: 120 }}
        />
      ) : (
        <Card style={{ margin: Spacing.xl }}>
          <Text style={styles.emptyText}>No agents yet. Add your first agent to delegate collections.</Text>
        </Card>
      )}

      <View style={styles.fab}>
        <Button title="+ Add agent" onPress={() => setShowAdd(true)} />
      </View>

      <Modal visible={showAdd} animationType="slide" transparent onRequestClose={() => setShowAdd(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Add agent</Text>
            <Text style={styles.label}>Name</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholderTextColor={Colors.textMuted} placeholder="Agent name" />
            <Text style={styles.label}>Phone (10 digits)</Text>
            <TextInput style={styles.input} value={phone} onChangeText={(v) => setPhone(v.replace(/\D/g, '').slice(0, 10))} keyboardType="number-pad" placeholderTextColor={Colors.textMuted} placeholder="9876543210" />
            <Text style={styles.label}>4-digit PIN</Text>
            <TextInput style={styles.input} value={pin} onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" secureTextEntry placeholderTextColor={Colors.textMuted} placeholder="••••" />
            <View style={styles.btnRow}>
              <Button title="Cancel" variant="secondary" onPress={() => setShowAdd(false)} style={{ flex: 1, marginRight: 8 }} />
              <Button title="Create" onPress={handleAdd} loading={createMut.isPending} style={{ flex: 1, marginLeft: 8 }} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: { padding: Spacing.xl, paddingBottom: Spacing.md },
  title: { ...Typography.display, color: Colors.text },
  sub: { ...Typography.caption, color: Colors.textSec, marginTop: 2 },
  agentCard: { marginBottom: Spacing.md },
  agentRow: { flexDirection: 'row', alignItems: 'center' },
  agentBody: { flex: 1, marginLeft: Spacing.md },
  agentName: { ...Typography.title, color: Colors.text },
  agentPhone: { ...Typography.caption, color: Colors.textSec },
  agentActions: { flexDirection: 'row', marginTop: Spacing.md, gap: Spacing.sm },
  actionBtn: { flex: 1 },
  emptyText: { ...Typography.body, color: Colors.textSec },
  fab: { position: 'absolute', left: Spacing.xl, right: Spacing.xl, bottom: Spacing.xl },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.xl, paddingBottom: Spacing.xxl },
  sheetTitle: { ...Typography.display, color: Colors.text, marginBottom: Spacing.lg },
  label: { ...Typography.caption, color: Colors.textSec, marginBottom: Spacing.sm, marginTop: Spacing.md },
  input: { backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.button, paddingHorizontal: Spacing.md, minHeight: TouchTarget.min, ...Typography.body, color: Colors.text },
  btnRow: { flexDirection: 'row', marginTop: Spacing.xl },
});
