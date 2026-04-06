import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button } from '@/components/common/Button';
import { Colors } from '@/constants/colors';
import { Radius, Spacing, TouchTarget, Typography } from '@/constants/typography';
import { useAuthStore } from '@/store/authStore';
import type { AuthStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Otp'>;

export function OTPScreen(_: Props) {
  const { t } = useTranslation();
  const verifyOwnerOtp = useAuthStore((s) => s.verifyOwnerOtp);
  const pendingPhone = useAuthStore((s) => s.pendingPhone);
  const isBusy = useAuthStore((s) => s.isBusy);
  const [otp, setOtp] = useState('');

  const handleVerify = async () => {
    if (!/^\d{6}$/.test(otp)) {
      Alert.alert(t('auth.invalid_otp'));
      return;
    }
    try {
      await verifyOwnerOtp(otp);
      // Navigation happens automatically — RootNavigator reacts to auth state.
    } catch (e: any) {
      Alert.alert(t('auth.invalid_otp'), e?.message ?? '');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Text style={styles.title}>{t('auth.otp_label')}</Text>
        {pendingPhone ? (
          <Text style={styles.subtitle}>
            {t('auth.otp_sent', { phone: `+91${pendingPhone}` })}
          </Text>
        ) : null}

        <TextInput
          style={styles.input}
          value={otp}
          onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad"
          maxLength={6}
          placeholder="000000"
          placeholderTextColor={Colors.textMuted}
          textAlign="center"
        />

        <Button
          title={t('auth.verify')}
          onPress={handleVerify}
          loading={isBusy}
          style={{ marginTop: Spacing.lg }}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  container: { flex: 1, padding: Spacing.xl, justifyContent: 'center' },
  title: {
    ...Typography.display,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textSec,
    marginBottom: Spacing.xl,
  },
  input: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.button,
    minHeight: TouchTarget.min + 8,
    fontSize: 28,
    letterSpacing: 8,
    color: Colors.text,
    paddingHorizontal: Spacing.md,
  },
});
