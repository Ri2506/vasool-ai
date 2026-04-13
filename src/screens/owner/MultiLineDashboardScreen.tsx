// MultiLineDashboardScreen — owner's bird's-eye view across every line.
//
// For Persona 2 (small thandal business with 3-5 lines and 2-4 agents),
// this is the screen they live on each morning. Shows:
//
//   - Org-wide totals at the top (collected today, due today, agents working)
//   - Per-line cards: today progress bar, agent on duty, outstanding,
//     30-day collection trend
//   - Per-agent strip — who's collecting where right now
//
// Tap a line → drills into LinesScreen detail (today's borrowers, etc.)

import React from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Avatar } from '@/components/common/Avatar';
import { EL, Common, Radii, Shadows, Space, Type } from '@/theme/emeraldLedger';
import { useLineStats } from '@/hooks/useLines';
import { useSmartCards } from '@/hooks/useSmartCards';
import { useTodaySummary } from '@/hooks/useCollections';
import { formatRupees } from '@/utils/format';
import type { OwnerStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<OwnerStackParamList>;

export function MultiLineDashboardScreen() {
  const navigation = useNavigation<Nav>();
  const { data: lines } = useLineStats();
  const { data: smart } = useSmartCards();
  const { data: today } = useTodaySummary();

  const totalLines = lines?.length ?? 0;
  const linesWithAgent = lines?.filter((l) => l.agent_id).length ?? 0;
  const agentSet = new Set(lines?.filter((l) => l.agent_id).map((l) => l.agent_id));
  const todayCollected = today?.totalCollected ?? 0;
  const todayDue = today?.totalExpected ?? 0;
  const todayProgress = todayDue > 0 ? Math.min(1, todayCollected / todayDue) : 0;

  // Identify the standout line (most behind) and the star (most ahead)
  let mostBehind: typeof lines = undefined;
  let mostAhead: typeof lines = undefined;
  if (lines && lines.length > 0) {
    const ranked = [...lines]
      .filter((l) => l.today_due_amount > 0)
      .map((l) => ({
        ...l,
        ratio: l.today_collected_amount / Math.max(1, l.today_due_amount),
      }));
    if (ranked.length > 0) {
      mostBehind = [ranked.reduce((a, b) => (a.ratio < b.ratio ? a : b))];
      mostAhead = [ranked.reduce((a, b) => (a.ratio > b.ratio ? a : b))];
    }
  }

  return (
    <SafeAreaView style={Common.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={EL.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Multi-line Dashboard</Text>
          <Text style={styles.sub}>{totalLines} lines · {agentSet.size} agents on duty</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: Space.lg, gap: Space.lg, paddingBottom: 60 }}>
        {/* Org-wide hero */}
        <View style={[styles.hero, Shadows.float]}>
          <Text style={styles.heroLabel}>TODAY ACROSS ALL LINES</Text>
          <View style={styles.heroRow}>
            <Text style={styles.heroBig}>{formatRupees(todayCollected)}</Text>
            <Text style={styles.heroBigSub}>of {formatRupees(todayDue)}</Text>
          </View>
          <View style={styles.heroProgressTrack}>
            <View style={[styles.heroProgressFill, { width: `${todayProgress * 100}%` }]} />
          </View>
          <View style={styles.heroPills}>
            <HeroPill icon="check-circle" label={`${today?.collectionCount ?? 0} done`} />
            <HeroPill icon="clock-outline" label={`${today?.dueCount ?? 0} pending`} />
            <HeroPill icon="account-multiple" label={`${linesWithAgent}/${totalLines} lines staffed`} />
          </View>
        </View>

        {/* Standout cards */}
        {mostBehind?.[0] && mostAhead?.[0] && mostBehind[0].line_id !== mostAhead[0].line_id ? (
          <View style={styles.callouts}>
            <View style={[styles.callout, { backgroundColor: 'rgba(217,119,6,0.08)' }]}>
              <Text style={[styles.calloutLabel, { color: EL.warn }]}>NEEDS ATTENTION</Text>
              <Text style={styles.calloutLine}>{mostBehind[0].line_name}</Text>
              <Text style={styles.calloutSub}>
                Only {formatRupees(mostBehind[0].today_collected_amount)} of {formatRupees(mostBehind[0].today_due_amount)} today
              </Text>
            </View>
            <View style={[styles.callout, { backgroundColor: 'rgba(0,105,72,0.06)' }]}>
              <Text style={[styles.calloutLabel, { color: EL.primary }]}>ON FIRE</Text>
              <Text style={styles.calloutLine}>{mostAhead[0].line_name}</Text>
              <Text style={styles.calloutSub}>
                {formatRupees(mostAhead[0].today_collected_amount)} of {formatRupees(mostAhead[0].today_due_amount)} today
              </Text>
            </View>
          </View>
        ) : null}

        {/* Capital summary strip */}
        {smart ? (
          <View style={styles.capitalRow}>
            <CapitalCard
              icon="bank"
              label="Outstanding"
              value={formatRupees(
                lines?.reduce((s, l) => s + l.outstanding_principal, 0) ?? 0
              )}
              color={EL.primary}
            />
            <CapitalCard
              icon="alert-circle"
              label="At risk"
              value={formatRupees(smart.capitalAtRisk)}
              color={EL.tertiary}
            />
            <CapitalCard
              icon="trending-up"
              label="Month profit"
              value={formatRupees(smart.monthProfit)}
              color={smart.monthProfit >= 0 ? EL.primary : EL.tertiary}
            />
          </View>
        ) : null}

        {/* Per-line cards */}
        <Text style={styles.sectionTitle}>By Line</Text>
        {lines && lines.length > 0 ? (
          lines.map((l) => {
            const progress =
              l.today_due_amount > 0
                ? Math.min(1, l.today_collected_amount / l.today_due_amount)
                : 0;
            return (
              <Pressable
                key={l.line_id}
                style={[styles.lineCard, Shadows.card]}
                onPress={() => navigation.navigate('Lines')}
              >
                <View style={styles.lineHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.lineName}>{l.line_name}</Text>
                    <View style={styles.lineAgentRow}>
                      {l.agent_name ? (
                        <>
                          <Avatar name={l.agent_name} size={20} />
                          <Text style={styles.lineAgentText}>{l.agent_name}</Text>
                        </>
                      ) : (
                        <Text style={styles.lineAgentText}>No agent assigned</Text>
                      )}
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.lineOutstanding}>
                      {formatRupees(l.outstanding_principal)}
                    </Text>
                    <Text style={styles.lineOutstandingLabel}>OUTSTANDING</Text>
                  </View>
                </View>

                {l.today_due_amount > 0 ? (
                  <>
                    <View style={styles.linePillRow}>
                      <Text style={styles.linePillLabel}>Today</Text>
                      <Text style={styles.linePillValue}>
                        {formatRupees(l.today_collected_amount)} / {formatRupees(l.today_due_amount)}
                      </Text>
                    </View>
                    <View style={styles.lineTrack}>
                      <View style={[styles.lineFill, { width: `${progress * 100}%` }]} />
                    </View>
                  </>
                ) : null}

                <View style={styles.lineFooter}>
                  <Stat label="Borrowers" value={String(l.borrower_count)} />
                  <Stat label="Loans" value={String(l.active_loan_count)} />
                  <Stat label="30-day" value={formatRupees(l.month_collected_amount)} />
                </View>
              </Pressable>
            );
          })
        ) : (
          <View style={styles.empty}>
            <MaterialCommunityIcons name="road-variant" size={36} color={EL.outline} />
            <Text style={styles.emptyTitle}>No lines yet</Text>
            <Text style={styles.emptySub}>
              Add a collection line to start tracking borrowers and agents.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function HeroPill({ icon, label }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string }) {
  return (
    <View style={styles.heroPill}>
      <MaterialCommunityIcons name={icon} size={12} color={EL.white} />
      <Text style={styles.heroPillText}>{label}</Text>
    </View>
  );
}

function CapitalCard({
  icon, label, value, color,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string; value: string; color: string;
}) {
  return (
    <View style={[styles.capitalCard, Shadows.card]}>
      <View style={[styles.capitalIcon, { backgroundColor: `${color}1A` }]}>
        <MaterialCommunityIcons name={icon} size={18} color={color} />
      </View>
      <Text style={styles.capitalLabel}>{label}</Text>
      <Text style={[styles.capitalValue, { color }]}>{value}</Text>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    padding: Space.lg,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: EL.surfaceCard,
  },
  title: { ...Type.titleLg, fontSize: 22, fontWeight: '800' },
  sub: { fontSize: 12, color: EL.onSurfaceMuted, fontWeight: '600', marginTop: 2 },

  hero: {
    backgroundColor: EL.primary,
    borderRadius: Radii.xl,
    padding: Space.xl,
    gap: Space.md,
  },
  heroLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 0.8,
  },
  heroRow: { flexDirection: 'row', alignItems: 'baseline', gap: Space.sm },
  heroBig: { fontSize: 32, fontWeight: '900', color: EL.white },
  heroBigSub: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.8)' },
  heroProgressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
  },
  heroProgressFill: { height: '100%', backgroundColor: EL.white },
  heroPills: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.xs },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Space.sm,
    paddingVertical: 4,
    borderRadius: Radii.pill,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  heroPillText: { fontSize: 11, fontWeight: '700', color: EL.white },

  callouts: { flexDirection: 'row', gap: Space.sm },
  callout: {
    flex: 1,
    padding: Space.md,
    borderRadius: Radii.lg,
    gap: 2,
  },
  calloutLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },
  calloutLine: { fontSize: 14, fontWeight: '800', color: EL.onSurface, marginTop: 4 },
  calloutSub: { fontSize: 11, color: EL.onSurfaceMuted, marginTop: 2 },

  capitalRow: { flexDirection: 'row', gap: Space.sm },
  capitalCard: {
    flex: 1,
    backgroundColor: EL.surfaceCard,
    padding: Space.md,
    borderRadius: Radii.lg,
    gap: Space.xs,
  },
  capitalIcon: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  capitalLabel: { fontSize: 10, fontWeight: '700', color: EL.onSurfaceMuted, letterSpacing: 0.5 },
  capitalValue: { fontSize: 15, fontWeight: '800', marginTop: 2 },

  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: EL.onSurface,
    marginTop: Space.md,
  },

  lineCard: {
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.lg,
    padding: Space.md,
    gap: Space.sm,
  },
  lineHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Space.md,
  },
  lineName: { fontSize: 16, fontWeight: '800', color: EL.onSurface },
  lineAgentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  lineAgentText: { fontSize: 12, color: EL.onSurfaceMuted, fontWeight: '600' },
  lineOutstanding: { fontSize: 16, fontWeight: '800', color: EL.primary },
  lineOutstandingLabel: { fontSize: 9, fontWeight: '700', color: EL.onSurfaceMuted, letterSpacing: 0.5, marginTop: 2 },

  linePillRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  linePillLabel: { fontSize: 11, fontWeight: '700', color: EL.onSurfaceMuted, letterSpacing: 0.5 },
  linePillValue: { fontSize: 12, fontWeight: '700', color: EL.onSurface },
  lineTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: EL.surfaceLow,
    overflow: 'hidden',
  },
  lineFill: { height: '100%', backgroundColor: EL.primary },

  lineFooter: {
    flexDirection: 'row',
    paddingTop: Space.sm,
    borderTopWidth: 1,
    borderTopColor: EL.surfaceLow,
  },
  statLabel: { fontSize: 9, fontWeight: '800', color: EL.onSurfaceMuted, letterSpacing: 0.5 },
  statValue: { fontSize: 13, fontWeight: '700', color: EL.onSurface, marginTop: 2 },

  empty: { alignItems: 'center', padding: Space.xxxl, gap: Space.sm },
  emptyTitle: { fontSize: 14, fontWeight: '700', color: EL.onSurface, marginTop: Space.md },
  emptySub: { fontSize: 12, color: EL.onSurfaceMuted, textAlign: 'center', paddingHorizontal: Space.lg },
});
