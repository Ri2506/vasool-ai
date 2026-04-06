import React from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { OwnerStackParamList } from '@/navigation/types';

import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Colors } from '@/constants/colors';
import { Spacing, TouchTarget, Typography } from '@/constants/typography';
import { setLanguage, type Language } from '@/i18n';
import { useAuthStore } from '@/store/authStore';
import { exportBorrowers, exportCollections, exportExpenses, shareCsv } from '@/utils/exportData';
import i18n from '@/i18n';

type Nav = NativeStackNavigationProp<OwnerStackParamList>;

export function SettingsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const signOut = useAuthStore((s) => s.signOut);
  const orgId = useAuthStore((s) => s.user?.orgId ?? null);
  const currentLng = (i18n.language as Language) ?? 'en';

  const handleExport = async (type: 'borrowers' | 'collections' | 'expenses') => {
    if (!orgId) return;
    const fns = { borrowers: exportBorrowers, collections: exportCollections, expenses: exportExpenses };
    const csv = await fns[type](orgId);
    if (!csv) return;
    await shareCsv(csv, `vasoolai-${type}.csv`);
  };

  const handleLang = async (lng: Language) => {
    await setLanguage(lng);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>{t('nav.settings')}</Text>

        {/* Language */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>{t('auth.choose_language')}</Text>
          <View style={styles.langRow}>
            <LangButton
              label="English"
              active={currentLng === 'en'}
              onPress={() => handleLang('en')}
            />
            <LangButton
              label="தமிழ்"
              active={currentLng === 'ta'}
              onPress={() => handleLang('ta')}
            />
          </View>
        </Card>

        {/* Referral */}
        <Card style={[styles.card, { backgroundColor: Colors.primaryLight, borderColor: Colors.primary }]}>
          <Text style={styles.sectionTitle}>Refer & Earn</Text>
          <Text style={styles.sub}>Share your code — you both get 1 month free</Text>
          <Button
            title="Get referral code"
            onPress={() => navigation.navigate('Referral')}
            style={{ marginTop: Spacing.md }}
          />
        </Card>

        {/* Agent management */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Agents</Text>
          <Text style={styles.sub}>Create and manage collection agents</Text>
          <Button
            title="Manage agents"
            variant="secondary"
            onPress={() => navigation.navigate('AgentManagement')}
            style={{ marginTop: Spacing.md }}
          />
        </Card>

        {/* Subscription */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Subscription</Text>
          <Text style={styles.sub}>Free plan — upgrade for more features</Text>
          <Button
            title="View plans"
            variant="secondary"
            onPress={() => navigation.navigate('Subscription')}
            style={{ marginTop: Spacing.md }}
          />
        </Card>

        {/* Import */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Import borrowers</Text>
          <Text style={styles.sub}>Bulk import from paper or another app</Text>
          <Button
            title="Import"
            variant="secondary"
            onPress={() => navigation.navigate('Import')}
            style={{ marginTop: Spacing.md }}
          />
        </Card>

        {/* Working days */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Working days</Text>
          <Text style={styles.sub}>
            Mon–Sat (Sundays skipped). Custom working day config coming in a future update.
          </Text>
          <View style={styles.dayRow}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <Badge key={d} label={d} variant="success" />
            ))}
            <Badge label="Sun" variant="neutral" />
          </View>
        </Card>

        {/* Investments */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Capital invested</Text>
          <Text style={styles.sub}>Track money put into the business</Text>
          <Button
            title="View investments"
            variant="secondary"
            onPress={() => navigation.navigate('Investments')}
            style={{ marginTop: Spacing.md }}
          />
        </Card>

        {/* Data export */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Export data</Text>
          <Text style={styles.sub}>Download as CSV (opens in Excel/Sheets)</Text>
          <View style={{ marginTop: Spacing.md }}>
            <Button title="Export borrowers" variant="secondary" onPress={() => handleExport('borrowers')} style={{ marginBottom: Spacing.sm }} />
            <Button title="Export collections" variant="secondary" onPress={() => handleExport('collections')} style={{ marginBottom: Spacing.sm }} />
            <Button title="Export expenses" variant="secondary" onPress={() => handleExport('expenses')} />
          </View>
        </Card>

        {/* App info */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>VasoolAI</Text>
          <Text style={styles.sub}>Version 0.1.0 • Phase 1 MVP</Text>
          <Text style={styles.sub}>Local-first • Offline-ready</Text>
        </Card>

        <Button
          title={t('auth.sign_out')}
          variant="danger"
          onPress={signOut}
          style={{ marginTop: Spacing.lg }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function LangButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.langBtn, active && styles.langBtnActive]}
    >
      <Text style={[styles.langLabel, active && styles.langLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  container: { padding: Spacing.xl, paddingBottom: Spacing.xxl },
  title: { ...Typography.display, color: Colors.text, marginBottom: Spacing.lg },
  card: { marginBottom: Spacing.lg },
  sectionTitle: { ...Typography.title, color: Colors.text, marginBottom: Spacing.sm },
  sub: { ...Typography.caption, color: Colors.textSec, marginTop: 2 },
  langRow: { flexDirection: 'row', marginTop: Spacing.md },
  langBtn: {
    flex: 1,
    minHeight: TouchTarget.min,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: Spacing.sm,
  },
  langBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  langLabel: { ...Typography.title, color: Colors.text },
  langLabelActive: { color: Colors.white },
  dayRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: Spacing.md, gap: Spacing.sm },
});
