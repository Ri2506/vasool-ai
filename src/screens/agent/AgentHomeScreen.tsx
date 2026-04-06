import React from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { Avatar } from '@/components/common/Avatar';
import { Button } from '@/components/common/Button';
import { ProgressBar } from '@/components/common/ProgressBar';
import { Colors } from '@/constants/colors';
import { Spacing, TouchTarget, Typography } from '@/constants/typography';
import { useDueToday, useRecordCollection, useTodaySummary } from '@/hooks/useCollections';
import { useAuthStore } from '@/store/authStore';
import { formatRupees } from '@/utils/format';
import type { DueTodayItem } from '@/db/repos/collections';

export function AgentHomeScreen() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const { data: items = [] } = useDueToday();
  const { data: summary } = useTodaySummary();
  const recordMut = useRecordCollection();

  const total = items.length + (summary?.collectionCount ?? 0);
  const done = summary?.collectionCount ?? 0;
  const progress = total > 0 ? done / total : 0;

  const handleQuickCollect = async (item: DueTodayItem) => {
    try {
      await recordMut.mutateAsync({
        loanId: item.loan_id,
        planEntryId: item.plan_entry_id,
        amount: item.expected_amount,
        expectedAmount: item.expected_amount,
        agentId: user?.id,
      });
    } catch (e: any) {
      Alert.alert(t('common.error_generic'), e?.message ?? '');
    }
  };

  const renderItem = ({ item }: { item: DueTodayItem }) => (
    <View style={styles.row}>
      <Avatar name={item.borrower_name} />
      <View style={styles.rowBody}>
        <Text style={styles.rowName}>{item.borrower_name}</Text>
        <Text style={styles.rowSub}>
          EMI {formatRupees(item.expected_amount)} • #{item.installment_number}
        </Text>
      </View>
      <Pressable
        onPress={() => handleQuickCollect(item)}
        disabled={recordMut.isPending}
        style={({ pressed }) => [
          styles.collectBtn,
          pressed && { opacity: 0.8 },
        ]}
      >
        <Text style={styles.collectBtnLabel}>{formatRupees(item.expected_amount)}</Text>
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.plan_entry_id}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListHeaderComponent={
          <>
            <View style={styles.greet}>
              <Text style={styles.greeting}>
                {t('common.hello_name', { name: user?.name ?? '' })}
              </Text>
              <Pressable onPress={signOut}>
                <Text style={styles.signOutText}>{t('auth.sign_out')}</Text>
              </Pressable>
            </View>
            <View style={styles.progressWrap}>
              <ProgressBar progress={progress} label={`${done}/${total} collected`} />
              {summary ? (
                <Text style={styles.summaryText}>
                  {formatRupees(summary.totalCollected)} collected today
                </Text>
              ) : null}
            </View>
            {items.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyTitle}>All done!</Text>
                <Text style={styles.emptySub}>No more collections due today.</Text>
              </View>
            ) : null}
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
    paddingBottom: 0,
  },
  greeting: { ...Typography.display, color: Colors.text },
  signOutText: { ...Typography.caption, color: Colors.textSec },
  progressWrap: {
    padding: Spacing.xl,
    backgroundColor: Colors.white,
    margin: Spacing.xl,
    marginTop: Spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  summaryText: { ...Typography.caption, color: Colors.primary, marginTop: Spacing.sm, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.white,
    minHeight: TouchTarget.min + 20,
  },
  rowBody: { flex: 1, marginLeft: Spacing.md },
  rowName: { ...Typography.title, color: Colors.text },
  rowSub: { ...Typography.caption, color: Colors.textSec, marginTop: 2 },
  collectBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingHorizontal: Spacing.lg,
    minHeight: TouchTarget.min,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 90,
  },
  collectBtnLabel: { ...Typography.title, color: Colors.white },
  sep: { height: 1, backgroundColor: Colors.border, marginLeft: 72 },
  emptyWrap: { alignItems: 'center', padding: Spacing.xl },
  emptyTitle: { ...Typography.display, color: Colors.primary },
  emptySub: { ...Typography.body, color: Colors.textSec, marginTop: Spacing.sm },
});
