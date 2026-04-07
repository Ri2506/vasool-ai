import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AuthNavigator } from './AuthNavigator';
import { OwnerNavigator } from './OwnerNavigator';
import { AgentNavigator } from './AgentNavigator';
import { OfflineBanner } from '@/components/common/OfflineBanner';
import { useAuthStore } from '@/store/authStore';
import { EL } from '@/theme/emeraldLedger';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const user = useAuthStore((s) => s.user);
  const isHydrating = useAuthStore((s) => s.isHydrating);

  if (isHydrating) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={EL.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <OfflineBanner />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user && <Stack.Screen name="Auth" component={AuthNavigator} />}
        {user?.role === 'owner' && <Stack.Screen name="Owner" component={OwnerNavigator} />}
        {user?.role === 'agent' && <Stack.Screen name="Agent" component={AgentNavigator} />}
      </Stack.Navigator>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: EL.surface,
  },
});
