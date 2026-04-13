import React, { useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { CommonActions, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { EL, Common, Glass, Radii, Shadows, Space, Fonts } from '@/theme/emeraldLedger';
import { useDueToday, useRecordCollection, useTodaySummary } from '@/hooks/useCollections';
import { useMyLoanRequests } from '@/hooks/useLoanRequests';
import { formatDateShort } from '@/utils/format';
import { useAuthStore } from '@/store/authStore';
import { formatRupees } from '@/utils/format';
import type { DueTodayItem } from '@/db/repos/collections';
import type { AgentStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<AgentStackParamList>;

export function AgentHomeScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const { data: items = [], refetch } = useDueToday();
  const { data: summary } = useTodaySummary();
  const { data: myRequests } = useMyLoanRequests();
  // Show only the latest 3 unresolved + recent decisions so the home
  // doesn't get noisy. Most recent first.
  const visibleRequests = (myRequests ?? []).slice(0, 4);
  const recordMut = useRecordCollection();
  const [pendingIds, setPendingIds] = React.useState<Set<string>>(new Set());
  const [showProfile, setShowProfile] = useState(false);

  const total = items.length + (summary?.collectionCount ?? 0);
  const done = summary?.collectionCount ?? 0;
  const progress = total > 0 ? done / total : 0;
  const progressPct = Math.round(progress * 100);
  const targetAmount = (summary?.totalCollected ?? 0) + (summary?.totalExpected ?? 0);

  const handleQuickCollect = async (item: DueTodayItem) => {
    if (pendingIds.has(item.plan_entry_id)) return;
    setPendingIds((prev) => new Set(prev).add(item.plan_entry_id));
    try {
      await recordMut.mutateAsync({
        loanId: item.loan_id,
        planEntryId: item.plan_entry_id,
        amount: item.expected_amount,
        expectedAmount: item.expected_amount,
        agentId: user?.id,
      });
      const alreadyPaid = Math.max(0, item.installment_number - 1) * item.loan_emi;
      const loanRemaining = Math.max(0, item.loan_principal - alreadyPaid - item.expected_amount);
      const totalDays = item.loan_emi > 0 ? Math.ceil(item.loan_principal / item.loan_emi) : 100;
      navigation.navigate('AgentReceipt', {
        borrowerName: item.borrower_name,
        amount: item.expected_amount,
        loanRemaining,
        daysPaid: item.installment_number,
        totalDays,
        agentName: user?.name,
        timestamp: Date.now(),
      });
    } catch (e: any) {
      Alert.alert(t('common.error_generic'), e?.message ?? '');
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.plan_entry_id);
        return next;
      });
    }
  };

  const renderItem = ({ item }: { item: DueTodayItem }) => (
    <View style={styles.borrowerCard}>
      <View style={styles.borrowerLeft}>
        <View style={styles.initialsBox}>
          <Text style={styles.initialsText}>
            {item.borrower_name
              .split(' ')
              .map((w) => w[0])
              .join('')
              .toUpperCase()
              .slice(0, 2)}
          </Text>
        </View>
        <View>
          <View style={styles.borrowerNameRow}>
            <Text style={styles.borrowerName}>{item.borrower_name}</Text>
            <View style={styles.nadapuPill}>
              <Text style={styles.nadapuText}>{'\u0BA8\u0B9F\u0BAA\u0BCD\u0BAA\u0BC1'}</Text>
            </View>
          </View>
          <Text style={styles.borrowerSub}>
            {formatRupees(item.expected_amount)} daily
          </Text>
        </View>
      </View>
      <Pressable
        onPress={() => handleQuickCollect(item)}
        disabled={pendingIds.has(item.plan_entry_id)}
        style={({ pressed }) => [
          styles.payBtn,
          pressed && { opacity: 0.9 },
          pendingIds.has(item.plan_entry_id) && { opacity: 0.5 },
        ]}
      >
        <MaterialCommunityIcons name="cash-multiple" size={24} color="#f5fff7" />
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
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor={EL.primary} />}
        ListHeaderComponent={
          <>
            {/* Header */}
            <View style={styles.headerRow}>
              <View style={styles.greetSection}>
                <Text style={styles.greetingText}>
                  Good morning, {user?.name ?? 'Agent'}
                </Text>
                <Text style={styles.greetingSub}>Ready for today's collections?</Text>
              </View>
              <View style={styles.headerRight}>
                <Pressable
                  style={styles.headerIconBtn}
                  onPress={() => Alert.alert('Notifications', 'No new notifications')}
                >
                  <MaterialCommunityIcons name="bell-outline" size={24} color={EL.onSurface} />
                </Pressable>
                <Pressable
                  style={styles.profileCircle}
                  onPress={() => setShowProfile(true)}
                >
                  <Text style={styles.profileInitial}>
                    {(user?.name ?? 'A')[0].toUpperCase()}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Today's Target Card */}
            <View style={styles.targetCard}>
              <View style={styles.targetTopRow}>
                <View>
                  <Text style={styles.targetLabel}>TODAY'S TARGET</Text>
                  <Text style={styles.targetAmount}>{formatRupees(targetAmount)}</Text>
                </View>
                <View style={styles.doneBadge}>
                  <Text style={styles.doneBadgeText}>{progressPct}% Done</Text>
                </View>
              </View>

              <View style={styles.targetStatsRow}>
                <Text style={styles.collectedText}>
                  {formatRupees(summary?.totalCollected ?? 0)} collected
                </Text>
                <Text style={styles.countText}>
                  {done} of {total}
                </Text>
              </View>

              {/* Progress bar */}
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progressPct}%` as any }]} />
              </View>
            </View>

            {/* Start Batch Collection CTA */}
            <Pressable
              style={({ pressed }) => [styles.batchBtn, pressed && { opacity: 0.95, transform: [{ scale: 0.98 }] }]}
              onPress={() => navigation.navigate('BatchCollect')}
            >
              <MaterialCommunityIcons name="lightning-bolt" size={22} color={EL.white} />
              <Text style={styles.batchBtnText}>Start Batch Collection</Text>
            </Pressable>

            {/* Due Today header */}
            {items.length > 0 && (
              <View style={styles.dueTodayHeader}>
                <Text style={styles.dueTodayTitle}>Due Today</Text>
                <Pressable onPress={() => navigation.navigate('BatchCollect')}>
                  <Text style={styles.viewAll}>View All</Text>
                </Pressable>
              </View>
            )}

            {/* Agent's own loan requests — shows approval / rejection
                feedback so they don't have to hassle the owner over the phone */}
            {visibleRequests.length > 0 ? (
              <View style={styles.reqWrap}>
                <Text style={styles.reqHeader}>My loan requests</Text>
                {visibleRequests.map((req) => {
                  const tone =
                    req.status === 'approved' ? EL.primary :
                    req.status === 'rejected' ? EL.tertiary :
                    req.status === 'cancelled' ? EL.onSurfaceMuted :
                    EL.warn;
                  const icon =
                    req.status === 'approved' ? 'check-decagram' :
                    req.status === 'rejected' ? 'close-circle' :
                    req.status === 'cancelled' ? 'minus-circle' :
                    'clock-outline';
                  return (
                    <View key={req.id} style={styles.reqCard}>
                      <View style={[styles.reqIcon, { backgroundColor: `${tone}1A` }]}>
                        <MaterialCommunityIcons name={icon} size={18} color={tone} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.reqName}>{req.borrower_name ?? 'Borrower'}</Text>
                        <Text style={styles.reqMeta}>
                          {formatRupees(req.disbursed_amount)} · {formatDateShort(new Date(req.created_at))}
                        </Text>
                        {req.rejection_reason ? (
                          <Text style={styles.reqReason}>Reason: {req.rejection_reason}</Text>
                        ) : null}
                      </View>
                      <View style={[styles.reqStatus, { backgroundColor: `${tone}1A` }]}>
                        <Text style={[styles.reqStatusText, { color: tone }]}>
                          {req.status.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : null}

            {items.length === 0 && (
              <View style={styles.emptyWrap}>
                <View style={styles.emptyIcon}>
                  <MaterialCommunityIcons name="check-all" size={48} color={EL.primary} />
                </View>
                <Text style={styles.emptyTitle}>All done!</Text>
                <Text style={styles.emptySub}>No more collections due today.</Text>
              </View>
            )}
          </>
        }
      />

      {/* Agent Profile / Logout Modal */}
      <Modal visible={showProfile} transparent animationType="slide" onRequestClose={() => setShowProfile(false)}>
        <Pressable style={styles.profileBackdrop} onPress={() => setShowProfile(false)}>
          <Pressable style={styles.profileSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.profileSheetHandle} />

            {/* Avatar + Name */}
            <View style={styles.profileHeader}>
              <View style={styles.profileAvatarLg}>
                <Text style={styles.profileInitialLg}>
                  {(user?.name ?? 'A')[0].toUpperCase()}
                </Text>
              </View>
              <Text style={styles.profileNameLg}>{user?.name ?? 'Agent'}</Text>
              <Text style={styles.profilePhoneLg}>{user?.phone ? `+91 ${user.phone}` : 'No phone'}</Text>
            </View>

            {/* Info rows */}
            <View style={styles.profileInfoSection}>
              <View style={styles.profileInfoRow}>
                <MaterialCommunityIcons name="account-outline" size={20} color={EL.onSurfaceSec} />
                <Text style={styles.profileInfoLabel}>Role</Text>
                <Text style={styles.profileInfoValue}>Collection Agent</Text>
              </View>
              <View style={styles.profileInfoRow}>
                <MaterialCommunityIcons name="domain" size={20} color={EL.onSurfaceSec} />
                <Text style={styles.profileInfoLabel}>Org</Text>
                <Text style={styles.profileInfoValue}>{user?.orgId ?? '-'}</Text>
              </View>
            </View>

            {/* Logout button */}
            <Pressable
              style={styles.logoutBtn}
              onPress={() => {
                setShowProfile(false);
                Alert.alert('Logout', 'Are you sure you want to logout?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Logout', style: 'destructive', onPress: signOut },
                ]);
              }}
            >
              <MaterialCommunityIcons name="logout" size={20} color={EL.tertiary} />
              <Text style={styles.logoutText}>Log Out</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* FAB — switch to Expenses tab */}
      <Pressable
        style={styles.fab}
        onPress={() => {
          // Dispatch a navigate action that targets the Expenses tab by name.
          // Works regardless of whether `navigation` is the tab or the stack
          // because React Navigation searches upward for a matching route.
          navigation.dispatch(CommonActions.navigate({ name: 'Expenses' }));
        }}
      >
        <MaterialCommunityIcons name="plus" size={28} color={EL.white} />
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Space.xl,
    paddingTop: Space.lg,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: EL.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: EL.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInitial: {
    fontFamily: Fonts.headline,
    fontSize: 16,
    fontWeight: '700',
    color: EL.white,
  },
  // Greeting
  greetSection: {
    flex: 1,
  },
  greetingText: {
    fontFamily: Fonts.headline,
    fontSize: 24,
    fontWeight: '800',
    color: EL.onSurface,
    letterSpacing: -0.3,
  },
  greetingSub: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: EL.onSurfaceSec,
    marginTop: Space.xs,
  },

  // Target Card
  targetCard: {
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.lg,
    padding: Space.xl,
    marginHorizontal: Space.xl,
    marginTop: Space.xl,
    ...Shadows.float,
  },
  targetTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Space.lg,
  },
  targetLabel: {
    fontFamily: Fonts.body,
    fontSize: 11,
    fontWeight: '600',
    color: EL.onSurfaceSec,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Space.xs,
  },
  targetAmount: {
    fontFamily: Fonts.headline,
    fontSize: 36,
    fontWeight: '800',
    color: EL.onSurface,
    letterSpacing: -1,
  },
  doneBadge: {
    backgroundColor: EL.primaryFixed,
    paddingHorizontal: Space.md,
    paddingVertical: Space.xs,
    borderRadius: Radii.pill,
  },
  doneBadgeText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    fontWeight: '700',
    color: EL.onPrimaryFixed,
  },
  targetStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Space.sm,
  },
  collectedText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    fontWeight: '700',
    color: EL.primary,
  },
  countText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    fontWeight: '500',
    color: EL.onSurfaceSec,
  },
  progressTrack: {
    height: 12,
    backgroundColor: EL.surfaceHighest,
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 6,
    backgroundColor: EL.primary,
  },

  // Batch CTA
  batchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: EL.primary,
    marginHorizontal: Space.xl,
    marginTop: Space.xl,
    paddingVertical: 18,
    borderRadius: Radii.md,
    gap: Space.md,
    shadowColor: 'rgba(0, 105, 72, 0.3)',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 6,
  },
  batchBtnText: {
    fontFamily: Fonts.headline,
    fontSize: 18,
    fontWeight: '700',
    color: EL.white,
  },

  // Due Today
  dueTodayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Space.xl + 2,
    marginTop: Space.xxl,
    marginBottom: Space.lg,
  },
  dueTodayTitle: {
    fontFamily: Fonts.headline,
    fontSize: 18,
    fontWeight: '700',
    color: EL.onSurface,
  },
  viewAll: {
    fontFamily: Fonts.body,
    fontSize: 14,
    fontWeight: '700',
    color: EL.primary,
  },

  // Borrower cards
  borrowerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.lg,
    padding: Space.xl,
    marginHorizontal: Space.xl,
    marginBottom: Space.lg,
  },
  borrowerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.lg,
  },
  initialsBox: {
    width: 48,
    height: 48,
    borderRadius: Radii.md,
    backgroundColor: EL.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    fontFamily: Fonts.headline,
    fontSize: 16,
    fontWeight: '700',
    color: EL.primary,
  },
  borrowerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
  },
  borrowerName: {
    fontFamily: Fonts.headline,
    fontSize: 15,
    fontWeight: '700',
    color: EL.onSurface,
  },
  nadapuPill: {
    backgroundColor: EL.primaryFixed,
    paddingHorizontal: Space.sm,
    paddingVertical: 2,
    borderRadius: Radii.pill,
  },
  nadapuText: {
    fontFamily: Fonts.body,
    fontSize: 10,
    fontWeight: '700',
    color: EL.onPrimaryFixed,
  },
  borrowerSub: {
    fontFamily: Fonts.body,
    fontSize: 14,
    fontWeight: '500',
    color: EL.onSurfaceSec,
    marginTop: 2,
  },
  payBtn: {
    backgroundColor: EL.primaryContainer,
    borderRadius: Radii.md,
    padding: Space.md,
  },

  // Empty
  reqWrap: {
    paddingHorizontal: Space.lg,
    paddingTop: Space.lg,
    gap: Space.sm,
  },
  reqHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: EL.onSurfaceMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  reqCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    padding: Space.md,
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.lg,
    ...Shadows.card,
  },
  reqIcon: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  reqName: { fontSize: 14, fontWeight: '800', color: EL.onSurface },
  reqMeta: { fontSize: 11, color: EL.onSurfaceMuted, marginTop: 2 },
  reqReason: { fontSize: 11, color: EL.tertiary, fontStyle: 'italic', marginTop: 2 },
  reqStatus: {
    paddingHorizontal: Space.sm,
    paddingVertical: 4,
    borderRadius: Radii.pill,
  },
  reqStatusText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },

  emptyWrap: {
    alignItems: 'center',
    padding: Space.xl,
    marginTop: Space.xxxl,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: EL.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Space.lg,
  },
  emptyTitle: {
    fontFamily: Fonts.headline,
    fontSize: 24,
    fontWeight: '700',
    color: EL.primary,
  },
  emptySub: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: EL.onSurfaceSec,
    marginTop: Space.xs,
  },

  // FAB
  fab: {
    position: 'absolute',
    right: Space.xxl,
    bottom: Space.xxl + 60,
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: EL.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.float,
  },

  // Profile modal
  profileBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  profileSheet: {
    backgroundColor: EL.surfaceCard,
    borderTopLeftRadius: Radii.xxl,
    borderTopRightRadius: Radii.xxl,
    paddingHorizontal: Space.xxl,
    paddingBottom: Space.xxxl + 16,
    paddingTop: Space.md,
    ...Shadows.float,
  },
  profileSheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: EL.outlineVariant,
    alignSelf: 'center',
    marginBottom: Space.xxl,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: Space.xxl,
  },
  profileAvatarLg: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: EL.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Space.md,
  },
  profileInitialLg: {
    fontFamily: Fonts.headline,
    fontSize: 28,
    fontWeight: '800',
    color: EL.white,
  },
  profileNameLg: {
    fontFamily: Fonts.headline,
    fontSize: 22,
    fontWeight: '700',
    color: EL.onSurface,
  },
  profilePhoneLg: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: EL.onSurfaceSec,
    marginTop: 2,
  },
  profileInfoSection: {
    backgroundColor: EL.surfaceLow,
    borderRadius: Radii.lg,
    padding: Space.lg,
    gap: Space.lg,
    marginBottom: Space.xxl,
  },
  profileInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
  },
  profileInfoLabel: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: EL.onSurfaceSec,
    flex: 1,
  },
  profileInfoValue: {
    fontFamily: Fonts.body,
    fontSize: 14,
    fontWeight: '600',
    color: EL.onSurface,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.sm,
    paddingVertical: Space.lg,
    borderRadius: Radii.md,
    borderWidth: 2,
    borderColor: 'rgba(155, 62, 59, 0.2)',
  },
  logoutText: {
    fontFamily: Fonts.headline,
    fontSize: 15,
    fontWeight: '700',
    color: EL.tertiary,
  },
});
