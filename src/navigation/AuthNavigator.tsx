import React, { useEffect, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { LanguageScreen } from '@/screens/auth/LanguageScreen';
import { PhoneLoginScreen } from '@/screens/auth/PhoneLoginScreen';
import { OTPScreen } from '@/screens/auth/OTPScreen';
import { PinLoginScreen } from '@/screens/auth/PinLoginScreen';
import { Config } from '@/constants/config';
import { secureStorage } from '@/lib/secureStorage';
import type { AuthStackParamList } from './types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  const [initialRoute, setInitialRoute] = useState<keyof AuthStackParamList | null>(null);

  useEffect(() => {
    (async () => {
      const onboarded = await secureStorage.getItem(Config.storageKeys.onboarded);
      setInitialRoute(onboarded === '1' ? 'PhoneLogin' : 'Language');
    })();
  }, []);

  if (!initialRoute) return null;

  return (
    <Stack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Language" component={LanguageScreen} />
      <Stack.Screen name="PhoneLogin" component={PhoneLoginScreen} />
      <Stack.Screen name="Otp" component={OTPScreen} />
      <Stack.Screen name="PinLogin" component={PinLoginScreen} />
    </Stack.Navigator>
  );
}
