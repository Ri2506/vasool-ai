import React, { useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button } from '@/components/common/Button';
import { Colors } from '@/constants/colors';
import { Spacing, Typography } from '@/constants/typography';
import { Config } from '@/constants/config';
import { setLanguage } from '@/i18n';
import { secureStorage } from '@/lib/secureStorage';
import type { AuthStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Language'>;

export function LanguageScreen({ navigation }: Props) {
  const { t, i18n } = useTranslation();
  const [selected, setSelected] = useState<'en' | 'ta'>(
    (i18n.language as 'en' | 'ta') ?? 'en'
  );

  const handleContinue = async () => {
    await setLanguage(selected);
    await secureStorage.setItem(Config.storageKeys.onboarded, '1');
    navigation.replace('PhoneLogin');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>{t('auth.choose_language')}</Text>
        <Text style={styles.subtitle}>{t('auth.language_subtitle')}</Text>

        <View style={styles.options}>
          <LanguageOption
            label="English"
            active={selected === 'en'}
            onPress={() => setSelected('en')}
          />
          <LanguageOption
            label="தமிழ்"
            active={selected === 'ta'}
            onPress={() => setSelected('ta')}
          />
        </View>

        <Button title={t('common.continue')} onPress={handleContinue} />
      </View>
    </SafeAreaView>
  );
}

interface OptionProps {
  label: string;
  active: boolean;
  onPress: () => void;
}

function LanguageOption({ label, active, onPress }: OptionProps) {
  return (
    <Button
      title={label}
      onPress={onPress}
      variant={active ? 'primary' : 'secondary'}
      style={{ marginBottom: Spacing.md }}
    />
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
    marginBottom: Spacing.sm,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textSec,
    marginBottom: Spacing.xl,
  },
  options: {
    marginBottom: Spacing.lg,
  },
});
