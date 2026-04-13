import React from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { CommonActions, useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Avatar } from '@/components/common/Avatar';
import { EL, Common, Glass, Radii, Shadows, Space, Type } from '@/theme/emeraldLedger';
import { useDueToday, useRecordCollection, useTodaySummary } from '@/hooks/useCollections';
import { useAuthStore } from '@/store/authStore';
import { formatRupees } from '@/utils/format';
import { getTodayCollections } from '@/db/repos/collections';
import type { DueTodayItem } from '@/db/repos/collections';
import type { OwnerStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<OwnerStackParamList>;

export function BatchCollectScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const orgId = useAuthStore((s) => s.user?.orgId ?? null);
  const { data: items = [], refetch: refetchDue } = useDueToday();
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

  // Fetch today's collected items
  const { data: collectedItems = [] } = useQuery({
    queryKey: ['today-collections', orgId],
    enabled: !!orgId,
    queryFn: () => getTodayCollections(orgId!),
  });
  const collectedCount = collectedItems.length;

  const renderCollectedItem = (c: { borrower_name: string; amount: number }, index: number) => (
    <View key={`collected-${index}`} style={styles.collectedRow}>
      <View style={styles.collectedLeft}>
        <View style={styles.checkCircle}>
          <MaterialCommunityIcons name="check" size={18} color={EL.primary} />
        </View>
        <View>
          <Text style={styles.rowName}>{c.borrower_name}</Text>
          <Text style={styles.rowSub}>{formatRupees(c.amount)}</Text>
        </View>
      </View>
      <Text style={styles.collectedAmount}>{'\u2713'} {formatRupees(c.amount)}</Text>
    </View>
  );

  // Route differs by role: owner has 'Collect' as a stack route with params,
  // agent has 'Collect' as a tab name (no params). Dispatch a CommonAction
  // that works for both — when navigated without params we just return to
  // the collect tab; with params we open the CollectScreen for that item.
  const openCollect = (item: DueTodayItem) => {
    try {
      // Owner path: 'Collect' is a stack route that expects { item } params
      navigation.dispatch(CommonActions.navigate({ name: 'Collect', params: { item } }));
    } catch {
      // Agent path: 'Collect' is a tab name (no params)
      navigation.dispatch(CommonActions.navigate({ name: 'Collect' }));
    }
  };

  const renderItem = ({ item }: { item: DueTodayItem }) => (
    <Pressable
      style={({ pressed }) => [
        styles.remainingRow,
        pressed && { transform: [{ scale: 0.98 }] },
      ]}
      onPress={() => openCollect(item)}
    >
      <View style={styles.remainingLeft}>
        <Avatar name={item.borrower_name} size={36} />
        <View>
          <Text style={styles.rowName}>{item.borrower_name}</Text>
          <Text style={styles.rowSub}>
            {formatRupees(item.expected_amount)} {item.line_name ? item.line_name : 'daily'}
          </Text>
        </View>
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
      {/* ── Fixed Header ── */}
      <View style={[Glass.container, styles.header]}>
        <View style={styles.headerLeft}>
          <Pressable
            style={styles.headerBtn}
            onPress={() => navigation.goBack()}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color={EL.onSurface} />
          </Pressable>
          <Text style={styles.headerTitle}>Batch Collect</Text>
        </View>
        <Pressable
          style={styles.headerBtn}
          onPress={() => refetchDue()}
        >
          <MaterialCommunityIcons name="refresh" size={22} color={EL.onSurface} />
        </Pressable>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.plan_entry_id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 140 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refetchDue} tintColor={EL.primary} />}
        ListHeaderComponent={
          <>
            {/* ── Progress Card ── */}
            <View style={styles.progressCard}>
              <View style={styles.progressTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.progressLabel}>Daily Collection Progress</Text>
                  <Text style={styles.progressAmount}>
                    {formatRupees(summary?.totalCollected ?? 0)} collected today
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.progressCount}>
                    {done} of {total}
                  </Text>
                  <Text style={styles.progressCountSub}>collected</Text>
                </View>
              </View>
              {/* Gradient progress bar */}
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
              </View>
            </View>

            {/* ── Collected Items ── */}
            {collectedCount > 0 ? (
              <View style={styles.collectedSection}>
                {collectedItems.map((c, idx) =>
                  renderCollectedItem(c, idx)
                )}
              </View>
            ) : null}

            {/* ── Remaining section header ── */}
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

      {/* ── Bottom Summary Bar ── */}
      <View style={styles.bottomBar}>
        <View style={styles.bottomLeft}>
          <View style={styles.pulseDot} />
          <View>
            <Text style={styles.bottomLabel}>Session Total</Text>
            <Text style={styles.bottomAmount}>
              {formatRupees(summary?.totalCollected ?? 0)} collected
            </Text>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.bottomLabel}>Pending</Text>
          <Text style={styles.bottomPending}>
            {items.length} remaining
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Space.xl,
    paddingVertical: Space.lg,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.lg,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: EL.onSurface,
    letterSpacing: -0.2,
  },

  // Progress card
  progressCard: {
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.lg,
    padding: Space.xxl,
    marginHorizontal: Space.lg,
    marginTop: Space.md,
    marginBottom: Space.xl,
    ...Shadows.card,
  },
  progressTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: Space.sm,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: EL.onSurfaceMuted,
  },
  progressAmount: {
    fontSize: 28,
    fontWeight: '800',
    color: EL.primary,
    letterSpacing: -0.5,
  },
  progressCount: {
    fontSize: 14,
    fontWeight: '700',
    color: EL.primary,
  },
  progressCountSub: {
    fontSize: 12,
    color: EL.onSurfaceMuted,
  },
  progressTrack: {
    height: 12,
    backgroundColor: EL.surfaceHighest,
    borderRadius: Radii.pill,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: EL.primary,
    borderRadius: Radii.pill,
  },

  // Collected items
  collectedSection: {
    paddingHorizontal: Space.lg,
    gap: Space.sm,
  },
  collectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 60,
    backgroundColor: EL.surface,
    borderRadius: Radii.md,
    paddingHorizontal: Space.lg,
    borderLeftWidth: 3,
    borderLeftColor: EL.primaryContainer,
  },
  collectedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    flex: 1,
  },
  checkCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: EL.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collectedAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: EL.primary,
  },

  // Section label
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: EL.onSurfaceMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: Space.xl + 4,
    marginBottom: Space.md,
    marginTop: Space.sm,
  },

  // Remaining rows
  remainingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 60,
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.md,
    paddingHorizontal: Space.lg,
    marginHorizontal: Space.lg,
    marginBottom: Space.md,
  },
  remainingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    flex: 1,
  },
  rowName: {
    fontSize: 14,
    fontWeight: '700',
    color: EL.onSurface,
  },
  rowSub: {
    fontSize: 12,
    color: EL.onSurfaceMuted,
    marginTop: 1,
  },
  collectBtn: {
    backgroundColor: EL.primary,
    borderRadius: Radii.md,
    paddingHorizontal: Space.xxl,
    paddingVertical: Space.sm,
    ...Shadows.card,
  },
  collectBtnLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: EL.white,
  },

  // Empty state
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Space.xl,
    marginTop: Space.xxxl,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: EL.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Space.lg,
  },
  emptyTitle: {
    ...Type.displaySm,
    color: EL.primary,
  },
  emptySub: {
    ...Type.bodySm,
    color: EL.onSurfaceSec,
    marginTop: Space.xs,
  },

  // Bottom summary bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Space.xxxl,
    paddingVertical: Space.xxl,
    paddingBottom: Space.xxxl,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    backgroundColor: 'rgba(240, 253, 244, 0.9)',
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
  bottomLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: EL.onSurfaceMuted,
  },
  bottomAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: EL.onSurface,
    lineHeight: 22,
  },
  bottomPending: {
    fontSize: 18,
    fontWeight: '700',
    color: EL.onSurfaceMuted,
    lineHeight: 22,
  },
});
