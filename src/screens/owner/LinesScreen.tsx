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
import { useTranslation } from 'react-i18next';

import { GradientButton } from '@/components/common/GradientButton';
import { EL, Common, Glass, Radii, Shadows, Space, Touch, Type } from '@/theme/emeraldLedger';
import { useCreateLine, useDeleteLine, useLines } from '@/hooks/useLines';
import type { LineRow, LineType } from '@/db/types';

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
  const { data: lines } = useLines();
  const createMut = useCreateLine();
  const deleteMut = useDeleteLine();

  const handleDelete = (line: LineRow) => {
    Alert.alert(
      'Delete line?',
      `Are you sure you want to delete "${line.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMut.mutateAsync(line.id);
            } catch (e: any) {
              Alert.alert('Cannot delete', e?.message ?? 'Failed to delete line');
            }
          },
        },
      ]
    );
  };
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<LineType>('daily');

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert(t('borrowers.name_required'));
      return;
    }
    await createMut.mutateAsync({ name, type });
    setName('');
    setType('daily');
    setShowModal(false);
  };

  const activeCount = lines?.length ?? 0;

  const renderItem = ({ item }: { item: LineRow }) => {
    const typeLabel = t(`lines.type_${item.type}`);
    const isDaily = item.type === 'daily' || item.type === 'daily_interest';
    return (
      <Pressable style={styles.lineCard} onLongPress={() => handleDelete(item)} delayLongPress={500}>
        {/* Header */}
        <View style={styles.lineHeader}>
          <View style={{ flex: 1 }}>
            <View style={styles.lineNameRow}>
              <Text style={styles.lineName}>{item.name}</Text>
              <View style={[styles.typeBadge, !isDaily && { backgroundColor: EL.secondaryContainer }]}>
                <Text style={[styles.typeBadgeText, !isDaily && { color: EL.secondary }]}>{typeLabel}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Progress */}
        <View style={styles.progressSection}>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>Collection Line</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: '0%' }]} />
          </View>
        </View>

        {/* Footer */}
        <View style={styles.lineFooter}>
          <View style={styles.footerLeft}>
            <MaterialCommunityIcons name="account" size={18} color={EL.primary} />
            <Text style={styles.footerText}>Long-press to delete</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color={EL.outline} />
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={Common.screen}>
      {/* Summary Cards */}
      <View style={styles.summaryGrid}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Active Lines</Text>
          <Text style={styles.summaryBig}>{activeCount}</Text>
          <View style={styles.summaryTrend}>
            <MaterialCommunityIcons name="trending-up" size={14} color={EL.primary} />
            <Text style={styles.summaryTrendText}>Lines managed</Text>
          </View>
        </View>
      </View>

      {/* Section Header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Daily Collection Routes</Text>
      </View>

      {lines && lines.length > 0 ? (
        <FlatList
          data={lines}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: Space.xl, paddingBottom: 120, gap: Space.xl }}
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
      <Pressable style={styles.fab} onPress={() => setShowModal(true)}>
        <MaterialCommunityIcons name="plus" size={28} color={EL.white} />
      </Pressable>

      {/* Add Line Modal */}
      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <Pressable style={[Glass.dark, styles.modalBackdrop]} onPress={() => setShowModal(false)}>
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
                onPress={() => setShowModal(false)}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Summary
  summaryGrid: {
    paddingHorizontal: Space.xl,
    paddingTop: Space.lg,
    marginBottom: Space.xl,
  },
  summaryCard: {
    backgroundColor: EL.surfaceCard,
    padding: Space.xl,
    borderRadius: Radii.xxl,
    ...Shadows.card,
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: EL.onSurfaceSec,
  },
  summaryBig: {
    fontSize: 36,
    fontWeight: '800',
    color: EL.onSurface,
    marginTop: Space.xs,
  },
  summaryTrend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xs,
    marginTop: Space.lg,
  },
  summaryTrendText: {
    fontSize: 14,
    fontWeight: '600',
    color: EL.primary,
  },

  // Section
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Space.xl,
    marginBottom: Space.lg,
  },
  sectionTitle: {
    ...Type.titleLg,
    fontWeight: '700',
    fontSize: 20,
  },

  // Line card
  lineCard: {
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.lg,
    padding: Space.xl,
    ...Shadows.card,
  },
  lineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Space.lg,
  },
  lineNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    flexWrap: 'wrap',
  },
  lineName: {
    ...Type.titleLg,
    fontWeight: '700',
    fontSize: 18,
  },
  typeBadge: {
    backgroundColor: EL.primaryFixed,
    paddingHorizontal: Space.sm,
    paddingVertical: 2,
    borderRadius: Radii.pill,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: EL.onSurface,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Progress
  progressSection: {
    marginBottom: Space.xl,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Space.sm,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: EL.onSurfaceSec,
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

  // Footer
  lineFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Space.lg,
    borderTopWidth: 1,
    borderTopColor: EL.surfaceMid,
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
  },
  footerText: {
    fontSize: 14,
    fontWeight: '500',
    color: EL.onSurface,
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
  },
  modalTitle: { ...Type.displaySm, marginBottom: Space.lg },
  label: { ...Type.labelMd, color: EL.onSurfaceSec, marginBottom: Space.sm },
  input: {
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.sm + 2,
    paddingHorizontal: Space.lg,
    minHeight: Touch.min,
    ...Type.bodyMd,
    color: EL.onSurface,
    ...Shadows.card,
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
});
