import React from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';

import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { EL, Common, Radii, Shadows, Space, Fonts } from '@/theme/emeraldLedger';
import type { AgentStackParamList } from '@/navigation/types';
import { getTodaySummary } from '@/db/repos/collections';
import { getTodayExpenseTotal, listExpenses } from '@/db/repos/expenses';
import type { ExpenseRow } from '@/db/types';
import { useAuthStore } from '@/store/authStore';
import { formatRupees } from '@/utils/format';

const EXP_ICON: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  petrol: 'gas-station',
  food: 'silverware-fork-knife',
  travel: 'car',
  phone: 'cellphone',
  other: 'cash',
};

const EXP_LABEL: Record<string, string> = {
  petrol: 'Petrol',
  food: 'Food',
  travel: 'Travel',
  phone: 'Phone',
  other: 'Other',
};

// SVG-like circular progress via a ring of small segments
const RING_SIZE = 192;
const RING_STROKE = 12;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;

export function AgentSummaryScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AgentStackParamList>>();
  const orgId = useAuthStore((s) => s.user?.orgId ?? null);

  const { data: summary } = useQuery({
    queryKey: ['agentSummary', orgId],
    enabled: !!orgId,
    queryFn: () => getTodaySummary(orgId!),
    refetchInterval: 15_000,
  });

  const { data: expenseTotal } = useQuery({
    queryKey: ['agentExpTotal', orgId],
    enabled: !!orgId,
    queryFn: () => getTodayExpenseTotal(orgId!),
  });

  const { data: allExpenses } = useQuery({
    queryKey: ['agentExpList', orgId],
    enabled: !!orgId,
    queryFn: () => listExpenses(orgId!),
  });

  const done = summary?.collectionCount ?? 0;
  const dueCount = (summary?.dueCount ?? 0) + done;
  const progress = dueCount > 0 ? done / dueCount : 0;
  const progressPct = Math.round(progress * 100);
  const netCash = (summary?.totalCollected ?? 0) - (expenseTotal ?? 0);
  const missed = Math.max(0, dueCount - done);

  // Weekly chart — today is real, rest are placeholders until weekly query is built
  const todayCollected = summary?.totalCollected ?? 0;
  const todayTarget = todayCollected + (summary?.totalExpected ?? 0);
  const todayPct = todayTarget > 0 ? Math.round((todayCollected / todayTarget) * 100) : 0;
  const weeklyData = [
    { day: 'TODAY', amount: todayCollected, pct: todayPct },
  ];

  // Expense breakdown from real data, grouped by category
  const expensesByCategory = React.useMemo(() => {
    if (!allExpenses) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startMs = today.getTime();
    const todayExpenses = allExpenses.filter((e: ExpenseRow) => e.date >= startMs);
    const grouped: Record<string, number> = {};
    for (const e of todayExpenses) {
      grouped[e.category] = (grouped[e.category] || 0) + e.amount;
    }
    return Object.entries(grouped).map(([cat, amount]) => ({
      icon: (EXP_ICON[cat] ?? 'cash') as keyof typeof MaterialCommunityIcons.glyphMap,
      label: EXP_LABEL[cat] ?? cat,
      sub: cat,
      amount,
    }));
  }, [allExpenses]);

  const handleShare = () => {
    navigation.navigate('AgentSharePreview');
  };

  return (
    <SafeAreaView style={Common.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.headerBtn} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={EL.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Collection Summary</Text>
        <Pressable style={styles.headerBtn} onPress={handleShare}>
          <MaterialCommunityIcons name="share-variant" size={22} color={EL.onSurface} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Main Performance Card */}
        <View style={styles.perfCard}>
          {/* Decorative blurred circle */}
          <View style={styles.decorCircle} />

          {/* Circular Progress Ring */}
          <View style={styles.ringContainer}>
            <View style={styles.ringOuter}>
              {/* Background ring */}
              <View style={styles.ringBg} />
              {/* We approximate the ring with a bordered circle + overlay */}
              <View
                style={[
                  styles.ringProgress,
                  {
                    // Use border trick: show progress via rotation
                    borderColor: EL.primary,
                    borderTopColor: progressPct > 75 ? EL.primary : EL.surfaceHighest,
                    borderRightColor: progressPct > 50 ? EL.primary : EL.surfaceHighest,
                    borderBottomColor: progressPct > 25 ? EL.primary : EL.surfaceHighest,
                    borderLeftColor: EL.primary,
                  },
                ]}
              />
            </View>
            <View style={styles.ringCenter}>
              <Text style={styles.ringPct}>{progressPct}%</Text>
              <Text style={styles.ringLabel}>GOAL HIT</Text>
            </View>
          </View>

          <View style={styles.perfDetails}>
            <Text style={styles.perfSubLabel}>Total Collected</Text>
            <Text style={styles.perfAmount}>{formatRupees(summary?.totalCollected ?? 0)}</Text>
            <View style={styles.visitedPill}>
              <MaterialCommunityIcons name="check-circle" size={14} color={EL.primary} />
              <Text style={styles.visitedText}>{done} of {dueCount} visited</Text>
            </View>
          </View>
        </View>

        {/* Stats Grid 2x2 */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { borderLeftColor: EL.primary }]}>
            <Text style={styles.statLabel}>Collections</Text>
            <View style={styles.statValueRow}>
              <Text style={styles.statNumber}>{done}</Text>
              <Text style={styles.statUnit}>Done</Text>
            </View>
          </View>
          <View style={[styles.statCard, { borderLeftColor: EL.tertiary }]}>
            <Text style={styles.statLabel}>Missed</Text>
            <View style={styles.statValueRow}>
              <Text style={[styles.statNumber, { color: EL.tertiary }]}>{missed}</Text>
              <Text style={styles.statUnit}>Borrower</Text>
            </View>
          </View>
          <View style={[styles.statCard, { borderLeftColor: EL.outlineVariant }]}>
            <Text style={styles.statLabel}>Expenses</Text>
            <View style={styles.statValueRow}>
              <Text style={styles.statNumber}>{formatRupees(expenseTotal ?? 0)}</Text>
            </View>
          </View>
          <View style={[styles.statCard, { borderLeftColor: EL.secondary }]}>
            <Text style={styles.statLabel}>Net Cash</Text>
            <View style={styles.statValueRow}>
              <Text style={[styles.statNumber, { color: EL.secondary }]}>{formatRupees(netCash)}</Text>
            </View>
          </View>
        </View>

        {/* Expenses Breakdown */}
        <View style={styles.expenseSection}>
          <View style={styles.expenseHeader}>
            <Text style={styles.expenseTitle}>Expenses Breakdown</Text>
            <View style={styles.todayPill}>
              <Text style={styles.todayPillText}>Today</Text>
            </View>
          </View>
          {expensesByCategory.map((exp, i) => (
            <View key={i} style={styles.expenseRow}>
              <View style={styles.expenseLeft}>
                <View style={styles.expenseIcon}>
                  <MaterialCommunityIcons name={exp.icon} size={20} color={EL.onSurfaceSec} />
                </View>
                <View>
                  <Text style={styles.expenseName}>{exp.label}</Text>
                  <Text style={styles.expenseSub}>{exp.sub}</Text>
                </View>
              </View>
              <Text style={styles.expenseAmount}>{formatRupees(exp.amount)}</Text>
            </View>
          ))}
        </View>

        {/* Weekly Collections Chart */}
        <View style={styles.weeklyCard}>
          <Text style={styles.weeklyTitle}>Weekly Collections</Text>
          {weeklyData.map((item, i) => (
            <View key={i} style={styles.weeklyRow}>
              <View style={styles.weeklyLabelRow}>
                <Text style={styles.weeklyDay}>{item.day}</Text>
                <Text style={styles.weeklyAmount}>{formatRupees(item.amount)}</Text>
              </View>
              <View style={styles.weeklyTrack}>
                <View
                  style={[
                    styles.weeklyFill,
                    {
                      width: `${item.pct}%` as any,
                      backgroundColor: i === 0 ? EL.primary : 'rgba(0, 105, 72, 0.4)',
                    },
                  ]}
                />
              </View>
            </View>
          ))}
        </View>

        {/* End-of-day primary action — kicks off cash handover flow */}
        <Pressable
          style={({ pressed }) => [styles.eodBtn, pressed && { opacity: 0.95, transform: [{ scale: 0.98 }] }]}
          onPress={() => navigation.navigate('AgentEOD')}
        >
          <View style={styles.eodIcon}>
            <MaterialCommunityIcons name="cash-multiple" size={20} color={EL.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.eodTitle}>Submit End-of-Day Cash</Text>
            <Text style={styles.eodSub}>
              Hand over {formatRupees(netCash)} to the owner
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color={EL.white} />
        </Pressable>

        {/* Share Button */}
        <Pressable
          style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.95, transform: [{ scale: 0.98 }] }]}
          onPress={handleShare}
        >
          <MaterialCommunityIcons name="send" size={18} color={EL.white} />
          <Text style={styles.shareBtnText}>Share Summary to Owner</Text>
        </Pressable>
      </ScrollView>
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
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: Fonts.headline,
    fontSize: 18,
    fontWeight: '700',
    color: EL.onSurface,
    letterSpacing: -0.2,
  },

  scrollContent: {
    paddingHorizontal: Space.xl,
    paddingTop: Space.sm,
    paddingBottom: 100,
  },

  // Main Performance Card
  perfCard: {
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.xxl,
    padding: Space.xl,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    ...Shadows.card,
  },
  decorCircle: {
    position: 'absolute',
    top: -64,
    right: -64,
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: 'rgba(133, 248, 196, 0.2)',
  },

  // Circular Progress Ring
  ringContainer: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Space.xl,
  },
  ringOuter: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
  },
  ringBg: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: RING_STROKE,
    borderColor: EL.surfaceHighest,
  },
  ringProgress: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: RING_STROKE,
    transform: [{ rotate: '-90deg' }],
  },
  ringCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringPct: {
    fontFamily: Fonts.headline,
    fontSize: 42,
    fontWeight: '800',
    color: EL.onSurface,
    letterSpacing: -2,
    lineHeight: 46,
  },
  ringLabel: {
    fontFamily: Fonts.body,
    fontSize: 11,
    fontWeight: '600',
    color: EL.primary,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginTop: Space.xs,
  },

  perfDetails: {
    alignItems: 'center',
    gap: Space.xs,
  },
  perfSubLabel: {
    fontFamily: Fonts.body,
    fontSize: 14,
    fontWeight: '500',
    color: EL.onSurfaceMuted,
  },
  perfAmount: {
    fontFamily: Fonts.headline,
    fontSize: 40,
    fontWeight: '800',
    color: EL.primary,
    letterSpacing: -1,
    lineHeight: 44,
  },
  visitedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    backgroundColor: 'rgba(0, 133, 93, 0.1)',
    paddingHorizontal: Space.lg,
    paddingVertical: Space.sm,
    borderRadius: Radii.pill,
    marginTop: Space.lg,
  },
  visitedText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    fontWeight: '600',
    color: EL.secondary,
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space.lg,
    marginTop: Space.xl,
  },
  statCard: {
    width: '47%',
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.lg,
    padding: Space.lg,
    borderLeftWidth: 4,
  },
  statLabel: {
    fontFamily: Fonts.body,
    fontSize: 12,
    fontWeight: '600',
    color: EL.onSurfaceMuted,
    marginBottom: Space.xs,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Space.xs,
  },
  statNumber: {
    fontFamily: Fonts.headline,
    fontSize: 24,
    fontWeight: '700',
    color: EL.onSurface,
  },
  statUnit: {
    fontFamily: Fonts.body,
    fontSize: 10,
    color: EL.onSurfaceMuted,
  },

  // Expenses Breakdown
  expenseSection: {
    backgroundColor: EL.surfaceLow,
    borderRadius: Radii.lg,
    padding: Space.xl,
    marginTop: Space.xl,
  },
  expenseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Space.xl,
  },
  expenseTitle: {
    fontFamily: Fonts.headline,
    fontSize: 15,
    fontWeight: '700',
    color: EL.onSurface,
    letterSpacing: -0.2,
  },
  todayPill: {
    backgroundColor: EL.primaryFixed,
    paddingHorizontal: Space.sm,
    paddingVertical: Space.xs,
    borderRadius: Radii.sm,
  },
  todayPillText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    fontWeight: '700',
    color: EL.primary,
  },
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Space.lg,
  },
  expenseLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
  },
  expenseIcon: {
    width: 40,
    height: 40,
    borderRadius: Radii.md,
    backgroundColor: EL.surfaceHighest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseName: {
    fontFamily: Fonts.body,
    fontSize: 14,
    fontWeight: '600',
    color: EL.onSurface,
  },
  expenseSub: {
    fontFamily: Fonts.body,
    fontSize: 10,
    color: EL.onSurfaceMuted,
  },
  expenseAmount: {
    fontFamily: Fonts.headline,
    fontSize: 14,
    fontWeight: '700',
    color: EL.onSurface,
  },

  // Weekly Collections
  weeklyCard: {
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.lg,
    padding: Space.xl,
    marginTop: Space.xl,
  },
  weeklyTitle: {
    fontFamily: Fonts.headline,
    fontSize: 15,
    fontWeight: '700',
    color: EL.onSurface,
    letterSpacing: -0.2,
    marginBottom: Space.xl,
  },
  weeklyRow: {
    marginBottom: Space.lg,
  },
  weeklyLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Space.xs,
  },
  weeklyDay: {
    fontFamily: Fonts.body,
    fontSize: 10,
    fontWeight: '700',
    color: EL.onSurfaceMuted,
  },
  weeklyAmount: {
    fontFamily: Fonts.body,
    fontSize: 10,
    fontWeight: '700',
    color: EL.onSurfaceMuted,
  },
  weeklyTrack: {
    height: 12,
    backgroundColor: EL.surfaceHighest,
    borderRadius: 6,
    overflow: 'hidden',
  },
  weeklyFill: {
    height: '100%',
    borderRadius: 6,
  },

  // Share Button
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: EL.primary,
    paddingVertical: Space.lg,
    borderRadius: Radii.md,
    gap: Space.md,
    marginTop: Space.xxl,
    shadowColor: 'rgba(0, 105, 72, 0.2)',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 4,
  },
  shareBtnText: {
    fontFamily: Fonts.headline,
    fontSize: 15,
    fontWeight: '700',
    color: EL.white,
  },

  // EOD primary action
  eodBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: EL.primary,
    padding: Space.lg,
    borderRadius: Radii.lg,
    gap: Space.md,
    marginTop: Space.xxl,
    ...Shadows.float,
  },
  eodIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eodTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: EL.white,
  },
  eodSub: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
});
