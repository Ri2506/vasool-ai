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

import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Colors } from '@/constants/colors';
import { Radius, Spacing, TouchTarget, Typography } from '@/constants/typography';
import { createBorrower } from '@/db/repos/borrowers';
import { useAuthStore } from '@/store/authStore';
import { useVoice } from '@/hooks/useVoice';
import { VoiceButton } from '@/components/common/VoiceButton';

/**
 * Bulk import screen. Two modes:
 *   1. Paste mode: paste a list (one borrower per line, "Name, Phone")
 *   2. Voice mode: speak each borrower name, tap to confirm
 *
 * PRD §4.9: "voice-powered bulk entry for migrating from paper"
 */
export function ImportScreen() {
  const orgId = useAuthStore((s) => s.user?.orgId ?? null);
  const voice = useVoice();
  const [mode, setMode] = useState<'paste' | 'voice'>('paste');
  const [pasteText, setPasteText] = useState('');
  const [voiceEntries, setVoiceEntries] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  // Voice: when speech is recognized, add to the list
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
      try {
        await createBorrower({ orgId, name, phone });
        count++;
      } catch {
        // skip duplicates or errors
      }
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
      try {
        await createBorrower({ orgId, name: name.trim() });
        count++;
      } catch {
        // skip
      }
    }
    setImporting(false);
    setResult(`Imported ${count} borrowers`);
    setVoiceEntries([]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Import borrowers</Text>
        <Text style={styles.sub}>Migrate from paper or another app</Text>

        {/* Mode toggle */}
        <View style={styles.modeRow}>
          <Button
            title="Paste list"
            variant={mode === 'paste' ? 'primary' : 'secondary'}
            onPress={() => setMode('paste')}
            style={{ flex: 1, marginRight: 8 }}
          />
          <Button
            title="Voice entry"
            variant={mode === 'voice' ? 'primary' : 'secondary'}
            onPress={() => setMode('voice')}
            style={{ flex: 1, marginLeft: 8 }}
          />
        </View>

        {mode === 'paste' ? (
          <>
            <Text style={styles.label}>
              One borrower per line. Format: Name, Phone
            </Text>
            <TextInput
              style={styles.textarea}
              value={pasteText}
              onChangeText={setPasteText}
              multiline
              placeholder={'Murugan K, 9876543210\nLakshmi S, 9988776655\nRaja M'}
              placeholderTextColor={Colors.textMuted}
            />
            <Text style={styles.hint}>
              {pasteText.split('\n').filter((l) => l.trim()).length} entries detected
            </Text>
            <Button
              title="Import all"
              onPress={handleImportPaste}
              loading={importing}
              style={{ marginTop: Spacing.md }}
            />
          </>
        ) : (
          <>
            <VoiceButton
              isListening={voice.isListening}
              onPress={voice.isListening ? voice.stopListening : voice.startListening}
              lastText={voice.lastResult?.text}
            />
            <Text style={styles.label}>
              Speak each borrower's name. They'll be added to the list below.
            </Text>
            {voiceEntries.length > 0 ? (
              <Card style={{ marginTop: Spacing.md }}>
                {voiceEntries.map((name, i) => (
                  <Text key={i} style={styles.entryText}>{i + 1}. {name}</Text>
                ))}
              </Card>
            ) : null}
            <Text style={styles.hint}>{voiceEntries.length} entries</Text>
            <Button
              title={`Import ${voiceEntries.length} borrowers`}
              onPress={handleImportVoice}
              loading={importing}
              disabled={voiceEntries.length === 0}
              style={{ marginTop: Spacing.md }}
            />
          </>
        )}

        {result ? (
          <Card style={{ marginTop: Spacing.lg, backgroundColor: Colors.primaryLight }}>
            <Text style={styles.resultText}>{result}</Text>
          </Card>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  container: { padding: Spacing.xl, paddingBottom: Spacing.xxl },
  title: { ...Typography.display, color: Colors.text },
  sub: { ...Typography.caption, color: Colors.textSec, marginBottom: Spacing.lg },
  modeRow: { flexDirection: 'row', marginBottom: Spacing.lg },
  label: { ...Typography.caption, color: Colors.textSec, marginBottom: Spacing.sm },
  textarea: {
    backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.button, padding: Spacing.md, minHeight: 150,
    ...Typography.body, color: Colors.text, textAlignVertical: 'top',
  },
  hint: { ...Typography.caption, color: Colors.textMuted, marginTop: Spacing.sm },
  entryText: { ...Typography.body, color: Colors.text, marginTop: 4 },
  resultText: { ...Typography.title, color: Colors.primaryDark },
});
