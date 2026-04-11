import React, { useEffect, useState } from 'react';
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

  const handleCopy = async () => {
    // Web: use clipboard API; native: fall back to Share sheet for copy+share
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(code);
        Alert.alert('Copied!', `${code} copied to clipboard`);
        return;
      } catch {}
    }
    // Native fallback: show code in alert for manual copy
    Alert.alert('Your referral code', code, [
      { text: 'Share instead', onPress: handleShare },
      { text: 'OK', style: 'default' },
    ]);
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
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Illustration section */}
        <View style={styles.heroSection}>
          <Text style={styles.heroTitle}>Grow the Ledger Community</Text>
          <Text style={styles.heroSub}>
            Share your unique code with fellow lenders. When they subscribe, both of you unlock premium benefits.
          </Text>
        </View>

        {/* Referral Code Card */}
        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>YOUR REFERRAL CODE</Text>
          <View style={styles.codePill}>
            <Text style={styles.codeText}>{code}</Text>
          </View>
          <View style={styles.codeActions}>
            <GradientButton
              title="Copy"
              onPress={handleCopy}
              icon={<MaterialCommunityIcons name="content-copy" size={18} color={EL.white} />}
              style={{ flex: 1 }}
            />
            <Pressable style={styles.shareBtn} onPress={handleShare}>
              <MaterialCommunityIcons name="share-variant" size={18} color={EL.primary} />
              <Text style={styles.shareBtnText}>Share</Text>
            </Pressable>
          </View>
        </View>

        {/* Stats Bento Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{stats.completedCount}</Text>
            <Text style={styles.statLabel}>friends joined</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{stats.freeMonthsEarned}</Text>
            <Text style={styles.statLabel}>free months earned</Text>
          </View>
        </View>

        {/* Apply Code Section */}
        <View style={styles.applySection}>
          <Text style={styles.applySectionTitle}>Have a referral code?</Text>
          <TextInput
            style={styles.applyInput}
            value={applyCode}
            onChangeText={(v) => setApplyCode(v.toUpperCase())}
            placeholder="Enter code here"
            placeholderTextColor={EL.outline}
            autoCapitalize="characters"
          />
          <GradientButton
            title="Apply"
            onPress={handleApply}
            loading={loading}
            style={{ marginTop: Space.lg, alignSelf: 'flex-end' }}
          />
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Space.xl, paddingBottom: Space.xxxl, gap: Space.xxl },

  // Hero
  heroSection: {
    backgroundColor: EL.surfaceLow,
    borderRadius: 32,
    padding: Space.xxl,
    alignItems: 'center',
  },
  heroTitle: {
    ...Type.displaySm,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: Space.sm,
  },
  heroSub: {
    ...Type.bodyMd,
    color: EL.onSurfaceSec,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Code card
  codeCard: {
    backgroundColor: EL.surfaceCard,
    borderRadius: 32,
    padding: Space.xxl,
    alignItems: 'center',
    ...Shadows.card,
  },
  codeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: EL.outline,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: Space.lg,
  },
  codePill: {
    backgroundColor: EL.surfaceLow,
    borderRadius: Radii.md,
    paddingHorizontal: Space.xl,
    paddingVertical: Space.lg,
    marginBottom: Space.xxl,
  },
  codeText: {
    fontSize: 28,
    fontWeight: '800',
    color: EL.primary,
    letterSpacing: 3,
  },
  codeActions: {
    flexDirection: 'row',
    gap: Space.md,
    width: '100%',
  },
  shareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.sm,
    backgroundColor: EL.surfaceHighest,
    paddingVertical: Space.lg,
    borderRadius: Radii.md,
  },
  shareBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: EL.primary,
  },

  // Stats
  statsGrid: {
    flexDirection: 'row',
    gap: Space.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: EL.surfaceLow,
    borderRadius: Radii.xxl,
    padding: Space.xl,
    alignItems: 'center',
    gap: Space.xs,
  },
  statNum: {
    fontSize: 30,
    fontWeight: '800',
    color: EL.primaryContainer,
  },
  statLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: EL.onSurfaceSec,
  },

  // Apply
  applySection: {
    backgroundColor: EL.surfaceMid,
    borderRadius: 32,
    padding: Space.xxl,
  },
  applySectionTitle: {
    ...Type.titleLg,
    fontWeight: '700',
    marginBottom: Space.lg,
  },
  applyInput: {
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.md,
    paddingHorizontal: Space.xl,
    paddingVertical: Space.lg,
    ...Type.bodyMd,
    color: EL.onSurface,
  },
});
