import React, { useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Avatar } from '@/components/common/Avatar';
import { GradientButton } from '@/components/common/GradientButton';
import { StarRating } from '@/components/common/StarRating';
import { EL, Common, Glass, Radii, Shadows, Space, Type } from '@/theme/emeraldLedger';
import { useRecordCollection } from '@/hooks/useCollections';
import { useBorrowerStatuses } from '@/hooks/useBorrowerStatus';
import { useGps } from '@/hooks/useGps';
import { useVoice } from '@/hooks/useVoice';
import { useAuthStore } from '@/store/authStore';
import { useAppStore } from '@/store/appStore';
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
  const orgId = useAuthStore((s) => s.user?.orgId ?? '');
  const isOnline = useAppStore((s) => s.isOnline);

  const st = statuses?.[item.borrower_id];

  const [amount, setAmount] = useState(String(item.expected_amount));
  const [showAdvance, setShowAdvance] = useState(false);
  const [advancePeriods, setAdvancePeriods] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'account'>('cash');
  const [gpsStatus, setGpsStatus] = useState<'pending' | 'captured' | 'unavailable'>('pending');
  const [showReturnPrincipal, setShowReturnPrincipal] = useState(false);
  const [principalReturnAmount, setPrincipalReturnAmount] = useState('');
  const [principalReturning, setPrincipalReturning] = useState(false);

  useEffect(() => {
    getLocation()
      .then((loc) => setGpsStatus(loc ? 'captured' : 'unavailable'))
      .catch(() => setGpsStatus('unavailable'));
  }, [getLocation]);

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
        gpsMocked: gps?.mocked,
        paymentMethod,
      });
      if (isPrincipalReturn) {
        const { recordPrincipalReturn } = await import('@/db/repos/principalReturns');
        await recordPrincipalReturn(orgId, item.loan_id, numAmount - item.expected_amount, 'Principal return from collection');
      }
      // Calculate remaining: principal - (installments already paid * emi) - this payment
      const alreadyPaid = Math.max(0, item.installment_number - 1) * item.loan_emi;
      const loanRemaining = Math.max(0, item.loan_principal - alreadyPaid - numAmount);
      const totalDays = item.loan_emi > 0 ? Math.ceil(item.loan_principal / item.loan_emi) : 100;

      navigation.replace('SuccessReceipt', {
        borrowerName: item.borrower_name,
        amount: numAmount,
        loanRemaining,
        daysPaid: item.installment_number,
        totalDays,
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

  // ── Return Principal (interest-only loans only) ──
  const handleReturnPrincipal = async () => {
    const amt = Number(principalReturnAmount);
    if (amt <= 0) {
      Alert.alert('Invalid amount', 'Please enter a positive principal return amount.');
      return;
    }
    setPrincipalReturning(true);
    try {
      const { recordPrincipalReturn } = await import('@/db/repos/principalReturns');
      await recordPrincipalReturn(orgId, item.loan_id, amt, 'Principal return');
      setShowReturnPrincipal(false);
      setPrincipalReturnAmount('');
      Alert.alert(
        'Principal returned',
        `${formatRupees(amt)} recorded as principal return. The outstanding principal has been reduced.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (e: any) {
      Alert.alert(t('common.error_generic'), e?.message ?? 'Failed to record principal return');
    } finally {
      setPrincipalReturning(false);
    }
  };

  // Quick amount chips
  const quickAmounts = [
    { label: '\u20B9250', value: 250 },
    { label: '\u20B9400', value: 400 },
    { label: formatRupees(item.expected_amount), value: item.expected_amount },
    { label: '\u20B91,000', value: 1000 },
    { label: 'Advance', value: -1 },
  ];

  // Keypad
  const handleKey = (key: string) => {
    if (key === 'backspace') {
      setAmount((prev) => prev.slice(0, -1));
    } else if (key === 'mic') {
      if (voice.isListening) {
        voice.stopListening();
      } else {
        voice.startListening();
      }
    } else {
      if (amount.length < 8) {
        setAmount((prev) => prev + key);
      }
    }
  };

  const numAmount = Number(amount) || 0;

  return (
    <SafeAreaView style={Common.screen}>
      {/* ── Sticky Header ── */}
      <View style={styles.header}>
        <Pressable
          style={styles.headerBtn}
          onPress={() => navigation.goBack()}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={EL.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Collection Entry</Text>
        <Pressable style={styles.headerBtn}>
          <MaterialCommunityIcons name="history" size={24} color={EL.onSurface} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Borrower Info Card ── */}
        <View style={styles.borrowerCard}>
          <View style={styles.borrowerTop}>
            <View style={styles.borrowerLeft}>
              <Avatar name={item.borrower_name} size={56} />
              <View style={styles.borrowerInfo}>
                <Text style={styles.borrowerName}>{item.borrower_name}</Text>
                {/* Status badge */}
                <View style={[styles.statusBadge, st?.is_nippu && { backgroundColor: 'rgba(155, 62, 59, 0.1)' }]}>
                  <View style={[styles.statusDot, st?.is_nippu && { backgroundColor: EL.tertiary }]} />
                  <Text style={[styles.statusText, st?.is_nippu && { color: EL.tertiary }]}>
                    {st?.is_nippu ? '\u0BA8\u0BBF\u0BAA\u0BCD\u0BAA\u0BC1 / Overdue' : '\u0BA8\u0B9F\u0BAA\u0BCD\u0BAA\u0BC1 / On Schedule'}
                  </Text>
                </View>
                {st?.rating ? (
                  <View style={{ marginTop: 6 }}>
                    <StarRating rating={st.rating} size={18} />
                  </View>
                ) : null}
              </View>
            </View>
            {item.borrower_phone ? (
              <Pressable
                style={styles.callBtn}
                onPress={() => Linking.openURL(`tel:${item.borrower_phone}`)}
              >
                <MaterialCommunityIcons name="phone" size={22} color={EL.primary} />
              </Pressable>
            ) : null}
          </View>

          {/* Loan info strip */}
          <View style={styles.loanInfoStrip}>
            <Text style={styles.loanInfoText}>
              {item.line_name ?? 'Daily loan'} {'\u2022'} EMI{' '}
              <Text style={{ fontWeight: '600' }}>{formatRupees(item.expected_amount)}</Text>
              {' '}{'\u2022'} Day {item.installment_number}/{item.loan_principal && item.loan_emi ? Math.ceil(item.loan_principal / item.loan_emi) : '?'}
            </Text>
          </View>

          {/* Due today highlight */}
          <View style={styles.dueBox}>
            <Text style={styles.dueLabel}>Due today</Text>
            <Text style={styles.dueAmount}>{formatRupees(item.expected_amount)}</Text>
          </View>
        </View>

        {/* ── Amount Display ── */}
        <View style={styles.amountSection}>
          <Text style={styles.amountLabel}>Entry Amount</Text>
          <View style={styles.amountDisplay}>
            <Text style={styles.amountRupee}>{'\u20B9'}</Text>
            <Text style={styles.amountValue}>{amount || '0'}</Text>
          </View>
          <View style={styles.amountUnderline} />
        </View>

        {/* ── Payment Method Toggle ── */}
        <View style={styles.methodSection}>
          <Text style={styles.methodLabel}>Payment method</Text>
          <View style={styles.methodRow}>
            <Pressable
              style={[styles.methodBtn, paymentMethod === 'cash' && styles.methodBtnActive]}
              onPress={() => setPaymentMethod('cash')}
            >
              <MaterialCommunityIcons
                name="cash"
                size={18}
                color={paymentMethod === 'cash' ? EL.white : EL.onSurface}
              />
              <Text
                style={[
                  styles.methodText,
                  paymentMethod === 'cash' && styles.methodTextActive,
                ]}
              >
                Cash
              </Text>
            </Pressable>
            <Pressable
              style={[styles.methodBtn, paymentMethod === 'account' && styles.methodBtnActive]}
              onPress={() => setPaymentMethod('account')}
            >
              <MaterialCommunityIcons
                name="bank"
                size={18}
                color={paymentMethod === 'account' ? EL.white : EL.onSurface}
              />
              <Text
                style={[
                  styles.methodText,
                  paymentMethod === 'account' && styles.methodTextActive,
                ]}
              >
                Account
              </Text>
            </Pressable>
          </View>
        </View>

        {/* ── Quick Amount Chips ── */}
        <View style={styles.chipsSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
            {quickAmounts.map((chip) => {
              const isAdvance = chip.value === -1;
              const isSelected = !isAdvance && chip.value === numAmount;
              return (
                <Pressable
                  key={chip.label}
                  style={[
                    styles.chip,
                    isSelected ? styles.chipSelected : styles.chipDefault,
                  ]}
                  onPress={() => {
                    if (isAdvance) {
                      setShowAdvance(true);
                    } else {
                      setAmount(String(chip.value));
                    }
                  }}
                >
                  <Text style={[
                    styles.chipText,
                    isSelected ? styles.chipTextSelected : styles.chipTextDefault,
                  ]}>
                    {chip.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* ── Numeric Keypad ── */}
        <View style={styles.keypad}>
          {[
            ['1', '2', '3'],
            ['4', '5', '6'],
            ['7', '8', '9'],
            ['mic', '0', 'backspace'],
          ].map((row, ri) => (
            <View key={ri} style={styles.keypadRow}>
              {row.map((key) => (
                <Pressable
                  key={key}
                  style={({ pressed }) => [
                    styles.key,
                    key === 'mic' && styles.keyMic,
                    pressed && key !== '' && { backgroundColor: EL.surfaceHigh },
                  ]}
                  onPress={() => handleKey(key)}
                >
                  {key === 'mic' ? (
                    <MaterialCommunityIcons
                      name="microphone"
                      size={28}
                      color={EL.primary}
                    />
                  ) : key === 'backspace' ? (
                    <MaterialCommunityIcons
                      name="backspace-outline"
                      size={28}
                      color={EL.onSurfaceMuted}
                    />
                  ) : (
                    <Text style={styles.keyText}>{key}</Text>
                  )}
                </Pressable>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>

      {/* ── Bottom Footer ── */}
      <View style={styles.bottomFooter}>
        <Pressable
          style={({ pressed }) => [
            styles.collectButton,
            pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] },
            (recordMut.isPending || numAmount <= 0) && { opacity: 0.5 },
          ]}
          onPress={handleCollect}
          disabled={recordMut.isPending || numAmount <= 0}
        >
          <Text style={styles.collectButtonText}>
            Collect {formatRupees(numAmount)}
          </Text>
          <MaterialCommunityIcons name="check-circle" size={20} color={EL.white} />
        </Pressable>
        {isInterestOnlyLoan && (
          <Pressable
            style={styles.returnPrincipalBtn}
            onPress={() => {
              setPrincipalReturnAmount('');
              setShowReturnPrincipal(true);
            }}
          >
            <MaterialCommunityIcons name="cash-refund" size={18} color={EL.primary} />
            <Text style={styles.returnPrincipalText}>Return Principal</Text>
          </Pressable>
        )}
        <View style={styles.footerIndicators}>
          <View style={styles.indicator}>
            <MaterialCommunityIcons
              name={gpsStatus === 'captured' ? 'map-marker-check' : gpsStatus === 'pending' ? 'map-marker-outline' : 'map-marker-off'}
              size={12}
              color={gpsStatus === 'captured' ? EL.primary : EL.onSurfaceMuted}
            />
            <Text style={styles.indicatorText}>
              GPS: {gpsStatus === 'captured' ? 'captured' : gpsStatus === 'pending' ? 'locating…' : 'unavailable'}
            </Text>
          </View>
          <View style={styles.indicator}>
            <MaterialCommunityIcons
              name={isOnline ? 'cloud-check-outline' : 'cloud-off-outline'}
              size={12}
              color={isOnline ? EL.primary : EL.onSurfaceMuted}
            />
            <Text style={styles.indicatorText}>
              {isOnline ? 'Online: syncing' : 'Offline: will sync'}
            </Text>
          </View>
        </View>
      </View>

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
                {advancePeriods || '?'} {'\u00D7'} {formatRupees(item.expected_amount)} = {formatRupees(item.expected_amount * (advancePeriods || 0))}
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

      {/* ── Return Principal Bottom Sheet (interest-only loans) ── */}
      <Modal
        visible={showReturnPrincipal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReturnPrincipal(false)}
      >
        <Pressable
          style={[Glass.dark, styles.sheetBackdrop]}
          onPress={() => setShowReturnPrincipal(false)}
        >
          <Pressable style={[Glass.container, styles.returnSheet]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />

            <Text style={styles.advanceTitle}>Return Principal</Text>
            <Text style={styles.advanceEmi}>
              Borrower is returning part or all of the principal
            </Text>

            {/* Amount input */}
            <View style={styles.returnAmountBox}>
              <Text style={styles.returnAmountLabel}>AMOUNT TO RETURN</Text>
              <View style={styles.returnAmountRow}>
                <Text style={styles.returnCurrency}>{'\u20B9'}</Text>
                <TextInput
                  style={styles.returnAmountInput}
                  value={principalReturnAmount}
                  onChangeText={(v) => setPrincipalReturnAmount(v.replace(/\D/g, ''))}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={EL.outlineVariant}
                  autoFocus
                />
              </View>
            </View>

            {/* Quick amount suggestions */}
            <View style={styles.returnChipRow}>
              {[
                { label: '25%', value: Math.round(item.loan_principal * 0.25) },
                { label: '50%', value: Math.round(item.loan_principal * 0.5) },
                { label: '100%', value: item.loan_principal },
              ].map((chip) => (
                <Pressable
                  key={chip.label}
                  style={styles.returnChip}
                  onPress={() => setPrincipalReturnAmount(String(chip.value))}
                >
                  <Text style={styles.returnChipLabel}>{chip.label}</Text>
                  <Text style={styles.returnChipValue}>{formatRupees(chip.value)}</Text>
                </Pressable>
              ))}
            </View>

            {/* Info note */}
            <View style={styles.advanceInfo}>
              <MaterialCommunityIcons name="information-outline" size={16} color={EL.primary} />
              <Text style={styles.advanceInfoText}>
                Principal returns reduce the outstanding loan amount. Daily interest continues
                until the full principal is returned.
              </Text>
            </View>

            <GradientButton
              title={`Record Return ${formatRupees(Number(principalReturnAmount) || 0)}`}
              onPress={handleReturnPrincipal}
              loading={principalReturning}
              disabled={!(Number(principalReturnAmount) > 0)}
              icon={<MaterialCommunityIcons name="cash-refund" size={20} color={EL.white} />}
              style={{ marginTop: Space.xl }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 160 },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Space.xl,
    paddingVertical: Space.lg,
    backgroundColor: EL.surface,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: EL.onSurface,
    letterSpacing: -0.2,
  },

  // Borrower card
  borrowerCard: {
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.lg,
    padding: Space.lg,
    marginHorizontal: Space.lg,
    marginTop: Space.lg,
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
  },
  borrowerName: {
    fontSize: 18,
    fontWeight: '700',
    color: EL.onSurface,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0, 105, 72, 0.1)',
    paddingHorizontal: Space.sm,
    paddingVertical: 2,
    borderRadius: Radii.pill,
    gap: 4,
    marginTop: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: EL.primary,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: EL.primary,
  },
  callBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: EL.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loanInfoStrip: {
    marginTop: Space.lg,
    paddingTop: Space.lg,
  },
  loanInfoText: {
    fontSize: 14,
    fontWeight: '400',
    color: EL.onSurfaceSec,
    lineHeight: 20,
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
    fontSize: 14,
    fontWeight: '500',
    color: EL.secondary,
  },
  dueAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: EL.primary,
  },

  // Amount display
  amountSection: {
    alignItems: 'center',
    marginTop: Space.xxxl,
  },
  amountLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: EL.onSurfaceMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  amountDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  amountRupee: {
    fontSize: 24,
    fontWeight: '700',
    color: EL.primary,
  },
  amountValue: {
    fontSize: 48,
    fontWeight: '800',
    color: EL.primary,
    letterSpacing: -2,
  },
  amountUnderline: {
    width: 48,
    height: 4,
    backgroundColor: 'rgba(0, 105, 72, 0.2)',
    borderRadius: 2,
    marginTop: Space.lg,
  },

  // Payment method toggle (cash vs account)
  methodSection: {
    marginTop: Space.xl,
    paddingHorizontal: Space.lg,
  },
  methodLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: EL.onSurfaceMuted,
    textTransform: 'uppercase',
    marginBottom: Space.sm,
  },
  methodRow: {
    flexDirection: 'row',
    gap: Space.sm,
  },
  methodBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.sm,
    paddingVertical: Space.md,
    borderRadius: Radii.md,
    backgroundColor: EL.surfaceCard,
  },
  methodBtnActive: {
    backgroundColor: EL.primary,
  },
  methodText: {
    fontSize: 14,
    fontWeight: '600',
    color: EL.onSurface,
  },
  methodTextActive: {
    color: EL.white,
  },

  // Quick amount chips
  chipsSection: {
    marginTop: Space.xl,
  },
  chipsRow: {
    paddingHorizontal: Space.lg,
    gap: Space.md,
    paddingVertical: Space.sm,
  },
  chip: {
    paddingHorizontal: Space.xl,
    paddingVertical: 10,
    borderRadius: Radii.pill,
  },
  chipSelected: {
    backgroundColor: EL.primary,
    ...Shadows.card,
  },
  chipDefault: {
    backgroundColor: EL.surfaceHigh,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: EL.white,
    fontWeight: '700',
  },
  chipTextDefault: {
    color: EL.onSurfaceSec,
  },

  // Keypad
  keypad: {
    marginTop: Space.xxl,
    paddingHorizontal: Space.lg,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Space.md,
  },
  key: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyMic: {
    backgroundColor: 'rgba(0, 105, 72, 0.1)',
  },
  keyText: {
    fontSize: 24,
    fontWeight: '700',
    color: EL.onSurface,
  },

  // Bottom footer
  bottomFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    paddingHorizontal: Space.xxl,
    paddingTop: Space.lg,
    paddingBottom: Space.xxxl,
    borderTopLeftRadius: Radii.xxl,
    borderTopRightRadius: Radii.xxl,
    ...Shadows.float,
    alignItems: 'center',
    gap: Space.md,
  },
  collectButton: {
    width: '100%',
    height: 52,
    borderRadius: Radii.md,
    backgroundColor: EL.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.sm,
    ...Shadows.card,
  },
  collectButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: EL.white,
  },
  returnPrincipalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.sm,
    width: '100%',
    paddingVertical: Space.md,
    borderRadius: Radii.md,
    borderWidth: 2,
    borderColor: 'rgba(0, 105, 72, 0.3)',
    backgroundColor: 'rgba(0, 105, 72, 0.05)',
  },
  returnPrincipalText: {
    fontSize: 14,
    fontWeight: '700',
    color: EL.primary,
    letterSpacing: 0.3,
  },
  footerIndicators: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.lg,
  },
  indicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  indicatorText: {
    fontSize: 10,
    fontWeight: '500',
    color: EL.onSurfaceMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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

  // Return principal sheet
  returnSheet: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: Space.xl,
    paddingBottom: Space.xxxl + 8,
    ...Shadows.float,
  },
  returnAmountBox: {
    width: '100%',
    backgroundColor: EL.surfaceLow,
    borderRadius: Radii.lg,
    padding: Space.xl,
    marginVertical: Space.xl,
    alignItems: 'center',
  },
  returnAmountLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: EL.primary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: Space.sm,
  },
  returnAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  returnCurrency: {
    fontSize: 28,
    fontWeight: '700',
    color: 'rgba(19, 30, 25, 0.4)',
  },
  returnAmountInput: {
    fontSize: 48,
    fontWeight: '800',
    color: EL.onSurface,
    letterSpacing: -1,
    minWidth: 120,
    textAlign: 'center',
  },
  returnChipRow: {
    flexDirection: 'row',
    gap: Space.md,
    marginBottom: Space.lg,
  },
  returnChip: {
    flex: 1,
    paddingVertical: Space.md,
    paddingHorizontal: Space.sm,
    borderRadius: Radii.md,
    backgroundColor: EL.surfaceCard,
    alignItems: 'center',
    ...Shadows.card,
  },
  returnChipLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: EL.primary,
    letterSpacing: 0.5,
  },
  returnChipValue: {
    fontSize: 12,
    fontWeight: '600',
    color: EL.onSurfaceSec,
    marginTop: 2,
  },
});
