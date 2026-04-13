// SubscriptionScreen — single-tier pricing per CLAUDE.md.
//
// Free forever (with hard caps) → ₹1,999/year Pro (unlimited).
// No tiers, no monthly toggles, no fake-trust GST/security badges.
// Just: usage now, what Pro unlocks, one button.

import React, { useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';

import { GradientButton } from '@/components/common/GradientButton';
import { EL, Common, Radii, Shadows, Space, Type } from '@/theme/emeraldLedger';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { getPlanQuota, FREE_CAPS } from '@/utils/planCaps';

export function SubscriptionScreen() {
  const navigation = useNavigation();
  const orgId = useAuthStore((s) => s.user?.orgId ?? null);
  const [loading, setLoading] = useState(false);

  const { data: quota } = useQuery({
    queryKey: ['plan-quota', orgId],
    enabled: !!orgId,
    queryFn: () => getPlanQuota(orgId!),
    refetchInterval: 30_000,
  });

  const isPro = quota?.plan === 'pro';

  const handleUpgrade = async () => {
    if (isPro) return;
    setLoading(true);
    try {
      // Razorpay UPI Autopay setup is server-side. Until the Edge Function
      // is wired with key + webhook, dry-run with an info dialog.
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { plan: 'pro', annual: true, amount_paise: 199_900 },
      });
      if (error) throw error;
      if (!data?.razorpay_configured) {
        Alert.alert(
          'Razorpay not configured yet',
          'The payment gateway needs Razorpay key + webhook deployed first. Until then, contact founder via WhatsApp +91-XXXXXXXXXX to upgrade manually.',
          [
            { text: 'OK' },
            {
              text: 'WhatsApp',
              onPress: () => Linking.openURL('https://wa.me/919999999999?text=Upgrade%20to%20Pro'),
            },
          ],
        );
      } else {
        Alert.alert(
          'Payment ready',
          `Order ${data.order_id} created. Amount ₹${(data.amount / 100).toLocaleString('en-IN')}. Razorpay checkout would open here.`,
        );
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not start checkout');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={Common.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={EL.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{isPro ? 'VasoolAI Pro' : 'Upgrade to Pro'}</Text>
          <Text style={styles.sub}>{isPro ? 'You are on the Pro plan' : 'Free forever — or unlock everything'}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: Space.lg, gap: Space.lg, paddingBottom: 80 }}>
        {/* Usage bar — only shown for free users since Pro has no caps */}
        {quota && !isPro ? (
          <View style={[styles.usageCard, Shadows.card]}>
            <Text style={styles.usageLabel}>YOUR FREE-PLAN USAGE</Text>
            <UsageRow
              icon="account-multiple"
              label="Borrowers"
              used={quota.borrowers.used}
              limit={FREE_CAPS.borrowers}
            />
            <UsageRow
              icon="road-variant"
              label="Lines"
              used={quota.lines.used}
              limit={FREE_CAPS.lines}
            />
            <UsageRow
              icon="account-tie"
              label="Agents"
              used={quota.agents.used}
              limit={FREE_CAPS.agents}
            />
          </View>
        ) : null}

        {/* Pro confirmation card if subscribed */}
        {isPro ? (
          <View style={[styles.proConfirm, Shadows.float]}>
            <View style={styles.proIcon}>
              <MaterialCommunityIcons name="crown" size={32} color={EL.white} />
            </View>
            <Text style={styles.proConfirmTitle}>You're on Pro</Text>
            <Text style={styles.proConfirmSub}>
              Unlimited borrowers, lines, agents. All fraud-prevention features unlocked.
            </Text>
          </View>
        ) : (
          <>
            {/* Pro pricing hero */}
            <View style={[styles.proCard, Shadows.float]}>
              <View style={styles.proHeader}>
                <View style={styles.proIconSmall}>
                  <MaterialCommunityIcons name="crown" size={22} color={EL.white} />
                </View>
                <View>
                  <Text style={styles.proTitle}>VasoolAI Pro</Text>
                  <Text style={styles.proTag}>Unlimited everything</Text>
                </View>
              </View>
              <View style={styles.priceRow}>
                <Text style={styles.priceBig}>₹1,999</Text>
                <Text style={styles.pricePer}>/year</Text>
              </View>
              <Text style={styles.priceMonthly}>≈ ₹167/month — less than one missed installment</Text>

              <View style={styles.featureList}>
                <Feature label="Unlimited borrowers, lines, agents" />
                <Feature label="Auto SMS receipts via MSG91" />
                <Feature label="Owner approval for new loans" />
                <Feature label="GPS + photo evidence on every entry" />
                <Feature label="EOD agent handover with variance tracking" />
                <Feature label="Fraud dashboard + push alerts" />
                <Feature label="Cloud sync + backup" />
                <Feature label="Priority WhatsApp support" />
              </View>

              <GradientButton
                title={loading ? 'Loading…' : 'Upgrade to Pro'}
                onPress={handleUpgrade}
                loading={loading}
                disabled={loading}
                icon={<MaterialCommunityIcons name="crown" size={18} color={EL.white} />}
              />
            </View>

            {/* Free plan summary */}
            <View style={[styles.freeCard, Shadows.card]}>
              <View style={styles.freeHeader}>
                <MaterialCommunityIcons name="check-circle-outline" size={20} color={EL.onSurfaceSec} />
                <Text style={styles.freeTitle}>Your current plan: Free</Text>
              </View>
              <Text style={styles.freeBody}>
                Free forever for 1 line · 1 agent · 30 borrowers. All collection,
                loan, and reporting features included. Upgrade only when you outgrow it.
              </Text>
            </View>
          </>
        )}

        {/* Trust note */}
        <View style={[styles.infoCard, Shadows.card]}>
          <MaterialCommunityIcons name="information-outline" size={18} color={EL.onSurfaceSec} />
          <Text style={styles.infoText}>
            One-time annual payment via UPI Autopay (Razorpay). Cancel any time —
            you keep all your data on the free plan.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function UsageRow({
  icon, label, used, limit,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  used: number;
  limit: number;
}) {
  const pct = Math.min(1, used / limit);
  const isFull = used >= limit;
  const color = isFull ? EL.tertiary : pct > 0.7 ? EL.warn : EL.primary;
  return (
    <View style={{ gap: 4, marginTop: Space.sm }}>
      <View style={styles.usageRow}>
        <MaterialCommunityIcons name={icon} size={14} color={EL.onSurfaceSec} />
        <Text style={styles.usageRowLabel}>{label}</Text>
        <Text style={[styles.usageRowValue, { color }]}>
          {used} / {limit}
        </Text>
      </View>
      <View style={styles.usageTrack}>
        <View style={[styles.usageFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function Feature({ label }: { label: string }) {
  return (
    <View style={styles.featureRow}>
      <MaterialCommunityIcons name="check-circle" size={16} color={EL.primary} />
      <Text style={styles.featureText}>{label}</Text>
    </View>
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

  // Usage card
  usageCard: { backgroundColor: EL.surfaceCard, borderRadius: Radii.lg, padding: Space.lg },
  usageLabel: { fontSize: 10, fontWeight: '800', color: EL.onSurfaceMuted, letterSpacing: 0.6, marginBottom: 4 },
  usageRow: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  usageRowLabel: { flex: 1, fontSize: 13, fontWeight: '600', color: EL.onSurface },
  usageRowValue: { fontSize: 13, fontWeight: '800' },
  usageTrack: {
    height: 6, borderRadius: 3,
    backgroundColor: EL.surfaceLow, overflow: 'hidden',
  },
  usageFill: { height: '100%', borderRadius: 3 },

  // Pro confirmation
  proConfirm: {
    backgroundColor: EL.primary,
    padding: Space.xl,
    borderRadius: Radii.xl,
    alignItems: 'center',
    gap: Space.sm,
  },
  proIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  proConfirmTitle: { fontSize: 22, fontWeight: '900', color: EL.white },
  proConfirmSub: { fontSize: 13, color: 'rgba(255,255,255,0.85)', textAlign: 'center', paddingHorizontal: Space.lg },

  // Pro pricing hero
  proCard: {
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.xl,
    padding: Space.xl,
    gap: Space.md,
  },
  proHeader: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  proIconSmall: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: EL.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  proTitle: { fontSize: 18, fontWeight: '900', color: EL.onSurface },
  proTag: { fontSize: 11, fontWeight: '700', color: EL.primary, marginTop: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  priceBig: { fontSize: 42, fontWeight: '900', color: EL.onSurface },
  pricePer: { fontSize: 14, fontWeight: '700', color: EL.onSurfaceMuted },
  priceMonthly: { fontSize: 12, color: EL.onSurfaceMuted, fontStyle: 'italic' },
  featureList: { gap: 8, marginVertical: Space.md },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  featureText: { fontSize: 13, fontWeight: '600', color: EL.onSurface, flex: 1 },

  // Free card
  freeCard: { backgroundColor: EL.surfaceCard, borderRadius: Radii.lg, padding: Space.lg, gap: Space.sm },
  freeHeader: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  freeTitle: { fontSize: 14, fontWeight: '800', color: EL.onSurface },
  freeBody: { fontSize: 12, color: EL.onSurfaceMuted, lineHeight: 17 },

  infoCard: {
    flexDirection: 'row', gap: Space.sm,
    backgroundColor: EL.surfaceCard,
    padding: Space.md,
    borderRadius: Radii.lg,
    alignItems: 'flex-start',
  },
  infoText: { flex: 1, fontSize: 12, color: EL.onSurfaceSec, lineHeight: 17 },
});
