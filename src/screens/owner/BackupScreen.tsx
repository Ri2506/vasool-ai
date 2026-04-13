// BackupScreen — owner exports a JSON snapshot they can save anywhere
// (Drive, email, WhatsApp). Restore lets them paste the JSON back to
// recover the local DB.
//
// Future: when the sync layer ships, this screen will also offer
// "Backup to cloud" + "Restore from cloud" (one-tap, Supabase-backed).

import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { GradientButton } from '@/components/common/GradientButton';
import { EL, Common, Radii, Shadows, Space, Type } from '@/theme/emeraldLedger';
import { exportBackup, restoreBackup, type BackupBundle } from '@/db/backup';
import { useAuthStore } from '@/store/authStore';

export function BackupScreen() {
  const navigation = useNavigation();
  const orgId = useAuthStore((s) => s.user?.orgId ?? null);
  const [busy, setBusy] = useState<'export' | 'restore' | null>(null);
  const [restoreText, setRestoreText] = useState('');
  const [showRestore, setShowRestore] = useState(false);

  const handleExport = async () => {
    if (!orgId) return;
    setBusy('export');
    try {
      const bundle = await exportBackup(orgId);
      const json = JSON.stringify(bundle);
      const sizeKb = Math.round((json.length / 1024) * 10) / 10;
      const summary = Object.entries(bundle.tables)
        .filter(([, rows]) => rows.length > 0)
        .map(([t, rows]) => `${rows.length} ${t}`)
        .join(', ');
      Alert.alert(
        'Backup ready',
        `${sizeKb} KB · ${summary}\n\nNext step: tap Share to save the JSON to Drive / email / WhatsApp.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Share',
            onPress: () =>
              Share.share({
                message: json,
                title: `VasoolAI-backup-${new Date().toISOString().slice(0, 10)}.json`,
              }),
          },
        ],
      );
    } catch (e: any) {
      Alert.alert('Backup failed', e?.message ?? 'unknown error');
    } finally { setBusy(null); }
  };

  const handleRestore = async () => {
    if (!restoreText.trim()) return;
    let bundle: BackupBundle;
    try {
      bundle = JSON.parse(restoreText.trim());
    } catch {
      Alert.alert('Invalid JSON', 'The text you pasted is not valid backup JSON.');
      return;
    }
    if (bundle.format !== 'vasool-ai-backup-v1') {
      Alert.alert('Wrong format', 'This file is not a VasoolAI backup.');
      return;
    }
    Alert.alert(
      'Overwrite local data?',
      `This will INSERT OR REPLACE every row in the backup. Existing rows with matching IDs are overwritten. There is no undo.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: async () => {
            setBusy('restore');
            try {
              const r = await restoreBackup(bundle);
              const skippedCount = Object.keys(r.skipped).length;
              Alert.alert(
                'Restore complete',
                `${r.totalInserted} rows restored.${skippedCount > 0 ? `\n\n${skippedCount} table(s) skipped due to errors.` : ''}\n\nReopen the app to see all data refreshed.`,
              );
              setShowRestore(false);
              setRestoreText('');
            } catch (e: any) {
              Alert.alert('Restore failed', e?.message ?? 'unknown error');
            } finally { setBusy(null); }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={Common.screen}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={22} color={EL.onSurface} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Backup &amp; Restore</Text>
            <Text style={styles.sub}>Snapshot of your local database</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ padding: Space.lg, gap: Space.lg, paddingBottom: 80 }}>
          {/* Export */}
          <View style={[styles.card, Shadows.card]}>
            <View style={styles.cardTop}>
              <View style={[styles.cardIcon, { backgroundColor: 'rgba(0,105,72,0.10)' }]}>
                <MaterialCommunityIcons name="cloud-upload" size={22} color={EL.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Export backup</Text>
                <Text style={styles.cardSub}>
                  Save a JSON snapshot of every borrower, loan, collection, expense,
                  and handover. Email it to yourself or save to Drive.
                </Text>
              </View>
            </View>
            <GradientButton
              title={busy === 'export' ? 'Preparing…' : 'Export now'}
              onPress={handleExport}
              loading={busy === 'export'}
              disabled={!!busy}
              icon={<MaterialCommunityIcons name="share-variant" size={16} color={EL.white} />}
            />
          </View>

          {/* Restore */}
          <View style={[styles.card, Shadows.card]}>
            <View style={styles.cardTop}>
              <View style={[styles.cardIcon, { backgroundColor: 'rgba(155,62,59,0.08)' }]}>
                <MaterialCommunityIcons name="cloud-download" size={22} color={EL.tertiary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Restore from backup</Text>
                <Text style={styles.cardSub}>
                  Paste a backup JSON to recover. INSERT OR REPLACE — existing rows
                  with matching IDs are overwritten.
                </Text>
              </View>
            </View>
            {showRestore ? (
              <>
                <TextInput
                  style={styles.bigInput}
                  multiline
                  numberOfLines={6}
                  placeholder="Paste backup JSON here…"
                  placeholderTextColor={EL.onSurfaceMuted}
                  value={restoreText}
                  onChangeText={setRestoreText}
                />
                <View style={{ flexDirection: 'row', gap: Space.sm }}>
                  <Pressable
                    onPress={() => { setShowRestore(false); setRestoreText(''); }}
                    style={styles.secondaryBtn}
                  >
                    <Text style={styles.secondaryText}>Cancel</Text>
                  </Pressable>
                  <View style={{ flex: 1 }}>
                    <GradientButton
                      title={busy === 'restore' ? 'Restoring…' : 'Restore'}
                      onPress={handleRestore}
                      variant="danger"
                      loading={busy === 'restore'}
                      disabled={!!busy || !restoreText.trim()}
                    />
                  </View>
                </View>
              </>
            ) : (
              <Pressable
                onPress={() => setShowRestore(true)}
                style={styles.openRestore}
              >
                <MaterialCommunityIcons name="content-paste" size={16} color={EL.tertiary} />
                <Text style={styles.openRestoreText}>Paste backup JSON</Text>
              </Pressable>
            )}
          </View>

          {/* Cloud-sync teaser */}
          <View style={[styles.infoCard, Shadows.card]}>
            <MaterialCommunityIcons name="information-outline" size={18} color={EL.onSurfaceSec} />
            <Text style={styles.infoText}>
              Coming soon: <Text style={{ fontWeight: '800' }}>One-tap cloud backup</Text> via Supabase.
              Until then, this manual export is the safest way to protect against
              "my phone broke" scenarios.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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

  card: { backgroundColor: EL.surfaceCard, borderRadius: Radii.lg, padding: Space.lg, gap: Space.md },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: Space.md },
  cardIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '800', color: EL.onSurface },
  cardSub: { fontSize: 12, color: EL.onSurfaceMuted, marginTop: 2, lineHeight: 17 },

  bigInput: {
    backgroundColor: EL.surfaceLow,
    borderRadius: Radii.md,
    padding: Space.md,
    fontSize: 12,
    color: EL.onSurface,
    minHeight: 120,
    textAlignVertical: 'top',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  openRestore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.sm,
    padding: Space.md,
    borderRadius: Radii.md,
    backgroundColor: 'rgba(155,62,59,0.06)',
  },
  openRestoreText: { fontSize: 13, fontWeight: '700', color: EL.tertiary },

  secondaryBtn: {
    paddingHorizontal: Space.lg,
    height: 48,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: EL.surfaceLow,
    borderRadius: Radii.md,
  },
  secondaryText: { fontSize: 14, fontWeight: '700', color: EL.onSurface },

  infoCard: {
    flexDirection: 'row', gap: Space.sm,
    backgroundColor: EL.surfaceCard,
    padding: Space.md,
    borderRadius: Radii.lg,
    alignItems: 'flex-start',
  },
  infoText: { flex: 1, fontSize: 12, color: EL.onSurfaceSec, lineHeight: 17 },
});
