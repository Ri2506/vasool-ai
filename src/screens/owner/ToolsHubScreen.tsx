// ToolsHubScreen — the owner's dedicated control center.
//
// Pulled OUT of Settings to give Tools its own first-class home.
// Categorized tile grid with live badges so the owner can see what
// needs attention at a glance:
//
//   - Fraud Prevention (red): Fraud Dashboard, Handovers, Loan Requests, SMS Queue
//   - Operations      (emerald): Lines, Deposits, Agents, Documents
//   - Reports         (blue): Daily Summary, Patti Note, Outstanding, Overdue, etc.
//   - More            (gray): Import, AI, Refer & Earn
//
// Each tile shows: gradient icon, title, subtitle, optional badge with count.

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

import { EL, Common, Radii, Shadows, Space, Type } from '@/theme/emeraldLedger';
import { useHandoverInbox } from '@/hooks/useHandovers';
import { usePendingLoanRequestCount } from '@/hooks/useLoanRequests';
import { useSmsStats } from '@/hooks/useSms';
import { useSyncStatus } from '@/hooks/useSync';
import type { OwnerStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<OwnerStackParamList>;

type Tone = 'red' | 'emerald' | 'blue' | 'amber' | 'gray';

interface Tool {
  key: string;
  title: string;
  subtitle: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  tone: Tone;
  badge?: number;
  badgeTone?: 'warn' | 'danger' | 'info';
  onPress: () => void;
}

const TONE_BG: Record<Tone, string> = {
  red: 'rgba(155,62,59,0.08)',
  emerald: 'rgba(0,105,72,0.08)',
  blue: 'rgba(37,99,235,0.08)',
  amber: 'rgba(217,119,6,0.10)',
  gray: 'rgba(109,122,114,0.08)',
};
const TONE_FG: Record<Tone, string> = {
  red: EL.tertiary,
  emerald: EL.primary,
  blue: EL.info,
  amber: EL.warn,
  gray: EL.onSurfaceSec,
};

export function ToolsHubScreen() {
  const navigation = useNavigation<Nav>();
  const { data: handovers } = useHandoverInbox();
  const { data: pendingRequests } = usePendingLoanRequestCount();
  const { data: smsStats } = useSmsStats();
  const { data: syncStatus } = useSyncStatus();

  const submittedHandovers = handovers?.filter((h) => h.status === 'submitted').length ?? 0;
  const disputedHandovers = handovers?.filter((h) => h.status === 'disputed').length ?? 0;
  const totalActions = submittedHandovers + disputedHandovers + (pendingRequests ?? 0) + (smsStats?.failed ?? 0);

  // ── Categorized tools ──
  const fraudTools: Tool[] = [
    {
      key: 'fraud-dashboard',
      title: 'Fraud Dashboard',
      subtitle: 'Disputes · mock-GPS · variance',
      icon: 'shield-alert',
      tone: 'red',
      badge: disputedHandovers,
      badgeTone: 'danger',
      onPress: () => navigation.navigate('FraudDashboard'),
    },
    {
      key: 'handovers',
      title: 'Handovers',
      subtitle: 'EOD agent cash reconciliation',
      icon: 'cash-multiple',
      tone: 'emerald',
      badge: submittedHandovers,
      badgeTone: 'warn',
      onPress: () => navigation.navigate('HandoverInbox'),
    },
    {
      key: 'loan-requests',
      title: 'Loan Requests',
      subtitle: 'Approve agent-proposed loans',
      icon: 'file-document-edit',
      tone: 'amber',
      badge: pendingRequests ?? 0,
      badgeTone: 'warn',
      onPress: () => navigation.navigate('LoanRequests'),
    },
    {
      key: 'sms-settings',
      title: 'SMS Receipts',
      subtitle: smsStats
        ? `${smsStats.sent_today} sent today · ${smsStats.queued} queued`
        : 'Auto-receipts to borrowers',
      icon: 'message-text',
      tone: 'blue',
      badge: smsStats?.failed ?? 0,
      badgeTone: 'danger',
      onPress: () => navigation.navigate('SmsSettings'),
    },
  ];

  const opsTools: Tool[] = [
    {
      key: 'multi-line',
      title: 'Multi-Line Dashboard',
      subtitle: 'Birds-eye across every line',
      icon: 'view-dashboard',
      tone: 'emerald',
      onPress: () => navigation.navigate('MultiLineDashboard'),
    },
    {
      key: 'lines',
      title: 'Collection Lines',
      subtitle: 'Routes + agent assignments',
      icon: 'road-variant',
      tone: 'emerald',
      onPress: () => navigation.navigate('Lines'),
    },
    {
      key: 'agents',
      title: 'Agents',
      subtitle: 'Add, manage, change PIN',
      icon: 'account-tie',
      tone: 'emerald',
      onPress: () => navigation.navigate('AgentManagement'),
    },
    {
      key: 'deposits',
      title: 'Deposits',
      subtitle: 'Money you take from depositors',
      icon: 'piggy-bank',
      tone: 'blue',
      onPress: () => navigation.navigate('Deposits'),
    },
    {
      key: 'investments',
      title: 'Investments',
      subtitle: 'Capital you put in',
      icon: 'finance',
      tone: 'blue',
      onPress: () => navigation.navigate('Investments'),
    },
  ];

  const reportTools: Tool[] = [
    {
      key: 'daily',
      title: 'Daily Summary',
      subtitle: 'Cash, account, loans, expenses',
      icon: 'calendar-today',
      tone: 'blue',
      onPress: () => navigation.navigate('DailySummary'),
    },
    {
      key: 'patti',
      title: 'Patti Note',
      subtitle: 'Per-line progress',
      icon: 'notebook',
      tone: 'blue',
      onPress: () => navigation.navigate('PattiNote'),
    },
    {
      key: 'outstanding',
      title: 'Outstanding',
      subtitle: 'Borrower-wise balance',
      icon: 'scale-balance',
      tone: 'blue',
      onPress: () => navigation.navigate('OutstandingReport'),
    },
    {
      key: 'overdue',
      title: 'Overdue / Nippu',
      subtitle: 'Borrowers behind schedule',
      icon: 'alert',
      tone: 'red',
      onPress: () => navigation.navigate('Overdue'),
    },
    {
      key: 'monthly',
      title: 'Monthly Summary',
      subtitle: 'Profit · interest · capital',
      icon: 'chart-line',
      tone: 'emerald',
      onPress: () => navigation.navigate('MonthlySummary'),
    },
    {
      key: 'nippu-report',
      title: 'Nippu Report',
      subtitle: 'Detailed defaulter list',
      icon: 'file-alert',
      tone: 'red',
      onPress: () => navigation.navigate('NippuReport'),
    },
  ];

  const moreTools: Tool[] = [
    {
      key: 'import',
      title: 'Import Borrowers',
      subtitle: 'CSV / Excel bulk add',
      icon: 'file-import',
      tone: 'gray',
      onPress: () => navigation.navigate('Import'),
    },
    {
      key: 'ai',
      title: 'AI Assistant',
      subtitle: 'Ask anything in Tamil/English',
      icon: 'robot-happy',
      tone: 'amber',
      onPress: () => navigation.navigate('AIChat'),
    },
    {
      key: 'refer',
      title: 'Refer & Earn',
      subtitle: 'Free Pro for every paying friend',
      icon: 'gift',
      tone: 'emerald',
      onPress: () => navigation.navigate('Referral'),
    },
    {
      key: 'subscription',
      title: 'Subscription',
      subtitle: 'Upgrade to VasoolAI Pro',
      icon: 'crown',
      tone: 'amber',
      onPress: () => navigation.navigate('Subscription'),
    },
    {
      key: 'sync',
      title: 'Cloud Sync',
      subtitle: syncStatus && syncStatus.totalDirty > 0
        ? `${syncStatus.totalDirty} pending push`
        : 'All synced',
      icon: 'cloud-sync',
      tone: syncStatus && syncStatus.totalDirty > 0 ? 'amber' : 'emerald',
      badge: syncStatus?.totalDirty ?? 0,
      badgeTone: 'warn',
      onPress: () => navigation.navigate('Sync'),
    },
    {
      key: 'backup',
      title: 'Backup & Restore',
      subtitle: 'Export local data · paste to restore',
      icon: 'database-export',
      tone: 'blue',
      onPress: () => navigation.navigate('Backup'),
    },
    {
      key: 'org-switcher',
      title: 'Switch organisation',
      subtitle: 'Multi-org accountants & co-owners',
      icon: 'swap-horizontal',
      tone: 'gray',
      onPress: () => navigation.navigate('OrgSwitcher'),
    },
    {
      key: 'diagnostics',
      title: 'Diagnostics',
      subtitle: 'Crash log · share with support',
      icon: 'bug',
      tone: 'gray',
      onPress: () => navigation.navigate('Diagnostics'),
    },
  ];

  return (
    <SafeAreaView style={Common.screen}>
      {/* ── Hero header ── */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={EL.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Tools</Text>
          <Text style={styles.sub}>
            {totalActions === 0
              ? 'All clear — nothing needs your attention'
              : `${totalActions} item${totalActions === 1 ? '' : 's'} need your attention`}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Action strip — at-a-glance pending counts */}
        {totalActions > 0 ? (
          <View style={styles.actionStrip}>
            {submittedHandovers > 0 ? (
              <ActionPill
                icon="cash-multiple"
                count={submittedHandovers}
                label="handovers"
                tone="warn"
                onPress={() => navigation.navigate('HandoverInbox')}
              />
            ) : null}
            {(pendingRequests ?? 0) > 0 ? (
              <ActionPill
                icon="file-document-edit"
                count={pendingRequests ?? 0}
                label="loan reqs"
                tone="warn"
                onPress={() => navigation.navigate('LoanRequests')}
              />
            ) : null}
            {disputedHandovers > 0 ? (
              <ActionPill
                icon="alert-circle"
                count={disputedHandovers}
                label="disputed"
                tone="danger"
                onPress={() => navigation.navigate('FraudDashboard')}
              />
            ) : null}
            {(smsStats?.failed ?? 0) > 0 ? (
              <ActionPill
                icon="message-alert"
                count={smsStats!.failed}
                label="SMS failed"
                tone="danger"
                onPress={() => navigation.navigate('SmsQueue')}
              />
            ) : null}
          </View>
        ) : null}

        <Section title="Fraud Prevention" sub="The moat — keeps agents honest">
          <Grid tools={fraudTools} />
        </Section>

        <Section title="Operations" sub="Day-to-day setup">
          <Grid tools={opsTools} />
        </Section>

        <Section title="Reports" sub="Read-only analytics">
          <Grid tools={reportTools} />
        </Section>

        <Section title="More">
          <Grid tools={moreTools} />
        </Section>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {sub ? <Text style={styles.sectionSub}>{sub}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function Grid({ tools }: { tools: Tool[] }) {
  return (
    <View style={styles.grid}>
      {tools.map((t) => (
        <ToolTile key={t.key} tool={t} />
      ))}
    </View>
  );
}

function ToolTile({ tool }: { tool: Tool }) {
  return (
    <Pressable
      onPress={tool.onPress}
      style={({ pressed }) => [
        styles.tile,
        pressed && { transform: [{ scale: 0.97 }], opacity: 0.92 },
      ]}
    >
      <View style={[styles.tileIcon, { backgroundColor: TONE_BG[tool.tone] }]}>
        <MaterialCommunityIcons name={tool.icon} size={24} color={TONE_FG[tool.tone]} />
        {tool.badge && tool.badge > 0 ? (
          <View
            style={[
              styles.tileBadge,
              tool.badgeTone === 'danger'
                ? { backgroundColor: EL.tertiary }
                : tool.badgeTone === 'info'
                ? { backgroundColor: EL.info }
                : { backgroundColor: EL.warn },
            ]}
          >
            <Text style={styles.tileBadgeText}>
              {tool.badge > 99 ? '99+' : tool.badge}
            </Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.tileTitle} numberOfLines={1}>{tool.title}</Text>
      <Text style={styles.tileSub} numberOfLines={2}>{tool.subtitle}</Text>
    </Pressable>
  );
}

function ActionPill({
  icon,
  count,
  label,
  tone,
  onPress,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  count: number;
  label: string;
  tone: 'warn' | 'danger';
  onPress: () => void;
}) {
  const fg = tone === 'danger' ? EL.tertiary : EL.warn;
  const bg = tone === 'danger' ? 'rgba(155,62,59,0.10)' : 'rgba(217,119,6,0.10)';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.actionPill, { backgroundColor: bg }, pressed && { opacity: 0.85 }]}
    >
      <MaterialCommunityIcons name={icon} size={14} color={fg} />
      <Text style={[styles.actionPillCount, { color: fg }]}>{count}</Text>
      <Text style={[styles.actionPillLabel, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    padding: Space.lg,
    paddingBottom: Space.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: EL.surfaceCard,
  },
  title: { ...Type.titleLg, fontSize: 24, fontWeight: '800' },
  sub: { fontSize: 12, color: EL.onSurfaceMuted, fontWeight: '600', marginTop: 2 },

  content: {
    paddingHorizontal: Space.lg,
    paddingBottom: Space.xxxl,
    gap: Space.xl,
  },

  actionStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space.sm,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xs,
    paddingHorizontal: Space.md,
    paddingVertical: Space.sm,
    borderRadius: Radii.pill,
  },
  actionPillCount: { fontSize: 14, fontWeight: '800' },
  actionPillLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },

  section: { gap: Space.md },
  sectionHeader: {},
  sectionTitle: { fontSize: 16, fontWeight: '800', color: EL.onSurface },
  sectionSub: { fontSize: 12, color: EL.onSurfaceMuted, fontWeight: '600', marginTop: 2 },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space.md,
  },
  tile: {
    width: '47.5%',
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.lg,
    padding: Space.lg,
    gap: Space.sm,
    minHeight: 130,
    ...Shadows.card,
  },
  tileIcon: {
    width: 48,
    height: 48,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tileBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: EL.surfaceCard,
  },
  tileBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: EL.white,
  },
  tileTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: EL.onSurface,
    marginTop: Space.xs,
  },
  tileSub: {
    fontSize: 11,
    color: EL.onSurfaceMuted,
    fontWeight: '500',
    lineHeight: 14,
  },
});
