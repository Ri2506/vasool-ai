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

import { Badge } from '@/components/common/Badge';
import { ELCard } from '@/components/common/ELCard';
import { GradientButton } from '@/components/common/GradientButton';
import { EL, Common, Glass, Radii, Shadows, Space, Touch, Type } from '@/theme/emeraldLedger';
import { useCreateLine, useLines } from '@/hooks/useLines';
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

  const renderItem = ({ item }: { item: LineRow }) => (
    <ELCard style={styles.lineCard}>
      <View style={styles.lineHeader}>
        <Text style={styles.lineName}>{item.name}</Text>
        <Badge label={t(`lines.type_${item.type}`)} variant="info" />
      </View>
    </ELCard>
  );

  return (
    <SafeAreaView style={Common.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('lines.title')}</Text>
      </View>

      {lines && lines.length > 0 ? (
        <FlatList
          data={lines}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: Space.xl, paddingBottom: 120 }}
        />
      ) : (
        <ELCard style={{ margin: Space.xl }}>
          <Text style={Type.titleMd}>{t('lines.empty_title')}</Text>
          <Text style={[Type.bodySm, { marginTop: Space.xs }]}>{t('lines.empty_sub')}</Text>
        </ELCard>
      )}

      {/* FAB */}
      <Pressable style={Common.fab} onPress={() => setShowModal(true)}>
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
  header: {
    paddingHorizontal: Space.xl,
    paddingTop: Space.lg,
    paddingBottom: Space.md,
  },
  title: { ...Type.displayMd },
  lineCard: { marginBottom: Space.md },
  lineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lineName: { ...Type.titleMd },

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
