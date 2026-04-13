import React, { useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Avatar } from '@/components/common/Avatar';
import { Badge } from '@/components/common/Badge';
import { ELCard } from '@/components/common/ELCard';
import { GradientButton } from '@/components/common/GradientButton';
import { EL, Common, Glass, Radii, Shadows, Space, Touch, Type } from '@/theme/emeraldLedger';
import { createAgent, deleteAgent, listAgents, toggleAgentActive, updateAgentPin } from '@/db/repos/agents';
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
    mutationFn: (input: { name: string; phone: string; pin: string }) => createAgent({ orgId: orgId!, ...input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agents', orgId] }),
  });
  const toggleMut = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => toggleAgentActive(id, active),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agents', orgId] }),
  });
  const pinMut = useMutation({
    mutationFn: ({ id, pin }: { id: string; pin: string }) => updateAgentPin(id, pin),
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
    try {
      await createMut.mutateAsync({ name, phone, pin });
      setName(''); setPhone(''); setPin('');
      setShowAdd(false);
    } catch (e: any) {
      Alert.alert('Failed to create agent', e?.message ?? 'Unknown error');
    }
  };

  const [changePinAgent, setChangePinAgent] = useState<UserRow | null>(null);
  const [newPin, setNewPin] = useState('');

  const handleChangePin = (agent: UserRow) => {
    setNewPin('');
    setChangePinAgent(agent);
  };

  const confirmChangePin = async () => {
    if (!changePinAgent) return;
    if (!/^\d{4}$/.test(newPin)) {
      Alert.alert('Invalid PIN', 'PIN must be exactly 4 digits');
      return;
    }
    try {
      await pinMut.mutateAsync({ id: changePinAgent.id, pin: newPin });
      Alert.alert('Done', `PIN updated for ${changePinAgent.name}`);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to update PIN');
    }
    setChangePinAgent(null);
    setNewPin('');
  };

  const handleDelete = (agent: UserRow) => {
    Alert.alert('Remove agent', `Remove ${agent.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => deleteMut.mutate(agent.id) },
    ]);
  };

  const renderAgent = ({ item }: { item: UserRow }) => (
    <ELCard style={styles.agentCard}>
      <View style={styles.agentRow}>
        <Avatar name={item.name} />
        <View style={styles.agentBody}>
          <Text style={styles.agentName}>{item.name}</Text>
          <Text style={styles.agentPhone}>{item.phone}</Text>
        </View>
        <Badge label={item.is_active ? 'Active' : 'Inactive'} variant={item.is_active ? 'success' : 'neutral'} />
      </View>
      <View style={styles.agentActions}>
        <GradientButton title={item.is_active ? 'Deactivate' : 'Activate'} variant="secondary" onPress={() => toggleMut.mutate({ id: item.id, active: !item.is_active })} style={styles.actionBtn} />
        <GradientButton title="Change PIN" variant="secondary" onPress={() => handleChangePin(item)} style={styles.actionBtn} />
        <GradientButton title="Remove" variant="danger" onPress={() => handleDelete(item)} style={styles.actionBtn} />
      </View>
    </ELCard>
  );

  return (
    <SafeAreaView style={Common.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Agents</Text>
        <Text style={styles.sub}>Manage your collection agents</Text>
      </View>

      {agents && agents.length > 0 ? (
        <FlatList data={agents} keyExtractor={(a) => a.id} renderItem={renderAgent} contentContainerStyle={{ padding: Space.xl, paddingBottom: 120 }} />
      ) : (
        <ELCard style={{ margin: Space.xl }}>
          <Text style={Type.bodySm}>No agents yet. Add your first agent to delegate collections.</Text>
        </ELCard>
      )}

      <Pressable style={Common.fab} onPress={() => setShowAdd(true)}>
        <MaterialCommunityIcons name="plus" size={28} color={EL.white} />
      </Pressable>

      <Modal visible={showAdd} animationType="slide" transparent onRequestClose={() => setShowAdd(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable style={[Glass.dark, styles.backdrop]} onPress={() => setShowAdd(false)}>
            <Pressable style={[Glass.container, styles.sheet]} onPress={(e) => e.stopPropagation()}>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <Text style={styles.sheetTitle}>Add agent</Text>
                <Text style={styles.label}>Name</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholderTextColor={EL.onSurfaceMuted}
                  placeholder="Agent name"
                  returnKeyType="next"
                />
                <Text style={styles.label}>Phone (10 digits)</Text>
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={(v) => setPhone(v.replace(/\D/g, '').slice(0, 10))}
                  keyboardType="number-pad"
                  placeholderTextColor={EL.onSurfaceMuted}
                  placeholder="9876543210"
                  returnKeyType="next"
                />
                <Text style={styles.label}>4-digit PIN</Text>
                <TextInput
                  style={styles.input}
                  value={pin}
                  onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 4))}
                  keyboardType="number-pad"
                  secureTextEntry
                  placeholderTextColor={EL.onSurfaceMuted}
                  placeholder={'\u2022\u2022\u2022\u2022'}
                  returnKeyType="done"
                />
                <View style={styles.btnRow}>
                  <GradientButton title="Cancel" variant="secondary" onPress={() => setShowAdd(false)} style={{ flex: 1, marginRight: Space.sm }} />
                  <GradientButton title="Create" onPress={handleAdd} loading={createMut.isPending} style={{ flex: 1, marginLeft: Space.sm }} />
                </View>
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Change PIN Modal */}
      <Modal visible={!!changePinAgent} animationType="slide" transparent onRequestClose={() => setChangePinAgent(null)}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable style={[Glass.dark, styles.backdrop]} onPress={() => setChangePinAgent(null)}>
            <Pressable style={[Glass.container, styles.sheet]} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.sheetTitle}>Change PIN</Text>
              <Text style={Type.bodySm}>New 4-digit PIN for {changePinAgent?.name}</Text>
              <Text style={styles.label}>New PIN</Text>
              <TextInput
                style={styles.input}
                value={newPin}
                onChangeText={(v) => setNewPin(v.replace(/\D/g, '').slice(0, 4))}
                keyboardType="number-pad"
                secureTextEntry
                placeholderTextColor={EL.onSurfaceMuted}
                placeholder={'\u2022\u2022\u2022\u2022'}
                autoFocus
              />
              <View style={styles.btnRow}>
                <GradientButton title="Cancel" variant="secondary" onPress={() => setChangePinAgent(null)} style={{ flex: 1, marginRight: Space.sm }} />
                <GradientButton title="Update" onPress={confirmChangePin} loading={pinMut.isPending} style={{ flex: 1, marginLeft: Space.sm }} />
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { padding: Space.xl, paddingBottom: Space.md },
  title: { ...Type.displayMd },
  sub: { ...Type.bodySm, color: EL.onSurfaceSec, marginTop: 2 },
  agentCard: { marginBottom: Space.md },
  agentRow: { flexDirection: 'row', alignItems: 'center' },
  agentBody: { flex: 1, marginLeft: Space.md },
  agentName: { ...Type.titleMd },
  agentPhone: { ...Type.bodySm, color: EL.onSurfaceMuted },
  agentActions: { flexDirection: 'row', marginTop: Space.md, gap: Space.sm },
  actionBtn: { flex: 1 },
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: Radii.xl + 4, borderTopRightRadius: Radii.xl + 4, padding: Space.xl, paddingBottom: Space.xxxl },
  sheetTitle: { ...Type.displaySm, marginBottom: Space.lg },
  label: { ...Type.labelMd, color: EL.onSurfaceSec, marginBottom: Space.sm, marginTop: Space.lg },
  input: { backgroundColor: EL.surfaceCard, borderRadius: Radii.sm + 2, paddingHorizontal: Space.lg, minHeight: Touch.min, ...Type.bodyMd, color: EL.onSurface, ...Shadows.card },
  btnRow: { flexDirection: 'row', marginTop: Space.xl },
});
