// DiagnosticsScreen — owner views recent crashes + can share the log.
//
// During soft-launch we don't have remote crash reporting set up. This
// screen makes the locally-cached crash log accessible so users can
// WhatsApp screenshots / text dumps to support.

import React, { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { GradientButton } from '@/components/common/GradientButton';
import { EL, Common, Radii, Shadows, Space, Type } from '@/theme/emeraldLedger';
import {
  clearCrashLog,
  flushCrashLog,
  getCrashLog,
  type CrashEvent,
} from '@/lib/crashReporter';

export function DiagnosticsScreen() {
  const navigation = useNavigation();
  const [events, setEvents] = useState<CrashEvent[]>([]);
  const [busy, setBusy] = useState(false);

  const reload = async () => setEvents(await getCrashLog());
  useEffect(() => { void reload(); }, []);

  const handleShare = async () => {
    if (events.length === 0) {
      Alert.alert('Nothing to share', 'No crashes recorded.');
      return;
    }
    const text = events
      .map((e) => `[${new Date(e.ts).toISOString()}] ${e.type.toUpperCase()} · ${e.platform}\n${e.message}\n${e.stack ?? ''}`)
      .join('\n\n---\n\n');
    await Share.share({ message: text, title: 'VasoolAI crash log' });
  };

  const handleUpload = async () => {
    setBusy(true);
    try {
      const r = await flushCrashLog();
      Alert.alert('Upload', `Uploaded ${r.uploaded} · failed ${r.failed}`);
      await reload();
    } finally { setBusy(false); }
  };

  const handleClear = async () => {
    Alert.alert('Clear log?', 'This permanently removes all recorded crashes.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: async () => { await clearCrashLog(); await reload(); } },
    ]);
  };

  return (
    <SafeAreaView style={Common.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={EL.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Diagnostics</Text>
          <Text style={styles.sub}>Last {events.length} crash event{events.length === 1 ? '' : 's'}</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <View style={{ flex: 1 }}>
          <GradientButton title="Share log" onPress={handleShare} icon={
            <MaterialCommunityIcons name="share-variant" size={16} color={EL.white} />
          } />
        </View>
        <Pressable style={styles.secondaryBtn} onPress={handleUpload} disabled={busy}>
          <MaterialCommunityIcons name="cloud-upload" size={18} color={EL.primary} />
          <Text style={styles.secondaryText}>Upload</Text>
        </Pressable>
        <Pressable style={[styles.secondaryBtn, { backgroundColor: 'rgba(155,62,59,0.08)' }]} onPress={handleClear}>
          <MaterialCommunityIcons name="delete-outline" size={18} color={EL.tertiary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: Space.lg, gap: Space.sm }}>
        {events.length === 0 ? (
          <View style={styles.empty}>
            <MaterialCommunityIcons name="check-decagram" size={36} color={EL.primary} />
            <Text style={styles.emptyTitle}>No crashes recorded</Text>
            <Text style={styles.emptySub}>The app has been running smoothly.</Text>
          </View>
        ) : (
          events.map((e, i) => (
            <View key={i} style={[styles.card, Shadows.card]}>
              <View style={styles.cardTop}>
                <Text style={[styles.cardKind,
                  e.type === 'boundary' && { color: EL.tertiary },
                  e.type === 'rejection' && { color: EL.warn },
                ]}>
                  {e.type.toUpperCase()}
                </Text>
                <Text style={styles.cardWhen}>{new Date(e.ts).toLocaleString()}</Text>
              </View>
              <Text style={styles.cardMsg}>{e.message}</Text>
              {e.context ? <Text style={styles.cardCtx}>{e.context}</Text> : null}
              {e.uploaded ? (
                <View style={styles.uploadedTag}>
                  <MaterialCommunityIcons name="cloud-check" size={10} color={EL.primary} />
                  <Text style={styles.uploadedText}>Uploaded</Text>
                </View>
              ) : null}
            </View>
          ))
        )}
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
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: EL.surfaceCard,
  },
  title: { ...Type.titleLg, fontWeight: '800' },
  sub: { fontSize: 12, color: EL.onSurfaceMuted, fontWeight: '600', marginTop: 2 },

  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    paddingHorizontal: Space.lg,
    paddingBottom: Space.md,
  },
  secondaryBtn: {
    height: 48,
    paddingHorizontal: Space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,105,72,0.08)',
    borderRadius: Radii.md,
  },
  secondaryText: { fontSize: 13, fontWeight: '700', color: EL.primary },

  empty: { alignItems: 'center', padding: Space.xxxl, gap: Space.sm },
  emptyTitle: { fontSize: 14, fontWeight: '700', color: EL.onSurface, marginTop: Space.md },
  emptySub: { fontSize: 12, color: EL.onSurfaceMuted },

  card: {
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.lg,
    padding: Space.md,
    gap: 4,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between' },
  cardKind: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  cardWhen: { fontSize: 10, color: EL.onSurfaceMuted },
  cardMsg: { fontSize: 13, fontWeight: '700', color: EL.onSurface },
  cardCtx: { fontSize: 11, color: EL.onSurfaceSec, fontStyle: 'italic' },
  uploadedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radii.pill,
    backgroundColor: 'rgba(0,105,72,0.08)',
    marginTop: 4,
  },
  uploadedText: { fontSize: 9, fontWeight: '700', color: EL.primary },
});
