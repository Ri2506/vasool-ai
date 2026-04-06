import React from 'react';
import {
  Alert,
  Linking,
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
import { useAuthStore } from '@/store/authStore';

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
  const currentPlan = useAuthStore((s) => s.user?.orgId ?? 'free');
  // In production, fetch actual plan from org row. Demo shows 'free'.
  const activePlan = 'free';

  const handleUpgrade = (plan: PlanTier) => {
    if (plan.priceNum === 0) return;
    // TODO: Replace with actual Razorpay checkout URL from Edge Function
    Alert.alert(
      `Upgrade to ${plan.name}`,
      `${plan.price} — Annual plans get 2 months free.\n\nRazorpay checkout will open here once configured.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Setup Razorpay',
          onPress: () => Linking.openURL('https://dashboard.razorpay.com'),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Choose your plan</Text>
        <Text style={styles.sub}>All plans include offline mode and cloud backup</Text>

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
});
