import React from 'react';
import { FlatList, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Avatar } from '@/components/common/Avatar';
import { ELCard } from '@/components/common/ELCard';
import { EL, Common, Radii, Space, Type } from '@/theme/emeraldLedger';
import { getOutstandingReport, type OutstandingRow } from '@/db/repos/reports';
import { useAuthStore } from '@/store/authStore';
import { formatRupees } from '@/utils/format';
import type { OwnerStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<OwnerStackParamList>;

export function OutstandingReportScreen() {
  const navigation = useNavigation<Nav>();
  const orgId = useAuthStore((s) => s.user?.orgId ?? null);
  const { data } = useQuery({
    queryKey: ['report', 'outstanding', orgId],
    enabled: !!orgId,
    queryFn: () => getOutstandingReport(orgId!),
  });

  const totalOutstanding = data?.reduce((s, r) => s + r.outstanding, 0) ?? 0;

  const renderItem = ({ item }: { item: OutstandingRow }) => (
    <Pressable
      onPress={() => navigation.navigate('BorrowerDetail', { id: item.borrower_id })}
    >
      <ELCard style={styles.card}>
        <View style={styles.cardRow}>
          <Avatar name={item.borrower_name} size={40} />
          <View style={styles.cardBody}>
            <Text style={styles.name}>{item.borrower_name}</Text>
            <Text style={styles.meta}>
              Paid {formatRupees(item.total_paid)} of {formatRupees(item.total_repayment)}
            </Text>
          </View>
          <View style={styles.amountCol}>
            <Text style={styles.outstandingAmount}>{formatRupees(item.outstanding)}</Text>
            <Text style={styles.outstandingLabel}>due</Text>
          </View>
        </View>
      </ELCard>
    </Pressable>
  );

  return (
    <SafeAreaView style={Common.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Outstanding</Text>
        <Text style={styles.sub}>Borrower-wise balance due</Text>
      </View>

      {/* Total banner */}
      <View style={styles.totalBanner}>
        <Text style={styles.totalLabel}>TOTAL OUTSTANDING</Text>
        <Text style={styles.totalValue}>{formatRupees(totalOutstanding)}</Text>
      </View>

      {data && data.length > 0 ? (
        <FlatList
          data={data}
          keyExtractor={(item) => item.loan_id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: Space.lg, paddingBottom: 100 }}
        />
      ) : (
        <ELCard style={{ margin: Space.xl }}>
          <Text style={Type.bodySm}>No outstanding loans. All borrowers are either fully paid or no active loans exist.</Text>
        </ELCard>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { padding: Space.xl, paddingBottom: Space.md },
  title: { ...Type.displaySm },
  sub: { ...Type.bodySm, color: EL.onSurfaceSec, marginTop: 2 },
  totalBanner: {
    marginHorizontal: Space.xl,
    backgroundColor: EL.surfaceLow,
    borderRadius: Radii.lg,
    padding: Space.xl,
    alignItems: 'center',
    marginBottom: Space.md,
  },
  totalLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: EL.onSurfaceSec,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  totalValue: {
    fontSize: 32,
    fontWeight: '800',
    color: EL.nippu,
    marginTop: Space.xs,
  },
  card: { marginBottom: Space.md },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  cardBody: { flex: 1, marginLeft: Space.md },
  name: { ...Type.titleMd, fontWeight: '700' },
  meta: { ...Type.bodySm, color: EL.onSurfaceSec, marginTop: 2 },
  amountCol: { alignItems: 'flex-end' },
  outstandingAmount: { fontSize: 16, fontWeight: '800', color: EL.nippu },
  outstandingLabel: { fontSize: 10, fontWeight: '600', color: EL.onSurfaceMuted, textTransform: 'uppercase' },
});
