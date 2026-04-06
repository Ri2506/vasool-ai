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

import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Colors } from '@/constants/colors';
import { Radius, Spacing, TouchTarget, Typography } from '@/constants/typography';
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
      message: `Try VasoolAI — the fastest collection app for money lenders! Use my code ${code} to get 1 month free.\n\nDownload: https://vasoolai.com`,
    });
  };

  const handleCopy = () => {
    // Web: use clipboard API
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
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Refer & Earn</Text>
        <Text style={styles.sub}>
          Share your code. When they sign up, you BOTH get 1 month free.
        </Text>

        {/* Your referral code */}
        <Card style={styles.codeCard}>
          <Text style={styles.codeLabel}>Your referral code</Text>
          <View style={styles.codeRow}>
            <Text style={styles.codeText}>{code}</Text>
            <Pressable onPress={handleCopy} style={styles.copyBtn}>
              <MaterialCommunityIcons name="content-copy" size={20} color={Colors.primary} />
            </Pressable>
          </View>
          <Button
            title="Share with WhatsApp"
            onPress={handleShare}
            style={{ marginTop: Spacing.md }}
          />
        </Card>

        {/* Stats */}
        <Card style={styles.statsCard}>
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
        </Card>

        {/* How it works */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>How it works</Text>
          <Step n="1" text="Share your code with a fellow financier" />
          <Step n="2" text="They sign up and enter your code" />
          <Step n="3" text="You both get 1 month of Pro plan free" />
          <Step n="4" text="No limit — refer 10 friends, get 10 free months!" />
        </Card>

        {/* Apply a code */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Have a referral code?</Text>
          <View style={styles.applyRow}>
            <TextInput
              style={styles.applyInput}
              value={applyCode}
              onChangeText={(v) => setApplyCode(v.toUpperCase())}
              placeholder="VASOOL-XXXXXX"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="characters"
            />
            <Button
              title="Apply"
              onPress={handleApply}
              loading={loading}
              style={{ marginLeft: Spacing.sm }}
            />
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function Step({ n, text }: { n: string; text: string }) {
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepCircle}>
        <Text style={styles.stepNum}>{n}</Text>
      </View>
      <Text style={styles.stepText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  container: { padding: Spacing.xl, paddingBottom: Spacing.xxl },
  title: { ...Typography.display, color: Colors.text },
  sub: { ...Typography.body, color: Colors.textSec, marginBottom: Spacing.lg },
  codeCard: { marginBottom: Spacing.lg, backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  codeLabel: { ...Typography.caption, color: Colors.primaryDark },
  codeRow: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.sm },
  codeText: { fontSize: 28, fontWeight: '800', color: Colors.primaryDark, letterSpacing: 2, flex: 1 },
  copyBtn: { padding: Spacing.md },
  statsCard: { marginBottom: Spacing.lg },
  statRow: { flexDirection: 'row' },
  stat: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 32, fontWeight: '800', color: Colors.primary },
  statLabel: { ...Typography.caption, color: Colors.textSec, marginTop: 4 },
  card: { marginBottom: Spacing.lg },
  sectionTitle: { ...Typography.title, color: Colors.text, marginBottom: Spacing.md },
  stepRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  stepCircle: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
    marginRight: Spacing.md,
  },
  stepNum: { ...Typography.body, color: Colors.white, fontWeight: '700' },
  stepText: { ...Typography.body, color: Colors.text, flex: 1 },
  applyRow: { flexDirection: 'row', alignItems: 'center' },
  applyInput: {
    flex: 1, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.button, paddingHorizontal: Spacing.md, minHeight: TouchTarget.min,
    ...Typography.body, color: Colors.text, letterSpacing: 1,
  },
});
