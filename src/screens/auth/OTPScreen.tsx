import React, { useRef, useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform,
  SafeAreaView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { GradientButton } from '@/components/common/GradientButton';
import { EL, Common, Radii, Shadows, Space, Type } from '@/theme/emeraldLedger';
import { useAuthStore } from '@/store/authStore';
import type { AuthStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Otp'>;

export function OTPScreen(_: Props) {
  const verifyOwnerOtp = useAuthStore((s) => s.verifyOwnerOtp);
  const pendingPhone = useAuthStore((s) => s.pendingPhone);
  const isBusy = useAuthStore((s) => s.isBusy);
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const refs = useRef<(TextInput | null)[]>([]);

  const handleDigit = (index: number, value: string) => {
    const v = value.replace(/\D/g, '').slice(0, 1);
    const next = [...digits];
    next[index] = v;
    setDigits(next);
    if (v && index < 5) refs.current[index + 1]?.focus();
  };

  const handleVerify = async () => {
    const otp = digits.join('');
    if (otp.length !== 6) { Alert.alert('Enter all 6 digits'); return; }
    try { await verifyOwnerOtp(otp); }
    catch (e: any) { Alert.alert('Invalid OTP', e?.message ?? ''); }
  };

  return (
    <SafeAreaView style={Common.screen}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.container}>
          <Text style={styles.title}>Verify OTP</Text>
          <Text style={styles.sub}>
            Enter the 6-digit code sent to{'\n'}
            <Text style={styles.phone}>+91 {pendingPhone ?? '...'}</Text>
          </Text>

          <View style={styles.digitRow}>
            {digits.map((d, i) => (
              <TextInput
                key={i}
                ref={(r) => { refs.current[i] = r; }}
                style={[styles.digitBox, d ? styles.digitBoxFilled : null]}
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

          <GradientButton title="Verify & Continue" onPress={handleVerify} loading={isBusy} style={styles.verifyBtn} />
          <Text style={styles.resend}>Didn't receive? <Text style={{ color: EL.primary, fontWeight: '600' }}>Resend OTP</Text></Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Space.xl, justifyContent: 'center' },
  title: { ...Type.displayMd, textAlign: 'center' },
  sub: { ...Type.bodyMd, color: EL.onSurfaceSec, textAlign: 'center', marginTop: Space.md, marginBottom: Space.xxxl },
  phone: { ...Type.titleMd, color: EL.onSurface },
  digitRow: { flexDirection: 'row', justifyContent: 'center', gap: Space.sm, marginBottom: Space.xxl },
  digitBox: {
    width: 48, height: 56, backgroundColor: EL.surfaceCard, borderRadius: Radii.md,
    ...Shadows.card, fontSize: 24, fontWeight: '700', color: EL.onSurface,
  },
  digitBoxFilled: { backgroundColor: EL.primaryFixed },
  verifyBtn: { minHeight: 56, borderRadius: Radii.md },
  resend: { ...Type.bodyMd, color: EL.onSurfaceMuted, textAlign: 'center', marginTop: Space.xl },
});
