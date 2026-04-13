// SmsQueueScreen — owner monitors outbound receipt SMS to borrowers.
//
// Three states per row:
//   queued — waiting to send (offline / Edge Function not configured)
//   sent   — delivered (or simulated when MSG91 not yet wired)
//   failed — exceeded retries; owner can manually re-flush
//
// Top action: "Send queued now" — triggers flushSmsQueue() immediately.

import React from 'react';
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { GradientButton } from '@/components/common/GradientButton';
import { EL, Common, Radii, Shadows, Space, Type } from '@/theme/emeraldLedger';
import { useFlushSmsQueue, useRecentSms, useSmsStats } from '@/hooks/useSms';
import type { SmsQueueRow } from '@/db/types';

export function SmsQueueScreen() {
  const navigation = useNavigation();
  const { data: stats } = useSmsStats();
  const { data: recent } = useRecentSms(80);
  const flush = useFlushSmsQueue();

  const handleFlush = async () => {
    try {
      const result = await flush.mutateAsync();
      Alert.alert(
        'Queue flushed',
        `Sent ${result.sent} · Failed ${result.failed} · Skipped ${result.skipped}`,
      );
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Flush failed');
    }
  };

  return (
    <SafeAreaView style={Common.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={EL.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>SMS Receipts</Text>
          <Text style={styles.sub}>Auto-receipts to borrowers via MSG91</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: Space.lg, gap: Space.lg, paddingBottom: 80 }}>
        {/* Stats strip */}
        <View style={styles.statsRow}>
          <Stat label="SENT TODAY" value={stats?.sent_today ?? 0} color={EL.primary} />
          <Stat label="QUEUED" value={stats?.queued ?? 0} color={EL.warn} />
          <Stat label="FAILED" value={stats?.failed ?? 0} color={EL.tertiary} />
        </View>

        {/* Manual flush */}
        {(stats?.queued ?? 0) > 0 || (stats?.failed ?? 0) > 0 ? (
          <View style={[styles.flushCard, Shadows.card]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.flushTitle}>
                {stats?.queued ?? 0} message{stats?.queued === 1 ? '' : 's'} waiting
              </Text>
              <Text style={styles.flushSub}>
                Auto-sends when network is available. Tap to send now.
              </Text>
            </View>
            <GradientButton
              title={flush.isPending ? 'Sending…' : 'Send now'}
              onPress={handleFlush}
              loading={flush.isPending}
              disabled={flush.isPending}
              icon={<MaterialCommunityIcons name="send" size={16} color={EL.white} />}
            />
          </View>
        ) : null}

        {/* Recent rows */}
        <Text style={styles.sectionTitle}>Recent</Text>
        {recent && recent.length > 0 ? (
          recent.map((row) => <SmsRow key={row.id} row={row} />)
        ) : (
          <View style={styles.empty}>
            <MaterialCommunityIcons name="message-outline" size={36} color={EL.outline} />
            <Text style={styles.emptyTitle}>No SMS sent yet</Text>
            <Text style={styles.emptySub}>
              Receipts are queued automatically when you record a collection.
            </Text>
          </View>
        )}
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

function SmsRow({ row }: { row: SmsQueueRow }) {
  const date = new Date(row.created_at);
  const dateStr = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const timeStr = date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });

  const statusIcon =
    row.status === 'sent' ? 'check-decagram' :
    row.status === 'failed' ? 'alert-circle' :
    row.status === 'queued' ? 'clock-outline' : 'minus';
  const statusColor =
    row.status === 'sent' ? EL.primary :
    row.status === 'failed' ? EL.tertiary :
    row.status === 'queued' ? EL.warn : EL.onSurfaceMuted;

  return (
    <View style={[styles.smsCard, Shadows.card]}>
      <View style={styles.smsTop}>
        <View style={styles.smsStatusPill}>
          <MaterialCommunityIcons name={statusIcon} size={14} color={statusColor} />
          <Text style={[styles.smsStatusText, { color: statusColor }]}>
            {row.status.toUpperCase()}
          </Text>
        </View>
        <Text style={styles.smsTime}>
          {dateStr} · {timeStr}
        </Text>
      </View>
      <Text style={styles.smsTo}>To: {row.to_phone}</Text>
      <Text style={styles.smsBody} numberOfLines={3}>{row.body}</Text>
      {row.last_error && row.status === 'failed' ? (
        <Text style={styles.smsError}>Error: {row.last_error}</Text>
      ) : null}
      {row.attempts > 0 && row.status !== 'sent' ? (
        <Text style={styles.smsMeta}>{row.attempts} attempt{row.attempts === 1 ? '' : 's'}</Text>
      ) : null}
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
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: EL.surfaceCard,
  },
  title: { ...Type.titleLg, fontWeight: '800' },
  sub: { fontSize: 12, color: EL.onSurfaceMuted, fontWeight: '600', marginTop: 2 },

  statsRow: { flexDirection: 'row', gap: Space.sm },
  statCard: {
    flex: 1,
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.lg,
    padding: Space.md,
  },
  statLabel: { fontSize: 9, fontWeight: '800', color: EL.onSurfaceMuted, letterSpacing: 0.6 },
  statValue: { fontSize: 22, fontWeight: '800', marginTop: 4 },

  flushCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    backgroundColor: EL.surfaceCard,
    padding: Space.lg,
    borderRadius: Radii.lg,
  },
  flushTitle: { fontSize: 14, fontWeight: '800', color: EL.onSurface },
  flushSub: { fontSize: 11, color: EL.onSurfaceMuted, marginTop: 2 },

  sectionTitle: { fontSize: 11, fontWeight: '800', color: EL.onSurfaceMuted, letterSpacing: 0.6 },

  smsCard: {
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.lg,
    padding: Space.md,
    gap: 4,
  },
  smsTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  smsStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Space.sm,
    paddingVertical: 2,
    borderRadius: Radii.pill,
    backgroundColor: EL.surfaceLow,
  },
  smsStatusText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
  smsTime: { fontSize: 10, color: EL.onSurfaceMuted, fontWeight: '600' },
  smsTo: { fontSize: 12, fontWeight: '700', color: EL.onSurfaceSec, marginTop: 4 },
  smsBody: { fontSize: 13, color: EL.onSurface, marginTop: 2, lineHeight: 18 },
  smsError: { fontSize: 11, color: EL.tertiary, marginTop: 4, fontStyle: 'italic' },
  smsMeta: { fontSize: 10, color: EL.onSurfaceMuted, marginTop: 2 },

  empty: { alignItems: 'center', padding: Space.xxxl, gap: Space.sm },
  emptyTitle: { fontSize: 14, fontWeight: '700', color: EL.onSurface, marginTop: Space.md },
  emptySub: { fontSize: 12, color: EL.onSurfaceMuted, textAlign: 'center', paddingHorizontal: Space.lg },
});
