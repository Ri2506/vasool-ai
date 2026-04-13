// NewLoanScreen — dynamic loan config wizard (Month 1 Week 2)
//
// Five-step flow that lets the owner configure any loan structure:
//   1. Disbursement  — amount + optional line
//   2. Repayment type — principal+interest or interest-only
//   3. Interest      — type (front_loaded/flat/reducing/none), rate, period
//   4. Frequency     — daily/weekly/monthly, tenure count, start date, grace
//   5. Preview       — live numbers via computeLoanTerms(), confirm + create
//
// All six loan structures supported by computeLoanTerms are reachable:
//   - Thandal classic (P+I, front_loaded, daily)
//   - Flat interest (P+I, flat, any freq)
//   - Reducing EMI (P+I, reducing, monthly)
//   - Interest-only rolling (I-only, flat)
//   - Interest-only + upfront fee (I-only, front_loaded)
//   - Zero interest (P+I, none)

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
import { useCreateLoanFromTerms } from '@/hooks/useLoans';
import { useBorrower } from '@/hooks/useBorrowers';
import { computeLoanTerms, type ComputeLoanTermsInput } from '@/utils/loanCalc';
import { formatDateShort, formatRupees } from '@/utils/format';
import type {
  RepaymentType,
  InterestType,
  CollectionFrequency,
  InterestRatePeriod,
} from '@/db/types';
import type { OwnerStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<OwnerStackParamList, 'NewLoan'>;

// ─── Step config ───────────────────────────────────────────────────────

const STEPS = [
  { key: 'disbursement', label: 'Amount' },
  { key: 'repayment', label: 'Repayment' },
  { key: 'interest', label: 'Interest' },
  { key: 'frequency', label: 'Schedule' },
  { key: 'preview', label: 'Review' },
] as const;

// Simplified: thandal/money-lending uses front-loaded interest exclusively.
// Flat, reducing, and none are removed from the wizard per user feedback.
// The calculator still supports them — just not exposed in the UI.

type StepKey = (typeof STEPS)[number]['key'];

// Quick presets for owner convenience
const REPAYMENT_OPTIONS: Array<{ value: RepaymentType; label: string; sub: string }> = [
  {
    value: 'principal_plus_interest',
    label: 'Principal + Interest',
    sub: 'Loan closes when all installments paid',
  },
  {
    value: 'interest_only',
    label: 'Interest Only',
    sub: 'Principal returned separately, loan rolls',
  },
];

const FREQUENCY_OPTIONS: Array<{ value: CollectionFrequency; label: string; sub: string }> = [
  { value: 'daily', label: 'Daily', sub: 'Collect every day' },
  { value: 'weekly', label: 'Weekly', sub: 'Collect once a week' },
  { value: 'monthly', label: 'Monthly', sub: 'Collect once a month' },
];

// ─── Main component ────────────────────────────────────────────────────

export function NewLoanScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const { borrowerId } = route.params;
  const { data: borrower } = useBorrower(borrowerId);
  const { data: lines } = useLines();
  const createLoan = useCreateLoanFromTerms();

  const [stepIndex, setStepIndex] = useState(0);
  const step: StepKey = STEPS[stepIndex].key;

  // ── Form state ──
  const [disbursedAmount, setDisbursedAmount] = useState('');
  const [lineId, setLineId] = useState<string | null>(null);
  const [repaymentType, setRepaymentType] = useState<RepaymentType>('principal_plus_interest');
  // Simplified: always front_loaded, rate is always per month.
  // The calculator supports other types but the UI doesn't expose them.
  const interestType: InterestType = 'front_loaded';
  const interestRatePeriod: InterestRatePeriod = 'month';
  const [interestRate, setInterestRate] = useState(''); // displayed as percent, e.g. "2" = 2%
  const [upfrontFee, setUpfrontFee] = useState('');
  const [frequency, setFrequency] = useState<CollectionFrequency>('daily');
  const [tenureCount, setTenureCount] = useState('');
  const [startDate, setStartDate] = useState<Date>(() => new Date());
  // Grace period is kept as 0 by default — removed from wizard UI per user feedback.
  // Field still exists in schema for backward compat and optional per-loan override later.
  const gracePeriod = 0;

  // ── Derived values ──
  const disbursedNum = Number(disbursedAmount) || 0;
  const rateDecimal = (Number(interestRate) || 0) / 100;
  const tenureNum = Number(tenureCount) || 0;

  // For interest_only + monthly + no-tenure, default to a 12-month window
  // (the loan will auto-extend when it runs out; user can change later).
  const isNoTenureFlow =
    repaymentType === 'interest_only' && frequency === 'monthly' && tenureCount === '';
  const effectiveTenure = isNoTenureFlow ? 12 : tenureNum;

  const computeInput: ComputeLoanTermsInput | null = useMemo(() => {
    if (disbursedNum <= 0 || effectiveTenure <= 0) return null;
    return {
      disbursedAmount: disbursedNum,
      repaymentType,
      interestType,
      interestRate: rateDecimal,
      interestRatePeriod,
      frequency,
      tenureCount: effectiveTenure,
      startDate: startDate.getTime(),
      upfrontFee:
        repaymentType === 'interest_only' && interestType === 'front_loaded'
          ? Number(upfrontFee) || 0
          : undefined,
    };
  }, [
    disbursedNum,
    effectiveTenure,
    repaymentType,
    interestType,
    rateDecimal,
    interestRatePeriod,
    frequency,
    startDate,
    upfrontFee,
  ]);

  const terms = useMemo(() => {
    if (!computeInput) return null;
    try {
      return computeLoanTerms(computeInput);
    } catch {
      return null;
    }
  }, [computeInput]);

  // ── Step validation ──
  const canAdvance = (): boolean => {
    if (step === 'disbursement') return disbursedNum > 0;
    if (step === 'repayment') return true; // radio is always set
    if (step === 'interest') {
      return rateDecimal > 0;
    }
    if (step === 'frequency') {
      // "No tenure" rolling mode is valid (interest_only + monthly + empty tenure)
      return isNoTenureFlow || tenureNum > 0;
    }
    return true;
  };

  const goNext = () => {
    if (!canAdvance()) {
      Alert.alert('Incomplete', 'Please fill in the required fields to continue.');
      return;
    }
    if (stepIndex < STEPS.length - 1) setStepIndex(stepIndex + 1);
  };

  const goBack = () => {
    if (stepIndex === 0) {
      navigation.goBack();
      return;
    }
    setStepIndex(stepIndex - 1);
  };

  const handleCreate = async () => {
    if (!terms || !computeInput) {
      Alert.alert('Incomplete', 'Please review all fields before creating the loan.');
      return;
    }
    try {
      const result = await createLoan.mutateAsync({
        borrowerId,
        lineId: lineId ?? undefined,
        disbursedAmount: computeInput.disbursedAmount,
        repaymentType: computeInput.repaymentType,
        interestType: computeInput.interestType,
        interestRate: computeInput.interestRate,
        interestRatePeriod: computeInput.interestRatePeriod,
        frequency: computeInput.frequency,
        tenureCount: computeInput.tenureCount,
        startDate: computeInput.startDate,
        upfrontFee: computeInput.upfrontFee,
        gracePeriodDays: gracePeriod,
      });
      Alert.alert('Loan created', 'Would you like to add a guarantor for this loan?', [
        {
          text: 'Skip',
          onPress: () => navigation.replace('LoanPlan', { loanId: result.loan.id }),
        },
        {
          text: 'Add Guarantor',
          onPress: () => navigation.replace('Guarantor', { loanId: result.loan.id }),
        },
      ]);
    } catch (e: any) {
      Alert.alert(t('common.error_generic'), e?.message ?? 'Failed to create loan');
    }
  };

  // ── Render helpers ──
  return (
    <SafeAreaView style={Common.screen}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Top bar */}
        <View style={styles.appBar}>
          <Pressable style={styles.backBtn} onPress={goBack}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={EL.onSurface} />
          </Pressable>
          <Text style={styles.appBarTitle}>New Loan</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Step indicator */}
        <StepIndicator stepIndex={stepIndex} />

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Borrower card is always visible */}
          {borrower ? (
            <View style={styles.borrowerCard}>
              <Avatar name={borrower.name} size={44} photoUri={borrower.photo_url} />
              <View style={styles.borrowerInfo}>
                <Text style={styles.borrowerName}>{borrower.name}</Text>
                <Text style={styles.borrowerSub}>
                  {borrower.phone ? `+91 ${borrower.phone}` : 'No phone'}
                </Text>
              </View>
            </View>
          ) : null}

          {/* Step body */}
          {step === 'disbursement' && (
            <DisbursementStep
              disbursedAmount={disbursedAmount}
              setDisbursedAmount={setDisbursedAmount}
              lines={lines ?? []}
              lineId={lineId}
              setLineId={setLineId}
            />
          )}
          {step === 'repayment' && (
            <RepaymentStep
              repaymentType={repaymentType}
              setRepaymentType={setRepaymentType}
            />
          )}
          {step === 'interest' && (
            <SimpleInterestStep
              interestRate={interestRate}
              setInterestRate={setInterestRate}
              repaymentType={repaymentType}
              upfrontFee={upfrontFee}
              setUpfrontFee={setUpfrontFee}
            />
          )}
          {step === 'frequency' && (
            <FrequencyStep
              frequency={frequency}
              setFrequency={setFrequency}
              tenureCount={tenureCount}
              setTenureCount={setTenureCount}
              startDate={startDate}
              setStartDate={setStartDate}
              repaymentType={repaymentType}
            />
          )}
          {step === 'preview' && (
            <PreviewStep
              terms={terms}
              disbursedNum={disbursedNum}
              repaymentType={repaymentType}
              interestType={interestType}
              interestRate={Number(interestRate) || 0}
              interestRatePeriod={interestRatePeriod}
              frequency={frequency}
              tenureCount={tenureNum}
            />
          )}

          <View style={{ height: 120 }} />
        </ScrollView>

        {/* Bottom bar */}
        <View style={styles.bottomBar}>
          {step === 'preview' ? (
            <GradientButton
              title="Create Loan"
              onPress={handleCreate}
              loading={createLoan.isPending}
              disabled={!terms}
              icon={<MaterialCommunityIcons name="check-circle" size={20} color={EL.white} />}
            />
          ) : (
            <GradientButton
              title="Next"
              onPress={goNext}
              disabled={!canAdvance()}
              icon={<MaterialCommunityIcons name="arrow-right" size={20} color={EL.white} />}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Step components ───────────────────────────────────────────────────

function StepIndicator({ stepIndex }: { stepIndex: number }) {
  return (
    <View style={styles.indicatorRow}>
      {STEPS.map((s, i) => (
        <View key={s.key} style={styles.indicatorItem}>
          <View
            style={[
              styles.indicatorDot,
              i <= stepIndex ? styles.indicatorDotActive : styles.indicatorDotInactive,
            ]}
          >
            {i < stepIndex ? (
              <MaterialCommunityIcons name="check" size={12} color={EL.white} />
            ) : (
              <Text
                style={[
                  styles.indicatorNumber,
                  i === stepIndex ? { color: EL.white } : null,
                ]}
              >
                {i + 1}
              </Text>
            )}
          </View>
          <Text style={styles.indicatorLabel}>{s.label}</Text>
        </View>
      ))}
    </View>
  );
}

interface DisbursementStepProps {
  disbursedAmount: string;
  setDisbursedAmount: (v: string) => void;
  lines: Array<{ id: string; name: string; type: string }>;
  lineId: string | null;
  setLineId: (v: string | null) => void;
}

function DisbursementStep(props: DisbursementStepProps) {
  const { disbursedAmount, setDisbursedAmount, lines, lineId, setLineId } = props;
  return (
    <View>
      <Text style={styles.stepTitle}>How much are you giving?</Text>
      <Text style={styles.stepSub}>The actual amount handed to the borrower.</Text>

      <Text style={styles.sectionLabel}>DISBURSED AMOUNT</Text>
      <View style={styles.bigInput}>
        <Text style={styles.bigPrefix}>{'\u20B9'}</Text>
        <TextInput
          style={styles.bigInputText}
          value={disbursedAmount}
          onChangeText={(v) => setDisbursedAmount(v.replace(/\D/g, ''))}
          keyboardType="number-pad"
          placeholder="10,000"
          placeholderTextColor={EL.outlineVariant}
        />
      </View>

      {lines.length > 0 ? (
        <>
          <Text style={styles.sectionLabel}>ASSIGN TO LINE (optional)</Text>
          <View style={styles.chipWrap}>
            <Pressable
              onPress={() => setLineId(null)}
              hitSlop={8}
              style={[
                styles.chipBtn,
                lineId === null ? styles.chipBtnActive : styles.chipBtnInactive,
              ]}
            >
              <Text style={[styles.chipText, lineId === null && { color: EL.white }]}>
                No line
              </Text>
            </Pressable>
            {lines.map((line) => {
              const active = lineId === line.id;
              return (
                <Pressable
                  key={line.id}
                  onPress={() => setLineId(line.id)}
                  hitSlop={8}
                  style={[styles.chipBtn, active ? styles.chipBtnActive : styles.chipBtnInactive]}
                >
                  <Text style={[styles.chipText, active && { color: EL.white }]}>{line.name}</Text>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}
    </View>
  );
}

interface RepaymentStepProps {
  repaymentType: RepaymentType;
  setRepaymentType: (v: RepaymentType) => void;
}

function RepaymentStep(props: RepaymentStepProps) {
  const { repaymentType, setRepaymentType } = props;
  return (
    <View>
      <Text style={styles.stepTitle}>How will the loan be repaid?</Text>
      <Text style={styles.stepSub}>Choose the repayment structure.</Text>

      <View style={{ gap: Space.md, marginTop: Space.lg }}>
        {REPAYMENT_OPTIONS.map((opt) => {
          const active = repaymentType === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => setRepaymentType(opt.value)}
              style={[styles.optionCard, active ? styles.optionCardActive : null]}
            >
              <View style={styles.optionRadio}>
                {active ? <View style={styles.optionRadioInner} /> : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.optionLabel}>{opt.label}</Text>
                <Text style={styles.optionSub}>{opt.sub}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

interface SimpleInterestStepProps {
  interestRate: string;
  setInterestRate: (v: string) => void;
  repaymentType: RepaymentType;
  upfrontFee: string;
  setUpfrontFee: (v: string) => void;
}

function SimpleInterestStep(props: SimpleInterestStepProps) {
  const { interestRate, setInterestRate, repaymentType, upfrontFee, setUpfrontFee } = props;

  const isInterestOnly = repaymentType === 'interest_only';

  return (
    <View>
      <Text style={styles.stepTitle}>Interest rate</Text>
      <Text style={styles.stepSub}>
        {isInterestOnly
          ? 'Rate per installment. E.g. 3% monthly = ₹300 on ₹10,000 every month until principal returned.'
          : 'Flat % of loan amount. E.g. 20% on ₹10,000 = ₹2,000 total interest.'}
      </Text>

      <Text style={styles.sectionLabel}>
        {isInterestOnly ? 'RATE PER INSTALLMENT' : 'INTEREST %'}
      </Text>
      <View style={styles.emiInput}>
        <TextInput
          style={styles.emiInputText}
          value={interestRate}
          onChangeText={(v) => setInterestRate(v.replace(/[^0-9.]/g, ''))}
          keyboardType="decimal-pad"
          placeholder={isInterestOnly ? '3' : '20'}
          placeholderTextColor={EL.outlineVariant}
          autoFocus
        />
        <Text style={styles.emiPrefix}>%</Text>
      </View>

      {/* Quick rate presets */}
      <View style={[styles.chipWrap, { marginTop: Space.lg }]}>
        {(isInterestOnly ? ['1', '2', '3', '5'] : ['10', '15', '20', '25', '30']).map((r) => {
          const active = interestRate === r;
          return (
            <Pressable
              key={r}
              onPress={() => setInterestRate(r)}
              style={[styles.chipBtn, active ? styles.chipBtnActive : styles.chipBtnInactive]}
            >
              <Text style={[styles.chipText, active && { color: EL.white }]}>{r}%</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Optional upfront fee — only for interest_only loans */}
      {repaymentType === 'interest_only' ? (
        <>
          <Text style={styles.sectionLabel}>UPFRONT FEE (optional)</Text>
          <Text style={styles.hint}>
            One-time fee collected at disbursement.
          </Text>
          <View style={styles.emiInput}>
            <Text style={styles.emiPrefix}>{'\u20B9'}</Text>
            <TextInput
              style={styles.emiInputText}
              value={upfrontFee}
              onChangeText={(v) => setUpfrontFee(v.replace(/\D/g, ''))}
              keyboardType="number-pad"
              placeholder="500"
              placeholderTextColor={EL.outlineVariant}
            />
          </View>
        </>
      ) : null}
    </View>
  );
}

interface FrequencyStepProps {
  frequency: CollectionFrequency;
  setFrequency: (v: CollectionFrequency) => void;
  tenureCount: string;
  setTenureCount: (v: string) => void;
  startDate: Date;
  setStartDate: (d: Date) => void;
  repaymentType: RepaymentType;
}

function FrequencyStep(props: FrequencyStepProps) {
  const {
    frequency,
    setFrequency,
    tenureCount,
    setTenureCount,
    startDate,
    setStartDate,
    repaymentType,
  } = props;

  const tenureLabel = {
    daily: 'DAYS',
    weekly: 'WEEKS',
    monthly: 'MONTHS',
  }[frequency];

  const tenureHelper =
    repaymentType === 'interest_only'
      ? 'Window to generate installments. The loan auto-extends until principal is returned separately — pick "No tenure" for a fully rolling loan.'
      : 'Number of installments.';

  // For interest_only + monthly, offer a "No tenure" rolling option.
  const allowNoTenure = repaymentType === 'interest_only' && frequency === 'monthly';
  const isNoTenure = allowNoTenure && tenureCount === '';

  return (
    <View>
      <Text style={styles.stepTitle}>When and how often?</Text>
      <Text style={styles.stepSub}>Collection schedule and start date.</Text>

      <Text style={styles.sectionLabel}>COLLECTION FREQUENCY</Text>
      <View style={{ gap: Space.md }}>
        {FREQUENCY_OPTIONS.map((opt) => {
          const active = frequency === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => setFrequency(opt.value)}
              style={[styles.optionCard, active ? styles.optionCardActive : null]}
            >
              <View style={styles.optionRadio}>
                {active ? <View style={styles.optionRadioInner} /> : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.optionLabel}>{opt.label}</Text>
                <Text style={styles.optionSub}>{opt.sub}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.sectionLabel}>TENURE ({tenureLabel})</Text>
      <Text style={styles.hint}>{tenureHelper}</Text>

      {/* No-tenure toggle for interest-only + monthly */}
      {allowNoTenure ? (
        <View style={[styles.chipWrap, { marginBottom: Space.md }]}>
          <Pressable
            onPress={() => setTenureCount('')}
            style={[styles.chipBtn, isNoTenure ? styles.chipBtnActive : styles.chipBtnInactive]}
          >
            <Text style={[styles.chipText, isNoTenure && { color: EL.white }]}>
              No tenure (rolling)
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setTenureCount(tenureCount || '12')}
            style={[styles.chipBtn, !isNoTenure ? styles.chipBtnActive : styles.chipBtnInactive]}
          >
            <Text style={[styles.chipText, !isNoTenure && { color: EL.white }]}>
              Fixed term
            </Text>
          </Pressable>
        </View>
      ) : null}

      {!isNoTenure ? (
        <View style={styles.stepperRow}>
          <Pressable
            style={styles.stepperBtn}
            onPress={() => {
              const n = Math.max(1, (Number(tenureCount) || 0) - 1);
              setTenureCount(String(n));
            }}
          >
            <MaterialCommunityIcons name="minus" size={24} color={EL.primary} />
          </Pressable>
          <View style={styles.stepperValue}>
            <TextInput
              style={styles.stepperText}
              value={tenureCount}
              onChangeText={(v) => setTenureCount(v.replace(/\D/g, ''))}
              keyboardType="number-pad"
              placeholder={frequency === 'daily' ? '100' : frequency === 'weekly' ? '20' : '12'}
              placeholderTextColor={EL.outlineVariant}
              textAlign="center"
            />
          </View>
          <Pressable
            style={styles.stepperBtn}
            onPress={() => setTenureCount(String((Number(tenureCount) || 0) + 1))}
          >
            <MaterialCommunityIcons name="plus" size={24} color={EL.primary} />
          </Pressable>
        </View>
      ) : null}

      <Text style={styles.sectionLabel}>START DATE</Text>
      <View style={styles.chipWrap}>
        {[0, 1, 2, 7].map((offset) => {
          const d = new Date();
          d.setDate(d.getDate() + offset);
          d.setHours(0, 0, 0, 0);
          const label = offset === 0 ? 'Today' : offset === 1 ? 'Tomorrow' : `+${offset}d`;
          const active = startDate.toDateString() === d.toDateString();
          return (
            <Pressable
              key={offset}
              onPress={() => setStartDate(d)}
              style={[styles.chipBtn, active ? styles.chipBtnActive : styles.chipBtnInactive]}
            >
              <Text style={[styles.chipText, active && { color: EL.white }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

    </View>
  );
}

interface PreviewStepProps {
  terms: ReturnType<typeof computeLoanTerms> | null;
  disbursedNum: number;
  repaymentType: RepaymentType;
  interestType: InterestType;
  interestRate: number;
  interestRatePeriod: InterestRatePeriod;
  frequency: CollectionFrequency;
  tenureCount: number;
}

function PreviewStep(props: PreviewStepProps) {
  const {
    terms,
    disbursedNum,
    repaymentType,
    interestType,
    interestRate,
    interestRatePeriod,
    frequency,
    tenureCount,
  } = props;

  if (!terms) {
    return (
      <View>
        <Text style={styles.stepTitle}>Review</Text>
        <Text style={styles.stepSub}>Something is missing — please go back and complete earlier steps.</Text>
      </View>
    );
  }

  const isInterestOnly = repaymentType === 'interest_only';
  const endLabel = terms.endDate
    ? formatDateShort(new Date(terms.endDate))
    : 'Rolling (no fixed end)';

  return (
    <View>
      <Text style={styles.stepTitle}>Review loan terms</Text>
      <Text style={styles.stepSub}>Check the numbers before creating.</Text>

      {/* Headline card */}
      <View style={styles.previewHero}>
        <Text style={styles.previewHeroLabel}>
          {isInterestOnly ? 'Total interest (rolling)' : 'Total repayment'}
        </Text>
        <Text style={styles.previewHeroAmount}>{formatRupees(terms.totalRepayment)}</Text>
        <View style={styles.previewHeroRow}>
          <Text style={styles.previewHeroSub}>
            {formatRupees(terms.emiAmount)} / installment
          </Text>
          <Text style={styles.previewHeroSub}>
            {terms.installments} installments
          </Text>
        </View>
      </View>

      {/* Key-value rows */}
      <View style={styles.previewRows}>
        <PreviewRow label="Disbursed" value={formatRupees(disbursedNum)} />
        <PreviewRow
          label="Repayment type"
          value={isInterestOnly ? 'Interest Only' : 'Principal + Interest'}
        />
        <PreviewRow
          label="Rate"
          value={isInterestOnly ? `${interestRate}% per installment` : `${interestRate}% flat`}
        />
        <PreviewRow label="Frequency" value={frequency} />
        <PreviewRow label="Tenure" value={`${tenureCount} ${frequency === 'daily' ? 'days' : frequency === 'weekly' ? 'weeks' : 'months'}`} />
        <PreviewRow
          label="End"
          value={endLabel}
          highlight={!terms.endDate ? EL.info : undefined}
        />
        <PreviewRow
          label="Total interest"
          value={formatRupees(terms.totalInterest)}
          highlight={EL.primary}
        />
      </View>

      {isInterestOnly ? (
        <View style={styles.infoBanner}>
          <MaterialCommunityIcons name="information-outline" size={16} color={EL.info} />
          <Text style={styles.infoBannerText}>
            Principal ₹{disbursedNum.toLocaleString('en-IN')} is returned separately — use "Return Principal" on the collection screen.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function PreviewRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: string;
}) {
  return (
    <View style={styles.previewRow}>
      <Text style={styles.previewRowLabel}>{label}</Text>
      <Text
        style={[
          styles.previewRowValue,
          highlight ? { color: highlight, fontWeight: '700' } : null,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Space.xl,
    paddingVertical: Space.lg,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appBarTitle: {
    ...Type.titleLg,
    fontSize: 20,
    fontWeight: '700',
  },

  // Step indicator
  indicatorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: Space.xl,
    marginBottom: Space.xl,
  },
  indicatorItem: {
    flex: 1,
    alignItems: 'center',
  },
  indicatorDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  indicatorDotActive: {
    backgroundColor: EL.primary,
  },
  indicatorDotInactive: {
    backgroundColor: EL.surfaceHighest,
  },
  indicatorNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: EL.onSurfaceSec,
  },
  indicatorLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: EL.onSurfaceSec,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  content: {
    paddingHorizontal: Space.xl,
    paddingBottom: Space.xxl,
  },

  // Borrower card
  borrowerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.lg,
    padding: Space.md,
    gap: Space.md,
    marginBottom: Space.xl,
    ...Shadows.card,
  },
  borrowerInfo: { flex: 1 },
  borrowerName: { ...Type.titleMd, fontWeight: '700' },
  borrowerSub: { ...Type.bodySm, color: EL.onSurfaceSec, marginTop: 2 },

  // Step title
  stepTitle: {
    ...Type.displaySm,
    fontSize: 22,
    fontWeight: '800',
  },
  stepSub: {
    ...Type.bodySm,
    color: EL.onSurfaceSec,
    marginTop: Space.xs,
    marginBottom: Space.lg,
  },

  // Section label
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: EL.onSurfaceSec,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Space.sm,
    marginTop: Space.xl,
    opacity: 0.7,
  },

  hint: {
    ...Type.labelSm,
    color: EL.onSurfaceMuted,
    marginBottom: Space.sm,
  },

  // Big input for disbursement
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
    fontSize: 34,
    fontWeight: '800',
    color: EL.onSurface,
  },

  // Medium input
  emiInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.lg,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.lg,
    ...Shadows.card,
  },
  emiInputText: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    color: EL.onSurface,
  },
  emiPrefix: {
    fontSize: 20,
    fontWeight: '700',
    color: EL.onSurfaceSec,
  },

  // Rate row
  rateRow: {
    gap: Space.md,
  },
  periodPickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space.sm,
  },
  periodChip: {
    paddingHorizontal: Space.lg,
    paddingVertical: Space.sm,
    borderRadius: Radii.pill,
    minHeight: 36,
    justifyContent: 'center',
  },
  periodChipActive: {
    backgroundColor: EL.primary,
  },
  periodChipInactive: {
    backgroundColor: EL.surfaceCard,
    ...Shadows.card,
  },
  periodChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: EL.onSurfaceSec,
  },

  // Chip buttons
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space.sm,
  },
  chipBtn: {
    paddingHorizontal: Space.xl,
    paddingVertical: Space.md,
    borderRadius: Radii.md,
    minHeight: Touch.min,
    justifyContent: 'center',
  },
  chipBtnActive: { backgroundColor: EL.primary },
  chipBtnInactive: { backgroundColor: EL.surfaceCard, ...Shadows.card },
  chipText: { fontSize: 14, fontWeight: '600', color: EL.onSurfaceSec },

  // Option card (radio list)
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.lg,
    padding: Space.lg,
    gap: Space.md,
    ...Shadows.card,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionCardActive: {
    borderColor: EL.primary,
  },
  optionRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: EL.outline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionRadioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: EL.primary,
  },
  optionLabel: {
    ...Type.titleMd,
    fontWeight: '700',
  },
  optionSub: {
    ...Type.bodySm,
    color: EL.onSurfaceSec,
    marginTop: 2,
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

  // Grace row
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
  graceChipText: {
    ...Type.labelMd,
    fontSize: 14,
    color: EL.onSurfaceSec,
  },

  // Preview hero
  previewHero: {
    backgroundColor: EL.surfaceLow,
    borderRadius: Radii.xxl,
    padding: Space.xl,
    marginTop: Space.lg,
  },
  previewHeroLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: EL.onSurfaceSec,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  previewHeroAmount: {
    fontSize: 36,
    fontWeight: '800',
    color: EL.primary,
    marginTop: Space.xs,
  },
  previewHeroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Space.md,
  },
  previewHeroSub: {
    ...Type.bodySm,
    color: EL.onSurfaceSec,
    fontWeight: '600',
  },

  previewRows: {
    marginTop: Space.xl,
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.lg,
    paddingHorizontal: Space.lg,
    ...Shadows.card,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Space.md,
  },
  previewRowLabel: {
    ...Type.bodyMd,
    color: EL.onSurfaceSec,
    textTransform: 'capitalize',
  },
  previewRowValue: {
    ...Type.bodyMd,
    fontWeight: '600',
    color: EL.onSurface,
  },

  // Info banner
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: EL.infoContainer,
    borderRadius: Radii.md,
    padding: Space.md,
    marginTop: Space.lg,
    gap: Space.sm,
  },
  infoBannerText: {
    ...Type.bodySm,
    color: EL.info,
    fontWeight: '500',
    flex: 1,
  },

  // Bottom bar
  bottomBar: {
    paddingHorizontal: Space.xl,
    paddingVertical: Space.lg,
    paddingBottom: Space.xxxl,
    backgroundColor: 'rgba(240, 253, 244, 0.95)',
  },
});
