import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform, Pressable,
  SafeAreaView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { GradientButton } from '@/components/common/GradientButton';
import { EL, Common, Radii, Shadows, Space, Type } from '@/theme/emeraldLedger';
import { useAuthStore } from '@/store/authStore';
import type { AuthStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Otp'>;

export function OTPScreen({ navigation }: Props) {
  const verifyOwnerOtp = useAuthStore((s) => s.verifyOwnerOtp);
  const pendingPhone = useAuthStore((s) => s.pendingPhone);
  const isBusy = useAuthStore((s) => s.isBusy);
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [countdown, setCountdown] = useState(30);
  const refs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((prev) => Math.max(0, prev - 1)), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleDigit = useCallback((index: number, value: string) => {
    const v = value.replace(/\D/g, '').slice(0, 1);
    const next = [...digits];
    next[index] = v;
    setDigits(next);
    if (v && index < 5) refs.current[index + 1]?.focus();
  }, [digits]);

  const handleVerify = async () => {
    const otp = digits.join('');
    if (otp.length !== 6) { Alert.alert('Enter all 6 digits'); return; }
    try { await verifyOwnerOtp(otp); }
    catch (e: any) { Alert.alert('Invalid OTP', e?.message ?? ''); }
  };

  const sendOwnerOtp = useAuthStore((s) => s.sendOwnerOtp);

  const handleResend = useCallback(() => {
    if (countdown > 0) return;
    setCountdown(30);
    if (pendingPhone) {
      sendOwnerOtp(pendingPhone).catch((e: any) => {
        Alert.alert('Resend failed', e?.message ?? '');
      });
    }
  }, [countdown, pendingPhone, sendOwnerOtp]);

  const formatPhone = (p: string | null) => {
    if (!p) return '...';
    return `+91 ${p.slice(0, 5)} ${p.slice(5)}`;
  };

  return (
    <SafeAreaView style={Common.screen}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header with back button */}
        <View style={styles.header}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color={EL.primary} />
          </Pressable>
        </View>

        {/* Main Content */}
        <View style={styles.content}>
          {/* Header Section */}
          <View style={styles.headingSection}>
            <Text style={styles.title}>Verify your number</Text>
            <Text style={styles.sub}>
              OTP sent to <Text style={styles.phone}>{formatPhone(pendingPhone)}</Text>
            </Text>
          </View>

          {/* OTP Input Grid */}
          <View style={styles.digitRow}>
            {digits.map((d, i) => (
              <TextInput
                key={i}
                ref={(r) => { refs.current[i] = r; }}
                style={[
                  styles.digitBox,
                  d ? styles.digitBoxFocused : null,
                ]}
                value={d}
                onChangeText={(v) => handleDigit(i, v)}
                keyboardType="number-pad"
                maxLength={1}
                textAlign="center"
                onKeyPress={({ nativeEvent }) => {
                  if (nativeEvent.key === 'Backspace' && !d && i > 0) refs.current[i - 1]?.focus();
                }}
              />
            ))}
          </View>

          {/* Resend Section */}
          <View style={styles.resendSection}>
            <Pressable onPress={handleResend}>
              <Text style={[styles.resendLink, countdown > 0 && styles.resendDisabled]}>
                Resend OTP
              </Text>
            </Pressable>
            {countdown > 0 && (
              <Text style={styles.countdownText}>
                Resend in 0:{countdown.toString().padStart(2, '0')}
              </Text>
            )}
          </View>

          {/* Security Badge */}
          <View style={styles.securityBadge}>
            <MaterialCommunityIcons name="shield-check" size={14} color={EL.primary} />
            <Text style={styles.securityText}>Secure AES-256 verification</Text>
          </View>
        </View>

        {/* Footer Action */}
        <View style={styles.footer}>
          <GradientButton
            title="Verify"
            onPress={handleVerify}
            loading={isBusy}
            icon={<MaterialCommunityIcons name="arrow-right" size={20} color={EL.white} />}
            style={styles.verifyBtn}
          />
        </View>
      </KeyboardAvoidingView>

      {/* Decorative Background */}
      <View style={styles.bgDecor} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    width: '100%',
    height: 64,
    paddingHorizontal: Space.xxl,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: Space.xxl,
    paddingTop: Space.xxxl,
  },
  // Heading
  headingSection: {
    width: '100%',
    marginBottom: Space.xxxl + 8,
  },
  title: {
    ...Type.displayMd,
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.6,
    marginBottom: Space.sm,
  },
  sub: {
    ...Type.bodyMd,
    color: EL.onSurfaceSec,
    lineHeight: 22,
  },
  phone: {
    fontWeight: '700',
    color: EL.onSurface,
  },
  // OTP Inputs
  digitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: Space.sm,
    marginBottom: Space.xxxl,
  },
  digitBox: {
    width: 48,
    height: 48,
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.sm,
    fontSize: 20,
    fontWeight: '700',
    color: EL.onSurface,
    ...Shadows.card,
    textAlign: 'center',
  },
  digitBoxFocused: {
    borderWidth: 2,
    borderColor: EL.primary,
  },
  // Resend
  resendSection: {
    alignItems: 'center',
    gap: Space.xs,
    marginBottom: Space.xxxl,
  },
  resendLink: {
    fontSize: 14,
    fontWeight: '600',
    color: EL.primary,
  },
  resendDisabled: {
    opacity: 0.5,
  },
  countdownText: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(61, 74, 66, 0.6)',
    letterSpacing: 0.8,
  },
  // Security Badge
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.sm,
    borderRadius: Radii.pill,
    backgroundColor: EL.surfaceLow,
    marginTop: 'auto',
    marginBottom: Space.xxxl,
  },
  securityText: {
    fontSize: 12,
    fontWeight: '500',
    color: EL.onSurfaceSec,
  },
  // Footer
  footer: {
    paddingHorizontal: Space.xxl,
    paddingBottom: Space.xxxl,
  },
  verifyBtn: {
    width: '100%',
    minHeight: 48,
    borderRadius: Radii.md,
  },
  // Decorative
  bgDecor: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 256,
    height: 256,
    borderRadius: 128,
    backgroundColor: 'rgba(0, 105, 72, 0.04)',
    zIndex: -1,
  },
});
