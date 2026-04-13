import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  SectionList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Avatar } from '@/components/common/Avatar';
import { SkeletonRow } from '@/components/common/Skeleton';
import { StarRating } from '@/components/common/StarRating';
import { StatusBadge, type BorrowerStatusType } from '@/components/common/StatusBadge';
import { ELCard } from '@/components/common/ELCard';
import { EL, Common, Radii, Shadows, Space, Type, Fonts } from '@/theme/emeraldLedger';
import { formatRupees } from '@/utils/format';
import { useVoice } from '@/hooks/useVoice';
import { useBorrowers } from '@/hooks/useBorrowers';
import { useBorrowerStatuses } from '@/hooks/useBorrowerStatus';
import { useDueToday } from '@/hooks/useCollections';
import { useBorrowerListSummaries } from '@/hooks/useBorrowerSummary';
import type { BorrowerRow } from '@/db/types';
import type { OwnerStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<OwnerStackParamList>;

type FilterKey = 'all' | 'due_today' | 'nippu' | 'completed';

export function BorrowerListScreen() {
  const navigation = useNavigation<Nav>();
  const voice = useVoice();
  const { t } = useTranslation();
  const { data: borrowers, isLoading, refetch, isRefetching } = useBorrowers();
  const { data: statuses } = useBorrowerStatuses();
  const { data: dueItems = [] } = useDueToday();
  const { data: summaries } = useBorrowerListSummaries();
  const dueBorrowerIds = useMemo(() => new Set(dueItems.map((d) => d.borrower_id)), [dueItems]);
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');

  useEffect(() => {
    if (voice.lastResult?.text) {
      setQuery(voice.lastResult.text);
    }
  }, [voice.lastResult]);

  const filtered = useMemo(() => {
    if (!borrowers) return [];
    let list = borrowers;

    // Apply filter
    if (activeFilter === 'due_today') {
      list = list.filter((b) => dueBorrowerIds.has(b.id));
    } else if (activeFilter === 'nippu') {
      list = list.filter((b) => statuses?.[b.id]?.is_nippu);
    } else if (activeFilter === 'completed') {
      list = list.filter((b) => {
        const st = statuses?.[b.id];
        return st && !st.is_nippu && !st.rating;
      });
    }

    // Apply search
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        (b.phone ?? '').toLowerCase().includes(q)
    );
  }, [borrowers, statuses, query, activeFilter]);

  // Line-wise grouping for SectionList
  const sections = useMemo(() => {
    if (!filtered.length) return [];
    const groups = new Map<string, BorrowerRow[]>();
    for (const b of filtered) {
      const summary = summaries?.get(b.id);
      const lineName = summary?.line_name ?? 'No line';
      const arr = groups.get(lineName) ?? [];
      arr.push(b);
      groups.set(lineName, arr);
    }
    // "No line" goes last; rest sorted alphabetically
    const entries = Array.from(groups.entries()).sort((a, b) => {
      if (a[0] === 'No line') return 1;
      if (b[0] === 'No line') return -1;
      return a[0].localeCompare(b[0]);
    });
    return entries.map(([title, data]) => ({ title, data }));
  }, [filtered, summaries]);

  // Count stats for filter chips
  const counts = useMemo(() => {
    if (!borrowers) return { all: 0, nippu: 0, completed: 0 };
    let nippu = 0;
    let completed = 0;
    for (const b of borrowers) {
      const st = statuses?.[b.id];
      if (st?.is_nippu) nippu++;
      else if (st && !st.rating) completed++;
    }
    return { all: borrowers.length, nippu, completed, due_today: dueBorrowerIds.size };
  }, [borrowers, statuses, dueBorrowerIds]);

  const filters: { key: FilterKey; label: string }[] = [
    { key: 'all', label: `All (${counts.all})` },
    { key: 'due_today', label: `Due Today (${counts.due_today})` },
    { key: 'nippu', label: `Overdue (${counts.nippu})` },
    { key: 'completed', label: 'Completed' },
  ];

  const renderItem = ({ item }: { item: BorrowerRow }) => {
    const st = statuses?.[item.id];
    const summary = summaries?.get(item.id);
    const borrowerStatus: BorrowerStatusType = st?.is_nippu ? 'nippu' : st?.rating ? 'nadapu' : 'none';
    return (
      <Pressable
        onPress={() => navigation.navigate('BorrowerDetail', { id: item.id })}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      >
        {/* Top row: avatar + name/phone + status */}
        <View style={styles.cardTopRow}>
          <View style={styles.cardLeft}>
            <Avatar name={item.name} photoUri={item.photo_url} size={44} />
            <View style={styles.cardBody}>
              <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
              {item.phone ? (
                <Text style={styles.cardPhone}>{item.phone}</Text>
              ) : null}
              {st?.emi ? (
                <Text style={styles.cardEmi}>
                  {formatRupees(st.emi)}/{st.line_type === 'daily' ? 'day' : st.line_type === 'weekly' ? 'wk' : 'mo'}
                </Text>
              ) : null}
            </View>
          </View>
          <View style={styles.cardRight}>
            <StatusBadge status={borrowerStatus} />
            {st?.rating ? (
              <View style={styles.cardStars}>
                <StarRating rating={st.rating} size={12} />
              </View>
            ) : null}
          </View>
        </View>

        {/* Paid/balance mini-stats row — only when active loan exists */}
        {summary && summary.active_loan_count > 0 ? (
          <View style={styles.cardStats}>
            <View style={styles.cardStat}>
              <Text style={styles.cardStatLabel}>Paid</Text>
              <Text style={[styles.cardStatValue, { color: EL.primary }]}>
                {formatRupees(summary.total_paid)}
              </Text>
            </View>
            <View style={styles.cardStat}>
              <Text style={styles.cardStatLabel}>Balance</Text>
              <Text style={[styles.cardStatValue, { color: EL.nippu }]}>
                {formatRupees(summary.total_balance)}
              </Text>
            </View>
            <View style={styles.cardStat}>
              <Text style={styles.cardStatLabel}>Loans</Text>
              <Text style={styles.cardStatValue}>{summary.active_loan_count}</Text>
            </View>
          </View>
        ) : null}
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={Common.screen}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        renderSectionHeader={({ section: { title, data } }) => (
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="road-variant" size={14} color={EL.primary} />
            <Text style={styles.sectionHeaderText}>{title}</Text>
            <Text style={styles.sectionHeaderCount}>
              {data.length} {data.length === 1 ? 'borrower' : 'borrowers'}
            </Text>
          </View>
        )}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={EL.primary}
            colors={[EL.primary]}
          />
        }
        ListHeaderComponent={
          <>
            {/* Top App Bar — clean title only, menu + duplicate search removed */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Borrowers</Text>
              <Text style={styles.headerSub}>
                {filtered.length} {filtered.length === 1 ? 'borrower' : 'borrowers'}
              </Text>
            </View>

            {/* Search Bar */}
            <View style={styles.searchSection}>
              <View style={styles.searchBar}>
                <MaterialCommunityIcons name="magnify" size={20} color={EL.onSurfaceMuted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder={t('borrowers.search_placeholder') ?? 'Search borrowers...'}
                  placeholderTextColor={EL.outlineVariant}
                  value={query}
                  onChangeText={setQuery}
                  returnKeyType="search"
                  autoCorrect={false}
                  autoCapitalize="none"
                />
                {query.length > 0 ? (
                  <Pressable onPress={() => setQuery('')} hitSlop={8} style={styles.searchAction}>
                    <MaterialCommunityIcons name="close-circle" size={18} color={EL.onSurfaceMuted} />
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={voice.isListening ? voice.stopListening : voice.startListening}
                    hitSlop={8}
                    style={[
                      styles.searchAction,
                      styles.micBtn,
                      voice.isListening && styles.micBtnActive,
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={voice.isListening ? 'microphone' : 'microphone-outline'}
                      size={18}
                      color={voice.isListening ? EL.white : EL.primary}
                    />
                  </Pressable>
                )}
              </View>
            </View>

            {/* Filter Chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
              style={styles.filterScroll}
            >
              {filters.map((f) => {
                const isActive = activeFilter === f.key;
                return (
                  <Pressable
                    key={f.key}
                    onPress={() => setActiveFilter(f.key)}
                    style={[
                      styles.chip,
                      isActive ? styles.chipActive : styles.chipInactive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        isActive ? styles.chipTextActive : styles.chipTextInactive,
                      ]}
                    >
                      {f.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Loading / Empty states */}
            {isLoading ? (
              <View style={{ marginTop: Space.md, paddingHorizontal: Space.xxl }}>
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </View>
            ) : filtered.length === 0 ? (
              <ELCard style={{ margin: Space.xxl }}>
                <Text style={Type.titleMd}>{t('borrowers.empty_title')}</Text>
                <Text style={[Type.bodySm, { marginTop: Space.xs }]}>
                  {t('borrowers.empty_sub')}
                </Text>
              </ELCard>
            ) : null}
          </>
        }
      />

      {/* FAB */}
      <Pressable
        style={styles.fab}
        onPress={() => navigation.navigate('BorrowerEdit', {})}
      >
        <MaterialCommunityIcons name="plus" size={28} color={EL.white} />
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  /* ── Header ── */
  header: {
    paddingHorizontal: Space.xxl,
    paddingTop: Space.lg,
    paddingBottom: Space.md,
  },
  headerTitle: {
    fontFamily: Fonts.headline,
    fontSize: 26,
    fontWeight: '800',
    color: EL.onSurface,
    letterSpacing: -0.5,
  },
  headerSub: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: EL.onSurfaceSec,
    marginTop: 2,
  },

  /* ── Search ── */
  searchSection: {
    paddingHorizontal: Space.xxl,
    marginTop: Space.lg,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.pill,
    paddingLeft: Space.lg,
    paddingRight: Space.sm,
    height: 48,
    gap: Space.sm,
    ...Shadows.card,
  },
  searchInput: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: 15,
    fontWeight: '500',
    color: EL.onSurface,
    paddingVertical: 0,
    height: '100%',
  },
  searchAction: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micBtn: {
    backgroundColor: 'rgba(0, 105, 72, 0.08)',
  },
  micBtnActive: {
    backgroundColor: EL.primary,
  },

  /* ── Filter Chips ── */
  filterScroll: {
    marginTop: Space.xxl,
    marginBottom: Space.xxl,
  },
  filterRow: {
    paddingHorizontal: Space.xxl,
    gap: Space.md,
  },
  chip: {
    paddingHorizontal: Space.xl,
    paddingVertical: 10,
    borderRadius: Radii.pill,
  },
  chipActive: {
    backgroundColor: EL.primary,
    shadowColor: 'rgba(0, 105, 72, 0.2)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 3,
  },
  chipInactive: {
    backgroundColor: EL.surfaceHighest,
  },
  chipText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    fontWeight: '600',
  },
  chipTextActive: {
    color: EL.white,
  },
  chipTextInactive: {
    color: EL.onSurfaceSec,
  },

  /* ── Section Header (line-wise grouping) ── */
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    paddingHorizontal: Space.xxl,
    paddingTop: Space.lg,
    paddingBottom: Space.sm,
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: '700',
    color: EL.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    flex: 1,
  },
  sectionHeaderCount: {
    fontSize: 11,
    fontWeight: '600',
    color: EL.onSurfaceMuted,
  },

  /* ── Borrower Card ── */
  card: {
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.lg,
    padding: Space.lg,
    marginHorizontal: Space.xxl,
    marginBottom: Space.md,
    ...Shadows.card,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardStats: {
    flexDirection: 'row',
    marginTop: Space.md,
    paddingTop: Space.md,
    borderTopWidth: 1,
    borderTopColor: EL.surfaceHighest,
    gap: Space.lg,
  },
  cardStat: {
    flex: 1,
  },
  cardStatLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: EL.onSurfaceMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardStatValue: {
    fontSize: 14,
    fontWeight: '700',
    color: EL.onSurface,
    marginTop: 2,
  },
  cardPressed: {
    backgroundColor: EL.surfaceLow,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: Space.lg,
  },
  cardBody: {
    flex: 1,
  },
  cardName: {
    fontFamily: Fonts.body,
    fontSize: 16,
    fontWeight: '700',
    color: EL.onSurface,
    lineHeight: 20,
  },
  cardPhone: {
    fontFamily: Fonts.body,
    fontSize: 14,
    fontWeight: '500',
    color: EL.outlineVariant,
    marginTop: 2,
  },
  cardEmi: {
    fontSize: 13,
    fontWeight: '500',
    color: EL.primary,
    marginTop: 2,
  },
  cardRight: {
    alignItems: 'flex-end',
    gap: Space.sm,
  },
  cardStars: {
    // star-glow effect approximation
    shadowColor: EL.starAmber,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 2,
  },

  /* ── FAB ── */
  fab: {
    position: 'absolute',
    right: Space.xxl,
    bottom: 112,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: EL.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(0, 105, 72, 0.4)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 6,
  },
});
