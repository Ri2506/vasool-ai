import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
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
import { VoiceButton } from '@/components/common/VoiceButton';
import { ELCard } from '@/components/common/ELCard';
import { EL, Common, Radii, Shadows, Space, Touch, Type } from '@/theme/emeraldLedger';
import { useVoice } from '@/hooks/useVoice';
import { useBorrowers } from '@/hooks/useBorrowers';
import { useBorrowerStatuses } from '@/hooks/useBorrowerStatus';
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
    if (activeFilter === 'nippu') {
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
    return { all: borrowers.length, nippu, completed };
  }, [borrowers, statuses]);

  const filters: { key: FilterKey; label: string }[] = [
    { key: 'all', label: `All (${counts.all})` },
    { key: 'due_today', label: 'Due Today' },
    { key: 'nippu', label: `\u0BA8\u0BBF\u0BAA\u0BCD\u0BAA\u0BC1 (${counts.nippu})` },
    { key: 'completed', label: 'Completed' },
  ];

  const renderItem = ({ item }: { item: BorrowerRow }) => {
    const st = statuses?.[item.id];
    const borrowerStatus: BorrowerStatusType = st?.is_nippu ? 'nippu' : st?.rating ? 'nadapu' : 'none';
    return (
      <Pressable
        onPress={() => navigation.navigate('BorrowerDetail', { id: item.id })}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      >
        <View style={styles.cardLeft}>
          <Avatar name={item.name} photoUri={item.photo_url} size={44} />
          <View style={styles.cardBody}>
            <Text style={styles.cardName}>{item.name}</Text>
            {item.phone ? <Text style={styles.cardPhone}>{item.phone}</Text> : null}
            {st?.rating ? (
              <Text style={styles.cardEmi}>
                {st.rating ? `\u2605 ${st.rating.toFixed(1)}` : ''}
              </Text>
            ) : null}
          </View>
        </View>
        <View style={styles.cardRight}>
          <StatusBadge status={borrowerStatus} />
          {st?.rating ? (
            <View style={{ marginTop: Space.sm }}>
              <StarRating rating={st.rating} size={11} />
            </View>
          ) : null}
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={Common.screen}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
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
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>{t('borrowers.title')}</Text>
              <Pressable
                style={styles.headerIcon}
                onPress={() => { /* search focus handled by input below */ }}
              >
                <MaterialCommunityIcons name="magnify" size={24} color={EL.onSurface} />
              </Pressable>
            </View>

            {/* Search bar */}
            <View style={styles.searchWrap}>
              <View style={styles.searchBar}>
                <MaterialCommunityIcons name="magnify" size={20} color={EL.onSurfaceMuted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder={t('borrowers.search_placeholder') ?? 'Search borrowers...'}
                  placeholderTextColor={EL.onSurfaceMuted}
                  value={query}
                  onChangeText={setQuery}
                />
                <VoiceButton
                  isListening={voice.isListening}
                  onPress={voice.isListening ? voice.stopListening : voice.startListening}
                  lastText={null}
                />
              </View>
            </View>

            {/* Filter chips */}
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
                    <Text style={[
                      styles.chipText,
                      isActive ? styles.chipTextActive : styles.chipTextInactive,
                    ]}>
                      {f.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Loading / Empty states */}
            {isLoading ? (
              <View style={{ marginTop: Space.md, paddingHorizontal: Space.xl }}>
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </View>
            ) : filtered.length === 0 ? (
              <ELCard style={{ margin: Space.xl }}>
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
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Space.xl,
    paddingTop: Space.lg,
    paddingBottom: Space.md,
  },
  title: {
    ...Type.displayMd,
    color: EL.onSurface,
  },
  headerIcon: {
    width: Touch.min,
    height: Touch.min,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radii.pill,
  },

  // Search
  searchWrap: {
    paddingHorizontal: Space.xl,
    paddingBottom: Space.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.lg,
    paddingHorizontal: Space.lg,
    minHeight: Touch.min,
    ...Shadows.card,
  },
  searchInput: {
    flex: 1,
    ...Type.bodyMd,
    color: EL.onSurface,
    marginLeft: Space.sm,
    paddingVertical: Space.sm,
  },

  // Filter chips
  filterScroll: {
    marginBottom: Space.lg,
  },
  filterRow: {
    paddingHorizontal: Space.xl,
    gap: Space.sm,
  },
  chip: {
    paddingHorizontal: Space.xl,
    paddingVertical: 10,
    borderRadius: Radii.pill,
  },
  chipActive: {
    backgroundColor: EL.primary,
    ...Shadows.card,
  },
  chipInactive: {
    backgroundColor: EL.surfaceHigh,
  },
  chipText: {
    ...Type.labelMd,
    fontWeight: '600',
  },
  chipTextActive: {
    color: EL.white,
  },
  chipTextInactive: {
    color: EL.onSurfaceSec,
  },

  // Borrower card
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.lg,
    padding: Space.lg,
    marginHorizontal: Space.xl,
    marginBottom: Space.md,
    ...Shadows.card,
  },
  cardPressed: {
    backgroundColor: EL.surfaceLow,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cardBody: {
    flex: 1,
    marginLeft: Space.lg,
  },
  cardName: {
    ...Type.titleMd,
    color: EL.onSurface,
    fontWeight: '700',
  },
  cardPhone: {
    ...Type.bodySm,
    color: EL.onSurfaceMuted,
    marginTop: 2,
  },
  cardEmi: {
    ...Type.labelSm,
    color: EL.primary,
    fontWeight: '600',
    marginTop: Space.xs,
  },
  cardRight: {
    alignItems: 'flex-end',
    gap: Space.sm,
  },

  // FAB
  fab: {
    ...Common.fab,
  },
});
