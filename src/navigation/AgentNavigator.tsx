import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import { AgentHomeScreen } from '@/screens/agent/AgentHomeScreen';
import { AgentExpenseScreen } from '@/screens/agent/AgentExpenseScreen';
import { AgentSummaryScreen } from '@/screens/agent/AgentSummaryScreen';
import { AgentSuccessReceiptScreen } from '@/screens/agent/AgentSuccessReceiptScreen';
import { EL, Shadows } from '@/theme/emeraldLedger';
import { TabIcon } from '@/components/common/TabIcon';
import type { AgentTabParamList, AgentStackParamList } from './types';

const Tab = createBottomTabNavigator<AgentTabParamList>();
const Stack = createNativeStackNavigator<AgentStackParamList>();

function AgentTabs() {
  const { t } = useTranslation();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: EL.primary,
        tabBarInactiveTintColor: EL.onSurfaceMuted,
        tabBarStyle: {
          borderTopWidth: 0,
          height: 64,
          paddingBottom: 8,
          backgroundColor: 'rgba(250, 252, 251, 0.85)',
          ...Shadows.float,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tab.Screen
        name="Collect"
        component={AgentHomeScreen}
        options={{ title: t('nav.collect'), tabBarIcon: ({ color }) => <TabIcon name="collect" color={color} /> }}
      />
      <Tab.Screen
        name="Expenses"
        component={AgentExpenseScreen}
        options={{ title: 'Expenses', tabBarIcon: ({ color }) => <TabIcon name="expenses" color={color} /> }}
      />
      <Tab.Screen
        name="Summary"
        component={AgentSummaryScreen}
        options={{ title: t('nav.summary'), tabBarIcon: ({ color }) => <TabIcon name="summary" color={color} /> }}
      />
    </Tab.Navigator>
  );
}

export function AgentNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AgentTabs" component={AgentTabs} />
      <Stack.Screen name="AgentReceipt" component={AgentSuccessReceiptScreen} />
    </Stack.Navigator>
  );
}
