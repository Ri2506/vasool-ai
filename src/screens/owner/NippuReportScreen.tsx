import React from 'react';
import {
  FlatList,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Avatar } from '@/components/common/Avatar';
import { ELCard } from '@/components/common/ELCard';
import { GradientButton } from '@/components/common/GradientButton';
import { EL, Common, Radii, Shadows, Space, Type } from '@/theme/emeraldLedger';
import { openDb } from '@/db';
import { useAuthStore } from '@/store/authStore';
import { formatRupees } from '@/utils/format';
import type { OwnerStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<OwnerStackParamList>;

interface NippuItem {
  borrower_id: string;
  borrower_name: string;
  borrower_phone: string | null;
  loan_id: string;
  days_overdue: number;
  amount_owed: number;
}

interface AgingBucket {
  label: string;
  min: number;
  max: number;
  count: number;
  total: number;
}

async function getNippuList(orgId: string): Promise<NippuItem[]> {
  const db = await openDb();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();

  return db.getAllAsync<NippuItem>(
    `SELECT
       b.id AS borrower_id,
       b.name AS borrower_name,
       b.phone AS borrower_phone,
       l.id AS loan_id,
       CAST((? - MIN(pe.due_date)) / 86400000 AS INTEGER) AS days_overdue,
       COALESCE(SUM(pe.expected_amount), 0) AS amount_owed
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

export function NippuReportScreen() {
  const navigation = useNavigation<Nav>();
  const orgId = useAuthStore((s) => s.user?.orgId ?? null);

  const { data: items = [] } = useQuery({
    queryKey: ['nippu-report', orgId],
    enabled: !!orgId,
    queryFn: () => getNippuList(orgId!),
  });

  // Compute aging buckets
  const buckets: AgingBucket[] = [
    { label: '1-3 Days', min: 1, max: 3, count: 0, total: 0 },
    { label: '4-7 Days', min: 4, max: 7, count: 0, total: 0 },
    { label: '8-14 Days', min: 8, max: 14, count: 0, total: 0 },
    { label: '15-30 Days', min: 15, max: 30, count: 0, total: 0 },
    { label: '30+ Days', min: 31, max: 99999, count: 0, total: 0 },
  ];
  for (const item of items) {
    for (const b of buckets) {
      if (item.days_overdue >= b.min && item.days_overdue <= b.max) {
        b.count++;
        b.total += Number(item.amount_owed);
        break;
      }
    }
  }

  const handleSendReminder = (item: NippuItem) => {
    if (!item.borrower_phone) return;
    const msg = `Hi ${item.borrower_name}, your payment of ${formatRupees(item.amount_owed)} is overdue by ${item.days_overdue} days. Please pay at the earliest. - VasoolAI`;
    Linking.openURL(`https://wa.me/91${item.borrower_phone}?text=${encodeURIComponent(msg)}`);
  };

  const renderItem = ({ item }: { item: NippuItem }) => (
    <ELCard style={styles.borrowerCard}>
      {/* Nippu badge */}
      <View style={styles.nippuBadge}>
        <Text style={styles.nippuBadgeText}>NIPPU / {'\u0BA8\u0BBF\u0BAA\u0BCD\u0BAA\u0BC1'}</Text>
      </View>

      {/* Borrower info */}
      <View style={styles.borrowerRow}>
        <Avatar name={item.borrower_name} size={56} />
        <View style={styles.borrowerInfo}>
          <Text style={styles.borrowerName}>{item.borrower_name}</Text>
          {item.borrower_phone ? (
            <Text style={styles.borrowerPhone}>{item.borrower_phone}</Text>
          ) : null}
        </View>
      </View>

      {/* Stats grid */}
      <View style={styles.statsGrid}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>OVERDUE AMOUNT</Text>
          <Text style={styles.statValue}>{formatRupees(item.amount_owed)}</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: 'rgba(186, 85, 81, 0.06)' }]}>
          <Text style={styles.statLabel}>DAYS OVERDUE</Text>
          <Text style={styles.statValue}>{item.days_overdue} Days</Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actionRow}>
        <GradientButton
          title="Send Reminder"
          onPress={() => handleSendReminder(item)}
          style={{ flex: 1 }}
        />
        {item.borrower_phone ? (
          <Pressable
            style={styles.callBtn}
            onPress={() => Linking.openURL(`tel:${item.borrower_phone}`)}
          >
            <MaterialCommunityIcons name="phone" size={20} color={EL.nippu} />
          </Pressable>
        ) : null}
      </View>
    </ELCard>
  );

  return (
    <SafeAreaView style={Common.screen}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.loan_id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: Space.xl, paddingBottom: 40 }}
        ListHeaderComponent={
          <>
            {/* Title */}
            <View style={styles.header}>
              <Text style={styles.title}>{'\u0BA8\u0BBF\u0BAA\u0BCD\u0BAA\u0BC1'} Report</Text>
              <Text style={styles.subtitle}>Overdue Portfolio Analysis</Text>
            </View>

            {/* Aging Buckets — horizontal scroll */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.bucketsRow}
              style={styles.bucketsScroll}
            >
              {buckets.filter(b => b.count > 0).map((bucket) => (
                <View key={bucket.label} style={styles.bucketCard}>
                  <Text style={styles.bucketLabel}>{bucket.label}</Text>
                  <View style={styles.bucketNumbers}>
                    <Text style={styles.bucketCount}>{bucket.count}</Text>
                    <Text style={styles.bucketCountSub}>borrowers</Text>
                  </View>
                  <Text style={styles.bucketTotal}>{formatRupees(bucket.total)}</Text>
                </View>
              ))}
              {buckets.every(b => b.count === 0) ? (
                <View style={[styles.bucketCard, { width: 200 }]}>
                  <Text style={styles.bucketLabel}>No overdue</Text>
                  <MaterialCommunityIcons name="check-circle" size={28} color={EL.primary} />
                </View>
              ) : null}
            </ScrollView>

            {/* Section header */}
            {items.length > 0 ? (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Worst Offenders</Text>
                <View style={styles.sortBadge}>
                  <Text style={styles.sortBadgeText}>Sorted: Longest Overdue</Text>
                </View>
              </View>
            ) : null}
          </>
        }
        ListEmptyComponent={
          <ELCard style={{ alignItems: 'center', paddingVertical: Space.xxxl }}>
            <MaterialCommunityIcons name="check-circle-outline" size={48} color={EL.primary} />
            <Text style={[Type.titleMd, { marginTop: Space.md }]}>No overdue borrowers</Text>
            <Text style={[Type.bodySm, { marginTop: Space.xs }]}>All payments are on schedule</Text>
          </ELCard>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Header
  header: {
    marginBottom: Space.lg,
  },
  title: {
    ...Type.displayLg,
    color: EL.nippu,
    fontSize: 28,
  },
  subtitle: {
    ...Type.bodyMd,
    color: EL.onSurfaceSec,
    fontWeight: '500',
    marginTop: Space.xs,
  },

  // Aging buckets
  bucketsScroll: {
    marginHorizontal: -Space.xl,
    marginBottom: Space.xxl,
  },
  bucketsRow: {
    paddingHorizontal: Space.xl,
    gap: Space.md,
  },
  bucketCard: {
    width: 176,
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.lg,
    padding: Space.xl,
    borderLeftWidth: 4,
    borderLeftColor: EL.nippu,
    ...Shadows.card,
  },
  bucketLabel: {
    ...Type.labelMd,
    color: EL.onSurfaceSec,
    fontWeight: '600',
    marginBottom: Space.sm,
  },
  bucketNumbers: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Space.xs,
  },
  bucketCount: {
    ...Type.displaySm,
    fontWeight: '800',
  },
  bucketCountSub: {
    ...Type.labelSm,
    color: EL.onSurfaceSec,
  },
  bucketTotal: {
    ...Type.titleMd,
    color: EL.nippu,
    fontWeight: '700',
    marginTop: Space.xs,
  },

  // Section
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: Space.xl,
  },
  sectionTitle: {
    ...Type.titleLg,
    fontWeight: '700',
  },
  sortBadge: {
    backgroundColor: EL.nippuContainer,
    paddingHorizontal: Space.md,
    paddingVertical: Space.xs,
    borderRadius: Radii.pill,
  },
  sortBadgeText: {
    ...Type.labelSm,
    color: EL.nippu,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontSize: 10,
  },

  // Borrower card
  borrowerCard: {
    marginBottom: Space.lg,
    position: 'relative',
    overflow: 'hidden',
  },
  nippuBadge: {
    position: 'absolute',
    top: Space.lg,
    right: Space.lg,
    backgroundColor: '#ba5551',
    paddingHorizontal: Space.md,
    paddingVertical: Space.xs,
    borderRadius: Radii.pill,
    zIndex: 1,
  },
  nippuBadgeText: {
    ...Type.labelSm,
    color: EL.white,
    fontWeight: '700',
    fontSize: 10,
    letterSpacing: -0.3,
  },
  borrowerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.lg,
    marginBottom: Space.lg,
    paddingRight: 100, // room for badge
  },
  borrowerInfo: {
    flex: 1,
  },
  borrowerName: {
    ...Type.titleLg,
    fontWeight: '700',
  },
  borrowerPhone: {
    ...Type.bodySm,
    color: EL.onSurfaceSec,
    marginTop: 2,
  },

  // Stats
  statsGrid: {
    flexDirection: 'row',
    gap: Space.md,
    marginBottom: Space.lg,
  },
  statBox: {
    flex: 1,
    backgroundColor: EL.surfaceLow,
    borderRadius: Radii.md,
    padding: Space.lg,
  },
  statLabel: {
    ...Type.labelSm,
    color: EL.onSurfaceSec,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Space.xs,
    fontSize: 10,
  },
  statValue: {
    ...Type.displaySm,
    color: EL.nippu,
    fontWeight: '800',
    fontSize: 20,
  },

  // Actions
  actionRow: {
    flexDirection: 'row',
    gap: Space.md,
  },
  callBtn: {
    width: 48,
    height: 48,
    borderRadius: Radii.md,
    backgroundColor: EL.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
