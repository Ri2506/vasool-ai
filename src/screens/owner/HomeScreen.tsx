import React, { useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Modal, Pressable, RefreshControl, SafeAreaView, StyleSheet, Text, View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Avatar } from '@/components/common/Avatar';
import { ELCard } from '@/components/common/ELCard';
import { GradientButton } from '@/components/common/GradientButton';
import { ProgressBar } from '@/components/common/ProgressBar';
import { StatusBadge } from '@/components/common/StatusBadge';
import { StarRating } from '@/components/common/StarRating';
import { EL, Common, Glass, Radii, Shadows, Space, Touch, Type, Fonts } from '@/theme/emeraldLedger';
import { useDueToday, useTodaySummary } from '@/hooks/useCollections';
import { useSmartCards } from '@/hooks/useSmartCards';
import { useBorrowerStatuses } from '@/hooks/useBorrowerStatus';
import { useAuthStore } from '@/store/authStore';
import { formatRupees } from '@/utils/format';
import type { DueTodayItem } from '@/db/repos/collections';
import type { OwnerStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<OwnerStackParamList>;

export function HomeScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);
  const { data: summary } = useTodaySummary();
  const { data: dueItems = [], isLoading, refetch } = useDueToday();
  const { data: smart } = useSmartCards();
  const { data: statuses } = useBorrowerStatuses();
  const [showBreakdown, setShowBreakdown] = useState(false);

  const total = dueItems.length + (summary?.collectionCount ?? 0);
  const done = summary?.collectionCount ?? 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const renderDueItem = ({ item }: { item: DueTodayItem }) => {
    const st = statuses?.[item.borrower_id];
    return (
      <Pressable
        style={({ pressed }) => [styles.borrowerCard, pressed && styles.borrowerCardPressed]}
        onPress={() => navigation.navigate('Collect', { item })}
      >
        <View style={styles.borrowerLeft}>
          <Avatar name={item.borrower_name} size={48} />
          <View style={styles.borrowerInfo}>
            <Text style={styles.borrowerName}>{item.borrower_name}</Text>
            <View style={styles.borrowerMeta}>
              <Text style={styles.borrowerSchedule}>
                {formatRupees(item.expected_amount)}/day {'\u2022'} {item.line_name ?? 'Daily'}
              </Text>
              {st?.is_nippu !== undefined ? (
                <StatusBadge status={st.is_nippu ? 'nippu' : 'nadapu'} />
              ) : null}
            </View>
            {st?.rating ? (
              <View style={styles.starRow}>
                <StarRating rating={st.rating} size={14} />
              </View>
            ) : null}
          </View>
        </View>
        {/* Green gradient collect button */}
        <Pressable
          style={({ pressed }) => [styles.collectBtn, pressed && styles.collectBtnPressed]}
          onPress={() => navigation.navigate('Collect', { item })}
        >
          <Text style={styles.collectBtnText}>{formatRupees(item.expected_amount)}</Text>
        </Pressable>
      </Pressable>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={Common.screen}>
        <ActivityIndicator size="large" color={EL.primary} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={Common.screen}>
      <FlatList
        data={dueItems}
        keyExtractor={(item) => item.plan_entry_id}
        renderItem={renderDueItem}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor={EL.primary} />}
        ListHeaderComponent={
          <>
            {/* Sticky Top Bar */}
            <View style={styles.topBar}>
              <View style={styles.topBarLeft}>
                <View style={styles.avatarCircle}>
                  <Avatar name={user?.name ?? 'U'} size={40} />
                </View>
                <Text style={styles.logoText}>VasoolAI</Text>
              </View>
              <Pressable
                style={styles.bellBtn}
                onPress={() => Alert.alert('Notifications', 'No new notifications')}
              >
                <MaterialCommunityIcons name="bell-outline" size={24} color={EL.primary} />
              </Pressable>
            </View>

            {/* Two-column metric cards */}
            {smart ? (
              <>
                <View style={styles.metricsRow}>
                  <ELCard style={styles.metricCard}>
                    <Text style={styles.metricLabel}>This month profit</Text>
                    <Text style={[
                      styles.metricValue,
                      { color: smart.monthProfit >= 0 ? EL.primary : EL.nippu },
                    ]}>
                      {formatRupees(smart.monthProfit)}
                    </Text>
                    <View style={styles.trendRow}>
                      <MaterialCommunityIcons
                        name={smart.monthProfit >= 0 ? 'trending-up' : 'trending-down'}
                        size={14}
                        color={smart.monthProfit >= 0 ? EL.primary : EL.nippu}
                      />
                      <Text style={[styles.trendText, { color: smart.monthProfit >= 0 ? EL.primary : EL.nippu }]}>
                        Interest - expenses
                      </Text>
                    </View>
                  </ELCard>

                  <Pressable onPress={() => setShowBreakdown(true)} style={{ flex: 1 }}>
                    <ELCard style={[styles.metricCard, { flex: undefined }]}>
                      <Text style={styles.metricLabel}>Available to lend</Text>
                      <Text style={styles.metricValueDark}>
                        {formatRupees(smart.availableToLend)}
                      </Text>
                      <Text style={styles.metricHint}>Ready to disburse</Text>
                    </ELCard>
                  </Pressable>
                </View>

                {/* Principal vs Interest split */}
                <View style={styles.metricsRow}>
                  <ELCard style={styles.metricCard}>
                    <Text style={styles.metricLabel}>Interest earned</Text>
                    <Text style={[styles.metricValue, { color: EL.primary }]}>
                      {formatRupees(smart.monthInterestEarned)}
                    </Text>
                    <Text style={styles.metricHint}>This month</Text>
                  </ELCard>

                  <ELCard style={styles.metricCard}>
                    <Text style={styles.metricLabel}>Principal recovered</Text>
                    <Text style={styles.metricValueDark}>
                      {formatRupees(smart.monthPrincipalRecovered)}
                    </Text>
                    <Text style={styles.metricHint}>Capital returning</Text>
                  </ELCard>
                </View>

                {/* Capital at Risk — only show if > 0 (interest-only loans outstanding) */}
                {smart.capitalAtRisk > 0 ? (
                  <View style={styles.carSection}>
                    <ELCard style={styles.carCard}>
                      <View style={styles.carHeader}>
                        <MaterialCommunityIcons
                          name="shield-alert-outline"
                          size={18}
                          color={EL.warn}
                        />
                        <Text style={styles.carLabel}>Capital at Risk</Text>
                      </View>
                      <Text style={styles.carValue}>{formatRupees(smart.capitalAtRisk)}</Text>
                      <Text style={styles.carHint}>
                        Outstanding principal on interest-only loans
                      </Text>
                    </ELCard>
                  </View>
                ) : null}
              </>
            ) : null}

            {/* Today's Progress section */}
            <View style={styles.progressSection}>
              <ELCard style={styles.progressCard}>
                <View style={styles.progressHeader}>
                  <View>
                    <Text style={styles.progressTitle}>Today's progress</Text>
                    <Text style={styles.progressSubtitle}>Collection Target</Text>
                  </View>
                  <Text style={styles.progressPct}>{pct}%</Text>
                </View>
                <ProgressBar progress={total > 0 ? done / total : 0} />
                <View style={styles.progressFooter}>
                  <Text style={styles.progressCount}>
                    {done}/{total} collected
                  </Text>
                  <Text style={styles.progressAmount}>
                    {formatRupees(summary?.totalCollected ?? 0)} / {formatRupees((summary?.totalCollected ?? 0) + (summary?.totalExpected ?? 0))}
                  </Text>
                </View>
              </ELCard>
            </View>

            {/* Pending Collections header */}
            {dueItems.length > 0 ? (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Pending Collections</Text>
                <Pressable onPress={() => navigation.navigate('BatchCollect')}>
                  <Text style={styles.viewAllText}>View all</Text>
                </Pressable>
              </View>
            ) : (
              <ELCard style={{ marginHorizontal: Space.lg, marginBottom: Space.lg }}>
                <Text style={Type.titleMd}>No collections due</Text>
                <Text style={[Type.bodySm, { marginTop: Space.xs }]}>
                  Create borrowers and loans to see today's collection list here.
                </Text>
              </ELCard>
            )}
          </>
        }
      />

      {/* FAB -- add new borrower */}
      <Pressable
        style={styles.fab}
        onPress={() => navigation.navigate('BorrowerEdit', {})}
      >
        <MaterialCommunityIcons name="plus" size={28} color={EL.white} />
      </Pressable>

      {/* Cash Position Breakdown Modal */}
      <Modal visible={showBreakdown} transparent animationType="slide" onRequestClose={() => setShowBreakdown(false)}>
        <Pressable style={[Glass.dark, { flex: 1, justifyContent: 'flex-end' }]} onPress={() => setShowBreakdown(false)}>
          <View style={[Glass.container, styles.sheet]}>
            <Text style={Type.displaySm}>Cash Position</Text>
            {smart ? (
              <>
                <BRow label="Collections received" value={formatRupees(smart.monthCollected)} plus />
                <BRow label="Investments added" value={formatRupees(smart.totalInvested)} plus />
                <View style={styles.divider} />
                <BRow label="Total in" value={formatRupees(smart.monthCollected + smart.totalInvested)} bold plus />
                <View style={{ height: Space.lg }} />
                <BRow label="Loans given out" value={formatRupees(smart.monthLent)} />
                <BRow label="Expenses" value={formatRupees(smart.monthExpenses)} />
                <View style={styles.divider} />
                <BRow label="Total out" value={formatRupees(smart.monthLent + smart.monthExpenses)} bold />
                <View style={styles.divider} />
                <View style={styles.totalRow}>
                  <Text style={Type.titleLg}>Available to lend</Text>
                  <Text style={[Type.displayMd, { color: EL.primary }]}>{formatRupees(smart.availableToLend)}</Text>
                </View>
              </>
            ) : null}
            <GradientButton title="Close" variant="secondary" onPress={() => setShowBreakdown(false)} style={{ marginTop: Space.xl }} />
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function BRow({ label, value, plus, bold }: { label: string; value: string; plus?: boolean; bold?: boolean }) {
  return (
    <View style={styles.bRow}>
      <Text style={[Type.bodyMd, bold && { fontWeight: '700' }]}>{label}</Text>
      <Text style={[Type.bodyMd, { color: plus ? EL.primary : EL.nippu, fontWeight: bold ? '700' : '500' }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  /* ── Top Bar ── */
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Space.xxl,
    paddingTop: Space.lg,
    paddingBottom: Space.lg,
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: EL.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontFamily: Fonts.headline,
    fontSize: 24,
    fontWeight: '700',
    color: EL.onSurface,
    letterSpacing: -0.48,
  },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ── Metric Cards ── */
  metricsRow: {
    flexDirection: 'row',
    paddingHorizontal: Space.lg,
    gap: Space.lg,
    marginTop: Space.sm,
  },
  metricCard: {
    flex: 1,
    padding: Space.lg,
  },
  metricLabel: {
    fontFamily: Fonts.body,
    fontSize: 12,
    fontWeight: '500',
    color: EL.onSurfaceSec,
  },
  metricValue: {
    fontFamily: Fonts.headline,
    fontSize: 22,
    fontWeight: '800',
    color: EL.primary,
    letterSpacing: -0.44,
    marginTop: Space.xs,
  },
  metricValueDark: {
    fontFamily: Fonts.headline,
    fontSize: 22,
    fontWeight: '800',
    color: EL.onSurface,
    letterSpacing: -0.44,
    marginTop: Space.xs,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: Space.xs,
  },
  trendText: {
    fontFamily: Fonts.body,
    fontSize: 11,
    fontWeight: '700',
    color: EL.primary,
  },
  metricHint: {
    fontFamily: Fonts.body,
    fontSize: 11,
    fontWeight: '500',
    color: EL.onSurfaceMuted,
    marginTop: Space.xs,
  },

  /* ── Capital at Risk ── */
  carSection: {
    paddingHorizontal: Space.lg,
    marginTop: Space.md,
  },
  carCard: {
    padding: Space.lg,
    backgroundColor: 'rgba(217, 119, 6, 0.08)',
  },
  carHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
  },
  carLabel: {
    fontFamily: Fonts.body,
    fontSize: 12,
    fontWeight: '600',
    color: EL.warn,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  carValue: {
    fontFamily: Fonts.headline,
    fontSize: 24,
    fontWeight: '800',
    color: EL.warn,
    letterSpacing: -0.48,
    marginTop: Space.xs,
  },
  carHint: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: EL.onSurfaceMuted,
    marginTop: Space.xs,
  },

  /* ── Progress Section ── */
  progressSection: {
    paddingHorizontal: Space.lg,
    marginTop: Space.xxl,
  },
  progressCard: {
    padding: Space.xl,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: Space.lg,
  },
  progressTitle: {
    fontFamily: Fonts.headline,
    fontSize: 18,
    fontWeight: '700',
    color: EL.onSurface,
  },
  progressSubtitle: {
    fontFamily: Fonts.body,
    fontSize: 13,
    fontWeight: '400',
    color: EL.onSurfaceSec,
    marginTop: 2,
  },
  progressPct: {
    fontFamily: Fonts.headline,
    fontSize: 20,
    fontWeight: '800',
    color: EL.primary,
  },
  progressFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Space.md,
  },
  progressCount: {
    fontFamily: Fonts.body,
    fontSize: 14,
    fontWeight: '600',
    color: EL.onSurface,
  },
  progressAmount: {
    fontFamily: Fonts.body,
    fontSize: 14,
    fontWeight: '500',
    color: EL.onSurfaceMuted,
  },

  /* ── Section Header ── */
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Space.lg + Space.xs,
    marginTop: Space.xxxl,
    marginBottom: Space.lg,
  },
  sectionTitle: {
    fontFamily: Fonts.headline,
    fontSize: 16,
    fontWeight: '700',
    color: EL.onSurface,
  },
  viewAllText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    fontWeight: '500',
    color: EL.primary,
  },

  /* ── Borrower Card ── */
  borrowerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.lg,
    padding: Space.lg,
    marginHorizontal: Space.lg,
    marginBottom: Space.lg,
    ...Shadows.card,
  },
  borrowerCardPressed: {
    backgroundColor: EL.surfaceLow,
  },
  borrowerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: Space.md,
  },
  borrowerInfo: {
    flex: 1,
    gap: 2,
  },
  borrowerName: {
    fontFamily: Fonts.headline,
    fontSize: 15,
    fontWeight: '700',
    color: EL.onSurface,
  },
  borrowerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  borrowerSchedule: {
    fontFamily: Fonts.body,
    fontSize: 12,
    fontWeight: '500',
    color: EL.onSurfaceSec,
  },
  starRow: {
    marginTop: 2,
  },

  /* ── Collect Button ── */
  collectBtn: {
    backgroundColor: EL.primary,
    borderRadius: Radii.md,
    height: Touch.min,
    paddingHorizontal: Space.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(0, 105, 72, 0.1)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 3,
  },
  collectBtnPressed: {
    backgroundColor: EL.primaryContainer,
  },
  collectBtnText: {
    fontFamily: Fonts.headline,
    fontSize: 15,
    fontWeight: '700',
    color: EL.white,
  },

  /* ── FAB ── */
  fab: {
    position: 'absolute',
    right: Space.xxl,
    bottom: 112,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: EL.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(0, 105, 72, 0.3)',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 25,
    elevation: 6,
  },

  /* ── Modal Sheet ── */
  sheet: {
    borderTopLeftRadius: Radii.xxl,
    borderTopRightRadius: Radii.xxl,
    padding: Space.xl,
    paddingBottom: Space.xxxl,
  },
  divider: {
    height: 1,
    backgroundColor: EL.surfaceLow,
    marginVertical: Space.md,
  },
  bRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Space.sm,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Space.md,
  },
});
