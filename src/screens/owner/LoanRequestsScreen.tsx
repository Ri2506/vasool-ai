// LoanRequestsScreen — owner reviews agent-submitted new-loan proposals.
//
// Each pending request shows: who proposed it, borrower details, full loan
// terms (disbursed, repayment type, interest rate, tenure, schedule
// preview), notes from the agent. Two actions: Approve (creates real
// loan) or Reject (with optional reason).
//
// This is the Month 2 moat feature — no competitor offers it.

import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { Avatar } from '@/components/common/Avatar';
import { GradientButton } from '@/components/common/GradientButton';
import { EL, Common, Glass, Radii, Shadows, Space, Type } from '@/theme/emeraldLedger';
import {
  useApproveLoanRequest,
  useLoanRequests,
  useRejectLoanRequest,
} from '@/hooks/useLoanRequests';
import { computeLoanTerms } from '@/utils/loanCalc';
import { formatDateShort, formatRupees } from '@/utils/format';
import type { LoanRequestWithMeta } from '@/db/repos/loanRequests';

export function LoanRequestsScreen() {
  const navigation = useNavigation();
  const { data: all } = useLoanRequests();
  const approve = useApproveLoanRequest();
  const reject = useRejectLoanRequest();

  const pending = all?.filter((r) => r.status === 'pending') ?? [];
  const recent = all?.filter((r) => r.status !== 'pending').slice(0, 20) ?? [];

  const [rejectFor, setRejectFor] = useState<LoanRequestWithMeta | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const handleApprove = (req: LoanRequestWithMeta) => {
    Alert.alert(
      'Approve this loan?',
      `${formatRupees(req.disbursed_amount)} for ${req.borrower_name}. The real loan and plan will be created immediately.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            try {
              await approve.mutateAsync(req.id);
            } catch (e: any) {
              Alert.alert('Error', e?.message ?? 'Failed to approve');
            }
          },
        },
      ],
    );
  };

  const handleReject = async () => {
    if (!rejectFor) return;
    try {
      await reject.mutateAsync({
        requestId: rejectFor.id,
        reason: rejectReason.trim() || undefined,
      });
      setRejectFor(null);
      setRejectReason('');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to reject');
    }
  };

  return (
    <SafeAreaView style={Common.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={EL.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Loan requests</Text>
          <Text style={styles.sub}>
            {pending.length > 0 ? `${pending.length} awaiting your approval` : 'No pending requests'}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: Space.lg, gap: Space.lg, paddingBottom: 80 }}>
        {/* Pending */}
        {pending.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Awaiting your approval</Text>
            {pending.map((req) => (
              <RequestCard
                key={req.id}
                req={req}
                onApprove={() => handleApprove(req)}
                onReject={() => setRejectFor(req)}
              />
            ))}
          </>
        ) : null}

        {/* Recent */}
        {recent.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Recent decisions</Text>
            {recent.map((req) => (
              <RecentCard key={req.id} req={req} />
            ))}
          </>
        ) : null}

        {/* Empty state */}
        {(!all || all.length === 0) ? (
          <View style={styles.empty}>
            <MaterialCommunityIcons name="file-document-outline" size={36} color={EL.outline} />
            <Text style={styles.emptyTitle}>No loan requests yet</Text>
            <Text style={styles.emptySub}>
              When your agents propose new loans, they'll appear here for your approval.
            </Text>
          </View>
        ) : null}
      </ScrollView>

      {/* Reject modal */}
      <Modal
        visible={!!rejectFor}
        transparent
        animationType="slide"
        onRequestClose={() => setRejectFor(null)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={[Glass.dark, { flex: 1, justifyContent: 'flex-end' }]} onPress={() => setRejectFor(null)}>
            <Pressable style={styles.rejectSheet} onPress={(e) => e.stopPropagation()}>
              <View style={styles.handle} />
              <Text style={styles.rejectTitle}>Reject loan request</Text>
              <Text style={styles.rejectSub}>
                {rejectFor?.borrower_name} · {formatRupees(rejectFor?.disbursed_amount ?? 0)}
              </Text>
              <Text style={styles.rejectLabel}>REASON (OPTIONAL)</Text>
              <TextInput
                value={rejectReason}
                onChangeText={setRejectReason}
                placeholder="e.g. borrower has prior overdue, agent did not verify address"
                placeholderTextColor={EL.onSurfaceMuted}
                multiline
                numberOfLines={3}
                style={styles.rejectInput}
              />
              <View style={styles.rejectButtons}>
                <Pressable onPress={() => setRejectFor(null)} style={styles.cancelBtn}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
                <View style={{ flex: 1 }}>
                  <GradientButton
                    title="Reject"
                    variant="danger"
                    onPress={handleReject}
                    loading={reject.isPending}
                    disabled={reject.isPending}
                  />
                </View>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ── Pending request card ──
function RequestCard({
  req,
  onApprove,
  onReject,
}: {
  req: LoanRequestWithMeta;
  onApprove: () => void;
  onReject: () => void;
}) {
  // Preview the schedule so the owner knows what they're approving
  let preview: { emi: number; totalInterest: number; endDate: number | null } | null = null;
  try {
    const terms = computeLoanTerms({
      disbursedAmount: req.disbursed_amount,
      repaymentType: req.repayment_type,
      interestType: req.interest_type,
      interestRate: req.interest_rate,
      interestRatePeriod: req.interest_rate_period,
      frequency: req.frequency,
      tenureCount: req.tenure_count,
      startDate: req.start_date,
      upfrontFee: req.upfront_fee ?? undefined,
    });
    preview = {
      emi: terms.emiAmount,
      totalInterest: terms.totalInterest,
      endDate: terms.endDate,
    };
  } catch {
    preview = null;
  }

  return (
    <View style={[styles.card, Shadows.card]}>
      {/* Header: borrower + agent */}
      <View style={styles.cardHeader}>
        <Avatar name={req.borrower_name ?? 'Borrower'} size={44} />
        <View style={{ flex: 1 }}>
          <Text style={styles.cardName}>{req.borrower_name ?? 'Unknown borrower'}</Text>
          <Text style={styles.cardMeta}>
            {req.borrower_phone ?? 'no phone'}
            {req.line_name ? ` · ${req.line_name}` : ''}
          </Text>
        </View>
        <View style={styles.amountBlock}>
          <Text style={styles.amount}>{formatRupees(req.disbursed_amount)}</Text>
          <Text style={styles.amountLabel}>disbursed</Text>
        </View>
      </View>

      {/* Terms grid */}
      <View style={styles.termsGrid}>
        <Term label="Type" value={req.repayment_type === 'interest_only' ? 'Interest-only' : 'P + I'} />
        <Term label="Rate" value={`${(req.interest_rate * 100).toFixed(1)}%/${req.interest_rate_period}`} />
        <Term label="Freq" value={req.frequency} />
        <Term label="Tenure" value={`${req.tenure_count} ${req.frequency === 'daily' ? 'days' : req.frequency === 'weekly' ? 'wks' : 'mo'}`} />
      </View>

      {/* Schedule preview */}
      {preview ? (
        <View style={styles.previewCard}>
          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>Per installment</Text>
            <Text style={styles.previewValue}>{formatRupees(preview.emi)}</Text>
          </View>
          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>Total interest</Text>
            <Text style={[styles.previewValue, { color: EL.primary }]}>
              {formatRupees(preview.totalInterest)}
            </Text>
          </View>
          {preview.endDate ? (
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Ends</Text>
              <Text style={styles.previewValue}>{formatDateShort(new Date(preview.endDate))}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Agent note */}
      <View style={styles.agentRow}>
        <MaterialCommunityIcons name="account-tie" size={14} color={EL.onSurfaceMuted} />
        <Text style={styles.agentText}>Requested by {req.requested_by_name ?? 'Unknown'}</Text>
      </View>
      {req.notes ? (
        <View style={styles.noteBlock}>
          <MaterialCommunityIcons name="note-text-outline" size={14} color={EL.onSurfaceMuted} />
          <Text style={styles.noteText}>{req.notes}</Text>
        </View>
      ) : null}

      {/* Action buttons */}
      <View style={styles.actions}>
        <Pressable onPress={onReject} style={styles.rejectAction}>
          <MaterialCommunityIcons name="close-circle-outline" size={16} color={EL.tertiary} />
          <Text style={styles.rejectActionText}>Reject</Text>
        </Pressable>
        <Pressable onPress={onApprove} style={styles.approveAction}>
          <MaterialCommunityIcons name="check-circle" size={16} color={EL.white} />
          <Text style={styles.approveActionText}>Approve</Text>
        </Pressable>
      </View>
    </View>
  );
}

function RecentCard({ req }: { req: LoanRequestWithMeta }) {
  const isApproved = req.status === 'approved';
  const isRejected = req.status === 'rejected';
  return (
    <View style={[styles.recentCard, Shadows.card]}>
      <View style={styles.cardHeader}>
        <View
          style={[
            styles.recentStatusPill,
            { backgroundColor: isApproved ? 'rgba(0,105,72,0.1)' : isRejected ? 'rgba(155,62,59,0.1)' : EL.surfaceLow },
          ]}
        >
          <MaterialCommunityIcons
            name={isApproved ? 'check' : isRejected ? 'close' : 'clock'}
            size={14}
            color={isApproved ? EL.primary : isRejected ? EL.tertiary : EL.onSurfaceMuted}
          />
          <Text
            style={[
              styles.recentStatusText,
              { color: isApproved ? EL.primary : isRejected ? EL.tertiary : EL.onSurfaceMuted },
            ]}
          >
            {req.status.toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardName}>{req.borrower_name}</Text>
          <Text style={styles.cardMeta}>
            {formatRupees(req.disbursed_amount)} · by {req.requested_by_name ?? 'Unknown'}
          </Text>
        </View>
      </View>
      {req.rejection_reason ? (
        <Text style={styles.rejectionReason}>Reason: {req.rejection_reason}</Text>
      ) : null}
    </View>
  );
}

function Term({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.term}>
      <Text style={styles.termLabel}>{label}</Text>
      <Text style={styles.termValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    padding: Space.lg,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: EL.surfaceCard,
  },
  title: { ...Type.titleLg, fontWeight: '800' },
  sub: { fontSize: 12, color: EL.onSurfaceMuted, fontWeight: '600', marginTop: 2 },

  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: EL.onSurfaceMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },

  card: {
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.lg,
    padding: Space.lg,
    gap: Space.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
  },
  cardName: { fontSize: 16, fontWeight: '800', color: EL.onSurface },
  cardMeta: { fontSize: 12, color: EL.onSurfaceMuted, marginTop: 2 },
  amountBlock: { alignItems: 'flex-end' },
  amount: { fontSize: 18, fontWeight: '800', color: EL.primary },
  amountLabel: { fontSize: 10, fontWeight: '700', color: EL.onSurfaceMuted, marginTop: 2, letterSpacing: 0.5 },

  termsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space.sm,
  },
  term: {
    flex: 1,
    minWidth: 70,
    backgroundColor: EL.surfaceLow,
    padding: Space.sm,
    borderRadius: Radii.md,
  },
  termLabel: { fontSize: 10, fontWeight: '700', color: EL.onSurfaceMuted, letterSpacing: 0.5 },
  termValue: { fontSize: 13, fontWeight: '700', color: EL.onSurface, marginTop: 2 },

  previewCard: {
    backgroundColor: EL.surfaceLow,
    borderRadius: Radii.md,
    padding: Space.md,
    gap: 2,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  previewLabel: { fontSize: 12, color: EL.onSurfaceSec },
  previewValue: { fontSize: 13, fontWeight: '700', color: EL.onSurface },

  agentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xs,
  },
  agentText: { fontSize: 11, color: EL.onSurfaceMuted, fontWeight: '600' },
  noteBlock: {
    flexDirection: 'row',
    gap: Space.sm,
    backgroundColor: 'rgba(217,119,6,0.05)',
    padding: Space.sm,
    borderRadius: Radii.sm,
  },
  noteText: { flex: 1, fontSize: 12, color: EL.onSurfaceSec, fontStyle: 'italic' },

  actions: {
    flexDirection: 'row',
    gap: Space.sm,
    marginTop: Space.xs,
  },
  rejectAction: {
    flex: 1,
    height: 42,
    borderRadius: Radii.md,
    backgroundColor: EL.surfaceLow,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.xs,
  },
  rejectActionText: { fontSize: 13, fontWeight: '700', color: EL.tertiary },
  approveAction: {
    flex: 2,
    height: 42,
    borderRadius: Radii.md,
    backgroundColor: EL.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.xs,
  },
  approveActionText: { fontSize: 13, fontWeight: '800', color: EL.white },

  // Recent card
  recentCard: {
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.lg,
    padding: Space.md,
  },
  recentStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Space.sm,
    paddingVertical: 4,
    borderRadius: Radii.pill,
  },
  recentStatusText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  rejectionReason: {
    fontSize: 12,
    color: EL.tertiary,
    fontStyle: 'italic',
    marginTop: Space.xs,
    paddingLeft: 52,
  },

  empty: {
    alignItems: 'center',
    padding: Space.xxxl,
    gap: Space.sm,
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: EL.onSurface, marginTop: Space.md },
  emptySub: { fontSize: 12, color: EL.onSurfaceMuted, textAlign: 'center', marginTop: Space.xs, paddingHorizontal: Space.xl },

  // Reject modal
  rejectSheet: {
    backgroundColor: EL.surfaceCard,
    borderTopLeftRadius: Radii.xxl,
    borderTopRightRadius: Radii.xxl,
    paddingTop: Space.sm,
    paddingHorizontal: Space.xl,
    paddingBottom: Space.xxxl,
    gap: Space.md,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: EL.outlineVariant,
    alignSelf: 'center',
    marginBottom: Space.sm,
  },
  rejectTitle: { fontSize: 20, fontWeight: '800', color: EL.onSurface },
  rejectSub: { fontSize: 13, color: EL.onSurfaceSec, marginTop: -8 },
  rejectLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: EL.onSurfaceMuted,
    letterSpacing: 0.8,
  },
  rejectInput: {
    backgroundColor: EL.surfaceLow,
    borderRadius: Radii.md,
    padding: Space.md,
    fontSize: 14,
    color: EL.onSurface,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  rejectButtons: {
    flexDirection: 'row',
    gap: Space.md,
  },
  cancelBtn: {
    flex: 0.5,
    height: 48,
    borderRadius: Radii.md,
    backgroundColor: EL.surfaceLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { fontSize: 14, fontWeight: '700', color: EL.onSurface },
});
