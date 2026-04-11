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
        {/* Branding Section */}
        <View style={styles.brandSection}>
          <Text style={styles.logo}>VasoolAI</Text>
          <Text style={styles.tagline}>Your digital collection ledger</Text>

          {/* Hero Decorative Circle with translate icon */}
          <View style={styles.heroCircle}>
            <View style={styles.heroCircleInner} />
            <MaterialCommunityIcons name="translate" size={56} color={EL.primary} />
          </View>
        </View>

        {/* Selection Section */}
        <View style={styles.selectionSection}>
          <Text style={styles.heading}>
            CHOOSE YOUR LANGUAGE / {'\u0BAE\u0BCA\u0BB4\u0BBF\u0BAF\u0BC8\u0BA4\u0BCD'} {'\u0BA4\u0BC7\u0BB0\u0BCD\u0BA8\u0BCD\u0BA4\u0BC6\u0B9F\u0BC1\u0B95\u0BCD\u0B95\u0BB5\u0BC1\u0BAE\u0BCD'}
          </Text>

          {/* Language Card: English */}
          <Pressable
            style={[
              styles.langCard,
              selected === 'en' ? styles.langCardSelected : styles.langCardUnselected,
            ]}
            onPress={() => setSelected('en')}
          >
            <View style={styles.langCardContent}>
              <View style={[
                styles.langBadge,
                selected === 'en' ? styles.langBadgeActive : styles.langBadgeInactive,
              ]}>
                <Text style={[
                  styles.langBadgeText,
                  selected === 'en' ? styles.langBadgeTextActive : styles.langBadgeTextInactive,
                ]}>EN</Text>
              </View>
              <Text style={styles.langLabel}>English</Text>
            </View>
            {selected === 'en' ? (
              <View style={styles.checkCircle}>
                <MaterialCommunityIcons name="check" size={16} color={EL.white} />
              </View>
            ) : (
              <View style={styles.emptyCircle} />
            )}
          </Pressable>

          {/* Language Card: Tamil */}
          <Pressable
            style={[
              styles.langCard,
              selected === 'ta' ? styles.langCardSelected : styles.langCardUnselected,
            ]}
            onPress={() => setSelected('ta')}
          >
            <View style={styles.langCardContent}>
              <View style={[
                styles.langBadge,
                selected === 'ta' ? styles.langBadgeActive : styles.langBadgeInactive,
              ]}>
                <Text style={[
                  styles.langBadgeText,
                  selected === 'ta' ? styles.langBadgeTextActive : styles.langBadgeTextInactive,
                ]}>{'\u0BA4'}</Text>
              </View>
              <Text style={styles.langLabel}>{'\u0BA4\u0BAE\u0BBF\u0BB4\u0BCD'}</Text>
            </View>
            {selected === 'ta' ? (
              <View style={styles.checkCircle}>
                <MaterialCommunityIcons name="check" size={16} color={EL.white} />
              </View>
            ) : (
              <View style={styles.emptyCircle} />
            )}
          </Pressable>
        </View>

        {/* Action Footer */}
        <View style={styles.footer}>
          <GradientButton
            title="Continue"
            onPress={handleContinue}
            icon={<MaterialCommunityIcons name="arrow-right" size={20} color={EL.white} />}
            style={styles.continueBtn}
          />
          <Text style={styles.securedText}>SECURED BY VASOOLAI CLOUD TECHNOLOGY</Text>
        </View>
      </View>

      {/* Decorative Background Blurs */}
      <View style={styles.bgDecorTop} />
      <View style={styles.bgDecorBottom} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Space.xxl,
    paddingVertical: Space.xxxl + 16,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // Branding
  brandSection: {
    alignItems: 'center',
    marginTop: Space.xxxl,
  },
  logo: {
    ...Type.displayMd,
    fontWeight: '900',
    color: EL.primary,
    letterSpacing: -0.56,
  },
  tagline: {
    ...Type.bodySm,
    color: 'rgba(61, 74, 66, 0.7)',
    fontWeight: '500',
    marginTop: Space.xs,
  },
  heroCircle: {
    width: 192,
    height: 192,
    borderRadius: 96,
    backgroundColor: 'rgba(0, 133, 93, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Space.xxxl + 8,
    overflow: 'hidden',
  },
  heroCircleInner: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 96,
    opacity: 0.05,
  },
  // Selection
  selectionSection: {
    width: '100%',
    flex: 1,
    justifyContent: 'center',
    gap: Space.lg,
  },
  heading: {
    ...Type.labelSm,
    fontWeight: '600',
    color: EL.onSurfaceSec,
    textAlign: 'center',
    letterSpacing: 1.1,
    marginBottom: Space.sm,
    fontSize: 12,
  },
  langCard: {
    height: 64,
    width: '100%',
    paddingHorizontal: 20,
    borderRadius: Radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 2,
  },
  langCardSelected: {
    backgroundColor: EL.surfaceCard,
    borderColor: EL.primary,
  },
  langCardUnselected: {
    backgroundColor: EL.surfaceCard,
    borderColor: 'transparent',
    ...Shadows.card,
  },
  langCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.lg,
  },
  langBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langBadgeActive: {
    backgroundColor: 'rgba(0, 105, 72, 0.1)',
  },
  langBadgeInactive: {
    backgroundColor: EL.surfaceHigh,
  },
  langBadgeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  langBadgeTextActive: {
    color: EL.primary,
  },
  langBadgeTextInactive: {
    color: EL.onSurfaceSec,
  },
  langLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: EL.onSurface,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: EL.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(188, 202, 192, 0.3)',
  },
  // Footer
  footer: {
    width: '100%',
    marginTop: Space.xxxl,
  },
  continueBtn: {
    width: '100%',
    minHeight: 48,
    borderRadius: Radii.md,
  },
  securedText: {
    fontSize: 10,
    fontWeight: '500',
    color: 'rgba(61, 74, 66, 0.4)',
    textAlign: 'center',
    marginTop: Space.xxl,
    letterSpacing: 0.8,
  },
  // Background decorations
  bgDecorTop: {
    position: 'absolute',
    top: '-10%',
    right: '-10%',
    width: '50%',
    height: '50%',
    borderRadius: 999,
    backgroundColor: 'rgba(0, 105, 72, 0.05)',
    zIndex: -1,
  },
  bgDecorBottom: {
    position: 'absolute',
    bottom: '-10%',
    left: '-10%',
    width: '50%',
    height: '50%',
    borderRadius: 999,
    backgroundColor: 'rgba(0, 105, 72, 0.05)',
    zIndex: -1,
  },
});
