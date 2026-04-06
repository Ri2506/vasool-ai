import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button } from '@/components/common/Button';
import { Colors } from '@/constants/colors';
import { Spacing, TouchTarget, Typography, Radius } from '@/constants/typography';
import { useAuthStore } from '@/store/authStore';
import type { AuthStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'PhoneLogin'>;

export function PhoneLoginScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const sendOwnerOtp = useAuthStore((s) => s.sendOwnerOtp);
  const devSetUser = useAuthStore((s) => s._devSetUser);
  const isBusy = useAuthStore((s) => s.isBusy);
  const [phone, setPhone] = useState('');

  // Dev bypass: skip Supabase Phone OTP (which needs a paid SMS provider)
  // and seed a local owner session pointing at a stable demo org. Removed
  // before production ship — see Sprint 4.
  const handleTryDemo = async () => {
    await devSetUser({
      id: 'demo-owner',
      orgId: 'demo-org-local',
      name: 'Demo Owner',
      phone: '0000000000',
      role: 'owner',
    });
  };

  const handleSend = async () => {
    if (!/^\d{10}$/.test(phone)) {
      Alert.alert(t('auth.invalid_phone'));
      return;
    }
    try {
      await sendOwnerOtp(phone);
      navigation.navigate('Otp');
    } catch (e: any) {
      Alert.alert(t('common.error_generic'), e?.message ?? '');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Text style={styles.title}>{t('auth.welcome')}</Text>
        <Text style={styles.subtitle}>{t('auth.owner_login')}</Text>

        <Text style={styles.label}>{t('auth.phone_label')}</Text>
        <View style={styles.inputRow}>
          <Text style={styles.prefix}>+91</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={(v) => setPhone(v.replace(/\D/g, '').slice(0, 10))}
            placeholder={t('auth.phone_placeholder') ?? ''}
            placeholderTextColor={Colors.textMuted}
            keyboardType="number-pad"
            maxLength={10}
          />
        </View>

        <Button
          title={t('auth.send_otp')}
          onPress={handleSend}
          loading={isBusy}
          style={{ marginTop: Spacing.lg }}
        />

        <View style={styles.spacer} />

        <Button
          title={t('auth.pin_login_cta')}
          variant="secondary"
          onPress={() => navigation.navigate('PinLogin')}
        />

        <Button
          title={t('auth.try_demo')}
          variant="secondary"
          onPress={handleTryDemo}
          style={{ marginTop: Spacing.sm }}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  container: {
    flex: 1,
    padding: Spacing.xl,
    justifyContent: 'center',
  },
  title: {
    ...Typography.display,
    color: Colors.text,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textSec,
    marginBottom: Spacing.xl,
  },
  label: {
    ...Typography.caption,
    color: Colors.textSec,
    marginBottom: Spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    minHeight: TouchTarget.min,
  },
  prefix: {
    ...Typography.title,
    color: Colors.text,
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    ...Typography.title,
    color: Colors.text,
  },
  spacer: {
    flex: 1,
  },
});
