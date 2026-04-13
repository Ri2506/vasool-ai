// ExportSheet — uniform "Share as PDF / Excel" bottom sheet used by every
// report screen. Pass a callback that resolves to {html, csv} and the
// sheet handles everything else: the print dialog (web), share sheet
// (native), and CSV download.

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { EL, Glass, Radii, Shadows, Space, Type } from '@/theme/emeraldLedger';
import { sharePdf, shareCsv } from '@/utils/pdfExport';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Fetches the export payload lazily so we don't build it until the user
   *  picks a format — keeps the report screen render path cheap. */
  build: () => Promise<{ html: string; csv: string }> | { html: string; csv: string };
  /** Used as the file/window name. Falls back to "VasoolAI-export". */
  filename?: string;
  /** Title shown at the top of the sheet. */
  title?: string;
}

export function ExportSheet({
  visible, onClose, build, filename = 'VasoolAI-export', title = 'Export report',
}: Props) {
  const [busy, setBusy] = useState<'pdf' | 'csv' | null>(null);

  const run = async (kind: 'pdf' | 'csv') => {
    setBusy(kind);
    try {
      const payload = await build();
      if (kind === 'pdf') await sharePdf(payload.html, filename);
      else await shareCsv(payload.csv, filename);
      onClose();
    } catch {
      // Errors surface via Share.share UI on native; on web the print
      // dialog opens regardless. Don't block the sheet on error.
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[Glass.dark, styles.backdrop]} onPress={onClose}>
        <Pressable style={[styles.sheet, Shadows.float]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.sub}>Choose a format to share</Text>

          <Pressable
            style={[styles.tile, busy === 'pdf' && styles.tileBusy]}
            onPress={() => run('pdf')}
            disabled={!!busy}
          >
            <View style={[styles.tileIcon, { backgroundColor: 'rgba(155,62,59,0.10)' }]}>
              <MaterialCommunityIcons name="file-pdf-box" size={26} color={EL.tertiary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.tileTitle}>Share as PDF</Text>
              <Text style={styles.tileSub}>Print-ready, formatted page</Text>
            </View>
            {busy === 'pdf' ? <ActivityIndicator color={EL.tertiary} /> : (
              <MaterialCommunityIcons name="chevron-right" size={20} color={EL.onSurfaceMuted} />
            )}
          </Pressable>

          <Pressable
            style={[styles.tile, busy === 'csv' && styles.tileBusy]}
            onPress={() => run('csv')}
            disabled={!!busy}
          >
            <View style={[styles.tileIcon, { backgroundColor: 'rgba(0,105,72,0.10)' }]}>
              <MaterialCommunityIcons name="file-table" size={26} color={EL.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.tileTitle}>Share as Excel (CSV)</Text>
              <Text style={styles.tileSub}>Opens in Excel · Google Sheets · Numbers</Text>
            </View>
            {busy === 'csv' ? <ActivityIndicator color={EL.primary} /> : (
              <MaterialCommunityIcons name="chevron-right" size={20} color={EL.onSurfaceMuted} />
            )}
          </Pressable>

          <Pressable onPress={onClose} style={styles.cancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: EL.surfaceCard,
    borderTopLeftRadius: Radii.xxl,
    borderTopRightRadius: Radii.xxl,
    padding: Space.xl,
    paddingBottom: Space.xxxl + 12,
    gap: Space.md,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: EL.outlineVariant,
    alignSelf: 'center', marginBottom: Space.sm,
  },
  title: { ...Type.titleLg, fontWeight: '800' },
  sub: { fontSize: 12, color: EL.onSurfaceMuted, marginBottom: Space.sm },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    padding: Space.md,
    borderRadius: Radii.lg,
    backgroundColor: EL.surfaceLow,
  },
  tileBusy: { opacity: 0.7 },
  tileIcon: {
    width: 44, height: 44, borderRadius: Radii.md,
    alignItems: 'center', justifyContent: 'center',
  },
  tileTitle: { fontSize: 15, fontWeight: '800', color: EL.onSurface },
  tileSub: { fontSize: 11, color: EL.onSurfaceMuted, marginTop: 2 },
  cancel: {
    paddingVertical: Space.md,
    alignItems: 'center',
    marginTop: Space.sm,
  },
  cancelText: { fontSize: 14, fontWeight: '700', color: EL.onSurfaceMuted },
});
