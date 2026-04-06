// Cross-platform secure-ish key/value storage.
//   - Native (iOS/Android) → expo-secure-store (Keychain / Keystore)
//   - Web → localStorage (NOT actually secure, but sufficient for dev/demo)
//
// We use this for:
//   • Supabase auth session persistence
//   • Language preference (not sensitive)
//   • Onboarded flag (not sensitive)
//   • Cached session user profile
//
// TODO(Sprint 3): on web, wrap sensitive values in Web Crypto encryption
// before hitting localStorage, or move to IndexedDB + passkey-gated keys.

import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export const secureStorage = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      try {
        return globalThis.localStorage?.getItem(key) ?? null;
      } catch {
        return null;
      }
    }
    return SecureStore.getItemAsync(key);
  },

  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      try {
        globalThis.localStorage?.setItem(key, value);
      } catch {
        // ignore
      }
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },

  removeItem: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') {
      try {
        globalThis.localStorage?.removeItem(key);
      } catch {
        // ignore
      }
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};
