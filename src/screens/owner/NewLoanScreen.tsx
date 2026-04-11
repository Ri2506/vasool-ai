import React, { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
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
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Avatar } from '@/components/common/Avatar';
import { GradientButton } from '@/components/common/GradientButton';
import { EL, Common, Radii, Shadows, Space, Touch, Type } from '@/theme/emeraldLedger';
import { useLines } from '@/hooks/useLines';
import { useCreateLoan } from '@/hooks/useLoans';
import { useBorrower } from '@/hooks/useBorrowers';
import { computeLoan, suggestEmi } from '@/utils/loanCalc';
import { formatDateShort, formatRupees } from '@/utils/format';
import type { LineType } from '@/db/types';
import type { OwnerStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<OwnerStackParamList, 'NewLoan'>;

export function NewLoanScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const { borrowerId } = route.params;
  const { data: borrower } = useBorrower(borrowerId);
  const { data: lines } = useLines();
  const createLoan = useCreateLoan();

  const [principal, setPrincipal] = useState('');
  const [emiAmount, setEmiAmount] = useState('');
  const [emiTouched, setEmiTouched] = useState(false);
  const [installments, setInstallments] = useState('');
  const [lineId, setLineId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [gracePeriod, setGracePeriod] = useState(0);
  const [productDesc, setProductDesc] = useState('');
  const [penaltyType, setPenaltyType] = useState<'none' | 'flat' | 'percentage'>('none');
  const [penaltyAmount, setPenaltyAmount] = useState('');

  const selectedLine = lines?.find((l) => l.id === lineId);
  const lineType: LineType = selectedLine?.type ?? 'daily';
  const isInterestOnly = lineType === 'daily_interest' || lineType === 'weekly_interest' || lineType === 'monthly_interest';

  const summary = useMemo(() => {
    const p = Number(principal);
    const e = Number(emiAmount);
    const n = Number(installments);
    if (p > 0 && e > 0 && n > 0) {
      return computeLoan({ principal: p, emiAmount: e, totalInstallments: n, lineType, startDate });
    }
    return null;
  }, [principal, emiAmount, installments, lineType, startDate]);

  const handlePrincipalChange = (v: string) => {
    const clean = v.replace(/\D/g, '');
    setPrincipal(clean);
    if (clean && installments && !emiTouched) {
      setEmiAmount(String(suggestEmi(Number(clean), Number(installments), lineType)));
    }
  };

  const handleInstallmentsChange = (v: string) => {
    const clean = v.replace(/\D/g, '');
    setInstallments(clean);
    if (principal && clean && !emiTouched) {
      setEmiAmount(String(suggestEmi(Number(principal), Number(clean), lineType)));
    }
  };

  const handleEmiChange = (v: string) => {
    setEmiTouched(true);
    setEmiAmount(v.replace(/\D/g, ''));
  };

  const handleCreate = async () => {
    if (!summary) {
      Alert.alert(t('common.error_generic'), 'Fill principal, EMI, and installments');
      return;
    }
    try {
      const result = await createLoan.mutateAsync({
        borrowerId,
        lineId: lineId || 'default',
        principal: Number(principal),
        emiAmount: Number(emiAmount),
        totalInstallments: Number(installments),
        lineType,
        startDate,
        gracePeriodDays: gracePeriod,
        productDescription: productDesc.trim() || undefined,
        penaltyType: penaltyType === 'none' ? undefined : penaltyType,
        penaltyAmount: Number(penaltyAmount) || 0,
      });
      // After creating the loan, offer to add a guarantor
      Alert.alert(
        'Loan created',
        'Would you like to add a guarantor for this loan?',
        [
          { text: 'Skip', onPress: () => navigation.replace('LoanPlan', { loanId: result.loan.id }) },
          { text: 'Add Guarantor', onPress: () => navigation.replace('Guarantor', { loanId: result.loan.id }) },
        ]
      );
    } catch (e: any) {
      Alert.alert(t('common.error_generic'), e?.message ?? '');
    }
  };

  return (
    <SafeAreaView style={Common.screen}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* TopAppBar */}
        <View style={styles.appBar}>
          <View style={styles.appBarLeft}>
            <Pressable
              style={styles.backBtn}
              onPress={() => navigation.goBack()}
            >
              <MaterialCommunityIcons name="arrow-left" size={24} color={EL.onSurface} />
            </Pressable>
            <Text style={styles.appBarTitle}>New Loan</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {/* ── Borrower Selector ── */}
          <Text style={styles.sectionLabel}>SELECT BORROWER</Text>
          {borrower ? (
            <Pressable style={styles.borrowerCard}>
              <Avatar name={borrower.name} size={48} photoUri={borrower.photo_url} />
              <View style={styles.borrowerInfo}>
                <Text style={styles.borrowerName}>{borrower.name}</Text>
                <Text style={styles.borrowerRating}>
                  {borrower.phone ? `+91 ${borrower.phone}` : 'No phone'}
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color={EL.outline} />
            </Pressable>
          ) : null}

          {/* ── Line Type ── */}
          <Text style={styles.sectionLabel}>LINE TYPE</Text>
          <View style={styles.chipWrap}>
            {(lines ?? []).map((line) => {
              const active = lineId === line.id;
              return (
                <Pressable
                  key={line.id}
                  onPress={() => setLineId(line.id)}
                  style={[styles.lineChip, active ? styles.lineChipActive : styles.lineChipInactive]}
                >
                  <Text style={[styles.lineChipText, active && { color: EL.white }]}>
                    {line.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {lines && lines.length === 0 ? (
            <Text style={styles.hint}>No lines yet — create one in the Lines tab.</Text>
          ) : null}

          {/* ── Principal ── */}
          <Text style={styles.sectionLabel}>PRINCIPAL ({'\u0B85\u0B9A\u0BB2\u0BCD'})</Text>
          <View style={styles.bigInput}>
            <Text style={styles.bigPrefix}>{'\u20B9'}</Text>
            <TextInput
              style={styles.bigInputText}
              value={principal}
              onChangeText={handlePrincipalChange}
              keyboardType="number-pad"
              placeholder="50,000"
              placeholderTextColor={EL.outlineVariant}
            />
          </View>

          {/* ── EMI ── */}
          <Text style={styles.sectionLabel}>
            {isInterestOnly ? t('loan.interest_amount') : 'EMI AMOUNT'}
          </Text>
          <View style={styles.emiInput}>
            <Text style={styles.emiPrefix}>{'\u20B9'}</Text>
            <TextInput
              style={styles.emiInputText}
              value={emiAmount}
              onChangeText={handleEmiChange}
              keyboardType="number-pad"
              placeholder="600"
              placeholderTextColor={EL.outlineVariant}
            />
          </View>

          {/* ── Installments ── */}
          <Text style={styles.sectionLabel}>NUMBER OF INSTALLMENTS</Text>
          <View style={styles.stepperRow}>
            <Pressable
              style={styles.stepperBtn}
              onPress={() => {
                const n = Math.max(1, Number(installments) - 1);
                handleInstallmentsChange(String(n));
              }}
            >
              <MaterialCommunityIcons name="minus" size={24} color={EL.primary} />
            </Pressable>
            <View style={styles.stepperValue}>
              <TextInput
                style={styles.stepperText}
                value={installments}
                onChangeText={handleInstallmentsChange}
                keyboardType="number-pad"
                placeholder="100"
                placeholderTextColor={EL.outlineVariant}
                textAlign="center"
              />
            </View>
            <Pressable
              style={styles.stepperBtn}
              onPress={() => handleInstallmentsChange(String(Number(installments || 0) + 1))}
            >
              <MaterialCommunityIcons name="plus" size={24} color={EL.primary} />
            </Pressable>
          </View>

          {/* ── Start Date ── */}
          <Text style={styles.sectionLabel}>START DATE ({'\u0BA4\u0BCA\u0B9F\u0B95\u0BCD\u0B95 \u0BA4\u0BC7\u0BA4\u0BBF'})</Text>
          <Pressable style={styles.dateCard} onPress={() => setShowDatePicker(!showDatePicker)}>
            <Text style={styles.dateText}>
              {startDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </Text>
            <MaterialCommunityIcons name="calendar" size={24} color={EL.primary} />
          </Pressable>
          {showDatePicker ? (
            <View style={styles.chipWrap}>
              {[0, 1, 2, 3, 7, 14].map((offset) => {
                const d = new Date();
                d.setDate(d.getDate() + offset);
                const label = offset === 0 ? 'Today' : offset === 1 ? 'Tomorrow' : `+${offset}d`;
                const isSelected = startDate.toDateString() === d.toDateString();
                return (
                  <Pressable
                    key={offset}
                    style={[styles.lineChip, isSelected ? styles.lineChipActive : styles.lineChipInactive]}
                    onPress={() => { setStartDate(d); setShowDatePicker(false); }}
                  >
                    <Text style={[styles.lineChipText, isSelected && { color: EL.white }]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {/* ── Grace Period ── */}
          <Text style={styles.sectionLabel}>GRACE PERIOD</Text>
          <View style={styles.graceRow}>
            {[0, 1, 2, 3].map((days) => {
              const active = gracePeriod === days;
              return (
                <Pressable
                  key={days}
                  style={[styles.graceChip, active ? styles.graceChipActive : styles.graceChipInactive]}
                  onPress={() => setGracePeriod(days)}
                >
                  <Text style={[styles.graceChipText, active && { color: EL.onSurface, fontWeight: '700' }]}>
                    {days === 0 ? '0 days' : `${days} day${days > 1 ? 's' : ''}`}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* ── Penalty ── */}
          <Text style={styles.sectionLabel}>{t('loan.penalty_type')}</Text>
          <View style={styles.chipWrap}>
            {[
              { val: 'none' as const, label: t('loan.penalty_none') },
              { val: 'flat' as const, label: t('loan.penalty_flat') },
              { val: 'percentage' as const, label: t('loan.penalty_pct') },
            ].map((opt) => {
              const active = penaltyType === opt.val;
              return (
                <Pressable
                  key={opt.val}
                  onPress={() => setPenaltyType(opt.val)}
                  style={[styles.lineChip, active ? styles.lineChipActive : styles.lineChipInactive]}
                >
                  <Text style={[styles.lineChipText, active && { color: EL.white }]}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>
          {penaltyType !== 'none' ? (
            <>
              <Text style={styles.sectionLabel}>{t('loan.penalty_amount')}</Text>
              <View style={styles.emiInput}>
                <Text style={styles.emiPrefix}>{penaltyType === 'flat' ? '\u20B9' : '%'}</Text>
                <TextInput
                  style={styles.emiInputText}
                  value={penaltyAmount}
                  onChangeText={(v) => setPenaltyAmount(v.replace(/\D/g, ''))}
                  keyboardType="number-pad"
                  placeholderTextColor={EL.outlineVariant}
                />
              </View>
            </>
          ) : null}

          {/* ── Product description (enterprise only) ── */}
          {lineType === 'enterprise' ? (
            <>
              <Text style={styles.sectionLabel}>{t('loan.product_desc')}</Text>
              <View style={styles.emiInput}>
                <TextInput
                  style={[styles.emiInputText, { flex: 1 }]}
                  value={productDesc}
                  onChangeText={setProductDesc}
                  placeholderTextColor={EL.outlineVariant}
                />
              </View>
            </>
          ) : null}

          {isInterestOnly ? (
            <View style={styles.infoBanner}>
              <MaterialCommunityIcons name="information-outline" size={16} color={EL.info} />
              <Text style={styles.infoBannerText}>{t('loan.interest_only')}</Text>
            </View>
          ) : null}

          {/* ── Preview Card ── */}
          {summary ? (
            <View style={styles.previewCard}>
              <View style={styles.previewHeader}>
                <MaterialCommunityIcons name="chart-line" size={14} color={EL.primary} />
                <Text style={styles.previewTag}>LOAN PROJECTION</Text>
              </View>
              <View style={styles.previewGrid}>
                <View>
                  <Text style={styles.previewLabel}>Total repayment</Text>
                  <Text style={styles.previewValue}>{formatRupees(summary.totalRepayment)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.previewLabel}>Interest earned</Text>
                  <Text style={[styles.previewValue, { color: EL.primary }]}>
                    {formatRupees(summary.interest)}
                  </Text>
                </View>
              </View>
              <View style={styles.previewDateRow}>
                <Text style={styles.previewLabel}>Completion Schedule</Text>
                <View style={styles.previewDateInner}>
                  <Text style={styles.previewDateText}>
                    {formatDateShort(new Date(summary.expectedEndDate))}
                  </Text>
                  <View style={styles.previewDatePill}>
                    <Text style={styles.previewDatePillText}>
                      {Number(installments)} working days
                    </Text>
                  </View>
                </View>
              </View>
              <Text style={[styles.viewPlanText, { paddingVertical: Space.sm }]}>
                Full schedule available after creating the loan
              </Text>
            </View>
          ) : null}

          {/* Spacer for fixed bottom */}
          <View style={{ height: 120 }} />
        </ScrollView>

        {/* ── Fixed Bottom ── */}
        <View style={styles.bottomBar}>
          <GradientButton
            title="Create Loan"
            onPress={handleCreate}
            loading={createLoan.isPending}
            icon={<MaterialCommunityIcons name="check-circle" size={20} color={EL.white} />}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // AppBar
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Space.xl,
    paddingVertical: Space.lg,
  },
  appBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.lg,
  },
  backBtn: {
    padding: Space.sm,
    marginLeft: -Space.sm,
    borderRadius: Radii.pill,
  },
  appBarTitle: {
    ...Type.displaySm,
    fontSize: 20,
    fontWeight: '700',
  },

  content: { paddingHorizontal: Space.xl, paddingBottom: Space.xxl },

  // Section labels — stitch uppercase tracking
  sectionLabel: {
    fontFamily: Type.labelSm.fontFamily,
    fontSize: 12,
    fontWeight: '700',
    color: EL.onSurfaceSec,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Space.md,
    marginTop: Space.xxl,
    opacity: 0.7,
  },

  // Borrower card
  borrowerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.lg,
    padding: Space.lg,
    gap: Space.lg,
    ...Shadows.card,
  },
  borrowerInfo: { flex: 1 },
  borrowerName: { ...Type.titleLg, fontWeight: '700', fontSize: 18 },
  borrowerRating: { ...Type.bodySm, color: EL.onSurfaceSec, marginTop: 2 },

  // Line type chips
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space.sm,
  },
  lineChip: {
    paddingHorizontal: Space.xl,
    paddingVertical: Space.md,
    borderRadius: Radii.md,
    minHeight: Touch.min,
    justifyContent: 'center',
  },
  lineChipActive: { backgroundColor: EL.primaryContainer },
  lineChipInactive: { backgroundColor: EL.surfaceCard, ...Shadows.card },
  lineChipText: { ...Type.labelMd, fontWeight: '600', color: EL.onSurfaceSec, fontSize: 14 },

  // Big input (principal)
  bigInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.lg,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.xxl,
    ...Shadows.card,
  },
  bigPrefix: {
    fontSize: 30,
    fontWeight: '800',
    color: EL.primary,
    marginRight: Space.sm,
  },
  bigInputText: {
    flex: 1,
    fontSize: 36,
    fontWeight: '800',
    color: EL.onSurface,
  },

  // EMI input
  emiInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.lg,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.xl,
    ...Shadows.card,
  },
  emiPrefix: {
    fontSize: 22,
    fontWeight: '700',
    color: EL.onSurfaceSec,
    marginRight: Space.sm,
  },
  emiInputText: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    color: EL.onSurface,
  },

  // Stepper
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
  },
  stepperBtn: {
    width: 56,
    height: 56,
    borderRadius: Radii.lg,
    backgroundColor: EL.surfaceHighest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    flex: 1,
    height: 56,
    borderRadius: Radii.lg,
    backgroundColor: EL.surfaceCard,
    justifyContent: 'center',
    ...Shadows.card,
  },
  stepperText: {
    fontSize: 24,
    fontWeight: '700',
    color: EL.onSurface,
  },

  // Date
  dateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.lg,
    paddingHorizontal: Space.xl,
    paddingVertical: Space.xl,
    ...Shadows.card,
  },
  dateText: { fontSize: 18, fontWeight: '600', color: EL.onSurface },

  // Grace period
  graceRow: {
    flexDirection: 'row',
    gap: Space.sm,
  },
  graceChip: {
    flex: 1,
    paddingVertical: Space.md,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  graceChipActive: { backgroundColor: EL.primaryFixed },
  graceChipInactive: { backgroundColor: EL.surfaceCard, ...Shadows.card },
  graceChipText: { ...Type.labelMd, fontWeight: '500', color: EL.onSurfaceSec, fontSize: 14 },

  hint: { ...Type.labelSm, color: EL.onSurfaceMuted, marginTop: Space.xs },

  // Info banner
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: EL.infoContainer,
    borderRadius: Radii.md,
    padding: Space.md,
    marginVertical: Space.md,
    gap: Space.sm,
  },
  infoBannerText: { ...Type.bodySm, color: EL.info, fontWeight: '600', flex: 1 },

  // Preview card
  previewCard: {
    marginTop: Space.xxl,
    padding: Space.xl,
    borderRadius: Radii.xxl,
    backgroundColor: EL.surfaceLow,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    marginBottom: Space.lg,
  },
  previewTag: {
    fontSize: 10,
    fontWeight: '700',
    color: EL.primary,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    opacity: 0.6,
  },
  previewGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  previewLabel: { fontSize: 12, color: EL.onSurfaceSec },
  previewValue: {
    fontSize: 20,
    fontWeight: '800',
    color: EL.onSurface,
    marginTop: Space.xs,
  },
  previewDateRow: {
    marginTop: Space.lg,
    paddingTop: Space.md,
  },
  previewDateInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    marginTop: Space.xs,
  },
  previewDateText: {
    fontSize: 16,
    fontWeight: '600',
    color: EL.onSurface,
  },
  previewDatePill: {
    backgroundColor: EL.secondaryContainer,
    paddingHorizontal: Space.sm,
    paddingVertical: Space.xs,
    borderRadius: Radii.sm,
  },
  previewDatePillText: {
    fontSize: 12,
    color: EL.secondary,
    fontWeight: '600',
  },
  viewPlanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.sm,
    paddingTop: Space.lg,
    marginTop: Space.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,105,72,0.1)',
  },
  viewPlanText: {
    fontSize: 14,
    fontWeight: '700',
    color: EL.primary,
  },

  // Bottom
  bottomBar: {
    paddingHorizontal: Space.xl,
    paddingVertical: Space.lg,
    paddingBottom: Space.xxxl,
    backgroundColor: 'rgba(240, 253, 244, 0.8)',
  },
});
