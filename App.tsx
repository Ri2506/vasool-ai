import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Platform, StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import {
  focusManager,
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { RootNavigator } from '@/navigation/RootNavigator';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { installCrashHandlers, flushCrashLog } from '@/lib/crashReporter';
import { OnboardingScreen, ONBOARDING_KEY } from '@/screens/auth/OnboardingScreen';
import { EL } from '@/theme/emeraldLedger';
import { initI18n } from '@/i18n';
import { secureStorage } from '@/lib/secureStorage';
import { useAuthStore } from '@/store/authStore';
import { openDb } from '@/db';

// Realtime defaults — every screen mount triggers a background refetch,
// every focus event refetches, every reconnect refetches. This keeps the
// UI in lock-step with SQLite even when mutations from other screens
// haven't explicitly invalidated.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 0,                  // always consider data stale → refetch
      refetchOnMount: 'always',
      refetchOnReconnect: 'always',
      refetchOnWindowFocus: true,
    },
    mutations: {
      onError: (error: any) => {
        Alert.alert('Error', error?.message ?? 'Something went wrong');
      },
    },
  },
});

// Focus tracking for React Native — ties RN's AppState to React Query's
// focusManager so backgrounding/foregrounding the app refetches data.
focusManager.setEventListener((handleFocus) => {
  if (Platform.OS === 'web') {
    // React Query handles browser focus natively
    return undefined;
  }
  const sub = AppState.addEventListener('change', (state) => {
    handleFocus(state === 'active');
  });
  return () => sub.remove();
});

// Online/offline tracking — when network comes back, refetch AND flush
// the outbound SMS queue (receipts, reminders) that accumulated offline.
onlineManager.setEventListener((setOnline) => {
  const unsub = NetInfo.addEventListener((state) => {
    const online = !!state.isConnected;
    setOnline(online);
    if (online) {
      // Fire-and-forget SMS queue flush on reconnect.
      // Dynamic import so App.tsx doesn't pull the whole SMS stack into
      // its initial bundle.
      import('@/db/repos/sms')
        .then(async ({ flushSmsQueue }) => {
          const { useAuthStore } = await import('@/store/authStore');
          const orgId = useAuthStore.getState().user?.orgId;
          if (orgId) await flushSmsQueue(orgId).catch(() => undefined);
        })
        .catch(() => undefined);
      // Push any locally-recorded crashes to Supabase
      flushCrashLog().catch(() => undefined);
      // Two-way sync — pushes dirty rows + pulls remote changes.
      // Edge Function may not be deployed yet; syncSilent swallows errors.
      import('@/db/sync')
        .then(({ syncSilent }) => syncSilent())
        .catch(() => undefined);
    }
  });
  return unsub;
});

export default function App() {
  const [ready, setReady] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    installCrashHandlers();
    (async () => {
      await initI18n();
      const db = await openDb();
      await hydrate();
      // eslint-disable-next-line no-console
      console.log('[VasoolAI] SQLite ready:', !!db);

      // Register for push (no-op on web). We only need the token if/when
      // we wire the Edge Function to send remote pushes; local notifs work
      // without registration.
      import('@/lib/notifications')
        .then(({ registerForPush }) => registerForPush())
        .catch(() => undefined);

      // Onboarding gate — first launch only
      try {
        const seen = await secureStorage.getItem(ONBOARDING_KEY);
        setNeedsOnboarding(!seen);
      } catch {
        setNeedsOnboarding(true);
      }

      setReady(true);
    })();
  }, [hydrate]);

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={EL.primary} size="large" />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            {needsOnboarding ? (
              <OnboardingScreen onDone={() => setNeedsOnboarding(false)} />
            ) : (
              <NavigationContainer>
                <StatusBar style="dark" />
                <RootNavigator />
              </NavigationContainer>
            )}
          </QueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: EL.surface,
  },
});
