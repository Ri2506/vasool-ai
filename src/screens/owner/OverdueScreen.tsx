import React from 'react';
import { FlatList, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Avatar } from '@/components/common/Avatar';
import { Badge } from '@/components/common/Badge';
import { ELCard } from '@/components/common/ELCard';
import { EL, Common, Radii, Shadows, Space, Type } from '@/theme/emeraldLedger';
import { openDb } from '@/db';
import { useAuthStore } from '@/store/authStore';
import { formatRupees, formatDateShort } from '@/utils/format';
import type { OwnerStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<OwnerStackParamList>;

interface OverdueItem {
  borrower_id: string;
  borrower_name: string;
  borrower_phone: string | null;
  loan_id: string;
  days_overdue: number;
  amount_owed: number;
  last_payment_date: number | null;
}

async function getOverdueList(orgId: string): Promise<OverdueItem[]> {
  const db = await openDb();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();

  return db.getAllAsync<OverdueItem>(
    `SELECT
       b.id AS borrower_id,
       b.name AS borrower_name,
       b.phone AS borrower_phone,
       l.id AS loan_id,
       CAST((? - MIN(pe.due_date)) / 86400000 AS INTEGER) AS days_overdue,
       COALESCE(SUM(pe.expected_amount), 0) AS amount_owed,
       (SELECT MAX(c.collected_at) FROM collections c WHERE c.loan_id = l.id) AS last_payment_date
     FROM plan_entries pe
     JOIN loans l ON l.id = pe.loan_id
     JOIN borrowers b ON b.id = l.borrower_id
     WHERE l.org_id = ?
       AND l.status = 'active'
       AND pe.status IN ('pending', 'partial')
       AND pe.due_date < ?
     GROUP BY l.id
     ORDER BY days_overdue DESC`,
    [todayMs, orgId, todayMs]
  );
}

export function OverdueScreen() {
  const navigation = useNavigation<Nav>();
  const orgId = useAuthStore((s) => s.user?.orgId ?? null);

  const { data: items, isLoading } = useQuery({
    queryKey: ['overdue', orgId],
    enabled: !!orgId,
    queryFn: () => getOverdueList(orgId!),
  });

  const renderItem = ({ item }: { item: OverdueItem }) => (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: EL.surfaceLow }]}
      onPress={() => navigation.navigate('BorrowerDetail', { id: item.borrower_id })}
    >
      <Avatar name={item.borrower_name} />
      <View style={styles.rowBody}>
        <Text style={styles.rowName}>{item.borrower_name}</Text>
        <Text style={styles.rowSub}>
          {item.days_overdue} days overdue \u2022 {formatRupees(item.amount_owed)} owed
        </Text>
        {item.last_payment_date ? (
          <Text style={styles.rowSub}>
            Last paid: {formatDateShort(new Date(item.last_payment_date))}
          </Text>
        ) : null}
      </View>
      <Badge
        label={`${item.days_overdue}d`}
        variant={item.days_overdue >= 7 ? 'danger' : 'warn'}
      />
    </Pressable>
  );

  return (
    <SafeAreaView style={Common.screen}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.title}>Overdue</Text>
          <Pressable
            style={styles.nippuLink}
            onPress={() => navigation.navigate('NippuReport')}
          >
            <Text style={styles.nippuLinkText}>{'\u0BA8\u0BBF\u0BAA\u0BCD\u0BAA\u0BC1'} Report</Text>
            <MaterialCommunityIcons name="chevron-right" size={16} color={EL.nippu} />
          </Pressable>
        </View>
        <Text style={styles.sub}>Borrowers with missed payments</Text>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={Type.bodySm}>Loading...</Text>
        </View>
      ) : items && items.length > 0 ? (
        <>
          {/* Aging buckets */}
          <ELCard style={styles.bucketsCard}>
            {[
              { label: '1-3 days', min: 1, max: 3 },
              { label: '4-7 days', min: 4, max: 7 },
              { label: '8-14 days', min: 8, max: 14 },
              { label: '15-30 days', min: 15, max: 30 },
              { label: '30+ days', min: 31, max: 9999 },
            ].map((bucket) => {
              const inBucket = items.filter(
                (i) => i.days_overdue >= bucket.min && i.days_overdue <= bucket.max
              );
              if (inBucket.length === 0) return null;
              const total = inBucket.reduce((s, i) => s + Number(i.amount_owed), 0);
              return (
                <View key={bucket.label} style={styles.bucketRow}>
                  <Text style={styles.bucketLabel}>{bucket.label}</Text>
                  <View style={styles.bucketCount}>
                    <Text style={styles.bucketCountText}>{inBucket.length}</Text>
                  </View>
                  <Text style={styles.bucketAmount}>{formatRupees(total)}</Text>
                </View>
              );
            })}
          </ELCard>

          <FlatList
            data={items}
            keyExtractor={(item) => item.loan_id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: 40 }}
          />
        </>
      ) : (
        <ELCard style={{ margin: Space.xl, alignItems: 'center', paddingVertical: Space.xxxl }}>
          <View style={styles.emptyIcon}>
            <MaterialCommunityIcons name="check-circle-outline" size={40} color={EL.primary} />
          </View>
          <Text style={[Type.titleMd, { marginTop: Space.md }]}>No overdue borrowers</Text>
          <Text style={[Type.bodySm, { marginTop: Space.xs }]}>All payments are on schedule</Text>
        </ELCard>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: Space.xl,
    paddingTop: Space.lg,
    paddingBottom: Space.md,
  },
  title: { ...Type.displayMd, color: EL.nippu },
  sub: { ...Type.bodySm, color: EL.onSurfaceSec, marginTop: 2 },

  // Buckets
  bucketsCard: {
    marginHorizontal: Space.xl,
    marginBottom: Space.lg,
  },
  bucketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Space.sm,
  },
  bucketLabel: { ...Type.bodyMd, color: EL.onSurfaceSec, flex: 1 },
  bucketCount: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: EL.nippuContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Space.md,
  },
  bucketCountText: { ...Type.labelMd, color: EL.nippu, fontWeight: '700' },
  bucketAmount: { ...Type.labelLg, color: EL.nippu, fontWeight: '700', width: 100, textAlign: 'right' },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Space.xl,
    paddingVertical: Space.lg,
    backgroundColor: EL.surfaceCard,
    marginHorizontal: Space.xl,
    marginBottom: Space.sm,
    borderRadius: Radii.lg,
    ...Shadows.card,
  },
  rowBody: { flex: 1, marginLeft: Space.md },
  rowName: { ...Type.titleMd, color: EL.onSurface },
  rowSub: { ...Type.bodySm, color: EL.onSurfaceMuted, marginTop: 2 },

  // Empty
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: EL.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Nippu link
  nippuLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xs,
    backgroundColor: EL.nippuContainer,
    paddingHorizontal: Space.md,
    paddingVertical: Space.sm,
    borderRadius: Radii.pill,
  },
  nippuLinkText: {
    ...Type.labelMd,
    color: EL.nippu,
    fontWeight: '700',
  },
});
