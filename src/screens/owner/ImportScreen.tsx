import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';

import { GradientButton } from '@/components/common/GradientButton';
import { VoiceButton } from '@/components/common/VoiceButton';
import { EL, Common, Radii, Shadows, Space, Touch, Type } from '@/theme/emeraldLedger';
import { createBorrower } from '@/db/repos/borrowers';
import { useAuthStore } from '@/store/authStore';
import { useVoice } from '@/hooks/useVoice';

export function ImportScreen() {
  const orgId = useAuthStore((s) => s.user?.orgId ?? null);
  const qc = useQueryClient();
  const voice = useVoice();
  const [mode, setMode] = useState<'paste' | 'voice'>('paste');
  const [pasteText, setPasteText] = useState('');
  const [voiceEntries, setVoiceEntries] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  React.useEffect(() => {
    if (voice.lastResult?.text && mode === 'voice') {
      setVoiceEntries((prev) => [...prev, voice.lastResult!.text]);
    }
  }, [voice.lastResult, mode]);

  const detectedCount = pasteText.split('\n').filter((l) => l.trim()).length;

  const handleImportPaste = async () => {
    if (!orgId || !pasteText.trim()) return;
    setImporting(true);
    const lines = pasteText.split('\n').filter((l) => l.trim());
    let count = 0;
    for (const line of lines) {
      const parts = line.split(',').map((s) => s.trim());
      const name = parts[0];
      const phone = parts[1] || undefined;
      if (!name) continue;
      try { await createBorrower({ orgId, name, phone }); count++; } catch {}
    }
    setImporting(false);
    setResult(`Imported ${count} borrowers`);
    setPasteText('');
    qc.invalidateQueries({ queryKey: ['borrowers'] });
  };

  const handleImportVoice = async () => {
    if (!orgId || voiceEntries.length === 0) return;
    setImporting(true);
    let count = 0;
    for (const name of voiceEntries) {
      try { await createBorrower({ orgId, name: name.trim() }); count++; } catch {}
    }
    setImporting(false);
    setResult(`Imported ${count} borrowers`);
    setVoiceEntries([]);
    qc.invalidateQueries({ queryKey: ['borrowers'] });
  };

  return (
    <SafeAreaView style={Common.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Import Borrowers</Text>

        {/* Toggle Switch */}
        <View style={styles.toggleContainer}>
          <Pressable
            style={[styles.toggleBtn, mode === 'paste' && styles.toggleBtnActive]}
            onPress={() => setMode('paste')}
          >
            <Text style={[styles.toggleText, mode === 'paste' && styles.toggleTextActive]}>Paste List</Text>
          </Pressable>
          <Pressable
            style={[styles.toggleBtn, mode === 'voice' && styles.toggleBtnActive]}
            onPress={() => setMode('voice')}
          >
            <Text style={[styles.toggleText, mode === 'voice' && styles.toggleTextActive]}>Voice Entry</Text>
          </Pressable>
        </View>

        {mode === 'paste' ? (
          <>
            {/* Paste View */}
            <View style={styles.pasteCard}>
              <Text style={styles.pasteLabel}>Paste lender data below</Text>
              <TextInput
                style={styles.textarea}
                value={pasteText}
                onChangeText={setPasteText}
                multiline
                placeholder={'Arjun Kumar, \u20B950,000, 2%\nPriya Dharshini, \u20B925,000, 1.5%\nKarthik Raja, \u20B91,20,000, 3%'}
                placeholderTextColor={EL.outlineVariant}
              />
              <View style={styles.infoBox}>
                <MaterialCommunityIcons name="information-outline" size={14} color={EL.primary} />
                <Text style={styles.infoText}>
                  Separate entries by new lines. Our system automatically detects Names, Amounts, and Interest Rates using AI.
                </Text>
              </View>
            </View>

            {/* Summary Card */}
            {detectedCount > 0 ? (
              <View style={styles.summaryCard}>
                <View>
                  <Text style={styles.summaryTitle}>Ready to Process</Text>
                  <Text style={styles.summarySub}>{detectedCount} borrowers detected in text</Text>
                </View>
                <View style={styles.avatarStack}>
                  {pasteText.split('\n').filter(l => l.trim()).slice(0, 3).map((line, i) => {
                    const initials = line.trim().split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                    return (
                      <View key={i} style={[styles.miniAvatar, { marginLeft: i > 0 ? -12 : 0 }]}>
                        <Text style={styles.miniAvatarText}>{initials}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : null}
          </>
        ) : (
          <>
            {/* Voice View */}
            <VoiceButton
              isListening={voice.isListening}
              onPress={voice.isListening ? voice.stopListening : voice.startListening}
              lastText={voice.lastResult?.text}
            />
            <Text style={styles.pasteLabel}>
              Speak each borrower's name. They'll be added to the list below.
            </Text>
            {voiceEntries.length > 0 ? (
              <View style={styles.voiceList}>
                {voiceEntries.map((name, i) => (
                  <View key={i} style={styles.voiceEntry}>
                    <MaterialCommunityIcons name="check-circle" size={18} color={EL.primary} />
                    <Text style={styles.voiceEntryText}>{name}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            <Text style={styles.hint}>{voiceEntries.length} entries</Text>
          </>
        )}

        {result ? (
          <View style={styles.resultCard}>
            <MaterialCommunityIcons name="check-circle" size={20} color={EL.primary} />
            <Text style={styles.resultText}>{result}</Text>
          </View>
        ) : null}

        <View style={{ height: 100 }} />
      </ScrollView>
      </KeyboardAvoidingView>

      {/* Fixed bottom CTA */}
      <View style={styles.bottomBar}>
        <GradientButton
          title={mode === 'paste' ? `Import ${detectedCount} borrowers` : `Import ${voiceEntries.length} borrowers`}
          onPress={mode === 'paste' ? handleImportPaste : handleImportVoice}
          loading={importing}
          disabled={mode === 'paste' ? detectedCount === 0 : voiceEntries.length === 0}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Space.xl, paddingBottom: Space.xxxl },
  title: {
    ...Type.displaySm,
    fontWeight: '800',
    marginBottom: Space.xxl,
  },

  // Toggle
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: EL.surfaceHigh,
    borderRadius: Radii.lg,
    padding: 6,
    marginBottom: Space.xxl,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: Space.md,
    borderRadius: Radii.md,
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: EL.surfaceCard,
    ...Shadows.card,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: EL.onSurfaceSec,
  },
  toggleTextActive: {
    color: EL.primary,
  },

  // Paste
  pasteCard: {
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.lg,
    padding: Space.xl,
    ...Shadows.card,
  },
  pasteLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: EL.onSurfaceSec,
    marginBottom: Space.lg,
  },
  textarea: {
    backgroundColor: EL.surfaceLow,
    borderRadius: Radii.md,
    padding: Space.lg,
    minHeight: 200,
    ...Type.bodyMd,
    color: EL.onSurface,
    textAlignVertical: 'top',
    lineHeight: 22,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Space.md,
    marginTop: Space.lg,
    backgroundColor: 'rgba(133,248,196,0.2)',
    borderRadius: Radii.md,
    padding: Space.lg,
  },
  infoText: {
    fontSize: 12,
    color: EL.secondary,
    lineHeight: 18,
    flex: 1,
  },

  // Summary
  summaryCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: EL.surfaceLow,
    borderRadius: Radii.lg,
    padding: Space.xl,
    marginTop: Space.xl,
  },
  summaryTitle: {
    ...Type.titleLg,
    fontWeight: '700',
  },
  summarySub: {
    fontSize: 14,
    color: EL.onSurfaceSec,
    marginTop: 2,
  },
  avatarStack: {
    flexDirection: 'row',
  },
  miniAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: EL.surfaceHighest,
    borderWidth: 2,
    borderColor: EL.surfaceLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniAvatarText: {
    fontSize: 10,
    fontWeight: '700',
    color: EL.onSurface,
  },

  // Voice
  voiceList: {
    gap: Space.sm,
    marginTop: Space.md,
  },
  voiceEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    backgroundColor: EL.surfaceCard,
    padding: Space.lg,
    borderRadius: Radii.md,
    ...Shadows.card,
  },
  voiceEntryText: {
    ...Type.bodyMd,
    fontWeight: '500',
  },

  hint: { ...Type.labelSm, color: EL.onSurfaceMuted, marginTop: Space.sm },

  // Result
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    backgroundColor: EL.primaryFixed,
    borderRadius: Radii.lg,
    padding: Space.xl,
    marginTop: Space.xl,
  },
  resultText: {
    ...Type.titleMd,
    color: EL.primary,
    fontWeight: '700',
  },

  // Bottom
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Space.xl,
    backgroundColor: 'rgba(250,252,251,0.95)',
  },
});
