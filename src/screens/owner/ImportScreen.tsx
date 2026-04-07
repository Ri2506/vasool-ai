import React, { useState } from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ELCard } from '@/components/common/ELCard';
import { GradientButton } from '@/components/common/GradientButton';
import { VoiceButton } from '@/components/common/VoiceButton';
import { EL, Common, Radii, Shadows, Space, Touch, Type } from '@/theme/emeraldLedger';
import { createBorrower } from '@/db/repos/borrowers';
import { useAuthStore } from '@/store/authStore';
import { useVoice } from '@/hooks/useVoice';

export function ImportScreen() {
  const orgId = useAuthStore((s) => s.user?.orgId ?? null);
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
  };

  return (
    <SafeAreaView style={Common.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Import borrowers</Text>
        <Text style={styles.sub}>Migrate from paper or another app</Text>

        <View style={styles.modeRow}>
          <GradientButton
            title="Paste list"
            variant={mode === 'paste' ? 'primary' : 'secondary'}
            onPress={() => setMode('paste')}
            style={{ flex: 1, marginRight: Space.sm }}
          />
          <GradientButton
            title="Voice entry"
            variant={mode === 'voice' ? 'primary' : 'secondary'}
            onPress={() => setMode('voice')}
            style={{ flex: 1, marginLeft: Space.sm }}
          />
        </View>

        {mode === 'paste' ? (
          <>
            <Text style={styles.label}>One borrower per line. Format: Name, Phone</Text>
            <TextInput
              style={styles.textarea}
              value={pasteText}
              onChangeText={setPasteText}
              multiline
              placeholder={'Murugan K, 9876543210\nLakshmi S, 9988776655\nRaja M'}
              placeholderTextColor={EL.onSurfaceMuted}
            />
            <Text style={styles.hint}>
              {pasteText.split('\n').filter((l) => l.trim()).length} entries detected
            </Text>
            <GradientButton title="Import all" onPress={handleImportPaste} loading={importing} style={{ marginTop: Space.md }} />
          </>
        ) : (
          <>
            <VoiceButton isListening={voice.isListening} onPress={voice.isListening ? voice.stopListening : voice.startListening} lastText={voice.lastResult?.text} />
            <Text style={styles.label}>Speak each borrower's name. They'll be added to the list below.</Text>
            {voiceEntries.length > 0 ? (
              <ELCard style={{ marginTop: Space.md }}>
                {voiceEntries.map((name, i) => (
                  <Text key={i} style={styles.entryText}>{i + 1}. {name}</Text>
                ))}
              </ELCard>
            ) : null}
            <Text style={styles.hint}>{voiceEntries.length} entries</Text>
            <GradientButton
              title={`Import ${voiceEntries.length} borrowers`}
              onPress={handleImportVoice}
              loading={importing}
              disabled={voiceEntries.length === 0}
              style={{ marginTop: Space.md }}
            />
          </>
        )}

        {result ? (
          <ELCard style={{ marginTop: Space.lg, backgroundColor: EL.primaryFixed }}>
            <Text style={[Type.titleMd, { color: EL.primaryDark }]}>{result}</Text>
          </ELCard>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Space.xl, paddingBottom: Space.xxxl },
  title: { ...Type.displaySm },
  sub: { ...Type.bodySm, color: EL.onSurfaceSec, marginBottom: Space.lg },
  modeRow: { flexDirection: 'row', marginBottom: Space.lg },
  label: { ...Type.labelMd, color: EL.onSurfaceSec, marginBottom: Space.sm },
  textarea: {
    backgroundColor: EL.surfaceCard, borderRadius: Radii.sm + 2,
    padding: Space.lg, minHeight: 150, ...Type.bodyMd, color: EL.onSurface,
    textAlignVertical: 'top', ...Shadows.card,
  },
  hint: { ...Type.labelSm, color: EL.onSurfaceMuted, marginTop: Space.sm },
  entryText: { ...Type.bodyMd, marginTop: Space.xs },
});
