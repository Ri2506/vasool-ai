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
import { Radius, Spacing, TouchTarget, Typography } from '@/constants/typography';
import { useAuthStore } from '@/store/authStore';
import type { AuthStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'PinLogin'>;

export function PinLoginScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const signInAgent = useAuthStore((s) => s.signInAgent);
  const isBusy = useAuthStore((s) => s.isBusy);
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');

  const handleSignIn = async () => {
    if (!/^\d{10}$/.test(phone)) {
      Alert.alert(t('auth.invalid_phone'));
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      Alert.alert(t('auth.invalid_pin'));
      return;
    }
    try {
      await signInAgent(phone, pin);
    } catch (e: any) {
      Alert.alert(t('auth.invalid_pin'), e?.message ?? '');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Text style={styles.title}>{t('auth.agent_login')}</Text>

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

        <Text style={[styles.label, { marginTop: Spacing.lg }]}>
          {t('auth.pin_label')}
        </Text>
        <TextInput
          style={styles.pinInput}
          value={pin}
          onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 4))}
          keyboardType="number-pad"
          maxLength={4}
          secureTextEntry
          placeholder="••••"
          placeholderTextColor={Colors.textMuted}
          textAlign="center"
        />

        <Button
          title={t('common.continue')}
          onPress={handleSignIn}
          loading={isBusy}
          style={{ marginTop: Spacing.lg }}
        />

        <View style={styles.spacer} />

        <Button
          title={t('auth.owner_login_cta')}
          variant="secondary"
          onPress={() => navigation.replace('PhoneLogin')}
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
  pinInput: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.button,
    minHeight: TouchTarget.min + 8,
    fontSize: 28,
    letterSpacing: 12,
    color: Colors.text,
    paddingHorizontal: Spacing.md,
  },
  spacer: { flex: 1 },
});
