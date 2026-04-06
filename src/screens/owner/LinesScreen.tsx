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
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Colors } from '@/constants/colors';
import { Radius, Spacing, TouchTarget, Typography } from '@/constants/typography';
import { useCreateLine, useLines } from '@/hooks/useLines';
import type { LineRow, LineType } from '@/db/types';

const LINE_TYPES: { value: LineType; labelKey: string }[] = [
  { value: 'daily', labelKey: 'lines.type_daily' },
  { value: 'weekly', labelKey: 'lines.type_weekly' },
  { value: 'monthly_emi', labelKey: 'lines.type_monthly_emi' },
  { value: 'monthly_interest', labelKey: 'lines.type_monthly_interest' },
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
    <Card style={styles.lineCard}>
      <View style={styles.lineHeader}>
        <Text style={styles.lineName}>{item.name}</Text>
        <Badge label={t(`lines.type_${item.type}`)} variant="info" />
      </View>
    </Card>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('lines.title')}</Text>
      </View>

      {lines && lines.length > 0 ? (
        <FlatList
          data={lines}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: Spacing.xl, paddingBottom: 120 }}
        />
      ) : (
        <Card style={{ margin: Spacing.xl }}>
          <Text style={styles.emptyTitle}>{t('lines.empty_title')}</Text>
          <Text style={styles.emptySub}>{t('lines.empty_sub')}</Text>
        </Card>
      )}

      <View style={styles.fab}>
        <Button title={'+ ' + t('lines.add')} onPress={() => setShowModal(true)} />
      </View>

      <Modal
        visible={showModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>{t('lines.add')}</Text>

            <Text style={styles.label}>{t('lines.line_name')}</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholderTextColor={Colors.textMuted}
            />

            <Text style={[styles.label, { marginTop: Spacing.md }]}>
              {t('lines.line_type')}
            </Text>
            <View style={styles.typeGrid}>
              {LINE_TYPES.map((opt) => (
                <Pressable
                  key={opt.value}
                  onPress={() => setType(opt.value)}
                  style={[
                    styles.typeChip,
                    type === opt.value && styles.typeChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.typeChipLabel,
                      type === opt.value && styles.typeChipLabelActive,
                    ]}
                  >
                    {t(opt.labelKey)}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.modalButtons}>
              <Button
                title={t('common.cancel')}
                variant="secondary"
                onPress={() => setShowModal(false)}
                style={{ flex: 1, marginRight: Spacing.sm }}
              />
              <Button
                title={t('lines.create')}
                onPress={handleCreate}
                loading={createMut.isPending}
                style={{ flex: 1, marginLeft: Spacing.sm }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  title: { ...Typography.display, color: Colors.text },
  lineCard: { marginBottom: Spacing.md },
  lineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lineName: { ...Typography.title, color: Colors.text },
  emptyTitle: { ...Typography.title, color: Colors.text },
  emptySub: { ...Typography.body, color: Colors.textSec, marginTop: 4 },
  fab: {
    position: 'absolute',
    left: Spacing.xl,
    right: Spacing.xl,
    bottom: Spacing.xl,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.bg,
    borderTopLeftRadius: Radius.card * 2,
    borderTopRightRadius: Radius.card * 2,
    padding: Spacing.xl,
    paddingBottom: Spacing.xxl,
  },
  modalTitle: {
    ...Typography.display,
    color: Colors.text,
    marginBottom: Spacing.lg,
  },
  label: {
    ...Typography.caption,
    color: Colors.textSec,
    marginBottom: Spacing.sm,
  },
  input: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.button,
    paddingHorizontal: Spacing.md,
    minHeight: TouchTarget.min,
    ...Typography.body,
    color: Colors.text,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  typeChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: Spacing.sm,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.white,
    minHeight: TouchTarget.min,
    justifyContent: 'center',
  },
  typeChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  typeChipLabel: { ...Typography.body, color: Colors.text, fontWeight: '600' },
  typeChipLabelActive: { color: Colors.white },
  modalButtons: {
    flexDirection: 'row',
    marginTop: Spacing.xl,
  },
});
