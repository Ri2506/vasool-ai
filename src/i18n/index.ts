import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';

import en from './en.json';
import ta from './ta.json';
import { Config } from '@/constants/config';
import { secureStorage } from '@/lib/secureStorage';

export type Language = 'en' | 'ta';

/**
 * Resolve the initial language:
 *   1. User's saved preference (SecureStore)
 *   2. Device locale if it starts with "ta" (Tamil)
 *   3. Default to English
 */
async function resolveInitialLanguage(): Promise<Language> {
  const saved = await secureStorage.getItem(Config.storageKeys.language);
  if (saved === 'en' || saved === 'ta') return saved;

  const locales = Localization.getLocales();
  const primary = locales[0]?.languageCode ?? 'en';
  return primary === 'ta' ? 'ta' : 'en';
}

export async function initI18n(): Promise<void> {
  const lng = await resolveInitialLanguage();
  await i18n.use(initReactI18next).init({
    compatibilityJSON: 'v4',
    resources: { en: { translation: en }, ta: { translation: ta } },
    lng,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });
}

export async function setLanguage(lng: Language): Promise<void> {
  await i18n.changeLanguage(lng);
  await secureStorage.setItem(Config.storageKeys.language, lng);
}

export default i18n;
