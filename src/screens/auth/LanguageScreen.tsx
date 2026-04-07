import React, { useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { GradientButton } from '@/components/common/GradientButton';
import { EL, Common, Radii, Shadows, Space, Type } from '@/theme/emeraldLedger';
import { Config } from '@/constants/config';
import { setLanguage } from '@/i18n';
import { secureStorage } from '@/lib/secureStorage';
import type { AuthStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Language'>;

export function LanguageScreen({ navigation }: Props) {
  const [selected, setSelected] = useState<'en' | 'ta'>('en');

  const handleContinue = async () => {
    await setLanguage(selected);
    await secureStorage.setItem(Config.storageKeys.onboarded, '1');
    navigation.replace('PhoneLogin');
  };

  return (
    <SafeAreaView style={Common.screen}>
      <View style={styles.container}>
        {/* Logo */}
        <Text style={styles.logo}>VasoolAI</Text>
        <Text style={styles.tagline}>Your digital collection ledger</Text>

        {/* Language icon */}
        <View style={styles.iconCircle}>
          <MaterialCommunityIcons name="translate" size={36} color={EL.primary} />
        </View>

        {/* Heading */}
        <Text style={styles.heading}>CHOOSE YOUR LANGUAGE / மொழியைத்</Text>
        <Text style={styles.headingSub}>தேர்ந்தெடுக்கவும்</Text>

        {/* Language options */}
        <Pressable
          style={[styles.langOption, selected === 'en' && styles.langOptionActive]}
          onPress={() => setSelected('en')}
        >
          <Text style={styles.langFlag}>EN</Text>
          <Text style={styles.langLabel}>English</Text>
          <View style={{ flex: 1 }} />
          {selected === 'en' ? (
            <MaterialCommunityIcons name="check-circle" size={22} color={EL.primary} />
          ) : null}
        </Pressable>

        <Pressable
          style={[styles.langOption, selected === 'ta' && styles.langOptionActive]}
          onPress={() => setSelected('ta')}
        >
          <Text style={styles.langFlag}>த</Text>
          <Text style={styles.langLabel}>தமிழ்</Text>
          <View style={{ flex: 1 }} />
          {selected === 'ta' ? (
            <MaterialCommunityIcons name="check-circle" size={22} color={EL.primary} />
          ) : null}
        </Pressable>

        <View style={{ flex: 1 }} />

        {/* Continue button */}
        <GradientButton
          title="Continue →"
          onPress={handleContinue}
          style={styles.continueBtn}
        />

        <Text style={styles.footer}>SECURED BY VASOOLAI CLOUD TECHNOLOGY</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Space.xl,
    alignItems: 'center',
  },
  logo: {
    ...Type.displayLg,
    color: EL.primary,
    marginTop: Space.xxxl,
  },
  tagline: {
    ...Type.bodySm,
    color: EL.onSurfaceSec,
    marginTop: Space.xs,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: EL.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Space.xxxl,
    marginBottom: Space.xxl,
  },
  heading: {
    ...Type.labelMd,
    color: EL.onSurfaceSec,
    textAlign: 'center',
    letterSpacing: 1,
  },
  headingSub: {
    ...Type.labelMd,
    color: EL.onSurfaceSec,
    textAlign: 'center',
    marginBottom: Space.xxl,
  },
  langOption: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.lg,
    padding: Space.xl,
    marginBottom: Space.md,
    ...Shadows.card,
  },
  langOptionActive: {
    backgroundColor: EL.primaryFixed,
  },
  langFlag: {
    ...Type.titleLg,
    color: EL.primary,
    width: 32,
    textAlign: 'center',
  },
  langLabel: {
    ...Type.titleMd,
    color: EL.onSurface,
    marginLeft: Space.md,
  },
  continueBtn: {
    width: '100%',
    minHeight: 56,
    borderRadius: Radii.pill,
  },
  footer: {
    ...Type.labelSm,
    color: EL.onSurfaceMuted,
    marginTop: Space.lg,
    letterSpacing: 1,
  },
});
