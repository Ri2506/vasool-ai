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
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { EL, Common, Radii, Shadows, Space, Fonts } from '@/theme/emeraldLedger';
import { useDueToday, useRecordCollection, useTodaySummary } from '@/hooks/useCollections';
import { useAuthStore } from '@/store/authStore';
import { formatRupees } from '@/utils/format';
import type { DueTodayItem } from '@/db/repos/collections';
import type { AgentStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<AgentStackParamList>;

export function AgentHomeScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);
  const { data: items = [], refetch } = useDueToday();
  const { data: summary } = useTodaySummary();
  const recordMut = useRecordCollection();
  const [pendingIds, setPendingIds] = React.useState<Set<string>>(new Set());

  const total = items.length + (summary?.collectionCount ?? 0);
  const done = summary?.collectionCount ?? 0;
  const progress = total > 0 ? done / total : 0;
  const progressPct = Math.round(progress * 100);
  const targetAmount = (summary?.totalCollected ?? 0) + (summary?.totalExpected ?? 0);

  const handleQuickCollect = async (item: DueTodayItem) => {
    if (pendingIds.has(item.plan_entry_id)) return;
    setPendingIds((prev) => new Set(prev).add(item.plan_entry_id));
    try {
      await recordMut.mutateAsync({
        loanId: item.loan_id,
        planEntryId: item.plan_entry_id,
        amount: item.expected_amount,
        expectedAmount: item.expected_amount,
        agentId: user?.id,
      });
      const alreadyPaid = Math.max(0, item.installment_number - 1) * item.loan_emi;
      const loanRemaining = Math.max(0, item.loan_principal - alreadyPaid - item.expected_amount);
      const totalDays = item.loan_emi > 0 ? Math.ceil(item.loan_principal / item.loan_emi) : 100;
      navigation.navigate('AgentReceipt', {
        borrowerName: item.borrower_name,
        amount: item.expected_amount,
        loanRemaining,
        daysPaid: item.installment_number,
        totalDays,
        agentName: user?.name,
        timestamp: Date.now(),
      });
    } catch (e: any) {
      Alert.alert(t('common.error_generic'), e?.message ?? '');
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.plan_entry_id);
        return next;
      });
    }
  };

  const renderItem = ({ item }: { item: DueTodayItem }) => (
    <View style={styles.borrowerCard}>
      <View style={styles.borrowerLeft}>
        <View style={styles.initialsBox}>
          <Text style={styles.initialsText}>
            {item.borrower_name
              .split(' ')
              .map((w) => w[0])
              .join('')
              .toUpperCase()
              .slice(0, 2)}
          </Text>
        </View>
        <View>
          <View style={styles.borrowerNameRow}>
            <Text style={styles.borrowerName}>{item.borrower_name}</Text>
            <View style={styles.nadapuPill}>
              <Text style={styles.nadapuText}>{'\u0BA8\u0B9F\u0BAA\u0BCD\u0BAA\u0BC1'}</Text>
            </View>
          </View>
          <Text style={styles.borrowerSub}>
            {formatRupees(item.expected_amount)} daily
          </Text>
        </View>
      </View>
      <Pressable
        onPress={() => handleQuickCollect(item)}
        disabled={pendingIds.has(item.plan_entry_id)}
        style={({ pressed }) => [
          styles.payBtn,
          pressed && { opacity: 0.9 },
          pendingIds.has(item.plan_entry_id) && { opacity: 0.5 },
        ]}
      >
        <MaterialCommunityIcons name="cash-multiple" size={24} color="#f5fff7" />
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView style={Common.screen}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.plan_entry_id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor={EL.primary} />}
        ListHeaderComponent={
          <>
            {/* Header */}
            <View style={styles.headerRow}>
              <View style={styles.greetSection}>
                <Text style={styles.greetingText}>
                  Good morning, {user?.name ?? 'Agent'}
                </Text>
                <Text style={styles.greetingSub}>Ready for today's collections?</Text>
              </View>
              <View style={styles.headerRight}>
                <Pressable style={styles.headerIconBtn}>
                  <MaterialCommunityIcons name="bell-outline" size={24} color={EL.onSurface} />
                </Pressable>
                <View style={styles.profileCircle}>
                  <Text style={styles.profileInitial}>
                    {(user?.name ?? 'A')[0].toUpperCase()}
                  </Text>
                </View>
              </View>
            </View>

            {/* Today's Target Card */}
            <View style={styles.targetCard}>
              <View style={styles.targetTopRow}>
                <View>
                  <Text style={styles.targetLabel}>TODAY'S TARGET</Text>
                  <Text style={styles.targetAmount}>{formatRupees(targetAmount)}</Text>
                </View>
                <View style={styles.doneBadge}>
                  <Text style={styles.doneBadgeText}>{progressPct}% Done</Text>
                </View>
              </View>

              <View style={styles.targetStatsRow}>
                <Text style={styles.collectedText}>
                  {formatRupees(summary?.totalCollected ?? 0)} collected
                </Text>
                <Text style={styles.countText}>
                  {done} of {total}
                </Text>
              </View>

              {/* Progress bar */}
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progressPct}%` as any }]} />
              </View>
            </View>

            {/* Start Batch Collection CTA */}
            <Pressable
              style={({ pressed }) => [styles.batchBtn, pressed && { opacity: 0.95, transform: [{ scale: 0.98 }] }]}
              onPress={() => navigation.navigate('BatchCollect')}
            >
              <MaterialCommunityIcons name="lightning-bolt" size={22} color={EL.white} />
              <Text style={styles.batchBtnText}>Start Batch Collection</Text>
            </Pressable>

            {/* Due Today header */}
            {items.length > 0 && (
              <View style={styles.dueTodayHeader}>
                <Text style={styles.dueTodayTitle}>Due Today</Text>
                <Pressable onPress={() => navigation.navigate('BatchCollect')}>
                  <Text style={styles.viewAll}>View All</Text>
                </Pressable>
              </View>
            )}

            {items.length === 0 && (
              <View style={styles.emptyWrap}>
                <View style={styles.emptyIcon}>
                  <MaterialCommunityIcons name="check-all" size={48} color={EL.primary} />
                </View>
                <Text style={styles.emptyTitle}>All done!</Text>
                <Text style={styles.emptySub}>No more collections due today.</Text>
              </View>
            )}
          </>
        }
      />

      {/* FAB — navigate to Expenses tab within the tab navigator parent */}
      <Pressable
        style={styles.fab}
        onPress={() => {
          const parent = navigation.getParent();
          if (parent) {
            parent.navigate('Expenses' as never);
          }
        }}
      >
        <MaterialCommunityIcons name="plus" size={28} color={EL.white} />
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Space.xl,
    paddingTop: Space.lg,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: EL.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: EL.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInitial: {
    fontFamily: Fonts.headline,
    fontSize: 16,
    fontWeight: '700',
    color: EL.white,
  },
  // Greeting
  greetSection: {
    flex: 1,
  },
  greetingText: {
    fontFamily: Fonts.headline,
    fontSize: 24,
    fontWeight: '800',
    color: EL.onSurface,
    letterSpacing: -0.3,
  },
  greetingSub: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: EL.onSurfaceSec,
    marginTop: Space.xs,
  },

  // Target Card
  targetCard: {
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.lg,
    padding: Space.xl,
    marginHorizontal: Space.xl,
    marginTop: Space.xl,
    ...Shadows.float,
  },
  targetTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Space.lg,
  },
  targetLabel: {
    fontFamily: Fonts.body,
    fontSize: 11,
    fontWeight: '600',
    color: EL.onSurfaceSec,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Space.xs,
  },
  targetAmount: {
    fontFamily: Fonts.headline,
    fontSize: 36,
    fontWeight: '800',
    color: EL.onSurface,
    letterSpacing: -1,
  },
  doneBadge: {
    backgroundColor: EL.primaryFixed,
    paddingHorizontal: Space.md,
    paddingVertical: Space.xs,
    borderRadius: Radii.pill,
  },
  doneBadgeText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    fontWeight: '700',
    color: EL.onPrimaryFixed,
  },
  targetStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Space.sm,
  },
  collectedText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    fontWeight: '700',
    color: EL.primary,
  },
  countText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    fontWeight: '500',
    color: EL.onSurfaceSec,
  },
  progressTrack: {
    height: 12,
    backgroundColor: EL.surfaceHighest,
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 6,
    backgroundColor: EL.primary,
  },

  // Batch CTA
  batchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: EL.primary,
    marginHorizontal: Space.xl,
    marginTop: Space.xl,
    paddingVertical: 18,
    borderRadius: Radii.md,
    gap: Space.md,
    shadowColor: 'rgba(0, 105, 72, 0.3)',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 6,
  },
  batchBtnText: {
    fontFamily: Fonts.headline,
    fontSize: 18,
    fontWeight: '700',
    color: EL.white,
  },

  // Due Today
  dueTodayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Space.xl + 2,
    marginTop: Space.xxl,
    marginBottom: Space.lg,
  },
  dueTodayTitle: {
    fontFamily: Fonts.headline,
    fontSize: 18,
    fontWeight: '700',
    color: EL.onSurface,
  },
  viewAll: {
    fontFamily: Fonts.body,
    fontSize: 14,
    fontWeight: '700',
    color: EL.primary,
  },

  // Borrower cards
  borrowerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.lg,
    padding: Space.xl,
    marginHorizontal: Space.xl,
    marginBottom: Space.lg,
  },
  borrowerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.lg,
  },
  initialsBox: {
    width: 48,
    height: 48,
    borderRadius: Radii.md,
    backgroundColor: EL.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    fontFamily: Fonts.headline,
    fontSize: 16,
    fontWeight: '700',
    color: EL.primary,
  },
  borrowerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
  },
  borrowerName: {
    fontFamily: Fonts.headline,
    fontSize: 15,
    fontWeight: '700',
    color: EL.onSurface,
  },
  nadapuPill: {
    backgroundColor: EL.primaryFixed,
    paddingHorizontal: Space.sm,
    paddingVertical: 2,
    borderRadius: Radii.pill,
  },
  nadapuText: {
    fontFamily: Fonts.body,
    fontSize: 10,
    fontWeight: '700',
    color: EL.onPrimaryFixed,
  },
  borrowerSub: {
    fontFamily: Fonts.body,
    fontSize: 14,
    fontWeight: '500',
    color: EL.onSurfaceSec,
    marginTop: 2,
  },
  payBtn: {
    backgroundColor: EL.primaryContainer,
    borderRadius: Radii.md,
    padding: Space.md,
  },

  // Empty
  emptyWrap: {
    alignItems: 'center',
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
    fontFamily: Fonts.headline,
    fontSize: 24,
    fontWeight: '700',
    color: EL.primary,
  },
  emptySub: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: EL.onSurfaceSec,
    marginTop: Space.xs,
  },

  // FAB
  fab: {
    position: 'absolute',
    right: Space.xxl,
    bottom: Space.xxl + 60,
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: EL.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.float,
  },
});
