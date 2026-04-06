import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import { HomeScreen } from '@/screens/owner/HomeScreen';
import { BorrowerListScreen } from '@/screens/owner/BorrowerListScreen';
import { BorrowerDetailScreen } from '@/screens/owner/BorrowerDetailScreen';
import { BorrowerEditScreen } from '@/screens/owner/BorrowerEditScreen';
import { LinesScreen } from '@/screens/owner/LinesScreen';
import { ReportsScreen } from '@/screens/owner/ReportsScreen';
import { ExpenseScreen } from '@/screens/owner/ExpenseScreen';
import { InvestmentScreen } from '@/screens/owner/InvestmentScreen';
import { SettingsScreen } from '@/screens/owner/SettingsScreen';
import { NewLoanScreen } from '@/screens/owner/NewLoanScreen';
import { LoanPlanScreen } from '@/screens/owner/LoanPlanScreen';
import { CollectScreen } from '@/screens/owner/CollectScreen';
import { BatchCollectScreen } from '@/screens/owner/BatchCollectScreen';
import { MonthlySummaryScreen } from '@/screens/owner/MonthlySummaryScreen';
import { OverdueScreen } from '@/screens/owner/OverdueScreen';
import { Colors } from '@/constants/colors';
import { TabIcon } from '@/components/common/TabIcon';
import type { OwnerStackParamList, OwnerTabParamList } from './types';

const Tab = createBottomTabNavigator<OwnerTabParamList>();

function OwnerTabs() {
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
      <Tab.Screen name="Home" component={HomeScreen} options={{
        title: t('nav.home'),
        tabBarIcon: ({ color }) => <TabIcon name="home" color={color} />,
      }} />
      <Tab.Screen name="Borrowers" component={BorrowerListScreen} options={{
        title: t('nav.borrowers'),
        tabBarIcon: ({ color }) => <TabIcon name="borrowers" color={color} />,
      }} />
      <Tab.Screen name="Reports" component={ReportsScreen} options={{
        title: t('nav.reports'),
        tabBarIcon: ({ color }) => <TabIcon name="reports" color={color} />,
      }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{
        title: t('nav.settings'),
        tabBarIcon: ({ color }) => <TabIcon name="settings" color={color} />,
      }} />
    </Tab.Navigator>
  );
}

const Stack = createNativeStackNavigator<OwnerStackParamList>();

export function OwnerNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: true, headerBackTitle: '' }}>
      <Stack.Screen name="Tabs" component={OwnerTabs} options={{ headerShown: false }} />
      <Stack.Screen name="BorrowerDetail" component={BorrowerDetailScreen} options={{ title: '' }} />
      <Stack.Screen name="BorrowerEdit" component={BorrowerEditScreen} options={{ title: '' }} />
      <Stack.Screen name="NewLoan" component={NewLoanScreen} options={{ title: '' }} />
      <Stack.Screen name="LoanPlan" component={LoanPlanScreen} options={{ title: '' }} />
      <Stack.Screen name="Collect" component={CollectScreen} options={{ title: 'Collect' }} />
      <Stack.Screen name="BatchCollect" component={BatchCollectScreen} options={{ title: 'Batch collect' }} />
      <Stack.Screen name="Lines" component={LinesScreen} options={{ title: '' }} />
      <Stack.Screen name="Expenses" component={ExpenseScreen} options={{ title: '' }} />
      <Stack.Screen name="Investments" component={InvestmentScreen} options={{ title: '' }} />
      <Stack.Screen name="MonthlySummary" component={MonthlySummaryScreen} options={{ title: 'Monthly Summary' }} />
      <Stack.Screen name="Overdue" component={OverdueScreen} options={{ title: 'Overdue' }} />
    </Stack.Navigator>
  );
}
