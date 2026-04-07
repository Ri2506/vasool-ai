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

type Props = NativeStackScreenProps<AuthStackParamList, 'PinLogin'>;

export function PinLoginScreen({ navigation }: Props) {
  const signInAgent = useAuthStore((s) => s.signInAgent);
  const isBusy = useAuthStore((s) => s.isBusy);
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');

  const handleSignIn = async () => {
    if (!/^\d{10}$/.test(phone)) { Alert.alert('Enter valid 10-digit phone'); return; }
    if (!/^\d{4}$/.test(pin)) { Alert.alert('PIN must be 4 digits'); return; }
    try { await signInAgent(phone, pin); }
    catch (e: any) { Alert.alert('Invalid PIN', e?.message ?? ''); }
  };

  return (
    <SafeAreaView style={Common.screen}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.iconCircle}>
            <MaterialCommunityIcons name="shield-account" size={36} color={EL.primary} />
          </View>
          <Text style={styles.title}>Agent Login</Text>
          <Text style={styles.sub}>Enter your phone number and 4-digit PIN</Text>

          {/* Phone */}
          <View style={styles.fieldCard}>
            <Text style={Type.labelMd}>PHONE NUMBER</Text>
            <View style={styles.inputRow}>
              <Text style={styles.prefix}>+91</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={(v) => setPhone(v.replace(/\D/g, '').slice(0, 10))}
                placeholder="10-digit mobile"
                placeholderTextColor={EL.onSurfaceMuted}
                keyboardType="number-pad"
                maxLength={10}
              />
            </View>
          </View>

          {/* PIN — 4 dots */}
          <View style={styles.fieldCard}>
            <Text style={Type.labelMd}>4-DIGIT PIN</Text>
            <View style={styles.pinRow}>
              {[0, 1, 2, 3].map((i) => (
                <View key={i} style={[styles.pinDot, pin.length > i && styles.pinDotFilled]} />
              ))}
            </View>
            <TextInput
              style={styles.hiddenInput}
              value={pin}
              onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 4))}
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry
              autoFocus
            />
          </View>

          <GradientButton
            title="Login"
            onPress={handleSignIn}
            loading={isBusy}
            style={styles.loginBtn}
          />

          <View style={{ flex: 1 }} />

          <Pressable onPress={() => navigation.replace('PhoneLogin')} style={styles.ownerLink}>
            <Text style={styles.ownerText}>I'm the owner → </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Space.xl },
  iconCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: EL.primaryFixed, alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center', marginTop: Space.xxxl, marginBottom: Space.xl,
  },
  title: { ...Type.displayMd, textAlign: 'center' },
  sub: { ...Type.bodyMd, color: EL.onSurfaceSec, textAlign: 'center', marginTop: Space.xs, marginBottom: Space.xxl },
  fieldCard: {
    backgroundColor: EL.surfaceCard, borderRadius: Radii.lg,
    padding: Space.xl, marginBottom: Space.lg, ...Shadows.card,
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', marginTop: Space.md },
  prefix: { ...Type.titleMd, color: EL.onSurfaceSec, marginRight: Space.md },
  input: {
    flex: 1, backgroundColor: EL.surfaceLow, borderRadius: Radii.sm,
    paddingHorizontal: Space.lg, minHeight: Touch.min, ...Type.titleMd, color: EL.onSurface,
  },
  pinRow: { flexDirection: 'row', justifyContent: 'center', gap: Space.xl, marginTop: Space.xl },
  pinDot: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: EL.surfaceHigh,
  },
  pinDotFilled: { backgroundColor: EL.primary },
  hiddenInput: { position: 'absolute', opacity: 0, width: 0, height: 0 },
  loginBtn: { minHeight: Touch.comfortable, borderRadius: Radii.md },
  ownerLink: { alignItems: 'center', paddingVertical: Space.lg },
  ownerText: { ...Type.labelLg, color: EL.primary },
});
