// OnboardingScreen — 4-screen swipeable intro shown once on first launch.
//
// Per soft-launch playbook, week-1 retention depends on operators
// understanding the value prop before they hit any sign-in friction.
// Each slide:
//   1. Welcome — "VasoolAI" + tagline
//   2. Stop fraud — handover variance + GPS
//   3. Daily collections in 30 seconds — single-tap due list
//   4. Tamil-first — switch language right here, then "Get Started"
//
// Persistence: on Skip / Get Started we set a `seenOnboarding` flag
// in SecureStore so we never show it again on this device.

import React, { useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { GradientButton } from '@/components/common/GradientButton';
import { secureStorage } from '@/lib/secureStorage';
import { EL, Common, Radii, Shadows, Space, Type } from '@/theme/emeraldLedger';

const { width } = Dimensions.get('window');
export const ONBOARDING_KEY = 'vasool.onboarding.v1';

interface Slide {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  body: string;
  accent: string;
}

// Slides resolve their copy via i18n at render time so the user sees
// onboarding in the locale they picked at app start.
interface SlideTemplate { icon: Slide['icon']; titleKey: string; bodyKey: string; accent: string }
const SLIDE_TEMPLATES: SlideTemplate[] = [
  { icon: 'wallet', titleKey: 'onboarding.slide1_title', bodyKey: 'onboarding.slide1_body', accent: EL.primary },
  { icon: 'shield-check', titleKey: 'onboarding.slide2_title', bodyKey: 'onboarding.slide2_body', accent: '#9b3e3b' },
  { icon: 'flash', titleKey: 'onboarding.slide3_title', bodyKey: 'onboarding.slide3_body', accent: '#d97706' },
  { icon: 'translate', titleKey: 'onboarding.slide4_title', bodyKey: 'onboarding.slide4_body', accent: EL.info },
];

interface Props {
  onDone: () => void;
}

export function OnboardingScreen({ onDone }: Props) {
  const { t } = useTranslation();
  const scrollX = useRef(new Animated.Value(0)).current;
  const [index, setIndex] = useState(0);
  const scrollRef = useRef<Animated.FlatList<SlideTemplate>>(null);
  const SLIDES: SlideTemplate[] = SLIDE_TEMPLATES;

  const handleNext = async () => {
    if (index < SLIDES.length - 1) {
      scrollRef.current?.scrollToIndex({ index: index + 1, animated: true });
      return;
    }
    await secureStorage.setItem(ONBOARDING_KEY, '1');
    onDone();
  };

  const handleSkip = async () => {
    await secureStorage.setItem(ONBOARDING_KEY, '1');
    onDone();
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== index) setIndex(i);
  };

  return (
    <SafeAreaView style={Common.screen}>
      <View style={styles.skipRow}>
        <Pressable onPress={handleSkip} hitSlop={12}>
          <Text style={styles.skipText}>{t('onboarding.skip')}</Text>
        </Pressable>
      </View>

      <Animated.FlatList
        ref={scrollRef}
        data={SLIDES}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false, listener: onScroll as any },
        )}
        scrollEventThrottle={16}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <View style={[styles.iconWrap, Shadows.float, { backgroundColor: `${item.accent}1A` }]}>
              <MaterialCommunityIcons name={item.icon} size={56} color={item.accent} />
            </View>
            <Text style={styles.slideTitle}>{t(item.titleKey)}</Text>
            <Text style={styles.slideBody}>{t(item.bodyKey)}</Text>
          </View>
        )}
      />

      {/* Dots */}
      <View style={styles.dots}>
        {SLIDES.map((_, i) => {
          const isActive = i === index;
          return (
            <View
              key={i}
              style={[
                styles.dot,
                isActive && styles.dotActive,
                isActive && { backgroundColor: SLIDES[index].accent },
              ]}
            />
          );
        })}
      </View>

      {/* Bottom CTA */}
      <View style={styles.cta}>
        <GradientButton
          title={index < SLIDES.length - 1 ? t('onboarding.next') : t('onboarding.get_started')}
          onPress={handleNext}
          icon={
            <MaterialCommunityIcons
              name={index < SLIDES.length - 1 ? 'arrow-right' : 'check'}
              size={20}
              color={EL.white}
            />
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  skipRow: {
    paddingHorizontal: Space.xl,
    paddingTop: Space.lg,
    alignItems: 'flex-end',
  },
  skipText: { fontSize: 13, fontWeight: '700', color: EL.onSurfaceMuted },
  slide: {
    flex: 1,
    paddingHorizontal: Space.xxl,
    paddingTop: Space.xxxl,
    alignItems: 'center',
  },
  iconWrap: {
    width: 132,
    height: 132,
    borderRadius: Radii.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Space.xxl,
    backgroundColor: EL.surfaceLow,
  },
  slideTitle: {
    ...Type.displayMd,
    fontSize: 28,
    fontWeight: '900',
    color: EL.onSurface,
    textAlign: 'center',
    marginBottom: Space.md,
  },
  slideBody: {
    fontSize: 15,
    color: EL.onSurfaceSec,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: Space.lg,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Space.sm,
    marginBottom: Space.lg,
  },
  dot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: EL.outlineVariant,
  },
  dotActive: { width: 24 },
  cta: {
    paddingHorizontal: Space.xl,
    paddingBottom: Space.xxxl,
  },
});
