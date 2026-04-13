import React from 'react';
import { Platform } from 'react-native';
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
import { AgentManagementScreen } from '@/screens/owner/AgentManagementScreen';
import { SubscriptionScreen } from '@/screens/owner/SubscriptionScreen';
import { AIChatScreen } from '@/screens/owner/AIChatScreen';
import { ImportScreen } from '@/screens/owner/ImportScreen';
import { ReferralScreen } from '@/screens/owner/ReferralScreen';
import { NippuReportScreen } from '@/screens/owner/NippuReportScreen';
import { AgentSuccessReceiptScreen } from '@/screens/agent/AgentSuccessReceiptScreen';
import { BorrowerRatingDetailScreen } from '@/screens/owner/BorrowerRatingDetailScreen';
import { GuarantorScreen } from '@/screens/owner/GuarantorScreen';
import { DocumentScreen } from '@/screens/owner/DocumentScreen';
import { DepositScreen } from '@/screens/owner/DepositScreen';
import { LoanCelebrationScreen } from '@/screens/owner/LoanCelebrationScreen';
import { DailySummaryScreen } from '@/screens/owner/DailySummaryScreen';
import { PattiNoteScreen } from '@/screens/owner/PattiNoteScreen';
import { OutstandingReportScreen } from '@/screens/owner/OutstandingReportScreen';
import { TabIcon } from '@/components/common/TabIcon';
import type { OwnerStackParamList, OwnerTabParamList } from './types';

const Tab = createBottomTabNavigator<OwnerTabParamList>();

function OwnerTabs() {
  const { t } = useTranslation();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#006948',
        tabBarInactiveTintColor: 'rgba(109, 122, 114, 0.4)',
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: 'rgba(240, 253, 244, 0.9)',
          borderTopWidth: 0,
          shadowColor: 'rgba(0,33,20,0.08)',
          shadowOffset: { width: 0, height: -10 },
          shadowOpacity: 1,
          shadowRadius: 40,
          elevation: 4,
          ...(Platform.OS === 'web'
            ? ({ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' } as any)
            : {}),
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
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
      <Stack.Screen name="AgentManagement" component={AgentManagementScreen} options={{ title: 'Agents' }} />
      <Stack.Screen name="Subscription" component={SubscriptionScreen} options={{ title: 'Plans' }} />
      <Stack.Screen name="AIChat" component={AIChatScreen} options={{ title: 'AI Assistant' }} />
      <Stack.Screen name="Import" component={ImportScreen} options={{ title: 'Import' }} />
      <Stack.Screen name="Referral" component={ReferralScreen} options={{ title: 'Refer & Earn' }} />
      <Stack.Screen name="NippuReport" component={NippuReportScreen} options={{ title: 'Nippu Report' }} />
      <Stack.Screen name="SuccessReceipt" component={AgentSuccessReceiptScreen} options={{ headerShown: false }} />
      <Stack.Screen name="BorrowerRating" component={BorrowerRatingDetailScreen} options={{ title: 'Borrower Rating' }} />
      <Stack.Screen name="Deposits" component={DepositScreen} options={{ title: 'Deposits' }} />
      <Stack.Screen name="Guarantor" component={GuarantorScreen} options={{ title: 'Guarantor' }} />
      <Stack.Screen name="LoanCelebration" component={LoanCelebrationScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Documents" component={DocumentScreen} options={{ title: 'Documents' }} />
      <Stack.Screen name="DailySummary" component={DailySummaryScreen} options={{ title: 'Daily Summary' }} />
      <Stack.Screen name="PattiNote" component={PattiNoteScreen} options={{ title: 'Patti Note' }} />
      <Stack.Screen name="OutstandingReport" component={OutstandingReportScreen} options={{ title: 'Outstanding' }} />
    </Stack.Navigator>
  );
}
