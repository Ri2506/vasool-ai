import React, { useEffect, useState } from 'react';
import {
  Alert,
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

import { ELCard } from '@/components/common/ELCard';
import { GradientButton } from '@/components/common/GradientButton';
import { EL, Common, Radii, Shadows, Space, Touch, Type } from '@/theme/emeraldLedger';
import { applyReferralCode, getReferralStats } from '@/db/repos/referrals';
import { useAuthStore } from '@/store/authStore';

export function ReferralScreen() {
  const orgId = useAuthStore((s) => s.user?.orgId ?? '');
  const [code, setCode] = useState('');
  const [stats, setStats] = useState({ totalReferred: 0, completedCount: 0, freeMonthsEarned: 0 });
  const [applyCode, setApplyCode] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      if (!orgId) return;
      const s = await getReferralStats(orgId);
      setCode(s.code);
      setStats(s);
    })();
  }, [orgId]);

  const handleShare = async () => {
    await Share.share({
      message: `Try VasoolAI \u2014 the fastest collection app for money lenders! Use my code ${code} to get 1 month free.\n\nDownload: https://vasoolai.com`,
    });
  };

  const handleCopy = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(code);
      Alert.alert('Copied!', `${code} copied to clipboard`);
    } else {
      Alert.alert('Your code', code);
    }
  };

  const handleApply = async () => {
    if (!applyCode.trim()) return;
    setLoading(true);
    const result = await applyReferralCode(applyCode, orgId);
    setLoading(false);
    Alert.alert(result.success ? 'Success!' : 'Error', result.message);
    if (result.success) {
      setApplyCode('');
      const s = await getReferralStats(orgId);
      setStats(s);
    }
  };

  return (
    <SafeAreaView style={Common.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Refer & Earn</Text>
        <Text style={styles.sub}>Share your code. When they sign up, you BOTH get 1 month free.</Text>

        {/* Your referral code */}
        <ELCard style={[styles.card, { backgroundColor: EL.primaryFixed }]}>
          <Text style={styles.codeLabel}>Your referral code</Text>
          <View style={styles.codeRow}>
            <Text style={styles.codeText}>{code}</Text>
            <Pressable onPress={handleCopy} style={styles.copyBtn}>
              <MaterialCommunityIcons name="content-copy" size={20} color={EL.primary} />
            </Pressable>
          </View>
          <GradientButton title="Share with WhatsApp" onPress={handleShare} style={{ marginTop: Space.md }} />
        </ELCard>

        {/* Stats */}
        <ELCard style={styles.card}>
          <View style={styles.statRow}>
            <View style={styles.stat}>
              <Text style={styles.statNum}>{stats.completedCount}</Text>
              <Text style={styles.statLabel}>Friends joined</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statNum}>{stats.freeMonthsEarned}</Text>
              <Text style={styles.statLabel}>Free months earned</Text>
            </View>
          </View>
        </ELCard>

        {/* How it works */}
        <ELCard style={styles.card}>
          <Text style={styles.sectionTitle}>How it works</Text>
          {[
            'Share your code with a fellow financier',
            'They sign up and enter your code',
            'You both get 1 month of Pro plan free',
            'No limit \u2014 refer 10 friends, get 10 free months!',
          ].map((text, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={styles.stepCircle}>
                <Text style={styles.stepNum}>{i + 1}</Text>
              </View>
              <Text style={styles.stepText}>{text}</Text>
            </View>
          ))}
        </ELCard>

        {/* Apply a code */}
        <ELCard style={styles.card}>
          <Text style={styles.sectionTitle}>Have a referral code?</Text>
          <View style={styles.applyRow}>
            <TextInput
              style={styles.applyInput}
              value={applyCode}
              onChangeText={(v) => setApplyCode(v.toUpperCase())}
              placeholder="VASOOL-XXXXXX"
              placeholderTextColor={EL.onSurfaceMuted}
              autoCapitalize="characters"
            />
            <GradientButton title="Apply" onPress={handleApply} loading={loading} style={{ marginLeft: Space.sm }} />
          </View>
        </ELCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Space.xl, paddingBottom: Space.xxxl },
  title: { ...Type.displayMd },
  sub: { ...Type.bodyMd, color: EL.onSurfaceSec, marginBottom: Space.lg },
  card: { marginBottom: Space.lg },
  codeLabel: { ...Type.labelMd, color: EL.onPrimaryFixed },
  codeRow: { flexDirection: 'row', alignItems: 'center', marginTop: Space.sm },
  codeText: { fontSize: 28, fontWeight: '800', color: EL.primaryDark, letterSpacing: 2, flex: 1 },
  copyBtn: { padding: Space.md },
  statRow: { flexDirection: 'row' },
  stat: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 32, fontWeight: '800', color: EL.primary },
  statLabel: { ...Type.bodySm, color: EL.onSurfaceSec, marginTop: Space.xs },
  sectionTitle: { ...Type.titleMd, marginBottom: Space.md },
  stepRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Space.md },
  stepCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: EL.primary, alignItems: 'center', justifyContent: 'center', marginRight: Space.md },
  stepNum: { ...Type.labelMd, color: EL.white, fontWeight: '700' },
  stepText: { ...Type.bodyMd, color: EL.onSurface, flex: 1 },
  applyRow: { flexDirection: 'row', alignItems: 'center' },
  applyInput: {
    flex: 1, backgroundColor: EL.surfaceCard, borderRadius: Radii.sm + 2,
    paddingHorizontal: Space.lg, minHeight: Touch.min, ...Type.bodyMd, color: EL.onSurface,
    letterSpacing: 1, ...Shadows.card,
  },
});
