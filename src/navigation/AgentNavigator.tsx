import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';

import { AgentHomeScreen } from '@/screens/agent/AgentHomeScreen';
import { AgentExpenseScreen } from '@/screens/agent/AgentExpenseScreen';
import { AgentSummaryScreen } from '@/screens/agent/AgentSummaryScreen';
import { Colors } from '@/constants/colors';
import { TabIcon } from '@/components/common/TabIcon';
import type { AgentTabParamList } from './types';

const Tab = createBottomTabNavigator<AgentTabParamList>();

export function AgentNavigator() {
  const { t } = useTranslation();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: { borderTopColor: Colors.border, height: 56, paddingBottom: 4 },
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
