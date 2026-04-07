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
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { Avatar } from '@/components/common/Avatar';
import { ELCard } from '@/components/common/ELCard';
import { ProgressBar } from '@/components/common/ProgressBar';
import { EL, Common, Radii, Shadows, Space, Type } from '@/theme/emeraldLedger';
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
      <Avatar name={item.borrower_name} size={36} />
      <View style={styles.rowBody}>
        <Text style={styles.rowName}>{item.borrower_name}</Text>
        <Text style={styles.rowSub}>
          EMI {formatRupees(item.expected_amount)} \u2022 #{item.installment_number}
        </Text>
      </View>
      <Pressable
        onPress={() => handleQuickCollect(item)}
        disabled={recordMut.isPending}
        style={({ pressed }) => [styles.collectBtn, pressed && { opacity: 0.85 }, recordMut.isPending && { opacity: 0.5 }]}
      >
        <Text style={styles.collectBtnLabel}>{formatRupees(item.expected_amount)}</Text>
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView style={Common.screen}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.plan_entry_id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListHeaderComponent={
          <>
            <View style={styles.greet}>
              <Text style={styles.greeting}>
                {t('common.hello_name', { name: user?.name ?? '' })}
              </Text>
              <Pressable onPress={signOut}>
                <MaterialCommunityIcons name="logout" size={20} color={EL.onSurfaceMuted} />
              </Pressable>
            </View>

            <ELCard style={styles.progressCard}>
              <ProgressBar progress={progress} label={`${done}/${total} collected`} />
              {summary ? (
                <Text style={styles.summaryText}>
                  {formatRupees(summary.totalCollected)} collected today
                </Text>
              ) : null}
            </ELCard>

            {items.length === 0 ? (
              <View style={styles.emptyWrap}>
                <View style={styles.emptyIcon}>
                  <MaterialCommunityIcons name="check-all" size={48} color={EL.primary} />
                </View>
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
  greet: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Space.xl,
    paddingTop: Space.lg,
    paddingBottom: 0,
  },
  greeting: { ...Type.displaySm, color: EL.onSurface },
  progressCard: {
    marginHorizontal: Space.xl,
    marginTop: Space.md,
    marginBottom: Space.lg,
  },
  summaryText: { ...Type.labelMd, color: EL.primary, marginTop: Space.sm, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.md,
    marginHorizontal: Space.xl,
    marginBottom: Space.sm,
    paddingHorizontal: Space.lg,
    height: 64,
    ...Shadows.card,
  },
  rowBody: { flex: 1, marginLeft: Space.md },
  rowName: { ...Type.labelLg, color: EL.onSurface },
  rowSub: { ...Type.labelSm, color: EL.onSurfaceMuted, marginTop: 1 },
  collectBtn: {
    backgroundColor: EL.primary,
    borderRadius: Radii.md,
    paddingHorizontal: Space.xl,
    paddingVertical: Space.sm,
    ...Shadows.card,
  },
  collectBtnLabel: { ...Type.labelLg, color: EL.white },
  emptyWrap: { alignItems: 'center', padding: Space.xl, marginTop: Space.xxxl },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: EL.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Space.lg,
  },
  emptyTitle: { ...Type.displaySm, color: EL.primary },
  emptySub: { ...Type.bodySm, color: EL.onSurfaceSec, marginTop: Space.xs },
});
