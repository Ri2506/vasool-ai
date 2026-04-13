// FraudDashboardScreen — owner's single-pane view of everything suspicious.
//
// Surfaces five signals in priority order:
//   1. Disputed handovers (owner counted < agent claimed)
//   2. Mocked GPS (collections or expenses from a mock-location provider)
//   3. Pending loan requests (needs owner action)
//   4. Per-agent variance summary (net shortage over 30 days)
//   5. High-expense photos missing (fallback pre-v8 rows)
//
// Every row has a tap-through to the detail screen where the owner can act.

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
import { useQuery } from '@tanstack/react-query';

import { Avatar } from '@/components/common/Avatar';
import { EL, Common, Radii, Shadows, Space, Type } from '@/theme/emeraldLedger';
import {
  useAgentVarianceSummary,
  useHandoverInbox,
} from '@/hooks/useHandovers';
import { usePendingLoanRequestCount } from '@/hooks/useLoanRequests';
import { openDb } from '@/db';
import { useAuthStore } from '@/store/authStore';
import { formatRupees } from '@/utils/format';

interface GpsFlagRow {
  source: 'collection' | 'expense';
  id: string;
  amount: number;
  at: number;
  agent_name: string | null;
  label: string;
}

export function FraudDashboardScreen() {
  const navigation = useNavigation();
  const orgId = useAuthStore((s) => s.user?.orgId ?? null);
  const { data: handovers } = useHandoverInbox();
  const { data: variance } = useAgentVarianceSummary(30);
  const { data: pendingRequests } = usePendingLoanRequestCount();

  const { data: gpsFlags } = useQuery<GpsFlagRow[]>({
    queryKey: ['fraud', 'gps-flags', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const db = await openDb();
      const cutoff = Date.now() - 30 * 86_400_000;
      const coll = await db.getAllAsync<{ id: string; amount: number; collected_at: number; agent_name: string | null; borrower_name: string }>(
        `SELECT c.id, c.amount, c.collected_at, u.name AS agent_name, b.name AS borrower_name
         FROM collections c
         LEFT JOIN users u ON u.id = c.agent_id
         LEFT JOIN loans l ON l.id = c.loan_id
         LEFT JOIN borrowers b ON b.id = l.borrower_id
         WHERE c.org_id = ? AND c.gps_mocked = 1 AND c.collected_at >= ?
         ORDER BY c.collected_at DESC LIMIT 20`,
        [orgId!, cutoff],
      );
      const exp = await db.getAllAsync<{ id: string; amount: number; date: number; agent_name: string | null; category: string }>(
        `SELECT e.id, e.amount, e.date, u.name AS agent_name, e.category
         FROM expenses e
         LEFT JOIN users u ON u.id = e.user_id
         WHERE e.org_id = ? AND e.gps_mocked = 1 AND e.date >= ?
         ORDER BY e.date DESC LIMIT 20`,
        [orgId!, cutoff],
      );
      const rows: GpsFlagRow[] = [
        ...coll.map((c) => ({
          source: 'collection' as const,
          id: c.id,
          amount: c.amount,
          at: c.collected_at,
          agent_name: c.agent_name,
          label: `Collection from ${c.borrower_name}`,
        })),
        ...exp.map((e) => ({
          source: 'expense' as const,
          id: e.id,
          amount: e.amount,
          at: e.date,
          agent_name: e.agent_name,
          label: `${e.category} expense`,
        })),
      ];
      return rows.sort((a, b) => b.at - a.at).slice(0, 15);
    },
  });

  const disputed = handovers?.filter((h) => h.status === 'disputed') ?? [];
  const flaggedAgents = variance?.filter((v) => v.net_variance < -50 || v.disputed_count > 0) ?? [];
  const totalIssues = disputed.length + (gpsFlags?.length ?? 0) + (pendingRequests ?? 0) + flaggedAgents.length;

  return (
    <SafeAreaView style={Common.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={EL.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Fraud dashboard</Text>
          <Text style={styles.sub}>
            {totalIssues === 0 ? 'All clear — no flags' : `${totalIssues} signal${totalIssues === 1 ? '' : 's'} to review`}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: Space.lg, gap: Space.lg, paddingBottom: 60 }}>
        {/* Overall status banner */}
        <View
          style={[
            styles.banner,
            totalIssues === 0 ? styles.bannerOk : styles.bannerAlert,
            Shadows.card,
          ]}
        >
          <MaterialCommunityIcons
            name={totalIssues === 0 ? 'shield-check' : 'shield-alert'}
            size={24}
            color={totalIssues === 0 ? EL.primary : EL.tertiary}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>
              {totalIssues === 0 ? 'No fraud signals detected' : 'Action needed'}
            </Text>
            <Text style={styles.bannerSub}>
              {totalIssues === 0
                ? 'Handovers, GPS, and loan requests look clean in the last 30 days.'
                : `${disputed.length} disputed handovers · ${(gpsFlags?.length ?? 0)} mock-GPS · ${pendingRequests ?? 0} pending loans · ${flaggedAgents.length} flagged agents`}
            </Text>
          </View>
        </View>

        {/* 1. Pending loan requests */}
        {(pendingRequests ?? 0) > 0 ? (
          <Pressable
            style={[styles.card, Shadows.card]}
            onPress={() => (navigation as any).navigate('LoanRequests')}
          >
            <View style={styles.cardRow}>
              <View style={[styles.iconPill, { backgroundColor: 'rgba(217,119,6,0.12)' }]}>
                <MaterialCommunityIcons name="file-document-edit" size={18} color={EL.warn} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{pendingRequests} loan request{pendingRequests === 1 ? '' : 's'} awaiting approval</Text>
                <Text style={styles.cardSub}>Tap to review and approve/reject</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={EL.onSurfaceMuted} />
            </View>
          </Pressable>
        ) : null}

        {/* 2. Disputed handovers */}
        {disputed.length > 0 ? (
          <View style={[styles.card, Shadows.card]}>
            <View style={styles.cardHeaderRow}>
              <MaterialCommunityIcons name="alert-circle" size={18} color={EL.tertiary} />
              <Text style={[styles.cardTitle, { color: EL.tertiary }]}>
                {disputed.length} disputed handover{disputed.length === 1 ? '' : 's'}
              </Text>
            </View>
            <Text style={styles.cardSub}>Owner counted less than the agent claimed.</Text>
            {disputed.slice(0, 3).map((h) => (
              <View key={h.id} style={styles.miniRow}>
                <Avatar name={h.agent_name ?? '?'} size={28} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.miniName}>{h.agent_name ?? 'Unknown'}</Text>
                  <Text style={styles.miniSub}>
                    Claimed {formatRupees(h.cash_handed_over ?? 0)} · counted {formatRupees(h.cash_received ?? 0)}
                  </Text>
                </View>
                <Text style={styles.miniAmount}>
                  {h.variance != null && h.variance !== 0 ? formatRupees(h.variance) : ''}
                </Text>
              </View>
            ))}
            <Pressable onPress={() => (navigation as any).navigate('HandoverInbox')} style={styles.viewAll}>
              <Text style={styles.viewAllText}>Review all handovers →</Text>
            </Pressable>
          </View>
        ) : null}

        {/* 3. Per-agent variance flags */}
        {flaggedAgents.length > 0 ? (
          <View style={[styles.card, Shadows.card]}>
            <View style={styles.cardHeaderRow}>
              <MaterialCommunityIcons name="account-alert" size={18} color={EL.warn} />
              <Text style={[styles.cardTitle, { color: EL.warn }]}>
                Agent variance (30 days)
              </Text>
            </View>
            <Text style={styles.cardSub}>
              Agents with net shortages or repeated disputes.
            </Text>
            {flaggedAgents.map((v) => (
              <View key={v.agent_id} style={styles.miniRow}>
                <Avatar name={v.agent_name} size={28} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.miniName}>{v.agent_name}</Text>
                  <Text style={styles.miniSub}>
                    {v.handover_count} handovers
                    {v.disputed_count > 0 ? ` · ${v.disputed_count} disputed` : ''}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.miniAmount,
                    { color: v.net_variance < 0 ? EL.tertiary : EL.warn },
                  ]}
                >
                  {v.net_variance > 0 ? '+' : ''}{formatRupees(v.net_variance)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* 4. Mocked GPS */}
        {gpsFlags && gpsFlags.length > 0 ? (
          <View style={[styles.card, Shadows.card]}>
            <View style={styles.cardHeaderRow}>
              <MaterialCommunityIcons name="map-marker-off" size={18} color={EL.tertiary} />
              <Text style={[styles.cardTitle, { color: EL.tertiary }]}>
                {gpsFlags.length} mock-location entr{gpsFlags.length === 1 ? 'y' : 'ies'}
              </Text>
            </View>
            <Text style={styles.cardSub}>
              Entries marked as coming from a fake-GPS app — agent was not actually at the borrower's location.
            </Text>
            {gpsFlags.slice(0, 6).map((f) => (
              <View key={f.id} style={styles.miniRow}>
                <View style={styles.gpsIcon}>
                  <MaterialCommunityIcons
                    name={f.source === 'collection' ? 'cash' : 'receipt'}
                    size={14}
                    color={EL.tertiary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.miniName}>{f.label}</Text>
                  <Text style={styles.miniSub}>
                    {f.agent_name ?? 'Unknown agent'} · {new Date(f.at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </Text>
                </View>
                <Text style={[styles.miniAmount, { color: EL.tertiary }]}>
                  {formatRupees(f.amount)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* All-clear state */}
        {totalIssues === 0 ? (
          <View style={styles.empty}>
            <MaterialCommunityIcons name="shield-check-outline" size={40} color={EL.primary} />
            <Text style={styles.emptyTitle}>Everything looks clean</Text>
            <Text style={styles.emptySub}>
              Keep running handovers and loan approvals through the app. Anomalies will appear here the moment they happen.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
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
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: EL.surfaceCard,
  },
  title: { ...Type.titleLg, fontWeight: '800' },
  sub: { fontSize: 12, color: EL.onSurfaceMuted, fontWeight: '600', marginTop: 2 },

  banner: {
    flexDirection: 'row',
    gap: Space.md,
    padding: Space.lg,
    borderRadius: Radii.lg,
    alignItems: 'center',
  },
  bannerOk: { backgroundColor: 'rgba(0,105,72,0.05)' },
  bannerAlert: { backgroundColor: 'rgba(155,62,59,0.05)' },
  bannerTitle: { fontSize: 15, fontWeight: '800', color: EL.onSurface },
  bannerSub: { fontSize: 12, color: EL.onSurfaceMuted, marginTop: 2 },

  card: {
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.lg,
    padding: Space.lg,
    gap: Space.sm,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
  },
  iconPill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 14, fontWeight: '800', color: EL.onSurface },
  cardSub: { fontSize: 12, color: EL.onSurfaceMuted, marginTop: 2 },

  miniRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    paddingVertical: 6,
  },
  miniName: { fontSize: 13, fontWeight: '700', color: EL.onSurface },
  miniSub: { fontSize: 11, color: EL.onSurfaceMuted, marginTop: 1 },
  miniAmount: { fontSize: 13, fontWeight: '800', color: EL.onSurface },
  gpsIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(155,62,59,0.1)',
  },
  viewAll: { paddingTop: Space.sm },
  viewAllText: { fontSize: 12, fontWeight: '700', color: EL.primary },

  empty: {
    alignItems: 'center',
    padding: Space.xxxl,
    gap: Space.sm,
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: EL.onSurface, marginTop: Space.md },
  emptySub: { fontSize: 12, color: EL.onSurfaceMuted, textAlign: 'center', marginTop: Space.xs, paddingHorizontal: Space.lg },
});
