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
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Avatar } from '@/components/common/Avatar';
import { ProgressBar } from '@/components/common/ProgressBar';
import { Colors } from '@/constants/colors';
import { Spacing, TouchTarget, Typography } from '@/constants/typography';
import { useDueToday, useRecordCollection, useTodaySummary } from '@/hooks/useCollections';
import { formatRupees } from '@/utils/format';
import type { DueTodayItem } from '@/db/repos/collections';
import type { OwnerStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<OwnerStackParamList>;

/**
 * BatchCollectScreen — rapid-fire collection list per PRD §5.3.
 * No screen transitions: tap the green button → instant record → checkmark.
 * Progress bar at top fills as agent works through the list.
 */
export function BatchCollectScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
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
      });
    } catch (e: any) {
      Alert.alert(t('common.error_generic'), e?.message ?? '');
    }
  };

  const renderItem = ({ item }: { item: DueTodayItem }) => (
    <View style={styles.row}>
      <Avatar name={item.borrower_name} />
      <Pressable
        style={styles.rowBody}
        onPress={() => navigation.navigate('Collect', { item })}
      >
        <Text style={styles.rowName}>{item.borrower_name}</Text>
        <Text style={styles.rowSub}>
          EMI {formatRupees(item.expected_amount)} • #{item.installment_number}
        </Text>
      </Pressable>
      {/* One-tap green button — THE core interaction */}
      <Pressable
        onPress={() => handleQuickCollect(item)}
        disabled={recordMut.isPending}
        style={({ pressed }) => [
          styles.collectBtn,
          pressed && { opacity: 0.8 },
          recordMut.isPending && { opacity: 0.5 },
        ]}
      >
        <Text style={styles.collectBtnLabel}>
          {formatRupees(item.expected_amount)}
        </Text>
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      {/* Progress header */}
      <View style={styles.progressWrap}>
        <ProgressBar
          progress={progress}
          label={`${done}/${total} collected`}
        />
        {summary ? (
          <Text style={styles.summaryText}>
            {formatRupees(summary.totalCollected)} of{' '}
            {formatRupees(summary.totalCollected + summary.totalExpected)}
          </Text>
        ) : null}
      </View>

      {items.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>All done!</Text>
          <Text style={styles.emptySub}>No more collections due today.</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.plan_entry_id}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  progressWrap: {
    padding: Spacing.xl,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  summaryText: {
    ...Typography.caption,
    color: Colors.textSec,
    marginTop: Spacing.sm,
  },
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
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  emptyTitle: { ...Typography.display, color: Colors.primary },
  emptySub: { ...Typography.body, color: Colors.textSec, marginTop: Spacing.sm },
});
