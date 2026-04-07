import React, { useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform, Pressable,
  SafeAreaView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { GradientButton } from '@/components/common/GradientButton';
import { EL, Common, Radii, Shadows, Space, Touch, Type } from '@/theme/emeraldLedger';
import { useAuthStore } from '@/store/authStore';
import type { AuthStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'PhoneLogin'>;

export function PhoneLoginScreen({ navigation }: Props) {
  const sendOwnerOtp = useAuthStore((s) => s.sendOwnerOtp);
  const devSetUser = useAuthStore((s) => s._devSetUser);
  const isBusy = useAuthStore((s) => s.isBusy);
  const [phone, setPhone] = useState('');

  const handleSend = async () => {
    if (!/^\d{10}$/.test(phone)) { Alert.alert('Please enter a valid 10-digit phone number'); return; }
    try { await sendOwnerOtp(phone); navigation.navigate('Otp'); }
    catch (e: any) { Alert.alert('Error', e?.message ?? ''); }
  };

  const handleTryDemo = async () => {
    await devSetUser({ id: 'demo-owner', orgId: 'demo-org-local', name: 'Demo Owner', phone: '0000000000', role: 'owner' });
  };

  return (
    <SafeAreaView style={Common.screen}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.container}>
          {/* Header */}
          <Text style={styles.logo}>VasoolAI</Text>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.sub}>Enter your phone number to continue</Text>

          {/* Phone input */}
          <View style={styles.inputCard}>
            <Text style={Type.labelMd}>PHONE NUMBER</Text>
            <View style={styles.inputRow}>
              <View style={styles.prefixBox}>
                <Text style={styles.flag}>🇮🇳</Text>
                <Text style={styles.prefix}>+91</Text>
              </View>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={(v) => setPhone(v.replace(/\D/g, '').slice(0, 10))}
                placeholder="10-digit mobile number"
                placeholderTextColor={EL.onSurfaceMuted}
                keyboardType="number-pad"
                maxLength={10}
              />
            </View>
          </View>

          <GradientButton
            title="Send OTP"
            onPress={handleSend}
            loading={isBusy}
            style={styles.sendBtn}
          />

          <View style={{ flex: 1 }} />

          {/* Agent link */}
          <Pressable onPress={() => navigation.navigate('PinLogin')} style={styles.agentLink}>
            <MaterialCommunityIcons name="shield-account" size={18} color={EL.primary} />
            <Text style={styles.agentText}>  Are you a collection agent?</Text>
          </Pressable>

          {/* Demo */}
          <GradientButton
            title="Try as demo owner"
            variant="secondary"
            onPress={handleTryDemo}
            style={{ marginTop: Space.md }}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, padding: Space.xl },
  logo: { ...Type.displayLg, color: EL.primary, marginTop: Space.xxxl },
  title: { ...Type.displayMd, marginTop: Space.xxl },
  sub: { ...Type.bodyMd, color: EL.onSurfaceSec, marginTop: Space.xs, marginBottom: Space.xxl },
  inputCard: {
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.lg,
    padding: Space.xl,
    ...Shadows.card,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Space.md,
  },
  prefixBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: EL.surfaceLow,
    borderRadius: Radii.sm,
    paddingHorizontal: Space.md,
    paddingVertical: Space.sm,
    marginRight: Space.md,
  },
  flag: { fontSize: 18, marginRight: Space.xs },
  prefix: { ...Type.titleMd, color: EL.onSurface },
  input: {
    flex: 1,
    backgroundColor: EL.surfaceLow,
    borderRadius: Radii.sm,
    paddingHorizontal: Space.lg,
    minHeight: Touch.min,
    ...Type.titleMd,
    color: EL.onSurface,
  },
  sendBtn: {
    marginTop: Space.xl,
    minHeight: Touch.comfortable,
    borderRadius: Radii.md,
  },
  agentLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Space.lg,
  },
  agentText: { ...Type.labelLg, color: EL.primary },
});
