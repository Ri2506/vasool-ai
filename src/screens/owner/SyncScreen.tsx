// SyncScreen — manual sync trigger + per-table dirty counts.
//
// Auto-sync runs in the background every time the network comes back (see
// App.tsx). This screen is for the rare case where the owner wants to
// force a push (e.g., before handing the phone to an agent on a different
// device, or after fixing a record they want propagated immediately).

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
import { useSyncNow, useSyncStatus } from '@/hooks/useSync';

export function SyncScreen() {
  const navigation = useNavigation();
  const { data: status } = useSyncStatus();
  const sync = useSyncNow();

  const handleSync = async () => {
    try {
      const r = await sync.mutateAsync();
      Alert.alert('Sync complete', `Pushed ${r.pushed} · Pulled ${r.pulled}`);
    } catch (e: any) {
      Alert.alert('Sync failed', e?.message ?? 'unknown error');
    }
  };

  const dirtyEntries = Object.entries(status?.byTable ?? {});

  return (
    <SafeAreaView style={Common.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={EL.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Cloud Sync</Text>
          <Text style={styles.sub}>Push local changes to Supabase</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: Space.lg, gap: Space.lg, paddingBottom: 80 }}>
        {/* Status hero */}
        <View
          style={[
            styles.hero,
            status?.totalDirty === 0 ? styles.heroOk : styles.heroDirty,
            Shadows.float,
          ]}
        >
          <MaterialCommunityIcons
            name={status?.totalDirty === 0 ? 'cloud-check' : 'cloud-upload'}
            size={36}
            color={status?.totalDirty === 0 ? EL.primary : EL.warn}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>
              {status?.totalDirty === 0 ? 'All synced' : `${status?.totalDirty} pending`}
            </Text>
            <Text style={styles.heroSub}>
              {status?.totalDirty === 0
                ? 'Local data matches the cloud copy.'
                : `${status?.totalDirty} row${status?.totalDirty === 1 ? '' : 's'} waiting to push to Supabase.`}
            </Text>
          </View>
        </View>

        {/* Per-table breakdown */}
        {dirtyEntries.length > 0 ? (
          <View style={[styles.card, Shadows.card]}>
            <Text style={styles.cardLabel}>PENDING BY TABLE</Text>
            {dirtyEntries.map(([table, count]) => (
              <View key={table} style={styles.tableRow}>
                <MaterialCommunityIcons name="table" size={14} color={EL.onSurfaceMuted} />
                <Text style={styles.tableName}>{table}</Text>
                <View style={styles.tableBadge}>
                  <Text style={styles.tableBadgeText}>{count}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        <GradientButton
          title={sync.isPending ? 'Syncing…' : 'Sync now'}
          onPress={handleSync}
          loading={sync.isPending}
          disabled={sync.isPending}
          icon={<MaterialCommunityIcons name="sync" size={18} color={EL.white} />}
        />

        {/* Info card */}
        <View style={[styles.infoCard, Shadows.card]}>
          <MaterialCommunityIcons name="information-outline" size={18} color={EL.onSurfaceSec} />
          <Text style={styles.infoText}>
            Sync also runs <Text style={{ fontWeight: '800' }}>automatically</Text> when the app
            reopens or when the network comes back. The "Sync now" button is for the rare case
            where you want to force a push right now.
          </Text>
        </View>
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

  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    padding: Space.xl,
    borderRadius: Radii.xl,
  },
  heroOk: { backgroundColor: 'rgba(0,105,72,0.06)' },
  heroDirty: { backgroundColor: 'rgba(217,119,6,0.08)' },
  heroTitle: { fontSize: 18, fontWeight: '800', color: EL.onSurface },
  heroSub: { fontSize: 12, color: EL.onSurfaceMuted, marginTop: 2 },

  card: { backgroundColor: EL.surfaceCard, borderRadius: Radii.lg, padding: Space.lg, gap: Space.sm },
  cardLabel: { fontSize: 10, fontWeight: '800', color: EL.onSurfaceMuted, letterSpacing: 0.6, marginBottom: 4 },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    paddingVertical: 6,
  },
  tableName: { flex: 1, fontSize: 13, fontWeight: '600', color: EL.onSurface },
  tableBadge: {
    minWidth: 32,
    paddingHorizontal: Space.sm,
    paddingVertical: 2,
    borderRadius: Radii.pill,
    backgroundColor: EL.warn,
    alignItems: 'center',
  },
  tableBadgeText: { fontSize: 11, fontWeight: '800', color: EL.white },

  infoCard: {
    flexDirection: 'row', gap: Space.sm,
    backgroundColor: EL.surfaceCard,
    padding: Space.md,
    borderRadius: Radii.lg,
    alignItems: 'flex-start',
  },
  infoText: { flex: 1, fontSize: 12, color: EL.onSurfaceSec, lineHeight: 17 },
});
