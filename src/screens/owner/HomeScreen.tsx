import React, { useState } from 'react';
import {
  FlatList, Modal, Pressable, SafeAreaView, StyleSheet, Text, View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Avatar } from '@/components/common/Avatar';
import { ELCard } from '@/components/common/ELCard';
import { GradientButton } from '@/components/common/GradientButton';
import { ProgressBar } from '@/components/common/ProgressBar';
import { StatusBadge } from '@/components/common/StatusBadge';
import { StarRating } from '@/components/common/StarRating';
import { EL, Common, Glass, Radii, Shadows, Space, Touch, Type } from '@/theme/emeraldLedger';
import { useDueToday, useTodaySummary } from '@/hooks/useCollections';
import { useSmartCards } from '@/hooks/useSmartCards';
import { useBorrowerStatuses } from '@/hooks/useBorrowerStatus';
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
  const { data: statuses } = useBorrowerStatuses();
  const [showBreakdown, setShowBreakdown] = useState(false);

  const total = dueItems.length + (summary?.collectionCount ?? 0);
  const done = summary?.collectionCount ?? 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const renderDueItem = ({ item }: { item: DueTodayItem }) => {
    const st = statuses?.[item.borrower_id];
    return (
      <Pressable
        style={styles.dueRow}
        onPress={() => navigation.navigate('Collect', { item })}
      >
        <Avatar name={item.borrower_name} size={44} />
        <View style={styles.dueBody}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.dueName}>{item.borrower_name}</Text>
            {st?.is_nippu !== undefined ? (
              <StatusBadge status={st.is_nippu ? 'nippu' : 'nadapu'} />
            ) : null}
          </View>
          <Text style={styles.dueSub}>
            {formatRupees(item.expected_amount)}/day • {item.line_name ?? 'Daily'}
          </Text>
          {st?.rating ? <StarRating rating={st.rating} size={10} /> : null}
        </View>
        {/* Green collect button */}
        <Pressable style={styles.collectBtn}>
          <Text style={styles.collectBtnText}>{formatRupees(item.expected_amount)}</Text>
        </Pressable>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={Common.screen}>
      <FlatList
        data={dueItems}
        keyExtractor={(item) => item.plan_entry_id}
        renderItem={renderDueItem}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListHeaderComponent={
          <>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.appName}>VasoolAI</Text>
              <Pressable onPress={signOut}>
                <MaterialCommunityIcons name="logout" size={22} color={EL.onSurfaceMuted} />
              </Pressable>
            </View>

            {/* Smart cards row */}
            {smart ? (
              <View style={styles.smartRow}>
                <ELCard style={styles.smartCard}>
                  <Text style={styles.smartLabel}>This month profit</Text>
                  <Text style={[styles.smartValue, { color: smart.monthProfit >= 0 ? EL.primary : EL.nippu }]}>
                    {formatRupees(smart.monthProfit)}
                  </Text>
                  <Text style={styles.smartHint}>↑ vs last month</Text>
                </ELCard>
                <Pressable onPress={() => setShowBreakdown(true)} style={{ flex: 1 }}>
                  <ELCard style={[styles.smartCard, { flex: undefined }]}>
                    <Text style={styles.smartLabel}>Available to lend</Text>
                    <Text style={styles.smartValue}>{formatRupees(smart.availableToLend)}</Text>
                    <Text style={styles.smartHint}>Ready to disburse →</Text>
                  </ELCard>
                </Pressable>
              </View>
            ) : null}

            {/* Today's progress */}
            <ELCard style={styles.progressCard}>
              <View style={styles.progressHeader}>
                <Text style={Type.titleMd}>Today's progress</Text>
                <Text style={[Type.displaySm, { color: EL.primary }]}>{pct}%</Text>
              </View>
              <Text style={styles.progressSub}>
                {done}/{total} collected  •  {formatRupees(summary?.totalCollected ?? 0)} / {formatRupees((summary?.totalCollected ?? 0) + (summary?.totalExpected ?? 0))}
              </Text>
              <ProgressBar progress={total > 0 ? done / total : 0} />
            </ELCard>

            {/* Pending collections header */}
            {dueItems.length > 0 ? (
              <View style={styles.sectionHeader}>
                <Text style={Type.titleMd}>Pending Collections</Text>
                <Pressable onPress={() => navigation.navigate('BatchCollect')}>
                  <Text style={styles.viewAll}>View all</Text>
                </Pressable>
              </View>
            ) : (
              <ELCard style={{ marginHorizontal: Space.xl, marginBottom: Space.lg }}>
                <Text style={Type.titleMd}>No collections due</Text>
                <Text style={[Type.bodySm, { marginTop: Space.xs }]}>
                  Create borrowers and loans to see today's collection list here.
                </Text>
              </ELCard>
            )}
          </>
        }
      />

      {/* FAB — new loan */}
      <Pressable
        style={Common.fab}
        onPress={() => navigation.navigate('BatchCollect')}
      >
        <MaterialCommunityIcons name="plus" size={28} color={EL.white} />
      </Pressable>

      {/* Cash Position Breakdown Modal */}
      <Modal visible={showBreakdown} transparent animationType="slide" onRequestClose={() => setShowBreakdown(false)}>
        <Pressable style={[Glass.dark, { flex: 1, justifyContent: 'flex-end' }]} onPress={() => setShowBreakdown(false)}>
          <View style={[Glass.container, styles.sheet]}>
            <Text style={Type.displaySm}>Cash Position</Text>
            {smart ? (
              <>
                <BRow label="Collections received" value={formatRupees(smart.monthCollected)} plus />
                <BRow label="Investments added" value={formatRupees(smart.totalInvested)} plus />
                <View style={styles.divider} />
                <BRow label="Total in" value={formatRupees(smart.monthCollected + smart.totalInvested)} bold plus />
                <View style={{ height: Space.lg }} />
                <BRow label="Loans given out" value={formatRupees(smart.monthLent)} />
                <BRow label="Expenses" value={formatRupees(smart.monthExpenses)} />
                <View style={styles.divider} />
                <BRow label="Total out" value={formatRupees(smart.monthLent + smart.monthExpenses)} bold />
                <View style={styles.divider} />
                <View style={styles.totalRow}>
                  <Text style={Type.titleLg}>Available to lend</Text>
                  <Text style={[Type.displayMd, { color: EL.primary }]}>{formatRupees(smart.availableToLend)}</Text>
                </View>
              </>
            ) : null}
            <GradientButton title="Close" variant="secondary" onPress={() => setShowBreakdown(false)} style={{ marginTop: Space.xl }} />
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function BRow({ label, value, plus, bold }: { label: string; value: string; plus?: boolean; bold?: boolean }) {
  return (
    <View style={styles.bRow}>
      <Text style={[Type.bodyMd, bold && { fontWeight: '700' }]}>{label}</Text>
      <Text style={[Type.bodyMd, { color: plus ? EL.primary : EL.nippu, fontWeight: bold ? '700' : '500' }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Space.xl, paddingTop: Space.lg, paddingBottom: Space.md,
  },
  appName: { ...Type.displayMd, color: EL.primary },
  smartRow: {
    flexDirection: 'row', paddingHorizontal: Space.xl, marginBottom: Space.lg, gap: Space.md,
  },
  smartCard: { flex: 1 },
  smartLabel: { ...Type.labelSm },
  smartValue: { ...Type.displaySm, color: EL.onSurface, marginTop: Space.xs },
  smartHint: { ...Type.labelSm, color: EL.onSurfaceMuted, marginTop: Space.xs },
  progressCard: { marginHorizontal: Space.xl, marginBottom: Space.lg },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressSub: { ...Type.bodySm, marginTop: Space.xs, marginBottom: Space.md },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Space.xl, marginBottom: Space.md,
  },
  viewAll: { ...Type.labelMd, color: EL.primary },
  dueRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Space.xl, paddingVertical: Space.lg,
    // No border separator — use whitespace per Emerald Ledger
  },
  dueBody: { flex: 1, marginLeft: Space.md },
  dueName: { ...Type.titleMd, color: EL.onSurface },
  dueSub: { ...Type.bodySm, marginTop: 2 },
  collectBtn: {
    backgroundColor: EL.primary, borderRadius: Radii.md,
    paddingHorizontal: Space.lg, minHeight: Touch.min,
    alignItems: 'center', justifyContent: 'center',
    ...Shadows.card,
  },
  collectBtnText: { ...Type.labelLg, color: EL.white },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Space.xl, paddingBottom: Space.xxxl },
  divider: { height: 1, backgroundColor: EL.surfaceLow, marginVertical: Space.md },
  bRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Space.sm },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Space.md },
});
