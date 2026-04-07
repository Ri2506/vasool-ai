import React from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Avatar } from '@/components/common/Avatar';
import { ELCard } from '@/components/common/ELCard';
import { ProgressBar } from '@/components/common/ProgressBar';
import { EL, Common, Glass, Radii, Shadows, Space, Type } from '@/theme/emeraldLedger';
import { useDueToday, useRecordCollection, useTodaySummary } from '@/hooks/useCollections';
import { formatRupees } from '@/utils/format';
import type { DueTodayItem } from '@/db/repos/collections';
import type { OwnerStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<OwnerStackParamList>;

export function BatchCollectScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const { data: items = [] } = useDueToday();
  const { data: summary } = useTodaySummary();
  const recordMut = useRecordCollection();

  const total = items.length + (summary?.collectionCount ?? 0);
  const done = summary?.collectionCount ?? 0;
  const progress = total > 0 ? done / total : 0;

  const handleQuickCollect = async (item: DueTodayItem) => {
    try {
      await recordMut.mutateAsync({
        loanId: item.loan_id,
        planEntryId: item.plan_entry_id,
        amount: item.expected_amount,
        expectedAmount: item.expected_amount,
      });
    } catch (e: any) {
      Alert.alert(t('common.error_generic'), e?.message ?? '');
    }
  };

  const renderItem = ({ item }: { item: DueTodayItem }) => (
    <Pressable
      style={styles.row}
      onPress={() => navigation.navigate('Collect', { item })}
    >
      <Avatar name={item.borrower_name} size={36} />
      <View style={styles.rowBody}>
        <Text style={styles.rowName}>{item.borrower_name}</Text>
        <Text style={styles.rowSub}>
          {formatRupees(item.expected_amount)} {item.line_name ? `\u2022 ${item.line_name}` : 'daily'}
        </Text>
      </View>
      <Pressable
        onPress={() => handleQuickCollect(item)}
        disabled={recordMut.isPending}
        style={({ pressed }) => [
          styles.collectBtn,
          pressed && { opacity: 0.85 },
          recordMut.isPending && { opacity: 0.5 },
        ]}
      >
        <Text style={styles.collectBtnLabel}>
          {formatRupees(item.expected_amount)}
        </Text>
      </Pressable>
    </Pressable>
  );

  return (
    <SafeAreaView style={Common.screen}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.plan_entry_id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 120 }}
        ListHeaderComponent={
          <>
            {/* Progress card */}
            <ELCard style={styles.progressCard}>
              <View style={styles.progressTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.progressLabel}>Daily Collection Progress</Text>
                  <Text style={styles.progressAmount}>
                    {formatRupees(summary?.totalCollected ?? 0)} collected today
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[Type.labelLg, { color: EL.primary }]}>
                    {done} of {total}
                  </Text>
                  <Text style={Type.labelSm}>collected</Text>
                </View>
              </View>
              <ProgressBar progress={progress} />
            </ELCard>

            {/* Section header for remaining */}
            {items.length > 0 ? (
              <Text style={styles.sectionLabel}>Remaining Today</Text>
            ) : null}
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}>
              <MaterialCommunityIcons name="check-all" size={48} color={EL.primary} />
            </View>
            <Text style={styles.emptyTitle}>All done!</Text>
            <Text style={styles.emptySub}>No more collections due today.</Text>
          </View>
        }
      />

      {/* Bottom summary bar */}
      <View style={[Glass.container, styles.bottomBar]}>
        <View style={styles.bottomLeft}>
          <View style={styles.pulseDot} />
          <View>
            <Text style={Type.labelSm}>Session Total</Text>
            <Text style={styles.bottomAmount}>
              {formatRupees(summary?.totalCollected ?? 0)} collected
            </Text>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={Type.labelSm}>Pending</Text>
          <Text style={[Type.titleMd, { color: EL.onSurfaceMuted }]}>
            {items.length} remaining
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Progress
  progressCard: {
    marginHorizontal: Space.lg,
    marginTop: Space.md,
    marginBottom: Space.lg,
  },
  progressTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: Space.md,
  },
  progressLabel: {
    ...Type.bodySm,
    color: EL.onSurfaceMuted,
  },
  progressAmount: {
    ...Type.displaySm,
    color: EL.primary,
    fontWeight: '800',
    letterSpacing: -0.5,
  },

  // Section
  sectionLabel: {
    ...Type.labelSm,
    color: EL.onSurfaceMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: Space.xl,
    marginBottom: Space.md,
  },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.md,
    marginHorizontal: Space.lg,
    marginBottom: Space.sm,
    paddingHorizontal: Space.lg,
    height: 64,
    ...Shadows.card,
  },
  rowBody: { flex: 1, marginLeft: Space.md },
  rowName: { ...Type.labelLg, color: EL.onSurface },
  rowSub: { ...Type.labelSm, color: EL.onSurfaceMuted, marginTop: 1 },
  collectBtn: {
    backgroundColor: EL.primary,
    borderRadius: Radii.md,
    paddingHorizontal: Space.xl,
    paddingVertical: Space.sm,
    ...Shadows.card,
  },
  collectBtnLabel: { ...Type.labelLg, color: EL.white },

  // Empty
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Space.xl, marginTop: Space.xxxl },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: EL.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Space.lg,
  },
  emptyTitle: { ...Type.displaySm, color: EL.primary },
  emptySub: { ...Type.bodySm, color: EL.onSurfaceSec, marginTop: Space.xs },

  // Bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Space.xxl,
    paddingVertical: Space.xl,
    paddingBottom: Space.xxxl,
    borderTopLeftRadius: Radii.xl + 12,
    borderTopRightRadius: Radii.xl + 12,
    ...Shadows.float,
  },
  bottomLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: EL.primary,
  },
  bottomAmount: {
    ...Type.titleLg,
    fontWeight: '800',
    color: EL.onSurface,
  },
});
