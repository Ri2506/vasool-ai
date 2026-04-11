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
        {/* Header with back button */}
        <View style={styles.header}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color={EL.onSurface} />
          </Pressable>
        </View>

        <View style={styles.container}>
          {/* Brand / Hero Visual */}
          <View style={styles.heroSection}>
            <View style={styles.brandIcon}>
              <MaterialCommunityIcons name="bank" size={28} color="#f5fff7" />
            </View>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.sub}>Enter your phone number to continue</Text>
          </View>

          {/* Login Form Section */}
          <View style={styles.formSection}>
            <Text style={styles.fieldLabel}>MOBILE NUMBER</Text>
            <View style={styles.inputWrapper}>
              {/* Prefix Box */}
              <View style={styles.prefixBox}>
                <Text style={styles.prefixText}>+91</Text>
              </View>
              {/* Phone Input */}
              <TextInput
                style={styles.phoneInput}
                value={phone}
                onChangeText={(v) => setPhone(v.replace(/\D/g, '').slice(0, 10))}
                placeholder="00000 00000"
                placeholderTextColor="rgba(188, 202, 192, 0.4)"
                keyboardType="number-pad"
                maxLength={10}
              />
            </View>

            {/* Send OTP Button */}
            <View style={styles.btnWrapper}>
              <GradientButton
                title="Send OTP"
                onPress={handleSend}
                loading={isBusy}
                icon={<MaterialCommunityIcons name="arrow-right" size={20} color={EL.white} />}
                style={styles.sendBtn}
              />
            </View>
          </View>

          {/* Role Toggle / Bottom Link */}
          <View style={styles.bottomSection}>
            <Pressable onPress={() => navigation.navigate('PinLogin')} style={styles.agentLink}>
              <Text style={styles.agentText}>Are you a collection agent?</Text>
              <MaterialCommunityIcons name="chevron-right" size={18} color={EL.primary} />
            </Pressable>

            {/* Demo button */}
            {__DEV__ ? (
              <GradientButton
                title="Try as demo owner"
                variant="secondary"
                onPress={handleTryDemo}
                style={{ marginTop: Space.md }}
              />
            ) : null}
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Decorative Background Elements */}
      <View style={styles.bgDecorTopRight} />
      <View style={styles.bgDecorBottomLeft} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    width: '100%',
    height: 64,
    paddingHorizontal: Space.xxl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    paddingHorizontal: Space.xxl,
    paddingTop: Space.xxxl,
    paddingBottom: Space.xxxl,
  },
  // Hero / Brand
  heroSection: {
    marginBottom: Space.xxxl + 16,
  },
  brandIcon: {
    width: 64,
    height: 64,
    borderRadius: Radii.lg,
    backgroundColor: EL.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Space.xxxl,
    ...Shadows.card,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: EL.onSurface,
    letterSpacing: -0.44,
  },
  sub: {
    ...Type.bodySm,
    color: EL.onSurfaceSec,
    marginTop: Space.sm,
  },
  // Form
  formSection: {
    flex: 1,
    gap: Space.sm,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: EL.onSurfaceSec,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginLeft: 4,
    marginBottom: Space.sm,
  },
  inputWrapper: {
    height: 56,
    width: '100%',
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.md,
    flexDirection: 'row',
    overflow: 'hidden',
    ...Shadows.card,
  },
  prefixBox: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: EL.surfaceHigh,
    paddingHorizontal: Space.lg,
    borderRightWidth: 1,
    borderRightColor: 'rgba(188, 202, 192, 0.2)',
  },
  prefixText: {
    fontSize: 16,
    fontWeight: '600',
    color: EL.onSurface,
  },
  phoneInput: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingHorizontal: Space.lg,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 1.6,
    color: EL.onSurface,
  },
  btnWrapper: {
    paddingTop: Space.lg,
  },
  sendBtn: {
    width: '100%',
    minHeight: 48,
    borderRadius: Radii.md,
  },
  // Bottom
  bottomSection: {
    marginTop: 'auto',
    alignItems: 'center',
    paddingTop: Space.xxxl + 16,
  },
  agentLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
  },
  agentText: {
    ...Type.labelLg,
    color: EL.primary,
    fontWeight: '600',
  },
  // Decorative
  bgDecorTopRight: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 256,
    height: 256,
    borderRadius: 128,
    backgroundColor: 'rgba(0, 105, 72, 0.05)',
    zIndex: -1,
  },
  bgDecorBottomLeft: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(0, 105, 72, 0.1)',
    zIndex: -1,
  },
});
