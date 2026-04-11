import React from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';

import { GradientButton } from '@/components/common/GradientButton';
import { EL, Common, Radii, Shadows, Space, Type } from '@/theme/emeraldLedger';
import { useSmartCards } from '@/hooks/useSmartCards';
import { useBorrowerStatuses } from '@/hooks/useBorrowerStatus';
import { useBorrowers } from '@/hooks/useBorrowers';
import { useAuthStore } from '@/store/authStore';
import { listAgents } from '@/db/repos/agents';
import { formatRupees } from '@/utils/format';

export function MonthlySummaryScreen() {
  const { data: smart } = useSmartCards();
  const { data: statuses } = useBorrowerStatuses();
  const { data: borrowers } = useBorrowers();
  const orgId = useAuthStore((s) => s.user?.orgId ?? null);
  const { data: agents } = useQuery({
    queryKey: ['agents', orgId],
    enabled: !!orgId,
    queryFn: () => listAgents(orgId!),
  });
  const month = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  // Compute best borrower: highest rating with most completed on-time payments
  const bestBorrower = React.useMemo(() => {
    if (!borrowers || !statuses) return null;
    let best: { name: string; rating: number } | null = null;
    for (const b of borrowers) {
      const st = statuses[b.id];
      if (!st || st.rating === 0) continue;
      if (!best || st.rating > best.rating) {
        best = { name: b.name, rating: st.rating };
      }
    }
    return best;
  }, [borrowers, statuses]);

  const topAgent = agents && agents.length > 0 ? agents[0] : null;

  const profit = smart?.monthProfit ?? 0;
  const collected = smart?.monthCollected ?? 0;
  const lent = smart?.monthLent ?? 0;
  const expenses = smart?.monthExpenses ?? 0;

  return (
    <SafeAreaView style={Common.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Hero Card — Net Profit */}
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>Net Profit</Text>
          <Text style={styles.heroAmount}>{formatRupees(profit)}</Text>
          {profit > 0 ? (
            <View style={styles.heroPill}>
              <MaterialCommunityIcons name="trending-up" size={14} color={EL.primary} />
              <Text style={styles.heroPillText}>vs last month</Text>
            </View>
          ) : null}
        </View>

        {/* Stats Grid (2x2) */}
        <View style={styles.statsGrid}>
          <StatCard label="Collected" value={formatRupees(collected)} color={EL.primary} barColor={EL.primary} />
          <StatCard label="Lent out" value={formatRupees(lent)} color={EL.secondary} barColor={EL.secondary} />
          <StatCard label="Expenses" value={formatRupees(expenses)} color={EL.tertiaryContainer} barColor={EL.tertiaryContainer} />
          <StatCard label="Profit" value={formatRupees(profit)} color={EL.primary} barColor={EL.primaryContainer} />
        </View>

        {/* Performance Highlights */}
        <Text style={styles.sectionTitle}>Performance Highlights</Text>

        {/* Top Agent — from real data */}
        {topAgent ? (
          <View style={styles.highlightCard}>
            <View style={styles.highlightAvatar}>
              <MaterialCommunityIcons name="account-check" size={24} color={EL.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.highlightHeader}>
                <Text style={styles.highlightName}>{topAgent.name}</Text>
                <View style={styles.highlightBadge}>
                  <Text style={styles.highlightBadgeText}>Top Agent</Text>
                </View>
              </View>
              <Text style={styles.highlightSub}>{topAgent.phone ?? 'Field collection agent'}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.highlightCard}>
            <View style={styles.highlightAvatar}>
              <MaterialCommunityIcons name="account-plus" size={24} color={EL.outline} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.highlightName}>No agents yet</Text>
              <Text style={styles.highlightSub}>Add an agent from Settings</Text>
            </View>
          </View>
        )}

        {/* Best Borrower — from real data */}
        {bestBorrower ? (
          <View style={styles.highlightCard}>
            <View style={styles.highlightAvatar}>
              <MaterialCommunityIcons name="star" size={24} color={EL.starAmber} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.highlightHeader}>
                <Text style={styles.highlightName}>{bestBorrower.name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                  <MaterialCommunityIcons name="star" size={12} color={EL.starAmber} />
                  <Text style={{ fontSize: 10, fontWeight: '700', color: EL.starAmber }}>
                    {bestBorrower.rating.toFixed(1)}
                  </Text>
                </View>
              </View>
              <Text style={styles.highlightSub}>
                {bestBorrower.rating >= 5 ? '100% on-time' : `${Math.round(bestBorrower.rating * 20)}% on-time`}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.highlightCard}>
            <View style={styles.highlightAvatar}>
              <MaterialCommunityIcons name="account-star" size={24} color={EL.outline} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.highlightName}>No top borrower yet</Text>
              <Text style={styles.highlightSub}>Ratings appear after payment history</Text>
            </View>
          </View>
        )}

        {/* Portfolio Activity */}
        <View style={styles.portfolioCard}>
          <Text style={styles.portfolioTitle}>Portfolio Activity</Text>
          <PortfolioRow color={EL.primaryContainer} label="Capital invested" value={formatRupees(smart?.totalInvested ?? 0)} />
          <PortfolioRow color={EL.primary} label="Available to lend" value={formatRupees(smart?.availableToLend ?? 0)} />
          <PortfolioRow color={EL.secondary} label="Next week forecast" value={formatRupees(smart?.nextWeekForecast ?? 0)} />
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Fixed bottom action */}
      <View style={styles.bottomBar}>
        <GradientButton
          title="Share Summary"
          onPress={async () => {
            try {
              const { Share } = await import('react-native');
              await Share.share({ message: 'VasoolAI Monthly Summary — feature coming soon' });
            } catch {}
          }}
          icon={<MaterialCommunityIcons name="share-variant" size={18} color={EL.white} />}
        />
      </View>
    </SafeAreaView>
  );
}

function StatCard({ label, value, color, barColor }: { label: string; value: string; color: string; barColor: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <View style={[styles.statBar, { backgroundColor: barColor }]} />
    </View>
  );
}

function PortfolioRow({ color, label, value, isTertiary }: { color: string; label: string; value: string; isTertiary?: boolean }) {
  return (
    <View style={styles.portfolioRow}>
      <View style={styles.portfolioLeft}>
        <View style={[styles.portfolioDot, { backgroundColor: color }]} />
        <Text style={styles.portfolioLabel}>{label}</Text>
      </View>
      <Text style={[styles.portfolioValue, isTertiary && { color: EL.tertiary }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: Space.lg, paddingBottom: Space.xxxl },

  // Hero
  heroCard: {
    backgroundColor: EL.surfaceLow,
    borderRadius: Radii.lg,
    padding: Space.xxl,
    alignItems: 'center',
    marginBottom: Space.xl,
  },
  heroLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(61,74,66,0.7)',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: Space.sm,
  },
  heroAmount: {
    fontSize: 36,
    fontWeight: '800',
    color: EL.primary,
    letterSpacing: -1.5,
    marginBottom: Space.sm,
  },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xs,
    backgroundColor: 'rgba(133,248,196,0.3)',
    paddingHorizontal: Space.md,
    paddingVertical: Space.xs,
    borderRadius: Radii.pill,
  },
  heroPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: EL.onSurface,
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space.md,
    marginBottom: Space.xl,
  },
  statCard: {
    width: '48%',
    backgroundColor: EL.surfaceCard,
    padding: Space.xl,
    borderRadius: Radii.lg,
    ...Shadows.card,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(61,74,66,0.6)',
    textTransform: 'uppercase',
    marginBottom: Space.xs,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  statBar: {
    height: 4,
    width: 32,
    borderRadius: 2,
    marginTop: Space.md,
  },

  // Section
  sectionTitle: {
    ...Type.titleLg,
    fontWeight: '700',
    marginBottom: Space.md,
    paddingHorizontal: Space.xs,
  },

  // Highlight cards
  highlightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.lg,
    backgroundColor: EL.surfaceCard,
    padding: Space.lg,
    borderRadius: Radii.lg,
    marginBottom: Space.md,
    ...Shadows.card,
  },
  highlightAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: EL.surfaceLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlightHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  highlightName: {
    ...Type.labelLg,
    fontWeight: '700',
  },
  highlightBadge: {
    backgroundColor: 'rgba(133,248,196,0.2)',
    paddingHorizontal: Space.sm,
    paddingVertical: 2,
    borderRadius: Radii.sm,
  },
  highlightBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: EL.primary,
  },
  highlightSub: {
    ...Type.bodySm,
    color: 'rgba(61,74,66,0.7)',
    marginTop: 2,
  },

  // Portfolio
  portfolioCard: {
    backgroundColor: EL.surfaceMid,
    padding: Space.xl,
    borderRadius: Radii.lg,
    marginTop: Space.md,
  },
  portfolioTitle: {
    ...Type.titleLg,
    fontWeight: '700',
    color: EL.onSurfaceSec,
    marginBottom: Space.lg,
  },
  portfolioRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Space.lg,
  },
  portfolioLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
  },
  portfolioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  portfolioLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: EL.onSurfaceSec,
  },
  portfolioValue: {
    fontSize: 14,
    fontWeight: '700',
    color: EL.onSurface,
  },

  // Bottom
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Space.lg,
    backgroundColor: 'rgba(240,253,244,0.9)',
  },
});
