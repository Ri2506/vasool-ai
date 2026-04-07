import React from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { OwnerStackParamList } from '@/navigation/types';

import { Badge } from '@/components/common/Badge';
import { ELCard } from '@/components/common/ELCard';
import { GradientButton } from '@/components/common/GradientButton';
import { EL, Common, Radii, Space, Touch, Type } from '@/theme/emeraldLedger';
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
    <SafeAreaView style={Common.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{t('nav.settings')}</Text>

        {/* Language */}
        <ELCard style={styles.card}>
          <Text style={styles.sectionTitle}>{t('auth.choose_language')}</Text>
          <View style={styles.langRow}>
            <LangButton label="English" active={currentLng === 'en'} onPress={() => handleLang('en')} />
            <LangButton label="\u0BA4\u0BAE\u0BBF\u0BB4\u0BCD" active={currentLng === 'ta'} onPress={() => handleLang('ta')} />
          </View>
        </ELCard>

        {/* Referral */}
        <ELCard style={[styles.card, { backgroundColor: EL.primaryFixed }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm }}>
            <MaterialCommunityIcons name="gift-outline" size={20} color={EL.primary} />
            <Text style={styles.sectionTitle}>Refer & Earn</Text>
          </View>
          <Text style={styles.sub}>Share your code \u2014 you both get 1 month free</Text>
          <GradientButton
            title="Get referral code"
            onPress={() => navigation.navigate('Referral')}
            style={{ marginTop: Space.md }}
          />
        </ELCard>

        {/* Agent management */}
        <SettingsRow
          icon="account-group"
          title="Agents"
          sub="Create and manage collection agents"
          onPress={() => navigation.navigate('AgentManagement')}
        />

        {/* Subscription */}
        <SettingsRow
          icon="crown-outline"
          title="Subscription"
          sub="Free plan \u2014 upgrade for more features"
          onPress={() => navigation.navigate('Subscription')}
        />

        {/* Import */}
        <SettingsRow
          icon="file-import-outline"
          title="Import borrowers"
          sub="Bulk import from paper or another app"
          onPress={() => navigation.navigate('Import')}
        />

        {/* Working days */}
        <ELCard style={styles.card}>
          <Text style={styles.sectionTitle}>Working days</Text>
          <Text style={styles.sub}>Mon\u2013Sat (Sundays skipped)</Text>
          <View style={styles.dayRow}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <Badge key={d} label={d} variant="success" />
            ))}
            <Badge label="Sun" variant="neutral" />
          </View>
        </ELCard>

        {/* Investments */}
        <SettingsRow
          icon="bank-outline"
          title="Capital invested"
          sub="Track money put into the business"
          onPress={() => navigation.navigate('Investments')}
        />

        {/* Data export */}
        <ELCard style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm }}>
            <MaterialCommunityIcons name="download-outline" size={20} color={EL.primary} />
            <Text style={styles.sectionTitle}>Export data</Text>
          </View>
          <Text style={styles.sub}>Download as CSV (opens in Excel/Sheets)</Text>
          <View style={{ marginTop: Space.md, gap: Space.sm }}>
            <GradientButton title="Export borrowers" variant="secondary" onPress={() => handleExport('borrowers')} />
            <GradientButton title="Export collections" variant="secondary" onPress={() => handleExport('collections')} />
            <GradientButton title="Export expenses" variant="secondary" onPress={() => handleExport('expenses')} />
          </View>
        </ELCard>

        {/* App info */}
        <ELCard style={styles.card}>
          <Text style={styles.sectionTitle}>VasoolAI</Text>
          <Text style={styles.sub}>Version 0.1.0 \u2022 Phase 1 MVP</Text>
          <Text style={styles.sub}>Local-first \u2022 Offline-ready</Text>
        </ELCard>

        <GradientButton
          title={t('auth.sign_out')}
          variant="danger"
          onPress={signOut}
          style={{ marginTop: Space.lg }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingsRow({ icon, title, sub, onPress }: { icon: string; title: string; sub: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress}>
      <ELCard style={styles.card}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm }}>
          <MaterialCommunityIcons name={icon as any} size={20} color={EL.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>{title}</Text>
            <Text style={styles.sub}>{sub}</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color={EL.onSurfaceMuted} />
        </View>
      </ELCard>
    </Pressable>
  );
}

function LangButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.langBtn, active ? styles.langBtnActive : styles.langBtnInactive]}
    >
      <Text style={[styles.langLabel, active && { color: EL.white }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: Space.xl, paddingBottom: Space.xxxl },
  title: { ...Type.displayMd, marginBottom: Space.lg },
  card: { marginBottom: Space.md },
  sectionTitle: { ...Type.titleMd, marginBottom: Space.xs },
  sub: { ...Type.bodySm, color: EL.onSurfaceSec, marginTop: 2 },
  langRow: { flexDirection: 'row', marginTop: Space.md, gap: Space.sm },
  langBtn: {
    flex: 1,
    minHeight: Touch.min,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Radii.md,
  },
  langBtnActive: { backgroundColor: EL.primary },
  langBtnInactive: { backgroundColor: EL.surfaceHigh },
  langLabel: { ...Type.labelLg, color: EL.onSurface },
  dayRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: Space.md, gap: Space.sm },
});
