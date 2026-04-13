// LinesScreen — owner's collection routes.
//
// Each line shows: name, type, assigned agent, borrower count, outstanding,
// today's due vs collected, month-to-date collected. Owner taps the agent
// row to reassign, or long-presses the line to delete.
//
// This is the multi-line operator's primary control surface — it answers
// "which line is on track today and who is collecting?" at a glance.

import React, { useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { Avatar } from '@/components/common/Avatar';
import { GradientButton } from '@/components/common/GradientButton';
import { EL, Common, Glass, Radii, Shadows, Space, Touch, Type } from '@/theme/emeraldLedger';
import { listAgents } from '@/db/repos/agents';
import {
  useAssignLineAgent,
  useCreateLine,
  useDeleteLine,
  useLineAssignmentHistory,
  useLineStats,
} from '@/hooks/useLines';
import { useAuthStore } from '@/store/authStore';
import { formatRupees } from '@/utils/format';
import type { LineType } from '@/db/types';
import type { LineStatsRow } from '@/db/repos/lines';

const LINE_TYPES: { value: LineType; labelKey: string }[] = [
  { value: 'daily', labelKey: 'lines.type_daily' },
  { value: 'weekly', labelKey: 'lines.type_weekly' },
  { value: 'monthly_emi', labelKey: 'lines.type_monthly_emi' },
  { value: 'monthly_interest', labelKey: 'lines.type_monthly_interest' },
  { value: 'daily_interest', labelKey: 'lines.type_daily_interest' },
  { value: 'weekly_interest', labelKey: 'lines.type_weekly_interest' },
  { value: 'enterprise', labelKey: 'lines.type_enterprise' },
];

export function LinesScreen() {
  const { t } = useTranslation();
  const orgId = useAuthStore((s) => s.user?.orgId ?? '');
  const { data: stats } = useLineStats();
  const { data: agents } = useQuery({
    queryKey: ['agents', orgId],
    enabled: !!orgId,
    queryFn: () => listAgents(orgId),
  });
  const createMut = useCreateLine();
  const deleteMut = useDeleteLine();
  const assignMut = useAssignLineAgent();

  const [showAddModal, setShowAddModal] = useState(false);
  const [assignFor, setAssignFor] = useState<LineStatsRow | null>(null);
  const [historyFor, setHistoryFor] = useState<LineStatsRow | null>(null);
  const { data: historyRows } = useLineAssignmentHistory(historyFor?.line_id);
  const [name, setName] = useState('');
  const [type, setType] = useState<LineType>('daily');

  const handleDelete = (line: LineStatsRow) => {
    Alert.alert(
      'Delete line?',
      `Are you sure you want to delete "${line.line_name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMut.mutateAsync(line.line_id);
            } catch (e: any) {
              Alert.alert('Cannot delete', e?.message ?? 'Failed to delete line');
            }
          },
        },
      ],
    );
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert(t('borrowers.name_required'));
      return;
    }
    await createMut.mutateAsync({ name, type });
    setName('');
    setType('daily');
    setShowAddModal(false);
  };

  const handleAssign = async (agentId: string | null) => {
    if (!assignFor) return;
    try {
      await assignMut.mutateAsync({ lineId: assignFor.line_id, agentId });
      setAssignFor(null);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to assign agent');
    }
  };

  const totalOutstanding =
    stats?.reduce((sum, l) => sum + l.outstanding_principal, 0) ?? 0;
  const totalBorrowers = stats?.reduce((sum, l) => sum + l.borrower_count, 0) ?? 0;

  const renderItem = ({ item }: { item: LineStatsRow }) => {
    const progress = item.today_due_amount > 0
      ? Math.min(1, item.today_collected_amount / item.today_due_amount)
      : 0;
    const typeLabel = t(`lines.type_${item.line_type}` as any, { defaultValue: item.line_type });

    return (
      <Pressable
        style={styles.lineCard}
        onLongPress={() => handleDelete(item)}
        delayLongPress={500}
      >
        {/* Title row */}
        <View style={styles.lineHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.lineName}>{item.line_name}</Text>
            <View style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>{typeLabel}</Text>
            </View>
          </View>
          <Text style={styles.outstandingValue}>
            {formatRupees(item.outstanding_principal)}
          </Text>
        </View>

        {/* Agent row — tap to reassign, or tap History for rotation log */}
        <View style={styles.agentRowGroup}>
          <Pressable onPress={() => setAssignFor(item)} style={[styles.agentRow, { flex: 1 }]}>
            <MaterialCommunityIcons name="account-tie" size={18} color={EL.primary} />
            <Text style={styles.agentName}>
              {item.agent_name ? item.agent_name : 'No agent assigned'}
            </Text>
            <MaterialCommunityIcons name="chevron-right" size={18} color={EL.onSurfaceMuted} />
          </Pressable>
          <Pressable
            onPress={() => setHistoryFor(item)}
            style={styles.historyBtn}
            hitSlop={8}
          >
            <MaterialCommunityIcons name="history" size={18} color={EL.onSurfaceSec} />
          </Pressable>
        </View>

        {/* Today's progress */}
        {item.today_due_amount > 0 ? (
          <>
            <View style={styles.progressLabelRow}>
              <Text style={styles.progressLabel}>Today</Text>
              <Text style={styles.progressValue}>
                {formatRupees(item.today_collected_amount)} /{' '}
                {formatRupees(item.today_due_amount)}
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
            </View>
          </>
        ) : null}

        {/* Stats footer */}
        <View style={styles.footerRow}>
          <Stat label="Borrowers" value={String(item.borrower_count)} />
          <Stat label="Loans" value={String(item.active_loan_count)} />
          <Stat label="30-day" value={formatRupees(item.month_collected_amount)} />
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={Common.screen}>
      {/* Header summary */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { flex: 1 }]}>
          <Text style={styles.summaryLabel}>Lines</Text>
          <Text style={styles.summaryBig}>{stats?.length ?? 0}</Text>
        </View>
        <View style={[styles.summaryCard, { flex: 1 }]}>
          <Text style={styles.summaryLabel}>Borrowers</Text>
          <Text style={styles.summaryBig}>{totalBorrowers}</Text>
        </View>
        <View style={[styles.summaryCard, { flex: 1.3 }]}>
          <Text style={styles.summaryLabel}>Outstanding</Text>
          <Text style={styles.summaryOutstanding}>
            {formatRupees(totalOutstanding)}
          </Text>
        </View>
      </View>

      {stats && stats.length > 0 ? (
        <FlatList
          data={stats}
          keyExtractor={(item) => item.line_id}
          renderItem={renderItem}
          contentContainerStyle={{
            paddingHorizontal: Space.xl,
            paddingTop: Space.lg,
            paddingBottom: 120,
            gap: Space.lg,
          }}
        />
      ) : (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <MaterialCommunityIcons name="road-variant" size={24} color={EL.primary} />
          </View>
          <Text style={styles.emptyTitle}>{t('lines.empty_title')}</Text>
          <Text style={styles.emptySub}>{t('lines.empty_sub')}</Text>
        </View>
      )}

      {/* FAB */}
      <Pressable style={styles.fab} onPress={() => setShowAddModal(true)}>
        <MaterialCommunityIcons name="plus" size={28} color={EL.white} />
      </Pressable>

      {/* Add Line Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAddModal(false)}
      >
        <Pressable style={[Glass.dark, styles.modalBackdrop]} onPress={() => setShowAddModal(false)}>
          <View style={[Glass.container, styles.modalSheet]}>
            <Text style={styles.modalTitle}>{t('lines.add')}</Text>
            <Text style={styles.label}>{t('lines.line_name')}</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Koyambedu Market"
              placeholderTextColor={EL.onSurfaceMuted}
            />
            <Text style={[styles.label, { marginTop: Space.lg }]}>{t('lines.line_type')}</Text>
            <View style={styles.typeGrid}>
              {LINE_TYPES.map((opt) => {
                const active = type === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => setType(opt.value)}
                    style={[styles.typeChip, active ? styles.typeChipActive : styles.typeChipInactive]}
                  >
                    <Text style={[styles.typeChipLabel, active && { color: EL.white }]}>
                      {t(opt.labelKey)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.modalButtons}>
              <GradientButton
                title={t('common.cancel')}
                variant="secondary"
                onPress={() => setShowAddModal(false)}
                style={{ flex: 1, marginRight: Space.sm }}
              />
              <GradientButton
                title={t('lines.create')}
                onPress={handleCreate}
                loading={createMut.isPending}
                style={{ flex: 1, marginLeft: Space.sm }}
              />
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* ── Assign Agent Modal ──
          Layout:
            - Drag handle + close × on the right
            - Title + line subtitle with type badge
            - Currently-assigned hero card (or "Unassigned" hero)
            - "Owner collects" tile + agent cards with avatar, name, phone
            - Active selection: filled emerald background + check
            - Empty state when no agents exist */}
      <Modal
        visible={!!assignFor}
        animationType="slide"
        transparent
        onRequestClose={() => setAssignFor(null)}
      >
        <Pressable style={[Glass.dark, styles.modalBackdrop]} onPress={() => setAssignFor(null)}>
          <Pressable style={styles.assignSheet} onPress={(e) => e.stopPropagation()}>
            {/* Drag handle */}
            <View style={styles.assignHandle} />

            {/* Header */}
            <View style={styles.assignHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.assignTitle}>Assign agent</Text>
                {assignFor ? (
                  <View style={styles.assignSubRow}>
                    <Text style={styles.assignSubtitle}>{assignFor.line_name}</Text>
                    <View style={styles.assignTypeBadge}>
                      <Text style={styles.assignTypeText}>
                        {t(`lines.type_${assignFor.line_type}` as any, {
                          defaultValue: assignFor.line_type,
                        })}
                      </Text>
                    </View>
                  </View>
                ) : null}
              </View>
              <Pressable
                onPress={() => setAssignFor(null)}
                style={styles.assignCloseBtn}
              >
                <MaterialCommunityIcons name="close" size={20} color={EL.onSurfaceSec} />
              </Pressable>
            </View>

            {/* Currently assigned hero */}
            {assignFor?.agent_name ? (
              <View style={styles.assignedHero}>
                <View style={styles.assignedHeroIcon}>
                  <MaterialCommunityIcons name="account-check" size={18} color={EL.white} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.assignedHeroLabel}>CURRENTLY ASSIGNED</Text>
                  <Text style={styles.assignedHeroName}>{assignFor.agent_name}</Text>
                </View>
              </View>
            ) : (
              <View style={styles.unassignedHero}>
                <MaterialCommunityIcons
                  name="account-question-outline"
                  size={18}
                  color={EL.onSurfaceMuted}
                />
                <Text style={styles.unassignedHeroText}>No agent assigned yet</Text>
              </View>
            )}

            {/* Section heading */}
            <Text style={styles.assignSectionLabel}>SELECT AGENT</Text>

            <ScrollView
              style={{ maxHeight: 360 }}
              contentContainerStyle={styles.assignList}
              showsVerticalScrollIndicator={false}
            >
              {/* "Owner collects" option */}
              <Pressable
                style={[
                  styles.agentCard,
                  !assignFor?.agent_id && styles.agentCardActive,
                ]}
                onPress={() => handleAssign(null)}
              >
                <View
                  style={[
                    styles.agentCardIcon,
                    !assignFor?.agent_id && styles.agentCardIconActive,
                  ]}
                >
                  <MaterialCommunityIcons
                    name="account-cowboy-hat"
                    size={20}
                    color={!assignFor?.agent_id ? EL.white : EL.onSurfaceSec}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.agentCardName,
                      !assignFor?.agent_id && styles.agentCardNameActive,
                    ]}
                  >
                    Owner collects
                  </Text>
                  <Text
                    style={[
                      styles.agentCardSub,
                      !assignFor?.agent_id && styles.agentCardSubActive,
                    ]}
                  >
                    No agent — you walk this line yourself
                  </Text>
                </View>
                {!assignFor?.agent_id ? (
                  <View style={styles.agentCheck}>
                    <MaterialCommunityIcons name="check" size={16} color={EL.white} />
                  </View>
                ) : null}
              </Pressable>

              {/* Agent list */}
              {agents && agents.filter((a) => a.is_active === 1 && a.role === 'agent').length > 0 ? (
                agents
                  .filter((a) => a.is_active === 1 && a.role === 'agent')
                  .map((agent) => {
                    const isActive = assignFor?.agent_id === agent.id;
                    return (
                      <Pressable
                        key={agent.id}
                        style={[styles.agentCard, isActive && styles.agentCardActive]}
                        onPress={() => handleAssign(agent.id)}
                      >
                        <Avatar name={agent.name} size={40} />
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              styles.agentCardName,
                              isActive && styles.agentCardNameActive,
                            ]}
                          >
                            {agent.name}
                          </Text>
                          {agent.phone ? (
                            <View style={styles.agentMetaRow}>
                              <MaterialCommunityIcons
                                name="phone"
                                size={11}
                                color={isActive ? EL.white : EL.onSurfaceMuted}
                              />
                              <Text
                                style={[
                                  styles.agentCardSub,
                                  isActive && styles.agentCardSubActive,
                                ]}
                              >
                                {agent.phone}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                        {isActive ? (
                          <View style={styles.agentCheck}>
                            <MaterialCommunityIcons name="check" size={16} color={EL.white} />
                          </View>
                        ) : null}
                      </Pressable>
                    );
                  })
              ) : (
                <View style={styles.assignEmpty}>
                  <MaterialCommunityIcons
                    name="account-multiple-plus-outline"
                    size={32}
                    color={EL.outline}
                  />
                  <Text style={styles.assignEmptyTitle}>No agents yet</Text>
                  <Text style={styles.assignEmptySub}>
                    Add agents from Settings → Tools → Agents to assign them to a line.
                  </Text>
                </View>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Rotation History Modal ── */}
      <Modal
        visible={!!historyFor}
        animationType="slide"
        transparent
        onRequestClose={() => setHistoryFor(null)}
      >
        <Pressable style={[Glass.dark, styles.modalBackdrop]} onPress={() => setHistoryFor(null)}>
          <Pressable style={styles.assignSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.assignHandle} />
            <View style={styles.assignHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.assignTitle}>Agent rotation history</Text>
                <Text style={styles.assignSubtitle}>{historyFor?.line_name}</Text>
              </View>
              <Pressable onPress={() => setHistoryFor(null)} style={styles.assignCloseBtn}>
                <MaterialCommunityIcons name="close" size={20} color={EL.onSurfaceSec} />
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
              {historyRows && historyRows.length > 0 ? (
                historyRows.map((h) => {
                  const days = Math.max(1, Math.round((h.duration_ms ?? 0) / 86_400_000));
                  const isCurrent = h.unassigned_at == null;
                  return (
                    <View key={h.id} style={styles.historyRow}>
                      <View style={styles.historyDot}>
                        <View style={[styles.historyDotInner, isCurrent && { backgroundColor: EL.primary }]} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.historyAgent}>
                          {h.agent_name ?? 'Unassigned'}
                          {isCurrent ? <Text style={styles.historyCurrent}>  · CURRENT</Text> : null}
                        </Text>
                        <Text style={styles.historyMeta}>
                          {new Date(h.assigned_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {h.unassigned_at
                            ? ` → ${new Date(h.unassigned_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
                            : ' → now'}
                          {' · '}{days}d
                        </Text>
                        {h.note ? <Text style={styles.historyNote}>{h.note}</Text> : null}
                      </View>
                    </View>
                  );
                })
              ) : (
                <View style={styles.assignEmpty}>
                  <MaterialCommunityIcons name="history" size={32} color={EL.outline} />
                  <Text style={styles.assignEmptyTitle}>No history yet</Text>
                  <Text style={styles.assignEmptySub}>
                    The first agent assignment will start the timeline.
                  </Text>
                </View>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBlock}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Summary row
  summaryRow: {
    flexDirection: 'row',
    gap: Space.sm,
    paddingHorizontal: Space.xl,
    paddingTop: Space.lg,
    paddingBottom: Space.sm,
  },
  summaryCard: {
    backgroundColor: EL.surfaceCard,
    padding: Space.md,
    borderRadius: Radii.lg,
    ...Shadows.card,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: EL.onSurfaceMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryBig: {
    fontSize: 22,
    fontWeight: '800',
    color: EL.onSurface,
    marginTop: 4,
  },
  summaryOutstanding: {
    fontSize: 16,
    fontWeight: '800',
    color: EL.primary,
    marginTop: 4,
  },

  // Line card
  lineCard: {
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.lg,
    padding: Space.lg,
    gap: Space.md,
    ...Shadows.card,
  },
  lineHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Space.md,
  },
  lineName: {
    ...Type.titleMd,
    fontWeight: '700',
    fontSize: 17,
  },
  typeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: EL.primaryFixed,
    paddingHorizontal: Space.sm,
    paddingVertical: 2,
    borderRadius: Radii.pill,
    marginTop: 4,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: EL.onPrimaryFixed,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  outstandingValue: {
    fontSize: 16,
    fontWeight: '800',
    color: EL.primary,
  },

  // Agent row
  agentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    paddingVertical: Space.sm,
    paddingHorizontal: Space.md,
    backgroundColor: EL.surfaceLow,
    borderRadius: Radii.md,
  },
  agentName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: EL.onSurface,
  },

  // Progress
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: EL.onSurfaceMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  progressValue: {
    fontSize: 13,
    fontWeight: '700',
    color: EL.onSurface,
  },
  progressTrack: {
    height: 8,
    width: '100%',
    backgroundColor: EL.surfaceMid,
    borderRadius: Radii.pill,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: EL.primary,
    borderRadius: Radii.pill,
  },

  // Footer stats
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: Space.md,
    borderTopWidth: 1,
    borderTopColor: EL.surfaceMid,
  },
  statBlock: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: EL.onSurfaceMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    color: EL.onSurface,
    marginTop: 2,
  },

  // Empty
  emptyCard: {
    margin: Space.xl,
    backgroundColor: EL.surfaceLow,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(188,202,192,0.3)',
    borderRadius: Radii.lg,
    padding: Space.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 180,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: EL.surfaceCard,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Space.md,
    ...Shadows.card,
  },
  emptyTitle: { ...Type.titleMd, fontWeight: '700' },
  emptySub: { ...Type.bodySm, color: EL.onSurfaceSec, textAlign: 'center', marginTop: Space.xs },

  // FAB
  fab: {
    position: 'absolute',
    right: Space.xl,
    bottom: Space.xxl + 60,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: EL.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.float,
  },

  // Modal
  modalBackdrop: { flex: 1, justifyContent: 'flex-end' },
  modalSheet: {
    borderTopLeftRadius: Radii.xl + 4,
    borderTopRightRadius: Radii.xl + 4,
    padding: Space.xl,
    paddingBottom: Space.xxxl,
    backgroundColor: EL.surfaceCard,
  },
  modalTitle: { ...Type.displaySm, marginBottom: Space.lg },
  label: { ...Type.labelMd, color: EL.onSurfaceSec, marginBottom: Space.sm },
  input: {
    backgroundColor: EL.surfaceLow,
    borderRadius: Radii.sm + 2,
    paddingHorizontal: Space.lg,
    minHeight: Touch.min,
    ...Type.bodyMd,
    color: EL.onSurface,
  },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm },
  typeChip: {
    paddingHorizontal: Space.xl,
    paddingVertical: 10,
    borderRadius: Radii.pill,
    minHeight: Touch.min,
    justifyContent: 'center',
  },
  typeChipActive: { backgroundColor: EL.primary },
  typeChipInactive: { backgroundColor: EL.surfaceHigh },
  typeChipLabel: { ...Type.labelMd, color: EL.onSurface, fontWeight: '600' },
  modalButtons: { flexDirection: 'row', marginTop: Space.xl },

  // ── Assign Agent sheet ──
  assignSheet: {
    backgroundColor: EL.surfaceCard,
    borderTopLeftRadius: Radii.xxl,
    borderTopRightRadius: Radii.xxl,
    paddingTop: Space.sm,
    paddingHorizontal: Space.xl,
    paddingBottom: Space.xxxl,
    ...Shadows.float,
  },
  assignHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: EL.outlineVariant,
    alignSelf: 'center',
    marginBottom: Space.lg,
  },
  assignHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Space.md,
    marginBottom: Space.lg,
  },
  assignTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: EL.onSurface,
  },
  assignSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  assignSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: EL.onSurfaceSec,
  },
  assignTypeBadge: {
    backgroundColor: EL.primaryFixed,
    paddingHorizontal: Space.sm,
    paddingVertical: 2,
    borderRadius: Radii.pill,
  },
  assignTypeText: {
    fontSize: 9,
    fontWeight: '700',
    color: EL.onPrimaryFixed,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  assignCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: EL.surfaceLow,
  },

  // Currently-assigned hero (above the list)
  assignedHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    padding: Space.md,
    borderRadius: Radii.lg,
    backgroundColor: 'rgba(0, 105, 72, 0.06)',
    marginBottom: Space.lg,
  },
  assignedHeroIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: EL.primary,
  },
  assignedHeroLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: EL.primary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  assignedHeroName: {
    fontSize: 15,
    fontWeight: '700',
    color: EL.onSurface,
    marginTop: 2,
  },
  unassignedHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    paddingVertical: Space.md,
    paddingHorizontal: Space.md,
    borderRadius: Radii.lg,
    backgroundColor: EL.surfaceLow,
    marginBottom: Space.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: EL.outlineVariant,
  },
  unassignedHeroText: {
    fontSize: 13,
    fontWeight: '600',
    color: EL.onSurfaceMuted,
  },

  assignSectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: EL.onSurfaceMuted,
    letterSpacing: 0.8,
    marginBottom: Space.sm,
  },
  assignList: {
    gap: Space.sm,
    paddingBottom: Space.md,
  },

  // Per-agent card
  agentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    padding: Space.md,
    borderRadius: Radii.lg,
    backgroundColor: EL.surfaceLow,
    minHeight: Touch.comfortable,
  },
  agentCardActive: {
    backgroundColor: EL.primary,
  },
  agentCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: EL.surfaceCard,
  },
  agentCardIconActive: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  agentCardName: {
    fontSize: 15,
    fontWeight: '700',
    color: EL.onSurface,
  },
  agentCardNameActive: {
    color: EL.white,
  },
  agentCardSub: {
    fontSize: 12,
    fontWeight: '500',
    color: EL.onSurfaceMuted,
    marginTop: 2,
  },
  agentCardSubActive: {
    color: 'rgba(255,255,255,0.85)',
  },
  agentMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  agentCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
  },

  assignEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Space.xl,
    gap: Space.xs,
  },
  assignEmptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: EL.onSurface,
    marginTop: Space.sm,
  },
  assignEmptySub: {
    fontSize: 12,
    color: EL.onSurfaceMuted,
    textAlign: 'center',
    paddingHorizontal: Space.lg,
  },

  // Agent row + history button group
  agentRowGroup: { flexDirection: 'row', alignItems: 'stretch', gap: Space.sm },
  historyBtn: {
    paddingHorizontal: Space.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radii.md,
    backgroundColor: EL.surfaceLow,
  },

  // Rotation history modal rows
  historyRow: {
    flexDirection: 'row',
    gap: Space.md,
    paddingVertical: Space.sm,
  },
  historyDot: {
    width: 14,
    alignItems: 'center',
    paddingTop: 4,
  },
  historyDotInner: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: EL.outlineVariant,
  },
  historyAgent: { fontSize: 14, fontWeight: '800', color: EL.onSurface },
  historyCurrent: { fontSize: 9, fontWeight: '800', color: EL.primary, letterSpacing: 0.5 },
  historyMeta: { fontSize: 11, color: EL.onSurfaceMuted, marginTop: 2 },
  historyNote: { fontSize: 11, color: EL.onSurfaceSec, marginTop: 2, fontStyle: 'italic' },
});
