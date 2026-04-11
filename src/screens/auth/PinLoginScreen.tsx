import React, { useState, useCallback } from 'react';
import {
  Alert, Pressable,
  SafeAreaView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { EL, Common, Radii, Shadows, Space, Type } from '@/theme/emeraldLedger';
import { useAuthStore } from '@/store/authStore';
import type { AuthStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'PinLogin'>;

export function PinLoginScreen({ navigation }: Props) {
  const signInAgent = useAuthStore((s) => s.signInAgent);
  const devSetUser = useAuthStore((s) => s._devSetUser);
  const isBusy = useAuthStore((s) => s.isBusy);
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');

  const handleDigit = useCallback((digit: string) => {
    setPin((prev) => {
      if (prev.length >= 4) return prev;
      const next = prev + digit;
      // Auto-submit when 4 digits entered
      if (next.length === 4) {
        setTimeout(() => {
          if (!/^\d{10}$/.test(phone)) {
            Alert.alert('Enter phone number', 'Please enter your 10-digit phone number before entering PIN.');
            setPin('');
            return;
          }
          signInAgent(phone, next).catch((e: any) => {
            Alert.alert('Invalid PIN', e?.message ?? '');
            setPin('');
          });
        }, 200);
      }
      return next;
    });
  }, [phone, signInAgent]);

  const handleBackspace = useCallback(() => {
    setPin((prev) => prev.slice(0, -1));
  }, []);

  return (
    <SafeAreaView style={Common.screen}>
      <View style={styles.container}>
        {/* Brand Identity */}
        <View style={styles.brandHeader}>
          <Text style={styles.brandName}>VasoolAI</Text>
          <View style={styles.brandUnderline} />
        </View>

        {/* Phone Input */}
        <View style={styles.phoneSection}>
          <Text style={styles.phoneLabel}>MOBILE NUMBER</Text>
          <View style={styles.phoneInputRow}>
            <View style={styles.phonePrefixBox}>
              <Text style={styles.phonePrefixText}>+91</Text>
            </View>
            <TextInput
              style={styles.phoneInput}
              value={phone}
              onChangeText={(v) => setPhone(v.replace(/\D/g, '').slice(0, 10))}
              placeholder="Enter phone number"
              placeholderTextColor="rgba(188, 202, 192, 0.4)"
              keyboardType="number-pad"
              maxLength={10}
            />
          </View>
        </View>

        {/* Login Hero Section */}
        <View style={styles.heroSection}>
          <Text style={styles.title}>Agent Login</Text>
          <Text style={styles.subtitle}>Enter your 4-digit PIN</Text>
          <Text style={styles.tamilText}>
            {'\u0B89\u0B99\u0BCD\u0B95\u0BB3\u0BCD'} 4 {'\u0B87\u0BB2\u0B95\u0BCD\u0B95'} PIN {'\u0B8E\u0BA3\u0BCD\u0BA3\u0BC8'} {'\u0B89\u0BB3\u0BCD\u0BB3\u0BBF\u0B9F\u0BB5\u0BC1\u0BAE\u0BCD'}
          </Text>

          {/* PIN Visualizers */}
          <View style={styles.pinRow}>
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                style={[
                  styles.pinDot,
                  pin.length > i ? styles.pinDotFilled : styles.pinDotEmpty,
                ]}
              />
            ))}
          </View>
        </View>

        {/* Number Pad Grid */}
        <View style={styles.numPad}>
          {/* Row 1 */}
          {['1', '2', '3'].map((d) => (
            <Pressable
              key={d}
              style={({ pressed }) => [styles.numBtn, pressed && styles.numBtnPressed]}
              onPress={() => handleDigit(d)}
            >
              <Text style={styles.numBtnText}>{d}</Text>
            </Pressable>
          ))}
          {/* Row 2 */}
          {['4', '5', '6'].map((d) => (
            <Pressable
              key={d}
              style={({ pressed }) => [styles.numBtn, pressed && styles.numBtnPressed]}
              onPress={() => handleDigit(d)}
            >
              <Text style={styles.numBtnText}>{d}</Text>
            </Pressable>
          ))}
          {/* Row 3 */}
          {['7', '8', '9'].map((d) => (
            <Pressable
              key={d}
              style={({ pressed }) => [styles.numBtn, pressed && styles.numBtnPressed]}
              onPress={() => handleDigit(d)}
            >
              <Text style={styles.numBtnText}>{d}</Text>
            </Pressable>
          ))}
          {/* Row 4: spacer, 0, backspace */}
          <View style={styles.numBtnSpacer} />
          <Pressable
            style={({ pressed }) => [styles.numBtn, pressed && styles.numBtnPressed]}
            onPress={() => handleDigit('0')}
          >
            <Text style={styles.numBtnText}>0</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.numBtnBackspace, pressed && { opacity: 0.6 }]}
            onPress={handleBackspace}
          >
            <MaterialCommunityIcons name="backspace-outline" size={28} color={EL.onSurfaceSec} />
          </Pressable>
        </View>

        {/* Footer Actions */}
        <View style={styles.footer}>
          <Pressable onPress={() => Alert.alert('Forgot PIN', 'Contact your employer to reset your PIN.')}>
            <Text style={styles.forgotText}>Forgot PIN?</Text>
          </Pressable>

          <View style={styles.secureBadge}>
            <MaterialCommunityIcons name="lock" size={12} color={EL.onSurfaceSec} />
            <Text style={styles.secureText}>SECURE SESSION</Text>
          </View>

          {__DEV__ ? (
            <Pressable
              style={styles.devBtn}
              onPress={() => devSetUser({ id: 'demo-agent', name: 'Ravi', phone: '9876543210', role: 'agent', orgId: 'demo-org-local' })}
            >
              <Text style={styles.devBtnText}>Try as demo agent</Text>
            </Pressable>
          ) : null}

          <Pressable onPress={() => navigation.navigate('PhoneLogin')} style={{ marginTop: Space.lg }}>
            <Text style={[styles.forgotText, { color: EL.primary }]}>I'm the owner →</Text>
          </Pressable>
        </View>
      </View>

      {/* Decorative Background Tones */}
      <View style={styles.bgDecorBottomLeft} />
      <View style={styles.bgDecorTopRight} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Space.xxxl,
    paddingTop: Space.xxxl + 16,
    paddingBottom: Space.xxxl,
    alignItems: 'center',
  },
  // Phone input
  phoneSection: {
    width: '100%',
    marginBottom: Space.xxxl,
  },
  phoneLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: EL.onSurfaceSec,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginLeft: 4,
    marginBottom: Space.sm,
  },
  phoneInputRow: {
    height: 48,
    width: '100%',
    backgroundColor: EL.surfaceHighest,
    borderRadius: Radii.md,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  phonePrefixBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Space.lg,
    borderRightWidth: 1,
    borderRightColor: 'rgba(188, 202, 192, 0.2)',
  },
  phonePrefixText: {
    fontSize: 14,
    fontWeight: '600',
    color: EL.onSurface,
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: Space.lg,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 1,
    color: EL.onSurface,
  },
  // Brand
  brandHeader: {
    alignItems: 'center',
    marginBottom: Space.xxxl + 32,
    gap: Space.sm,
  },
  brandName: {
    fontSize: 24,
    fontWeight: '900',
    color: EL.primary,
    letterSpacing: -0.48,
  },
  brandUnderline: {
    width: 32,
    height: 4,
    borderRadius: 2,
    backgroundColor: EL.primaryContainer,
  },
  // Hero
  heroSection: {
    alignItems: 'center',
    marginBottom: Space.xxxl + 16,
  },
  title: {
    ...Type.displayMd,
    fontSize: 30,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.6,
    marginBottom: Space.md,
  },
  subtitle: {
    ...Type.bodyMd,
    color: EL.onSurfaceSec,
    fontWeight: '500',
    letterSpacing: 0.4,
  },
  tamilText: {
    fontSize: 12,
    color: EL.onSurfaceMuted,
    marginTop: Space.xs,
    lineHeight: 19.2,
  },
  // PIN dots
  pinRow: {
    flexDirection: 'row',
    gap: Space.xxl,
    marginTop: Space.xxxl + 16,
  },
  pinDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  pinDotFilled: {
    backgroundColor: EL.primary,
    shadowColor: 'rgba(0, 105, 72, 0.2)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
    // Ring effect via border
    borderWidth: 3,
    borderColor: 'rgba(0, 105, 72, 0.2)',
  },
  pinDotEmpty: {
    backgroundColor: EL.surfaceHighest,
  },
  // Number pad
  numPad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: 300,
    gap: 24,
    marginTop: 'auto',
  },
  numBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: EL.surfaceHighest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numBtnPressed: {
    backgroundColor: EL.surfaceHigh,
    transform: [{ scale: 0.92 }],
  },
  numBtnText: {
    fontSize: 24,
    fontWeight: '700',
    color: EL.onSurface,
  },
  numBtnSpacer: {
    width: 64,
    height: 64,
  },
  numBtnBackspace: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Footer
  footer: {
    alignItems: 'center',
    marginTop: Space.xxxl + 32,
  },
  forgotText: {
    fontSize: 14,
    fontWeight: '600',
    color: EL.primary,
    letterSpacing: 0.4,
  },
  secureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    marginTop: Space.xxxl,
    opacity: 0.4,
  },
  secureText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 3.2,
    textTransform: 'uppercase',
    color: EL.onSurface,
  },
  // Decorative
  bgDecorBottomLeft: {
    position: 'absolute',
    bottom: -96,
    left: -96,
    width: 256,
    height: 256,
    borderRadius: 128,
    backgroundColor: 'rgba(133, 248, 196, 0.2)',
    zIndex: -1,
  },
  bgDecorTopRight: {
    position: 'absolute',
    top: -96,
    right: -96,
    width: 256,
    height: 256,
    borderRadius: 128,
    backgroundColor: 'rgba(192, 237, 211, 0.2)',
    zIndex: -1,
  },
  devBtn: {
    marginTop: Space.xl,
    backgroundColor: EL.surfaceHighest,
    paddingVertical: Space.md,
    paddingHorizontal: Space.xxl,
    borderRadius: Radii.pill,
  },
  devBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: EL.primary,
  },
});
