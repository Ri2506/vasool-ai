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

import { GradientButton } from '@/components/common/GradientButton';
import { EL, Common, Radii, Shadows, Space, Type } from '@/theme/emeraldLedger';
import { supabase } from '@/lib/supabase';

interface PlanTier {
  id: string;
  name: string;
  price: string;
  priceNum: number;
  desc: string;
  features: { text: string; included: boolean }[];
  highlight?: boolean;
}

const PLANS: PlanTier[] = [
  {
    id: 'free', name: 'Free', price: '\u20B90', priceNum: 0,
    desc: 'Perfect for beginners managing personal lending.',
    features: [
      { text: 'Up to 5 Borrowers', included: true },
      { text: 'Basic Ledger Tracking', included: true },
      { text: 'WhatsApp Reminders', included: false },
      { text: 'AI Collections Assistant', included: false },
    ],
  },
  {
    id: 'starter', name: 'Starter', price: '\u20B9199', priceNum: 199,
    desc: 'Scale your small lending business efficiently.',
    features: [
      { text: 'Up to 50 Borrowers', included: true },
      { text: 'WhatsApp Reminders', included: true },
      { text: 'PDF Statement Exports', included: true },
      { text: 'AI Collections Assistant', included: false },
    ],
  },
  {
    id: 'pro', name: 'Pro', price: '\u20B9499', priceNum: 499, highlight: true,
    desc: 'Advanced automation for high-volume lenders.',
    features: [
      { text: 'Unlimited Borrowers', included: true },
      { text: 'Auto-WhatsApp Reminders', included: true },
      { text: 'AI Assistant (Chatbot)', included: true },
      { text: 'Custom Branding', included: true },
    ],
  },
  {
    id: 'business', name: 'Business', price: '\u20B9999', priceNum: 999,
    desc: 'Enterprise-grade tools for multi-branch operations.',
    features: [
      { text: 'Multi-Lender Access', included: true },
      { text: 'Advanced API Access', included: true },
      { text: 'Dedicated Account Manager', included: true },
      { text: 'Priority Support', included: true },
    ],
  },
];

export function SubscriptionScreen() {
  // TODO: persist selected plan once billing integration is wired up.
  // For now the starter tier is the default state.
  const [activePlan] = useState<string>('free');
  const [annual, setAnnual] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  const handleUpgrade = async (plan: PlanTier) => {
    if (plan.priceNum === 0) return;
    setLoading(plan.id);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', { body: { plan: plan.id, annual } });
      if (error) throw error;
      if (!data?.razorpay_configured) {
        Alert.alert(`${plan.name} \u2014 ${annual ? '\u20B9' + (plan.priceNum * 10) + '/yr' : plan.price + '/mo'}`, data?.message ?? 'Razorpay not configured yet.', [
          { text: 'OK' },
          { text: 'Setup Razorpay', onPress: () => Linking.openURL('https://dashboard.razorpay.com') },
        ]);
      } else {
        Alert.alert('Payment ready', `Order ${data.order_id} created for ${plan.name}.\nAmount: \u20B9${(data.amount / 100).toLocaleString('en-IN')}`);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Payment failed');
    } finally {
      setLoading(null);
    }
  };

  return (
    <SafeAreaView style={Common.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Hero */}
        <Text style={styles.heroTitle}>Choose Your Plan</Text>
        <Text style={styles.heroSub}>
          Secure your lending business with premium features designed for scale and absolute precision.
        </Text>

        {/* Toggle */}
        <View style={styles.toggleRow}>
          <Text style={[styles.toggleLabel, !annual && { color: EL.onSurfaceSec }]}>Monthly</Text>
          <Pressable style={styles.toggleTrack} onPress={() => setAnnual(!annual)}>
            <View style={[styles.toggleThumb, annual && { marginLeft: 'auto' }]} />
          </Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm }}>
            <Text style={[styles.toggleLabel, annual && { color: EL.onSurface, fontWeight: '600' }]}>Annual</Text>
            <View style={styles.saveBadge}>
              <Text style={styles.saveBadgeText}>SAVE 20%</Text>
            </View>
          </View>
        </View>

        {/* Plan Cards */}
        {PLANS.map((plan) => {
          const isActive = plan.id === activePlan;
          const isPro = plan.highlight;
          return (
            <View
              key={plan.id}
              style={[
                styles.planCard,
                isPro && styles.planCardPro,
              ]}
            >
              {isPro ? (
                <View style={styles.popularBadge}>
                  <Text style={styles.popularBadgeText}>MOST POPULAR</Text>
                </View>
              ) : null}

              <Text style={[styles.planName, isPro && { color: EL.primary }]}>{plan.name}</Text>
              {annual && plan.priceNum > 0 ? (
                <View>
                  <View style={styles.priceRow}>
                    <Text style={[styles.planPrice, isPro && { fontSize: 42 }]}>
                      {'\u20B9'}{plan.priceNum * 10}
                    </Text>
                    <Text style={styles.planPriceSuffix}>/yr</Text>
                  </View>
                  <Text style={styles.strikePrice}>
                    {plan.price}/month
                  </Text>
                </View>
              ) : (
                <View style={styles.priceRow}>
                  <Text style={[styles.planPrice, isPro && { fontSize: 42 }]}>{plan.price}</Text>
                  <Text style={styles.planPriceSuffix}>/mo</Text>
                </View>
              )}
              <Text style={styles.planDesc}>{plan.desc}</Text>

              <View style={styles.featureList}>
                {plan.features.map((f, i) => (
                  <View key={i} style={[styles.featureRow, !f.included && { opacity: 0.4 }]}>
                    <MaterialCommunityIcons
                      name={f.included ? 'check' : 'close'}
                      size={16}
                      color={f.included ? EL.primary : EL.onSurface}
                    />
                    <Text style={[styles.featureText, isPro && f.included && { fontWeight: '600' }]}>{f.text}</Text>
                  </View>
                ))}
              </View>

              {isActive ? (
                <View style={styles.currentPlan}>
                  <Text style={styles.currentPlanText}>Current Plan</Text>
                </View>
              ) : isPro ? (
                <GradientButton
                  title="Start 14-Day Trial"
                  onPress={() => handleUpgrade(plan)}
                  loading={loading === plan.id}
                  style={{ marginTop: Space.md }}
                />
              ) : (
                <Pressable
                  style={styles.selectBtn}
                  onPress={() => handleUpgrade(plan)}
                >
                  <Text style={styles.selectBtnText}>
                    {plan.priceNum === 0 ? 'Get Started' : 'Select Plan'}
                  </Text>
                </Pressable>
              )}
            </View>
          );
        })}

        {/* Trust badges */}
        <View style={styles.trustGrid}>
          <TrustBadge icon="shield-lock" title="Bank-Grade Security" desc="Your data is encrypted with 256-bit AES protection." />
          <TrustBadge icon="sync" title="Real-time Sync" desc="Access your ledger across all devices with cloud sync." />
          <TrustBadge icon="check-decagram" title="GST Compliant" desc="Generate GST-ready reports with a single click." />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function TrustBadge({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <View style={styles.trustItem}>
      <MaterialCommunityIcons name={icon as any} size={28} color={EL.primary} />
      <Text style={styles.trustTitle}>{title}</Text>
      <Text style={styles.trustDesc}>{desc}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: Space.xl, paddingBottom: Space.xxxl },

  // Hero
  heroTitle: {
    ...Type.displayLg,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -1,
    marginBottom: Space.lg,
  },
  heroSub: {
    ...Type.bodyMd,
    color: EL.onSurfaceSec,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Space.xxl,
  },

  // Toggle
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.lg,
    marginBottom: Space.xxl,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: EL.onSurfaceSec,
  },
  toggleTrack: {
    width: 64,
    height: 32,
    backgroundColor: EL.surfaceHighest,
    borderRadius: Radii.pill,
    padding: 4,
    justifyContent: 'center',
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: EL.primary,
    ...Shadows.card,
  },
  saveBadge: {
    backgroundColor: EL.primaryFixed,
    paddingHorizontal: Space.sm,
    paddingVertical: 2,
    borderRadius: Radii.pill,
  },
  saveBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: EL.onSurface,
    letterSpacing: 0.5,
  },

  // Plan cards
  planCard: {
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.xxl,
    padding: Space.xxl,
    marginBottom: Space.xl,
    ...Shadows.card,
  },
  planCardPro: {
    borderWidth: 2,
    borderColor: EL.primary,
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  popularBadge: {
    position: 'absolute',
    top: -14,
    alignSelf: 'center',
    backgroundColor: EL.primary,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.xs,
    borderRadius: Radii.pill,
  },
  popularBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: EL.white,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  planName: {
    ...Type.titleLg,
    fontWeight: '700',
    color: EL.onSurfaceSec,
    marginBottom: Space.sm,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Space.xs,
  },
  planPrice: {
    fontSize: 36,
    fontWeight: '800',
    color: EL.onSurface,
  },
  planPriceSuffix: {
    fontSize: 14,
    fontWeight: '500',
    color: EL.onSurfaceSec,
  },
  strikePrice: {
    fontSize: 13,
    fontWeight: '500',
    color: EL.onSurfaceMuted,
    textDecorationLine: 'line-through',
    marginTop: 2,
  },
  planDesc: {
    ...Type.bodySm,
    color: EL.onSurfaceSec,
    marginTop: Space.lg,
    lineHeight: 20,
  },
  featureList: {
    marginTop: Space.xl,
    gap: Space.lg,
    marginBottom: Space.xl,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Space.md,
  },
  featureText: {
    ...Type.bodyMd,
    color: EL.onSurface,
    flex: 1,
  },
  currentPlan: {
    backgroundColor: EL.primaryFixed,
    paddingVertical: Space.md,
    borderRadius: Radii.md,
    alignItems: 'center',
  },
  currentPlanText: {
    fontSize: 14,
    fontWeight: '700',
    color: EL.primary,
  },
  selectBtn: {
    backgroundColor: EL.surfaceHighest,
    paddingVertical: Space.lg,
    borderRadius: Radii.md,
    alignItems: 'center',
  },
  selectBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: EL.onSurfaceSec,
  },

  // Trust
  trustGrid: {
    marginTop: Space.xxl,
    gap: Space.xxl,
  },
  trustItem: {
    gap: Space.md,
  },
  trustTitle: {
    ...Type.titleMd,
    fontWeight: '700',
  },
  trustDesc: {
    ...Type.bodySm,
    color: EL.onSurfaceSec,
    lineHeight: 20,
  },
});
