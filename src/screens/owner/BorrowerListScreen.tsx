import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Avatar } from '@/components/common/Avatar';
import { SkeletonRow } from '@/components/common/Skeleton';
import { VoiceButton } from '@/components/common/VoiceButton';
import { useVoice } from '@/hooks/useVoice';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Colors } from '@/constants/colors';
import { Radius, Spacing, TouchTarget, Typography } from '@/constants/typography';
import { useBorrowers } from '@/hooks/useBorrowers';
import { useBorrowerStatuses } from '@/hooks/useBorrowerStatus';
import type { BorrowerRow } from '@/db/types';
import type { OwnerStackParamList } from '@/navigation/types';

// BorrowerListScreen is mounted as a TAB screen (no navigation prop passed
// through the stack). We grab the parent stack's navigation via
// useNavigation so we can push BorrowerDetail / BorrowerEdit on top.
type Nav = NativeStackNavigationProp<OwnerStackParamList>;

export function BorrowerListScreen() {
  const navigation = useNavigation<Nav>();
  const voice = useVoice();
  const { t } = useTranslation();
  const { data: borrowers, isLoading, refetch, isRefetching } = useBorrowers();
  const { data: statuses } = useBorrowerStatuses();
  const [query, setQuery] = useState('');

  // When voice recognizes text, use it as search query
  useEffect(() => {
    if (voice.lastResult?.text) {
      setQuery(voice.lastResult.text);
    }
  }, [voice.lastResult]);

  const filtered = useMemo(() => {
    if (!borrowers) return [];
    const q = query.trim().toLowerCase();
    if (!q) return borrowers;
    return borrowers.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        (b.phone ?? '').toLowerCase().includes(q)
    );
  }, [borrowers, query]);

  const renderItem = ({ item }: { item: BorrowerRow }) => {
    const st = statuses?.[item.id];
    const stars = st?.rating ? '★'.repeat(st.rating) + '☆'.repeat(5 - st.rating) : '';
    return (
      <Pressable
        onPress={() => navigation.navigate('BorrowerDetail', { id: item.id })}
        style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
      >
        <Avatar name={item.name} />
        <View style={styles.rowText}>
          <View style={styles.nameRow}>
            <Text style={styles.rowName}>{item.name}</Text>
            {st?.is_nippu !== undefined ? (
              <View style={[styles.statusDot, { backgroundColor: st.is_nippu ? Colors.danger : Colors.primary }]} />
            ) : null}
          </View>
          {item.phone ? <Text style={styles.rowSub}>{item.phone}</Text> : null}
          {stars ? <Text style={styles.stars}>{stars}</Text> : null}
        </View>
        {st?.is_nippu ? (
          <Text style={styles.nippuLabel}>{t('borrowers.overdue')}</Text>
        ) : st?.rating ? (
          <Text style={styles.nadapuLabel}>{t('borrowers.on_schedule')}</Text>
        ) : null}
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('borrowers.title')}</Text>
      </View>
      <View style={styles.searchWrap}>
        <View style={styles.searchRow}>
          <TextInput
            style={[styles.search, { flex: 1 }]}
            placeholder={t('borrowers.search_placeholder') ?? ''}
            placeholderTextColor={Colors.textMuted}
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

      {isLoading ? (
        <View style={{ marginTop: Spacing.md }}>
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </View>
      ) : filtered.length === 0 ? (
        <Card style={{ margin: Spacing.xl }}>
          <Text style={styles.emptyTitle}>{t('borrowers.empty_title')}</Text>
          <Text style={styles.emptySub}>{t('borrowers.empty_sub')}</Text>
        </Card>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 120 }}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
        />
      )}

      <View style={styles.fab}>
        <Button
          title={'+ ' + t('borrowers.add')}
          onPress={() => navigation.navigate('BorrowerEdit', {})}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  title: { ...Typography.display, color: Colors.text },
  searchWrap: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  search: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.button,
    paddingHorizontal: Spacing.md,
    minHeight: TouchTarget.min,
    ...Typography.body,
    color: Colors.text,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.white,
    minHeight: TouchTarget.min + 12,
  },
  rowText: { flex: 1, marginLeft: Spacing.md },
  rowName: { ...Typography.title, color: Colors.text },
  rowSub: { ...Typography.caption, color: Colors.textSec, marginTop: 2 },
  sep: { height: 1, backgroundColor: Colors.border, marginLeft: 72 },
  emptyTitle: { ...Typography.title, color: Colors.text },
  emptySub: { ...Typography.body, color: Colors.textSec, marginTop: 4 },
  fab: {
    position: 'absolute',
    left: Spacing.xl,
    right: Spacing.xl,
    bottom: Spacing.xl,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginLeft: 6 },
  stars: { ...Typography.caption, color: Colors.warn, marginTop: 2, letterSpacing: 1 },
  nippuLabel: { ...Typography.caption, color: Colors.danger, fontWeight: '700' },
  nadapuLabel: { ...Typography.caption, color: Colors.primary, fontWeight: '600' },
});
