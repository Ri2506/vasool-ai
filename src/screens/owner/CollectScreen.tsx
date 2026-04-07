import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Avatar } from '@/components/common/Avatar';
import { GradientButton } from '@/components/common/GradientButton';
import { NumberPad } from '@/components/common/NumberPad';
import { QuickAmountChips } from '@/components/common/QuickAmountChips';
import { StarRating } from '@/components/common/StarRating';
import { VoiceButton } from '@/components/common/VoiceButton';
import { EL, Common, Glass, Radii, Shadows, Space, Type } from '@/theme/emeraldLedger';
import { useRecordCollection } from '@/hooks/useCollections';
import { useBorrowerStatuses } from '@/hooks/useBorrowerStatus';
import { useGps } from '@/hooks/useGps';
import { useVoice } from '@/hooks/useVoice';
import { formatRupees } from '@/utils/format';
import type { OwnerStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<OwnerStackParamList, 'Collect'>;

export function CollectScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const { item } = route.params;
  const recordMut = useRecordCollection();
  const { getLocation } = useGps();
  const { data: statuses } = useBorrowerStatuses();
  const voice = useVoice();

  const st = statuses?.[item.borrower_id];

  const [amount, setAmount] = useState(String(item.expected_amount));
  const [showAdvance, setShowAdvance] = useState(false);
  const [advancePeriods, setAdvancePeriods] = useState(0);

  useEffect(() => {
    if (voice.lastResult?.amount) {
      setAmount(String(voice.lastResult.amount));
    }
  }, [voice.lastResult]);

  const isInterestOnlyLoan = item.line_type === 'daily_interest' || item.line_type === 'weekly_interest' || item.line_type === 'monthly_interest';

  const doRecord = async (isPrincipalReturn = false) => {
    const numAmount = Number(amount);
    if (numAmount <= 0) return;
    try {
      const gps = await getLocation();
      await recordMut.mutateAsync({
        loanId: item.loan_id,
        planEntryId: item.plan_entry_id,
        amount: numAmount,
        expectedAmount: item.expected_amount,
        isAdvance: advancePeriods > 0,
        advancePeriods,
        gpsLat: gps?.lat,
        gpsLng: gps?.lng,
      });
      if (isPrincipalReturn) {
        const { recordPrincipalReturn } = await import('@/db/repos/principalReturns');
        const orgId = item.loan_id;
        await recordPrincipalReturn(orgId, item.loan_id, numAmount - item.expected_amount, 'Principal return from collection');
      }
      // Navigate to receipt screen
      navigation.replace('SuccessReceipt', {
        borrowerName: item.borrower_name,
        amount: numAmount,
        loanRemaining: Math.max(0, item.loan_principal - numAmount),
        daysPaid: item.installment_number,
        totalDays: item.loan_principal > 0 ? Math.ceil(item.loan_principal / item.loan_emi) : 100,
        timestamp: Date.now(),
      });
    } catch (e: any) {
      Alert.alert(t('common.error_generic'), e?.message ?? '');
    }
  };

  const handleCollect = async () => {
    const numAmount = Number(amount);
    if (numAmount <= 0) return;
    if (isInterestOnlyLoan && numAmount > item.expected_amount) {
      const excess = numAmount - item.expected_amount;
      Alert.alert(
        t('loan.return_principal'),
        `\u20B9${excess.toLocaleString('en-IN')} is more than the interest. Is this a principal return?`,
        [
          { text: 'No, just payment', onPress: () => doRecord(false) },
          { text: `Yes, \u20B9${excess.toLocaleString('en-IN')} principal`, onPress: () => doRecord(true) },
        ]
      );
      return;
    }
    try {
      await doRecord(false);
    } catch (e: any) {
      Alert.alert(t('common.error_generic'), e?.message ?? '');
    }
  };

  return (
    <SafeAreaView style={Common.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* ── Borrower Info Card ── */}
        <View style={styles.borrowerCard}>
          <View style={styles.borrowerTop}>
            <View style={styles.borrowerLeft}>
              <Avatar name={item.borrower_name} size={56} />
              <View style={styles.borrowerInfo}>
                <Text style={styles.borrowerName}>{item.borrower_name}</Text>
                {item.borrower_phone ? (
                  <Text style={styles.borrowerPhone}>{item.borrower_phone}</Text>
                ) : null}
                {st?.rating ? (
                  <StarRating rating={st.rating} size={16} />
                ) : null}
              </View>
            </View>
            {item.borrower_phone ? (
              <Pressable style={styles.callBtn}>
                <MaterialCommunityIcons name="phone" size={20} color={EL.primary} />
              </Pressable>
            ) : null}
          </View>

          {/* Loan info strip */}
          <View style={styles.loanInfo}>
            <Text style={styles.loanInfoText}>
              {item.line_name ?? 'Daily loan'} \u2022 EMI{' '}
              <Text style={{ fontWeight: '600' }}>{formatRupees(item.expected_amount)}</Text>
              {' '}\u2022 #{item.installment_number}
            </Text>
          </View>

          {/* Due today highlight */}
          <View style={styles.dueBox}>
            <Text style={styles.dueLabel}>Due today</Text>
            <Text style={styles.dueAmount}>{formatRupees(item.expected_amount)}</Text>
          </View>
        </View>

        {/* ── Number Pad with Amount Display ── */}
        <NumberPad
          value={amount}
          onChange={setAmount}
          onConfirm={handleCollect}
          confirmLabel={`Collect`}
          disabled={recordMut.isPending}
        />

        {/* ── Quick Amount Chips ── */}
        <View style={{ marginTop: Space.lg }}>
          <QuickAmountChips
            emiAmount={item.expected_amount}
            selected={Number(amount)}
            onSelect={(v) => setAmount(String(v))}
          />
        </View>

        {/* ── Voice input ── */}
        <VoiceButton
          isListening={voice.isListening}
          onPress={voice.isListening ? voice.stopListening : voice.startListening}
          lastText={voice.lastResult?.text}
        />

        {/* ── Advance toggle ── */}
        <GradientButton
          title="Advance payment"
          variant="secondary"
          onPress={() => setShowAdvance(true)}
          style={{ marginTop: Space.lg, marginHorizontal: Space.lg }}
        />
      </ScrollView>

      {/* ── Advance Payment Bottom Sheet ── */}
      <Modal visible={showAdvance} transparent animationType="slide" onRequestClose={() => setShowAdvance(false)}>
        <Pressable style={[Glass.dark, styles.sheetBackdrop]} onPress={() => setShowAdvance(false)}>
          <View style={[Glass.container, styles.advanceSheet]}>
            {/* Handle */}
            <View style={styles.sheetHandle} />

            {/* Header */}
            <Text style={styles.advanceTitle}>Advance Payment</Text>
            <Text style={styles.advanceEmi}>EMI: {formatRupees(item.expected_amount)}/day</Text>

            {/* Multiplier chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.advanceChipRow}
              style={{ marginVertical: Space.xxl }}
            >
              {[2, 3, 5, 7, 10].map((n) => {
                const active = advancePeriods === n;
                return (
                  <Pressable
                    key={n}
                    onPress={() => {
                      setAdvancePeriods(n);
                      setAmount(String(item.expected_amount * n));
                    }}
                    style={[styles.advanceChip, active ? styles.advanceChipActive : styles.advanceChipInactive]}
                  >
                    <Text style={[styles.advanceChipText, active && { color: EL.white }]}>
                      {n} days {formatRupees(item.expected_amount * n)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Calculation display */}
            <View style={styles.calcBox}>
              <Text style={styles.calcText}>
                {advancePeriods || '?'} \u00D7 {formatRupees(item.expected_amount)} = {formatRupees(item.expected_amount * (advancePeriods || 0))}
              </Text>
            </View>

            {/* Info note */}
            <View style={styles.advanceInfo}>
              <MaterialCommunityIcons name="information-outline" size={16} color={EL.primary} />
              <Text style={styles.advanceInfoText}>
                {item.borrower_name} will be marked as paid for{' '}
                <Text style={{ fontWeight: '700', color: EL.onSurface }}>{advancePeriods || 0} working days</Text>
              </Text>
            </View>

            {/* Confirm button */}
            <GradientButton
              title={`Confirm Advance ${formatRupees(item.expected_amount * (advancePeriods || 0))}`}
              onPress={() => {
                setShowAdvance(false);
                handleCollect();
              }}
              disabled={advancePeriods === 0}
              icon={<MaterialCommunityIcons name="check-circle" size={20} color={EL.white} />}
              style={{ marginTop: Space.xl }}
            />
          </View>
        </Pressable>
      </Modal>

      {/* ── Bottom Status Bar ── */}
      <View style={[Glass.container, styles.bottomBar]}>
        <View style={styles.bottomStatus}>
          <View style={styles.statusItem}>
            <MaterialCommunityIcons name="map-marker" size={12} color={EL.onSurfaceMuted} />
            <Text style={styles.statusText}>GPS: captured</Text>
          </View>
          <View style={styles.statusItem}>
            <MaterialCommunityIcons name="cloud-off-outline" size={12} color={EL.onSurfaceMuted} />
            <Text style={styles.statusText}>Offline: will sync</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 100 },

  // Borrower card
  borrowerCard: {
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.lg,
    padding: Space.lg,
    marginHorizontal: Space.lg,
    marginTop: Space.md,
    marginBottom: Space.lg,
    ...Shadows.card,
  },
  borrowerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  borrowerLeft: {
    flexDirection: 'row',
    flex: 1,
    gap: Space.lg,
  },
  borrowerInfo: {
    flex: 1,
    gap: 2,
  },
  borrowerName: {
    ...Type.titleLg,
    fontWeight: '700',
  },
  borrowerPhone: {
    ...Type.bodySm,
    color: EL.onSurfaceMuted,
  },
  callBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: EL.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loanInfo: {
    marginTop: Space.lg,
    paddingTop: Space.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.04)',
  },
  loanInfoText: {
    ...Type.bodyMd,
    color: EL.onSurfaceSec,
  },
  dueBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: EL.surfaceLow,
    borderRadius: Radii.md,
    padding: Space.md,
    marginTop: Space.md,
  },
  dueLabel: {
    ...Type.labelMd,
    color: EL.onSurfaceSec,
  },
  dueAmount: {
    ...Type.titleLg,
    color: EL.primary,
    fontWeight: '700',
  },

  // Advance bottom sheet
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end' },
  advanceSheet: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: Space.xl,
    paddingBottom: Space.xxxl + 8,
    alignItems: 'center',
    ...Shadows.float,
  },
  sheetHandle: {
    width: 48,
    height: 5,
    backgroundColor: EL.outline,
    borderRadius: 3,
    opacity: 0.4,
    marginBottom: Space.xxl,
  },
  advanceTitle: {
    ...Type.displaySm,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  advanceEmi: {
    ...Type.bodyMd,
    color: EL.onSurfaceSec,
    fontWeight: '500',
    marginTop: Space.xs,
  },
  advanceChipRow: {
    gap: Space.sm,
    paddingHorizontal: Space.sm,
  },
  advanceChip: {
    paddingHorizontal: Space.xl,
    paddingVertical: Space.md,
    borderRadius: Radii.md,
  },
  advanceChipActive: {
    backgroundColor: EL.primary,
    ...Shadows.card,
  },
  advanceChipInactive: {
    backgroundColor: EL.surfaceCard,
    borderWidth: 1,
    borderColor: EL.primary,
  },
  advanceChipText: {
    ...Type.labelMd,
    color: EL.primary,
    fontWeight: '600',
  },
  calcBox: {
    width: '100%',
    backgroundColor: EL.surfaceHigh,
    borderRadius: Radii.lg,
    paddingVertical: Space.xxl,
    paddingHorizontal: Space.lg,
    marginBottom: Space.lg,
    alignItems: 'center',
  },
  calcText: {
    ...Type.displaySm,
    color: EL.primary,
    fontWeight: '800',
    letterSpacing: -0.5,
    fontSize: 24,
  },
  advanceInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Space.sm,
    paddingHorizontal: Space.sm,
    marginBottom: Space.md,
  },
  advanceInfoText: {
    ...Type.bodyMd,
    color: EL.onSurfaceSec,
    flex: 1,
    lineHeight: 20,
  },

  // Bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: Space.md,
    paddingHorizontal: Space.xl,
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
  },
  bottomStatus: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Space.xl,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xs,
  },
  statusText: {
    ...Type.labelSm,
    color: EL.onSurfaceMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontSize: 10,
  },
});
