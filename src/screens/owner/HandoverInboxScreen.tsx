// HandoverInboxScreen — owner reviews and confirms agent EOD cash handovers.
//
// Three sections:
//   1. Pending action — submitted handovers awaiting owner cash confirmation
//   2. Disputed — owner counted < agent claimed, needs investigation
//   3. Recent (last 30d) — confirmed history with per-agent variance summary
//
// Tap a submitted handover → bottom sheet to enter "cash counted" → confirm
// or dispute. The sheet pre-fills with what the agent claimed for the
// honest-default-tap.

import React, { useState } from 'react';
import {
  Alert,
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
import { useNavigation } from '@react-navigation/native';

import { Avatar } from '@/components/common/Avatar';
import { GradientButton } from '@/components/common/GradientButton';
import { EL, Common, Glass, Radii, Shadows, Space, Type } from '@/theme/emeraldLedger';
import {
  useAgentVarianceSummary,
  useConfirmHandover,
  useHandoverInbox,
} from '@/hooks/useHandovers';
import type { HandoverWithAgent } from '@/db/repos/handovers';
import type { AgentVarianceRow } from '@/db/repos/handovers';
import { formatRupees } from '@/utils/format';

export function HandoverInboxScreen() {
  const navigation = useNavigation();
  const { data: all } = useHandoverInbox();
  const { data: variance } = useAgentVarianceSummary(30);
  const confirm = useConfirmHandover();

  const [active, setActive] = useState<HandoverWithAgent | null>(null);
  const [cashStr, setCashStr] = useState('');

  const submitted = all?.filter((h) => h.status === 'submitted') ?? [];
  const disputed = all?.filter((h) => h.status === 'disputed') ?? [];
  const recent = all?.filter((h) => h.status === 'confirmed').slice(0, 20) ?? [];

  const openConfirm = (row: HandoverWithAgent) => {
    setActive(row);
    setCashStr(String(row.cash_handed_over ?? row.collected_amount ?? 0));
  };

  const handleConfirm = async () => {
    if (!active) return;
    const cash = Number(cashStr);
    if (cash < 0) {
      Alert.alert('Invalid amount', 'Cash counted cannot be negative.');
      return;
    }
    try {
      await confirm.mutateAsync({ id: active.id, cashReceived: cash });
      setActive(null);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to confirm');
    }
  };

  return (
    <SafeAreaView style={Common.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={EL.onSurface} />
        </Pressable>
        <Text style={styles.title}>Handovers</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: Space.lg, gap: Space.lg, paddingBottom: 80 }}>
        {/* Top stats — pending count + month variance */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, Shadows.card]}>
            <Text style={styles.statLabel}>NEEDS YOUR ACTION</Text>
            <Text style={[styles.statValue, { color: EL.warn }]}>{submitted.length}</Text>
          </View>
          <View style={[styles.statCard, Shadows.card]}>
            <Text style={styles.statLabel}>DISPUTED (30D)</Text>
            <Text style={[styles.statValue, { color: EL.tertiary }]}>{disputed.length}</Text>
          </View>
        </View>

        {/* Pending — submitted handovers awaiting owner */}
        {submitted.length > 0 ? (
          <Section title="Awaiting your confirmation" sub="Tap to count cash and confirm">
            {submitted.map((h) => (
              <HandoverCard key={h.id} row={h} onPress={() => openConfirm(h)} />
            ))}
          </Section>
        ) : null}

        {/* Disputed */}
        {disputed.length > 0 ? (
          <Section title="Disputed" sub="Cash counted < agent claimed">
            {disputed.map((h) => (
              <HandoverCard key={h.id} row={h} onPress={() => openConfirm(h)} disputed />
            ))}
          </Section>
        ) : null}

        {/* Per-agent variance summary */}
        {variance && variance.length > 0 ? (
          <Section title="Per-agent variance (30 days)" sub="Bigger variance = bigger flag">
            {variance.map((v) => (
              <VarianceCard key={v.agent_id} row={v} />
            ))}
          </Section>
        ) : null}

        {/* Recent confirmed */}
        {recent.length > 0 ? (
          <Section title="Recent">
            {recent.map((h) => (
              <HandoverCard key={h.id} row={h} compact />
            ))}
          </Section>
        ) : null}

        {/* Empty state */}
        {(!all || all.length === 0) ? (
          <View style={styles.empty}>
            <MaterialCommunityIcons name="inbox-outline" size={36} color={EL.outline} />
            <Text style={styles.emptyTitle}>No handovers yet</Text>
            <Text style={styles.emptySub}>
              When agents submit end-of-day cash, they'll appear here for your confirmation.
            </Text>
          </View>
        ) : null}
      </ScrollView>

      {/* Confirm modal */}
      <Modal
        visible={!!active}
        transparent
        animationType="slide"
        onRequestClose={() => setActive(null)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={[Glass.dark, { flex: 1, justifyContent: 'flex-end' }]} onPress={() => setActive(null)}>
            <Pressable style={styles.confirmSheet} onPress={(e) => e.stopPropagation()}>
              <View style={styles.handle} />
              {active ? (
                <>
                  <Text style={styles.confirmTitle}>Confirm cash received</Text>
                  <Text style={styles.confirmSub}>
                    {active.agent_name} · {new Date(active.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </Text>

                  <View style={styles.confirmTallyCard}>
                    <Row label="Collected" value={formatRupees(active.collected_amount)} />
                    <Row label="Expenses" value={`− ${formatRupees(active.expenses_amount)}`} />
                    <Divider />
                    <Row label="Net (auto-tally)" value={formatRupees(active.collected_amount - active.expenses_amount)} bold />
                    <Row label="Agent claims handed" value={formatRupees(active.cash_handed_over ?? 0)} bold />
                    {active.notes ? (
                      <View style={styles.noteBlock}>
                        <MaterialCommunityIcons name="note-text-outline" size={14} color={EL.onSurfaceMuted} />
                        <Text style={styles.noteText}>{active.notes}</Text>
                      </View>
                    ) : null}
                  </View>

                  <Text style={styles.confirmLabel}>CASH YOU COUNTED</Text>
                  <View style={styles.cashWrap}>
                    <Text style={styles.rupee}>₹</Text>
                    <TextInput
                      value={cashStr}
                      onChangeText={setCashStr}
                      keyboardType="numeric"
                      style={styles.cashInput}
                      autoFocus
                    />
                  </View>

                  {/* Variance preview from owner's perspective */}
                  {(() => {
                    const counted = Number(cashStr) || 0;
                    const claimed = active.cash_handed_over ?? 0;
                    const diff = counted - claimed;
                    if (diff === 0) return null;
                    const isShort = diff < 0;
                    return (
                      <View
                        style={[
                          styles.varianceBox,
                          isShort ? styles.varianceShortage : styles.varianceExtra,
                        ]}
                      >
                        <MaterialCommunityIcons
                          name={isShort ? 'alert-circle' : 'arrow-up-bold-circle'}
                          size={16}
                          color={isShort ? EL.tertiary : EL.warn}
                        />
                        <Text
                          style={[
                            styles.varianceMsg,
                            { color: isShort ? EL.tertiary : EL.warn },
                          ]}
                        >
                          {isShort
                            ? `${formatRupees(Math.abs(diff))} less than agent claimed — will be marked DISPUTED`
                            : `${formatRupees(diff)} more than agent claimed`}
                        </Text>
                      </View>
                    );
                  })()}

                  <View style={styles.confirmButtons}>
                    <Pressable
                      onPress={() => setActive(null)}
                      style={[styles.cancelBtn]}
                    >
                      <Text style={styles.cancelText}>Cancel</Text>
                    </Pressable>
                    <View style={{ flex: 1 }}>
                      <GradientButton
                        title={confirm.isPending ? 'Confirming...' : 'Confirm'}
                        onPress={handleConfirm}
                        disabled={confirm.isPending}
                        loading={confirm.isPending}
                      />
                    </View>
                  </View>
                </>
              ) : null}
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: Space.sm }}>
      <View>
        <Text style={styles.sectionTitle}>{title}</Text>
        {sub ? <Text style={styles.sectionSub}>{sub}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function HandoverCard({
  row,
  onPress,
  compact,
  disputed,
}: {
  row: HandoverWithAgent;
  onPress?: () => void;
  compact?: boolean;
  disputed?: boolean;
}) {
  const date = new Date(row.date);
  const dateStr = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const variance = row.variance ?? 0;
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.card,
        Shadows.card,
        disputed && { backgroundColor: 'rgba(155,62,59,0.05)' },
      ]}
    >
      <View style={styles.cardRow}>
        <Avatar name={row.agent_name ?? 'Agent'} size={36} />
        <View style={{ flex: 1 }}>
          <Text style={styles.cardName}>{row.agent_name ?? 'Unknown agent'}</Text>
          <Text style={styles.cardSub}>
            {dateStr} · Collected {formatRupees(row.collected_amount)}
            {row.expenses_amount > 0 ? ` · Exp ${formatRupees(row.expenses_amount)}` : ''}
          </Text>
        </View>
        <View style={styles.cardRight}>
          <Text style={[styles.cardAmount, disputed && { color: EL.tertiary }]}>
            {formatRupees(row.cash_handed_over ?? 0)}
          </Text>
          {row.cash_received != null && row.cash_received !== row.cash_handed_over ? (
            <Text style={styles.cardVariance}>
              counted: {formatRupees(row.cash_received)}
            </Text>
          ) : null}
          {!compact && variance !== 0 ? (
            <Text style={[styles.cardVariance, { color: variance < 0 ? EL.tertiary : EL.warn }]}>
              {variance > 0 ? '+' : ''}
              {formatRupees(variance)}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

function VarianceCard({ row }: { row: AgentVarianceRow }) {
  const flag = Math.abs(row.net_variance) > 100 || row.disputed_count > 0;
  return (
    <View style={[styles.card, Shadows.card]}>
      <View style={styles.cardRow}>
        <Avatar name={row.agent_name} size={36} />
        <View style={{ flex: 1 }}>
          <Text style={styles.cardName}>{row.agent_name}</Text>
          <Text style={styles.cardSub}>
            {row.handover_count} handovers · collected {formatRupees(row.total_collected)}
          </Text>
        </View>
        <View style={styles.cardRight}>
          <Text
            style={[
              styles.cardAmount,
              { color: flag ? EL.tertiary : EL.primary },
            ]}
          >
            {row.net_variance > 0 ? '+' : ''}
            {formatRupees(row.net_variance)}
          </Text>
          {row.disputed_count > 0 ? (
            <Text style={[styles.cardVariance, { color: EL.tertiary }]}>
              {row.disputed_count} disputed
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.confirmRow}>
      <Text style={[styles.confirmRowLabel, bold && { fontWeight: '700', color: EL.onSurface }]}>
        {label}
      </Text>
      <Text style={[styles.confirmRowValue, bold && { fontWeight: '800' }]}>{value}</Text>
    </View>
  );
}

function Divider() {
  return <View style={styles.confirmDivider} />;
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    padding: Space.lg,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: EL.surfaceCard,
  },
  title: { ...Type.titleLg, fontWeight: '800' },

  statsRow: {
    flexDirection: 'row',
    gap: Space.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.lg,
    padding: Space.lg,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: EL.onSurfaceMuted,
    letterSpacing: 0.8,
  },
  statValue: {
    fontSize: 32,
    fontWeight: '800',
    marginTop: 4,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: EL.onSurface,
  },
  sectionSub: {
    fontSize: 11,
    fontWeight: '600',
    color: EL.onSurfaceMuted,
    marginTop: 2,
  },

  card: {
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.lg,
    padding: Space.md,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
  },
  cardName: {
    fontSize: 14,
    fontWeight: '700',
    color: EL.onSurface,
  },
  cardSub: {
    fontSize: 11,
    fontWeight: '500',
    color: EL.onSurfaceMuted,
    marginTop: 2,
  },
  cardRight: { alignItems: 'flex-end' },
  cardAmount: { fontSize: 16, fontWeight: '800', color: EL.primary },
  cardVariance: { fontSize: 11, fontWeight: '700', marginTop: 2 },

  empty: {
    alignItems: 'center',
    padding: Space.xxxl,
    gap: Space.sm,
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: EL.onSurface, marginTop: Space.md },
  emptySub: { fontSize: 12, color: EL.onSurfaceMuted, textAlign: 'center', marginTop: Space.xs, paddingHorizontal: Space.lg },

  // Confirm sheet
  confirmSheet: {
    backgroundColor: EL.surfaceCard,
    borderTopLeftRadius: Radii.xxl,
    borderTopRightRadius: Radii.xxl,
    paddingTop: Space.sm,
    paddingHorizontal: Space.xl,
    paddingBottom: Space.xxxl,
    gap: Space.md,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: EL.outlineVariant,
    alignSelf: 'center',
    marginBottom: Space.sm,
  },
  confirmTitle: { fontSize: 20, fontWeight: '800', color: EL.onSurface },
  confirmSub: { fontSize: 13, color: EL.onSurfaceSec, marginTop: -8 },
  confirmTallyCard: {
    backgroundColor: EL.surfaceLow,
    borderRadius: Radii.lg,
    padding: Space.md,
    gap: 4,
  },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  confirmRowLabel: { fontSize: 13, color: EL.onSurfaceSec },
  confirmRowValue: { fontSize: 14, fontWeight: '700', color: EL.onSurface },
  confirmDivider: { height: 1, backgroundColor: EL.surfaceMid, marginVertical: 4 },
  noteBlock: {
    flexDirection: 'row',
    gap: Space.sm,
    paddingTop: Space.sm,
    borderTopWidth: 1,
    borderTopColor: EL.surfaceMid,
    marginTop: 4,
  },
  noteText: { flex: 1, fontSize: 12, color: EL.onSurfaceSec, fontStyle: 'italic' },

  confirmLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: EL.onSurfaceMuted,
    letterSpacing: 0.8,
    marginTop: Space.sm,
  },
  cashWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: EL.surfaceLow,
    borderRadius: Radii.md,
    paddingHorizontal: Space.md,
  },
  rupee: { fontSize: 24, color: EL.primary, fontWeight: '600', marginRight: Space.sm },
  cashInput: {
    flex: 1,
    fontSize: 28,
    fontWeight: '700',
    color: EL.onSurface,
    paddingVertical: Space.md,
  },

  varianceBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    padding: Space.md,
    borderRadius: Radii.md,
  },
  varianceShortage: { backgroundColor: 'rgba(155,62,59,0.08)' },
  varianceExtra: { backgroundColor: 'rgba(217,119,6,0.08)' },
  varianceMsg: { flex: 1, fontSize: 12, fontWeight: '700' },

  confirmButtons: {
    flexDirection: 'row',
    gap: Space.md,
    marginTop: Space.md,
  },
  cancelBtn: {
    flex: 0.5,
    height: 48,
    borderRadius: Radii.md,
    backgroundColor: EL.surfaceLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { fontSize: 14, fontWeight: '700', color: EL.onSurface },
});
