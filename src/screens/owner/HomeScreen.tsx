import React from 'react';
import {
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Avatar } from '@/components/common/Avatar';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { ProgressBar } from '@/components/common/ProgressBar';
import { Colors } from '@/constants/colors';
import { Spacing, TouchTarget, Typography } from '@/constants/typography';
import { useDueToday, useTodaySummary } from '@/hooks/useCollections';
import { useSmartCards } from '@/hooks/useSmartCards';
import { useAuthStore } from '@/store/authStore';
import { formatRupees } from '@/utils/format';
import type { DueTodayItem } from '@/db/repos/collections';
import type { OwnerStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<OwnerStackParamList>;

export function HomeScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const { data: summary } = useTodaySummary();
  const { data: dueItems = [] } = useDueToday();
  const { data: smart } = useSmartCards();

  const total = dueItems.length + (summary?.collectionCount ?? 0);
  const done = summary?.collectionCount ?? 0;
  const progress = total > 0 ? done / total : 0;

  const renderDueItem = ({ item }: { item: DueTodayItem }) => (
    <Pressable
      style={styles.dueRow}
      onPress={() => navigation.navigate('Collect', { item })}
    >
      <Avatar name={item.borrower_name} />
      <View style={styles.dueBody}>
        <Text style={styles.dueName}>{item.borrower_name}</Text>
        <Text style={styles.dueSub}>
          EMI {formatRupees(item.expected_amount)} • #{item.installment_number}
        </Text>
      </View>
      <View style={styles.dueBtnWrap}>
        <Text style={styles.dueBtnLabel}>{formatRupees(item.expected_amount)}</Text>
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={dueItems}
        keyExtractor={(item) => item.plan_entry_id}
        renderItem={renderDueItem}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListHeaderComponent={
          <>
            {/* Greeting */}
            <View style={styles.greet}>
              <Text style={styles.greeting}>
                {t('common.hello_name', { name: user?.name ?? '' })}
              </Text>
              <Pressable onPress={signOut}>
                <Text style={styles.signOut}>{t('auth.sign_out')}</Text>
              </Pressable>
            </View>

            {/* Smart cards — P&L + Available to lend */}
            {smart ? (
              <View style={styles.smartRow}>
                <Card style={styles.smartCard}>
                  <Text style={styles.smartLabel}>This month profit</Text>
                  <Text style={[styles.smartValue, { color: smart.monthProfit >= 0 ? Colors.primary : Colors.danger }]}>
                    {formatRupees(smart.monthProfit)}
                  </Text>
                </Card>
                <Card style={styles.smartCard}>
                  <Text style={styles.smartLabel}>Available to lend</Text>
                  <Text style={styles.smartValue}>{formatRupees(smart.availableToLend)}</Text>
                </Card>
              </View>
            ) : null}
            {smart && smart.nextWeekForecast > 0 ? (
              <Card style={styles.card}>
                <Text style={styles.forecastLabel}>
                  Next week expected: {formatRupees(smart.nextWeekForecast)} from collections
                </Text>
              </Card>
            ) : null}

            {/* Today's progress card */}
            <Card style={styles.card}>
              <Text style={styles.cardTitle}>
                Today: {total} people, {formatRupees((summary?.totalExpected ?? 0) + (summary?.totalCollected ?? 0))} to collect
              </Text>
              <ProgressBar
                progress={progress}
                label={`${done}/${total} (${Math.round(progress * 100)}%)`}
              />
              {summary && summary.totalCollected > 0 ? (
                <Text style={styles.cardSub}>
                  Collected: {formatRupees(summary.totalCollected)}
                </Text>
              ) : null}
            </Card>

            {/* Quick action buttons */}
            <View style={styles.actionRow}>
              {dueItems.length > 0 ? (
                <Button
                  title={`Batch collect (${dueItems.length})`}
                  onPress={() => navigation.navigate('BatchCollect')}
                  style={{ flex: 1, marginRight: Spacing.sm }}
                />
              ) : null}
              <Button
                title="Overdue"
                variant="danger"
                onPress={() => navigation.navigate('Overdue')}
                style={{ flex: 1, marginLeft: dueItems.length > 0 ? Spacing.sm : 0 }}
              />
            </View>
            <View style={styles.actionRow}>
              <Button
                title="Monthly summary"
                variant="secondary"
                onPress={() => navigation.navigate('MonthlySummary')}
                style={{ flex: 1, marginRight: Spacing.sm }}
              />
              <Button
                title="AI Assistant"
                variant="secondary"
                onPress={() => navigation.navigate('AIChat')}
                style={{ flex: 1, marginLeft: Spacing.sm }}
              />
            </View>

            {/* Due list heading */}
            {dueItems.length > 0 ? (
              <Text style={styles.sectionTitle}>Due today</Text>
            ) : (
              <Card style={styles.card}>
                <Text style={styles.emptyTitle}>No collections due</Text>
                <Text style={styles.emptySub}>
                  Create borrowers and loans to see today's collection list here.
                </Text>
              </Card>
            )}
          </>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  greet: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.xl,
    paddingBottom: Spacing.sm,
  },
  greeting: { ...Typography.display, color: Colors.text },
  signOut: { ...Typography.caption, color: Colors.textSec },
  card: { marginHorizontal: Spacing.xl, marginBottom: Spacing.lg },
  cardTitle: { ...Typography.title, color: Colors.text, marginBottom: Spacing.md },
  cardSub: { ...Typography.caption, color: Colors.primary, marginTop: Spacing.sm, fontWeight: '600' },
  sectionTitle: {
    ...Typography.title,
    color: Colors.textSec,
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  dueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.white,
    minHeight: TouchTarget.min + 20,
  },
  dueBody: { flex: 1, marginLeft: Spacing.md },
  dueName: { ...Typography.title, color: Colors.text },
  dueSub: { ...Typography.caption, color: Colors.textSec, marginTop: 2 },
  dueBtnWrap: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingHorizontal: Spacing.lg,
    minHeight: TouchTarget.min,
    justifyContent: 'center',
  },
  dueBtnLabel: { ...Typography.title, color: Colors.white },
  sep: { height: 1, backgroundColor: Colors.border, marginLeft: 72 },
  emptyTitle: { ...Typography.title, color: Colors.text },
  emptySub: { ...Typography.body, color: Colors.textSec, marginTop: 4 },
  smartRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  smartCard: { flex: 1, marginHorizontal: 0 },
  smartLabel: { ...Typography.caption, color: Colors.textSec },
  smartValue: { ...Typography.display, color: Colors.text, marginTop: 4 },
  forecastLabel: { ...Typography.body, color: Colors.info },
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
  },
});
