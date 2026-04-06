import React from 'react';
import { FlatList, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Avatar } from '@/components/common/Avatar';
import { Badge } from '@/components/common/Badge';
import { Card } from '@/components/common/Card';
import { Colors } from '@/constants/colors';
import { Spacing, TouchTarget, Typography } from '@/constants/typography';
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

  const { data: items } = useQuery({
    queryKey: ['overdue', orgId],
    enabled: !!orgId,
    queryFn: () => getOverdueList(orgId!),
  });

  const renderItem = ({ item }: { item: OverdueItem }) => (
    <Pressable
      style={styles.row}
      onPress={() => navigation.navigate('BorrowerDetail', { id: item.borrower_id })}
    >
      <Avatar name={item.borrower_name} />
      <View style={styles.rowBody}>
        <Text style={styles.rowName}>{item.borrower_name}</Text>
        <Text style={styles.rowSub}>
          {item.days_overdue} days overdue • {formatRupees(item.amount_owed)} owed
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
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Overdue</Text>
        <Text style={styles.sub}>Borrowers with missed payments</Text>
      </View>

      {items && items.length > 0 ? (
        <FlatList
          data={items}
          keyExtractor={(item) => item.loan_id}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      ) : (
        <Card style={{ margin: Spacing.xl }}>
          <Text style={styles.emptyText}>No overdue borrowers</Text>
        </Card>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: { padding: Spacing.xl, paddingBottom: Spacing.md },
  title: { ...Typography.display, color: Colors.danger },
  sub: { ...Typography.caption, color: Colors.textSec, marginTop: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.white,
    minHeight: TouchTarget.min + 12,
  },
  rowBody: { flex: 1, marginLeft: Spacing.md },
  rowName: { ...Typography.title, color: Colors.text },
  rowSub: { ...Typography.caption, color: Colors.textSec, marginTop: 2 },
  sep: { height: 1, backgroundColor: Colors.border, marginLeft: 72 },
  emptyText: { ...Typography.body, color: Colors.textSec },
});
