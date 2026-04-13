// SmsSettingsScreen — owner controls outbound SMS receipts.
//
// Three sections:
//   1. Master toggle — when off, no SMS is queued for any borrower.
//      Useful before MSG91/DLT setup is complete so the queue doesn't pile up.
//   2. MSG91 setup status — clear instructions on which Supabase secrets
//      to set, with copy-able commands. While MSG91 is unconfigured the
//      Edge Function runs in dry-run mode (logs the SMS instead of sending).
//   3. Today's stats + open queue — quick link to SmsQueueScreen.

import React from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { EL, Common, Radii, Shadows, Space, Type } from '@/theme/emeraldLedger';
import { useOrg, useUpdateOrg } from '@/hooks/useOrgSettings';
import { useSmsStats } from '@/hooks/useSms';
import type { OwnerStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<OwnerStackParamList>;

export function SmsSettingsScreen() {
  const navigation = useNavigation<Nav>();
  const { data: org } = useOrg();
  const { data: stats } = useSmsStats();
  const update = useUpdateOrg();

  const enabled = org?.sms_enabled !== 0;

  const handleToggle = (value: boolean) => {
    update.mutate({ sms_enabled: value ? 1 : 0 });
  };

  return (
    <SafeAreaView style={Common.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={EL.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>SMS Receipts</Text>
          <Text style={styles.sub}>Auto-send receipts to borrowers via MSG91</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: Space.lg, gap: Space.lg, paddingBottom: Space.xxxl }}>
        {/* ── Master toggle ── */}
        <View style={[styles.card, Shadows.card]}>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.toggleTitle}>Send receipt SMS</Text>
              <Text style={styles.toggleSub}>
                {enabled
                  ? 'New collections automatically queue a receipt SMS'
                  : 'No SMS will be sent for any collection'}
              </Text>
            </View>
            <Switch
              value={enabled}
              onValueChange={handleToggle}
              trackColor={{ false: EL.surfaceMid, true: EL.primary }}
              thumbColor={EL.white}
            />
          </View>
        </View>

        {/* ── Live stats ── */}
        <View style={styles.statsRow}>
          <Stat label="SENT TODAY" value={stats?.sent_today ?? 0} color={EL.primary} />
          <Stat label="QUEUED" value={stats?.queued ?? 0} color={EL.warn} />
          <Stat label="FAILED" value={stats?.failed ?? 0} color={EL.tertiary} />
        </View>

        <Pressable
          style={[styles.linkRow, Shadows.card]}
          onPress={() => navigation.navigate('SmsQueue')}
        >
          <View style={[styles.linkIcon, { backgroundColor: 'rgba(37,99,235,0.1)' }]}>
            <MaterialCommunityIcons name="message-text" size={20} color={EL.info} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>Open SMS queue</Text>
            <Text style={styles.linkSub}>See sent, queued, and failed messages</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color={EL.onSurfaceMuted} />
        </Pressable>

        {/* ── MSG91 setup status ── */}
        <View style={[styles.setupCard, Shadows.card]}>
          <View style={styles.setupHeader}>
            <View style={[styles.setupIcon, { backgroundColor: 'rgba(217,119,6,0.1)' }]}>
              <MaterialCommunityIcons name="cog" size={20} color={EL.warn} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.setupTitle}>MSG91 setup</Text>
              <Text style={styles.setupSub}>
                One-time backend config to start delivering real SMS
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <Text style={styles.setupStep}>1. Get an MSG91 account</Text>
          <Text style={styles.setupBody}>
            Sign up at msg91.com → enable Transactional SMS. Indian DLT
            registration is required (₹5k one-time, then ₹0.18 per SMS).
          </Text>

          <Text style={styles.setupStep}>2. Create a DLT-approved Flow</Text>
          <Text style={styles.setupBody}>
            In MSG91 dashboard → Flows → New Flow → template body:
          </Text>
          <View style={styles.codeBox}>
            <Text style={styles.codeText}>{'{#var#}'}</Text>
          </View>
          <Text style={styles.setupBody}>
            Copy the Flow ID + your auth key + 6-char sender ID.
          </Text>

          <Text style={styles.setupStep}>3. Set Supabase secrets</Text>
          <Text style={styles.setupBody}>
            Run from your terminal in the supabase/ directory:
          </Text>
          <View style={styles.codeBox}>
            <Text style={styles.codeText}>
              supabase secrets set MSG91_AUTH_KEY=YOUR_KEY{'\n'}
              supabase secrets set MSG91_FLOW_ID=YOUR_FLOW{'\n'}
              supabase secrets set MSG91_SENDER_ID=VASOOL
            </Text>
          </View>

          <Text style={styles.setupStep}>4. Deploy the function</Text>
          <View style={styles.codeBox}>
            <Text style={styles.codeText}>
              supabase functions deploy send-receipt-sms
            </Text>
          </View>

          <View style={styles.dryRunBanner}>
            <MaterialCommunityIcons name="information-outline" size={14} color={EL.info} />
            <Text style={styles.dryRunText}>
              Until secrets are set, the function runs in dry-run mode —
              receipts get marked &lsquo;sent&rsquo; without actually delivering. Safe
              to leave SMS enabled while you set up.
            </Text>
          </View>
        </View>

        {/* ── Borrower opt-out info ── */}
        <View style={[styles.infoCard, Shadows.card]}>
          <MaterialCommunityIcons name="account-cancel-outline" size={18} color={EL.onSurfaceSec} />
          <Text style={styles.infoText}>
            Per-borrower opt-out: open any borrower → Edit → toggle &ldquo;Don&apos;t send SMS&rdquo;.
            Useful for borrowers who say &ldquo;don&apos;t text me, I&apos;ll come pay myself.&rdquo;
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[styles.statCard, Shadows.card]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
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
  title: { ...Type.titleLg, fontWeight: '800' },
  sub: { fontSize: 12, color: EL.onSurfaceMuted, fontWeight: '600', marginTop: 2 },

  card: { backgroundColor: EL.surfaceCard, borderRadius: Radii.lg, padding: Space.lg },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
  },
  toggleTitle: { fontSize: 15, fontWeight: '800', color: EL.onSurface },
  toggleSub: { fontSize: 12, color: EL.onSurfaceMuted },

  statsRow: { flexDirection: 'row', gap: Space.sm },
  statCard: { flex: 1, backgroundColor: EL.surfaceCard, borderRadius: Radii.lg, padding: Space.md },
  statLabel: { fontSize: 9, fontWeight: '800', color: EL.onSurfaceMuted, letterSpacing: 0.6 },
  statValue: { fontSize: 22, fontWeight: '800', marginTop: 4 },

  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    backgroundColor: EL.surfaceCard,
    padding: Space.md,
    borderRadius: Radii.lg,
  },
  linkIcon: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  linkTitle: { fontSize: 14, fontWeight: '700', color: EL.onSurface },
  linkSub: { fontSize: 11, color: EL.onSurfaceMuted, marginTop: 2 },

  // Setup
  setupCard: {
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.lg,
    padding: Space.lg,
    gap: Space.sm,
  },
  setupHeader: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  setupIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  setupTitle: { fontSize: 15, fontWeight: '800', color: EL.onSurface },
  setupSub: { fontSize: 11, color: EL.onSurfaceMuted, marginTop: 2 },
  divider: { height: 1, backgroundColor: EL.surfaceLow, marginVertical: Space.sm },
  setupStep: { fontSize: 13, fontWeight: '800', color: EL.primary, marginTop: Space.sm },
  setupBody: { fontSize: 12, color: EL.onSurfaceSec, lineHeight: 17 },
  codeBox: {
    backgroundColor: '#0f1611',
    padding: Space.md,
    borderRadius: Radii.md,
    marginVertical: 4,
  },
  codeText: {
    fontFamily: 'Courier',
    fontSize: 11,
    color: '#85f8c4',
    lineHeight: 16,
  },
  dryRunBanner: {
    flexDirection: 'row',
    gap: Space.sm,
    backgroundColor: 'rgba(37,99,235,0.06)',
    padding: Space.md,
    borderRadius: Radii.md,
    marginTop: Space.sm,
  },
  dryRunText: { flex: 1, fontSize: 11, color: EL.onSurfaceSec, lineHeight: 16 },

  infoCard: {
    flexDirection: 'row',
    gap: Space.sm,
    backgroundColor: EL.surfaceCard,
    padding: Space.md,
    borderRadius: Radii.lg,
    alignItems: 'flex-start',
  },
  infoText: { flex: 1, fontSize: 12, color: EL.onSurfaceSec, lineHeight: 17 },
});
