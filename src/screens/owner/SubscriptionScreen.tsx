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

import { Badge } from '@/components/common/Badge';
import { ELCard } from '@/components/common/ELCard';
import { GradientButton } from '@/components/common/GradientButton';
import { EL, Common, Radii, Shadows, Space, Type } from '@/theme/emeraldLedger';
import { supabase } from '@/lib/supabase';

interface PlanTier {
  id: string;
  name: string;
  price: string;
  priceNum: number;
  features: string[];
  highlight?: boolean;
}

const PLANS: PlanTier[] = [
  { id: 'free', name: 'Free', price: '\u20B90/mo', priceNum: 0, features: ['1 user', '25 borrowers', '2 lines', 'One-tap + batch collect', 'Offline + cloud', 'Daily report'] },
  { id: 'starter', name: 'Starter', price: '\u20B9199/mo', priceNum: 199, features: ['1 user', '75 borrowers', '5 lines', 'All reports', 'Voice input', 'Smart cards (P&L)'] },
  { id: 'pro', name: 'Pro', price: '\u20B9499/mo', priceNum: 499, highlight: true, features: ['3 users', 'Unlimited borrowers', 'All + PDF export', 'AI risk tips', 'Agent management', 'Agent performance %'] },
  { id: 'business', name: 'Business', price: '\u20B9999/mo', priceNum: 999, features: ['10 users', 'Unlimited everything', 'Auto monthly reports', 'AI chat assistant', 'Priority support'] },
];

export function SubscriptionScreen() {
  const activePlan = 'free';
  const [annual, setAnnual] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  const handleUpgrade = async (plan: PlanTier) => {
    if (plan.priceNum === 0) return;
    setLoading(plan.id);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', { body: { plan: plan.id, annual } });
      if (error) throw error;
      if (!data?.razorpay_configured) {
        Alert.alert(`${plan.name} \u2014 ${annual ? '\u20B9' + (plan.priceNum * 10) + '/yr' : plan.price}`, data?.message ?? 'Razorpay not configured yet.', [
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
        <Text style={styles.title}>Choose your plan</Text>
        <Text style={styles.sub}>All plans include offline mode and cloud backup</Text>

        <Pressable style={styles.annualToggle} onPress={() => setAnnual(!annual)}>
          <View style={[styles.toggleDot, annual && styles.toggleDotActive]} />
          <Text style={styles.toggleLabel}>
            {annual ? 'Annual billing (2 months free!)' : 'Monthly billing'}
          </Text>
        </Pressable>

        {PLANS.map((plan) => {
          const isActive = plan.id === activePlan;
          return (
            <ELCard
              key={plan.id}
              style={[styles.planCard, plan.highlight && styles.planHighlight]}
            >
              <View style={styles.planHeader}>
                <Text style={styles.planName}>{plan.name}</Text>
                <Text style={[styles.planPrice, plan.highlight && { color: EL.primary }]}>
                  {plan.price}
                </Text>
              </View>
              {plan.features.map((f, i) => (
                <View key={i} style={styles.featureRow}>
                  <MaterialCommunityIcons name="check" size={14} color={EL.primary} />
                  <Text style={styles.feature}>{f}</Text>
                </View>
              ))}
              {isActive ? (
                <Badge label="Current plan" variant="success" />
              ) : (
                <GradientButton
                  title={plan.priceNum === 0 ? 'Current' : `Upgrade to ${plan.name}`}
                  variant={plan.highlight ? 'primary' : 'secondary'}
                  onPress={() => handleUpgrade(plan)}
                  disabled={plan.priceNum === 0}
                  loading={loading === plan.id}
                  style={{ marginTop: Space.md }}
                />
              )}
            </ELCard>
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
  content: { padding: Space.xl, paddingBottom: Space.xxxl },
  title: { ...Type.displayMd },
  sub: { ...Type.bodySm, color: EL.onSurfaceSec, marginBottom: Space.lg },
  planCard: { marginBottom: Space.lg },
  planHighlight: { borderWidth: 2, borderColor: EL.primary },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Space.md },
  planName: { ...Type.titleLg, fontWeight: '700' },
  planPrice: { ...Type.displaySm },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: Space.sm, marginTop: Space.xs },
  feature: { ...Type.bodyMd, color: EL.onSurfaceSec },
  footnote: { ...Type.labelSm, color: EL.onSurfaceMuted, textAlign: 'center', marginTop: Space.lg },
  annualToggle: { flexDirection: 'row', alignItems: 'center', marginBottom: Space.lg, paddingVertical: Space.sm },
  toggleDot: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: EL.outline, marginRight: Space.md },
  toggleDotActive: { backgroundColor: EL.primary, borderColor: EL.primary },
  toggleLabel: { ...Type.bodyMd, fontWeight: '600' },
});
