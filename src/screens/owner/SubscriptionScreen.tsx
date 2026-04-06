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

import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Colors } from '@/constants/colors';
import { Spacing, Typography } from '@/constants/typography';
import { supabase } from '@/lib/supabase';

// PRD §10 pricing tiers
interface PlanTier {
  id: string;
  name: string;
  price: string;
  priceNum: number;
  features: string[];
  highlight?: boolean;
}

const PLANS: PlanTier[] = [
  {
    id: 'free',
    name: 'Free',
    price: '₹0/mo',
    priceNum: 0,
    features: ['1 user', '25 borrowers', '2 lines', 'One-tap + batch collect', 'Offline + cloud', 'Daily report'],
  },
  {
    id: 'starter',
    name: 'Starter',
    price: '₹199/mo',
    priceNum: 199,
    features: ['1 user', '75 borrowers', '5 lines', 'All reports', 'Voice input', 'Smart cards (P&L)'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '₹499/mo',
    priceNum: 499,
    highlight: true,
    features: ['3 users', 'Unlimited borrowers', 'All + PDF export', 'AI risk tips', 'Agent management', 'Agent performance %'],
  },
  {
    id: 'business',
    name: 'Business',
    price: '₹999/mo',
    priceNum: 999,
    features: ['10 users', 'Unlimited everything', 'Auto monthly reports', 'AI chat assistant', 'Priority support'],
  },
];

/**
 * Subscription screen — shows the 4 pricing tiers from the PRD.
 *
 * Razorpay integration: when the user taps "Upgrade", we open a
 * Razorpay checkout link. The actual payment flow requires:
 *   1. A Razorpay account + API keys
 *   2. A Supabase Edge Function that creates the Razorpay subscription
 *   3. A webhook that updates organizations.plan on payment success
 *
 * For now, tapping "Upgrade" shows the plan details and a placeholder
 * that directs to Razorpay setup. Replace the handleUpgrade URL once
 * the Razorpay subscription is configured.
 */
export function SubscriptionScreen() {
  const activePlan = 'free'; // TODO: fetch from org row
  const [annual, setAnnual] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  const handleUpgrade = async (plan: PlanTier) => {
    if (plan.priceNum === 0) return;
    setLoading(plan.id);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { plan: plan.id, annual },
      });
      if (error) throw error;

      if (!data?.razorpay_configured) {
        // Razorpay keys not set yet — show dev message
        Alert.alert(
          `${plan.name} — ${annual ? '₹' + (plan.priceNum * 10) + '/yr' : plan.price}`,
          data?.message ?? 'Razorpay not configured yet.',
          [
            { text: 'OK' },
            { text: 'Setup Razorpay', onPress: () => Linking.openURL('https://dashboard.razorpay.com') },
          ]
        );
      } else {
        // Razorpay configured — open checkout
        // On native: use react-native-razorpay SDK
        // On web: open Razorpay checkout page
        Alert.alert(
          'Payment ready',
          `Order ${data.order_id} created for ${plan.name}.\nAmount: ₹${(data.amount / 100).toLocaleString('en-IN')}\n\nRazorpay checkout would open here.`
        );
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Payment failed');
    } finally {
      setLoading(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Choose your plan</Text>
        <Text style={styles.sub}>All plans include offline mode and cloud backup</Text>

        {/* Annual toggle */}
        <Pressable
          style={styles.annualToggle}
          onPress={() => setAnnual(!annual)}
        >
          <View style={[styles.toggleDot, annual && styles.toggleDotActive]} />
          <Text style={styles.toggleLabel}>
            {annual ? 'Annual billing (2 months free!)' : 'Monthly billing'}
          </Text>
        </Pressable>

        {PLANS.map((plan) => {
          const isActive = plan.id === activePlan;
          return (
            <Card
              key={plan.id}
              style={[
                styles.planCard,
                plan.highlight ? styles.planHighlight : undefined,
              ]}
            >
              <View style={styles.planHeader}>
                <Text style={styles.planName}>{plan.name}</Text>
                <Text style={[styles.planPrice, plan.highlight && { color: Colors.primary }]}>
                  {plan.price}
                </Text>
              </View>

              {plan.features.map((f, i) => (
                <Text key={i} style={styles.feature}>✓  {f}</Text>
              ))}

              {isActive ? (
                <Badge label="Current plan" variant="success" />
              ) : (
                <Button
                  title={plan.priceNum === 0 ? 'Current' : `Upgrade to ${plan.name}`}
                  variant={plan.highlight ? 'primary' : 'secondary'}
                  onPress={() => handleUpgrade(plan)}
                  disabled={plan.priceNum === 0}
                  loading={loading === plan.id}
                  style={{ marginTop: Spacing.md }}
                />
              )}
            </Card>
          );
        })}

        <Text style={styles.footnote}>
          Annual plans: 2 months free. Cancel anytime.{'\n'}
          Payments processed securely via Razorpay (UPI/Card).
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  container: { padding: Spacing.xl, paddingBottom: Spacing.xxl },
  title: { ...Typography.display, color: Colors.text },
  sub: { ...Typography.caption, color: Colors.textSec, marginBottom: Spacing.lg },
  planCard: { marginBottom: Spacing.lg },
  planHighlight: { borderColor: Colors.primary, borderWidth: 2 },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  planName: { ...Typography.title, color: Colors.text, fontSize: 18 },
  planPrice: { ...Typography.display, color: Colors.text },
  feature: { ...Typography.body, color: Colors.textSec, marginTop: 4 },
  footnote: { ...Typography.caption, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.lg },
  annualToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  toggleDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.border,
    marginRight: Spacing.md,
  },
  toggleDotActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  toggleLabel: { ...Typography.body, color: Colors.text, fontWeight: '600' },
});
