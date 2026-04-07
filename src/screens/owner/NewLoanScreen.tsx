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
import { ELCard } from '@/components/common/ELCard';
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
    if (!lineId) {
      Alert.alert(t('common.error_generic'), 'Pick a line');
      return;
    }
    try {
      const result = await createLoan.mutateAsync({
        borrowerId,
        lineId,
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
      navigation.replace('LoanPlan', { loanId: result.loan.id });
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
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>{t('loan.title')}</Text>

          {/* ── Borrower Selector ── */}
          {borrower ? (
            <View style={styles.borrowerCard}>
              <Avatar name={borrower.name} size={48} photoUri={borrower.photo_url} />
              <View style={styles.borrowerInfo}>
                <Text style={styles.borrowerName}>{borrower.name}</Text>
                {borrower.phone ? (
                  <Text style={styles.borrowerPhone}>{borrower.phone}</Text>
                ) : null}
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={EL.onSurfaceMuted} />
            </View>
          ) : null}

          {/* ── Line Type ── */}
          <Text style={styles.sectionLabel}>{t('loan.line')}</Text>
          <View style={styles.chipGrid}>
            {(lines ?? []).map((line) => {
              const active = lineId === line.id;
              return (
                <Pressable
                  key={line.id}
                  onPress={() => setLineId(line.id)}
                  style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
                >
                  <Text style={[styles.chipLabel, active && { color: EL.white }]}>
                    {line.name}
                  </Text>
                  <Text style={[styles.chipSub, active && { color: 'rgba(255,255,255,0.7)' }]}>
                    {t(`lines.type_${line.type}`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {lines && lines.length === 0 ? (
            <Text style={styles.hint}>No lines yet \u2014 create one in the Lines tab.</Text>
          ) : null}

          {/* ── Principal ── */}
          <Text style={styles.sectionLabel}>{t('loan.principal')} (\u0B85\u0B9A\u0BB2\u0BCD)</Text>
          <View style={styles.bigInput}>
            <Text style={styles.bigPrefix}>\u20B9</Text>
            <TextInput
              style={styles.bigInputText}
              value={principal}
              onChangeText={handlePrincipalChange}
              keyboardType="number-pad"
              placeholder="50,000"
              placeholderTextColor={EL.outline}
            />
          </View>

          {/* ── EMI ── */}
          <Text style={styles.sectionLabel}>
            {isInterestOnly ? t('loan.interest_amount') : t('loan.emi')}
          </Text>
          <View style={styles.inputCard}>
            <Text style={styles.inputPrefix}>\u20B9</Text>
            <TextInput
              style={styles.inputText}
              value={emiAmount}
              onChangeText={handleEmiChange}
              keyboardType="number-pad"
              placeholder="600"
              placeholderTextColor={EL.outline}
            />
          </View>

          {/* ── Installments ── */}
          <Text style={styles.sectionLabel}>{t('loan.installments')}</Text>
          <View style={styles.stepperRow}>
            <Pressable
              style={styles.stepperBtn}
              onPress={() => {
                const n = Math.max(1, Number(installments) - 1);
                handleInstallmentsChange(String(n));
              }}
            >
              <MaterialCommunityIcons name="minus" size={20} color={EL.primary} />
            </Pressable>
            <View style={styles.stepperValue}>
              <TextInput
                style={styles.stepperText}
                value={installments}
                onChangeText={handleInstallmentsChange}
                keyboardType="number-pad"
                placeholder="100"
                placeholderTextColor={EL.outline}
                textAlign="center"
              />
            </View>
            <Pressable
              style={styles.stepperBtn}
              onPress={() => handleInstallmentsChange(String(Number(installments || 0) + 1))}
            >
              <MaterialCommunityIcons name="plus" size={20} color={EL.primary} />
            </Pressable>
          </View>

          {/* ── Start Date ── */}
          <Text style={styles.sectionLabel}>{t('loan.start_date')} (\u0BA4\u0BCA\u0B9F\u0B95\u0BCD\u0B95 \u0BA4\u0BC7\u0BA4\u0BBF)</Text>
          <Pressable style={styles.dateCard} onPress={() => setShowDatePicker(!showDatePicker)}>
            <Text style={styles.dateText}>
              {startDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </Text>
            <MaterialCommunityIcons name="calendar" size={20} color={EL.primary} />
          </Pressable>
          {showDatePicker ? (
            <View style={styles.chipGrid}>
              {[0, 1, 2, 3, 7, 14].map((offset) => {
                const d = new Date();
                d.setDate(d.getDate() + offset);
                const label = offset === 0 ? 'Today' : offset === 1 ? 'Tomorrow' : `+${offset}d`;
                const isSelected = startDate.toDateString() === d.toDateString();
                return (
                  <Pressable
                    key={offset}
                    style={[styles.chip, isSelected ? styles.chipActive : styles.chipInactive]}
                    onPress={() => { setStartDate(d); setShowDatePicker(false); }}
                  >
                    <Text style={[styles.chipLabel, isSelected && { color: EL.white }]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {/* ── Grace Period ── */}
          <Text style={styles.sectionLabel}>{t('loan.grace_period')}</Text>
          <View style={styles.chipGrid}>
            {[0, 1, 2, 3].map((days) => {
              const active = gracePeriod === days;
              return (
                <Pressable
                  key={days}
                  style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
                  onPress={() => setGracePeriod(days)}
                >
                  <Text style={[styles.chipLabel, active && { color: EL.white }]}>
                    {days === 0 ? 'None' : `${days} day${days > 1 ? 's' : ''}`}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.hint}>{t('loan.grace_hint')}</Text>

          {/* ── Penalty ── */}
          <Text style={styles.sectionLabel}>{t('loan.penalty_type')}</Text>
          <View style={styles.chipGrid}>
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
                  style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
                >
                  <Text style={[styles.chipLabel, active && { color: EL.white }]}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>
          {penaltyType !== 'none' ? (
            <>
              <Text style={styles.sectionLabel}>{t('loan.penalty_amount')}</Text>
              <View style={styles.inputCard}>
                <Text style={styles.inputPrefix}>{penaltyType === 'flat' ? '\u20B9' : '%'}</Text>
                <TextInput
                  style={styles.inputText}
                  value={penaltyAmount}
                  onChangeText={(v) => setPenaltyAmount(v.replace(/\D/g, ''))}
                  keyboardType="number-pad"
                  placeholderTextColor={EL.outline}
                />
              </View>
            </>
          ) : null}

          {/* ── Product description (enterprise only) ── */}
          {lineType === 'enterprise' ? (
            <>
              <Text style={styles.sectionLabel}>{t('loan.product_desc')}</Text>
              <View style={styles.inputCard}>
                <TextInput
                  style={[styles.inputText, { flex: 1 }]}
                  value={productDesc}
                  onChangeText={setProductDesc}
                  placeholderTextColor={EL.outline}
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
            <ELCard variant="section" style={styles.previewCard}>
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
              <View style={styles.previewDate}>
                <Text style={styles.previewLabel}>Completion</Text>
                <Text style={Type.labelLg}>
                  {formatDateShort(new Date(summary.expectedEndDate))}
                </Text>
              </View>
            </ELCard>
          ) : null}

          {/* Spacer for fixed bottom */}
          <View style={{ height: 100 }} />
        </ScrollView>

        {/* ── Fixed Bottom ── */}
        <View style={styles.bottomBar}>
          <GradientButton
            title={t('loan.create')}
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
  content: { padding: Space.xl, paddingBottom: Space.xxl },
  title: { ...Type.displaySm, marginBottom: Space.md },

  // Borrower card
  borrowerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.lg,
    padding: Space.lg,
    marginBottom: Space.xxl,
    gap: Space.lg,
    ...Shadows.card,
  },
  borrowerInfo: { flex: 1 },
  borrowerName: { ...Type.titleLg, fontWeight: '700' },
  borrowerPhone: { ...Type.bodySm, color: EL.onSurfaceMuted, marginTop: 2 },

  // Section labels
  sectionLabel: {
    ...Type.labelSm,
    color: EL.onSurfaceSec,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Space.sm,
    marginTop: Space.lg,
    opacity: 0.7,
  },

  // Chip grid
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm, marginBottom: Space.sm },
  chip: {
    paddingHorizontal: Space.xl,
    paddingVertical: Space.md,
    borderRadius: Radii.md,
    minHeight: Touch.min,
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: EL.primary },
  chipInactive: { backgroundColor: EL.surfaceCard, ...Shadows.card },
  chipLabel: { ...Type.labelMd, color: EL.onSurface, fontWeight: '600' },
  chipSub: { ...Type.labelSm, color: EL.onSurfaceSec, marginTop: 2 },

  // Big input (principal)
  bigInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.lg,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.xl,
    ...Shadows.card,
  },
  bigPrefix: {
    ...Type.displaySm,
    color: EL.primary,
    fontWeight: '800',
    marginRight: Space.sm,
  },
  bigInputText: {
    flex: 1,
    fontSize: 32,
    fontWeight: '800',
    color: EL.onSurface,
  },

  // Regular input
  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.lg,
    paddingHorizontal: Space.lg,
    minHeight: Touch.comfortable,
    ...Shadows.card,
  },
  inputPrefix: {
    ...Type.titleLg,
    color: EL.onSurfaceSec,
    fontWeight: '700',
    marginRight: Space.sm,
  },
  inputText: {
    flex: 1,
    ...Type.titleLg,
    color: EL.onSurface,
    fontWeight: '700',
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
    backgroundColor: EL.surfaceHigh,
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
    ...Type.displaySm,
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
    minHeight: Touch.comfortable,
    marginBottom: Space.sm,
    ...Shadows.card,
  },
  dateText: { ...Type.titleMd, fontWeight: '600' },

  hint: { ...Type.labelSm, color: EL.onSurfaceMuted },

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
  previewCard: { marginTop: Space.xl },
  previewHeader: { flexDirection: 'row', alignItems: 'center', gap: Space.sm, marginBottom: Space.lg },
  previewTag: { ...Type.labelSm, color: EL.primary, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  previewGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  previewLabel: { ...Type.labelSm, color: EL.onSurfaceSec },
  previewValue: { ...Type.displaySm, fontWeight: '800', marginTop: Space.xs },
  previewDate: { marginTop: Space.lg, paddingTop: Space.md, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.04)' },

  // Bottom
  bottomBar: {
    paddingHorizontal: Space.xl,
    paddingVertical: Space.lg,
    paddingBottom: Space.xxxl,
    backgroundColor: 'rgba(250, 252, 251, 0.92)',
  },
});
