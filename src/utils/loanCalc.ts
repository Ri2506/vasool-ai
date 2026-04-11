// Loan calculations — ALL days count (no skipping Sundays).
// Tenure and interest are fully dynamic per owner's input.
//
// 7 line types:
//   daily           — fixed EMI every day for N days
//   weekly          — fixed EMI every week for N weeks
//   monthly_emi     — fixed EMI every month for N months
//   monthly_interest — interest-only monthly, principal returned separately
//   enterprise      — flexible monthly with optional product description
//   daily_interest  — interest-only daily, principal returned separately
//   weekly_interest — interest-only weekly, principal returned separately

import type {
  LineType,
  PlanEntryStatus,
  RepaymentType,
  InterestType,
  CollectionFrequency,
  InterestRatePeriod,
} from '@/db/types';

export interface LoanInput {
  principal: number;
  emiAmount: number;
  totalInstallments: number;
  lineType: LineType;
  startDate: Date | number;
}

export interface PlanInstallment {
  installmentNumber: number;
  dueDate: number;
  expectedAmount: number;
  status: PlanEntryStatus;
}

export interface LoanSummary {
  totalRepayment: number;
  interest: number;
  expectedEndDate: number;
  plan: PlanInstallment[];
  isInterestOnly: boolean;
}

/**
 * Generate due dates. ALL calendar days count — no Sundays skipped.
 *   daily/daily_interest: every single day
 *   weekly/weekly_interest: every 7 days
 *   monthly_emi/monthly_interest/enterprise: every month (same day-of-month)
 */
function generateDates(startDate: Date | number, count: number, lineType: LineType): number[] {
  if (count <= 0) return [];
  const base = new Date(typeof startDate === 'number' ? startDate : startDate.getTime());
  base.setHours(0, 0, 0, 0);
  const out: number[] = [];

  switch (lineType) {
    case 'daily':
    case 'daily_interest':
      for (let i = 0; i < count; i++) {
        const d = new Date(base.getTime());
        d.setDate(base.getDate() + i);
        d.setHours(0, 0, 0, 0);
        out.push(d.getTime());
      }
      break;

    case 'weekly':
    case 'weekly_interest':
      for (let i = 0; i < count; i++) {
        const d = new Date(base.getTime());
        d.setDate(base.getDate() + i * 7);
        d.setHours(0, 0, 0, 0);
        out.push(d.getTime());
      }
      break;

    case 'monthly_emi':
    case 'monthly_interest':
    case 'enterprise': {
      const day = base.getDate();
      for (let i = 0; i < count; i++) {
        const d = new Date(base.getFullYear(), base.getMonth() + i, 1);
        const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        d.setDate(Math.min(day, lastDay));
        d.setHours(0, 0, 0, 0);
        out.push(d.getTime());
      }
      break;
    }
  }
  return out;
}

/**
 * Build the full repayment schedule.
 * Interest and tenure are 100% dynamic — whatever the owner enters.
 */
export function computeLoan(input: LoanInput): LoanSummary {
  const { principal, emiAmount, totalInstallments, lineType, startDate } = input;

  // Validate
  if (principal <= 0 || emiAmount <= 0 || totalInstallments <= 0) {
    return { totalRepayment: 0, interest: 0, expectedEndDate: 0, plan: [], isInterestOnly: false };
  }

  const isInterestOnly = lineType === 'daily_interest' || lineType === 'weekly_interest' || lineType === 'monthly_interest';
  const dates = generateDates(startDate, totalInstallments, lineType);

  const plan: PlanInstallment[] = dates.map((dueDate, i) => ({
    installmentNumber: i + 1,
    dueDate,
    expectedAmount: emiAmount,
    status: 'pending' as PlanEntryStatus,
  }));

  const totalRepayment = emiAmount * totalInstallments;
  // Interest-only: all payments are interest. Regular: interest = total - principal.
  const interest = isInterestOnly
    ? totalRepayment
    : Math.max(0, totalRepayment - principal);
  const expectedEndDate = dates[dates.length - 1] ?? 0;

  return { totalRepayment, interest, expectedEndDate, plan, isInterestOnly };
}

/**
 * Suggest EMI. Owner can always override — this is just a starting point.
 * For small loans (< ₹150 principal), rounds to nearest ₹1 not ₹10.
 */
export function suggestEmi(principal: number, installments: number, lineType?: LineType): number {
  if (installments <= 0 || principal <= 0) return 0;

  if (lineType === 'daily_interest') {
    // Typical: 0.3% daily → ₹300/day per ₹1,00,000
    return Math.max(1, Math.round(principal * 0.003));
  }
  if (lineType === 'weekly_interest') {
    // Typical: 2% weekly → ₹2,000/week per ₹1,00,000
    return Math.max(1, Math.round(principal * 0.02));
  }

  // Regular: 20% flat markup divided by installments
  const total = Math.round(principal * 1.2);
  const raw = total / installments;
  if (raw < 10) return Math.max(1, Math.round(raw));
  return Math.max(10, Math.round(raw / 10) * 10);
}

/**
 * Check if a borrower is Nippu (overdue beyond grace).
 * daysOverdue = all calendar days since first missed payment.
 */
export function isNippu(daysOverdue: number, gracePeriodDays: number): boolean {
  return daysOverdue > gracePeriodDays;
}

/**
 * Payment rating (1-5 stars). 0 = no data.
 */
export function calculatePaymentRating(onTime: number, total: number): number {
  if (total === 0) return 0;
  const pct = (onTime / total) * 100;
  if (pct >= 90) return 5;
  if (pct >= 75) return 4;
  if (pct >= 60) return 3;
  if (pct >= 40) return 2;
  return 1;
}

/**
 * Penalty calculation. All calendar days count.
 */
export function calculatePenalty(
  emiAmount: number,
  daysLate: number,
  penaltyType: 'flat' | 'percentage' | null,
  penaltyAmount: number
): number {
  if (!penaltyType || penaltyAmount <= 0 || daysLate <= 0) return 0;
  if (penaltyType === 'flat') return Math.round(penaltyAmount * daysLate);
  return Math.round((emiAmount * penaltyAmount * daysLate) / 100);
}

// ═══════════════════════════════════════════════════════════════════════
//  Dynamic loan term calculator (Month 1 — schema v3)
// ═══════════════════════════════════════════════════════════════════════
//
// Pure function that turns owner-facing loan terms into a concrete plan of
// installments. Supports six loan structures via RepaymentType × InterestType
// combinations:
//
//   1. Thandal classic:
//      principal_plus_interest + front_loaded + daily
//   2. Flat interest loan:
//      principal_plus_interest + flat + daily/weekly/monthly
//   3. Reducing balance EMI:
//      principal_plus_interest + reducing + monthly
//   4. Interest-only rolling:
//      interest_only + flat + daily/weekly/monthly
//   5. Interest-only with upfront fee:
//      interest_only + front_loaded + daily/weekly/monthly
//   6. Zero interest:
//      principal_plus_interest + none + any frequency

const MS_PER_DAY = 86_400_000;

export interface ComputeLoanTermsInput {
  /** Amount actually handed to the borrower (in rupees) */
  disbursedAmount: number;
  /** Whether principal is part of each installment or returned separately */
  repaymentType: RepaymentType;
  /** How interest is calculated */
  interestType: InterestType;
  /** Interest rate as a decimal. 2% = 0.02. Ignored if interestType is 'none' */
  interestRate: number;
  /** The period the interestRate refers to */
  interestRatePeriod: InterestRatePeriod;
  /** How often collections are scheduled */
  frequency: CollectionFrequency;
  /**
   * Number of installments for principal_plus_interest loans.
   * For interest_only loans this is the window size for initial plan_entries
   * generation (e.g., 365 daily / 52 weekly / 12 monthly).
   */
  tenureCount: number;
  /** Start of the first installment (epoch ms) */
  startDate: number;
  /**
   * For front_loaded + interest_only: the one-time upfront fee charged at
   * disbursement time. Becomes a day-0 paid plan_entry. Optional.
   */
  upfrontFee?: number;
}

export interface PlanEntryDraft {
  installmentNumber: number;
  dueDate: number;
  expectedAmount: number;
  principalPortion: number;
  interestPortion: number;
  /** Only set for day-0 upfront fee entry on interest_only + front_loaded */
  preMarkedPaid?: boolean;
}

export interface ComputedLoanTerms {
  principal: number;
  totalRepayment: number;
  emiAmount: number;
  installments: number;
  totalInterest: number;
  endDate: number | null;
  planEntries: PlanEntryDraft[];
}

/**
 * Main entry point. Takes owner inputs, returns a complete loan term
 * breakdown with per-installment schedule.
 * Throws on invalid inputs (negative amounts, zero tenure, etc).
 */
export function computeLoanTerms(input: ComputeLoanTermsInput): ComputedLoanTerms {
  validateLoanTerms(input);
  if (input.repaymentType === 'principal_plus_interest') {
    return computePrincipalPlusInterest(input);
  }
  return computeInterestOnly(input);
}

// ─── Principal + Interest ──────────────────────────────────────────────

function computePrincipalPlusInterest(input: ComputeLoanTermsInput): ComputedLoanTerms {
  const {
    disbursedAmount, interestType, interestRate, interestRatePeriod,
    frequency, tenureCount, startDate,
  } = input;

  const principal = disbursedAmount;
  const tenureDays = tenureInDays(tenureCount, frequency);

  let totalInterest = 0;
  let planEntries: PlanEntryDraft[] = [];

  if (interestType === 'none') {
    totalInterest = 0;
    const emi = roundPaise(principal / tenureCount);
    planEntries = generateFlatSchedule({
      installments: tenureCount,
      emi,
      startDate,
      frequency,
      principalPortionPerEmi: emi,
      interestPortionPerEmi: 0,
    });
  } else if (interestType === 'front_loaded' || interestType === 'flat') {
    totalInterest = computeSimpleInterest(principal, interestRate, interestRatePeriod, tenureDays);
    const totalRepay = principal + totalInterest;
    const emi = roundPaise(totalRepay / tenureCount);
    const interestPerEmi = roundPaise(totalInterest / tenureCount);
    const principalPerEmi = roundPaise(emi - interestPerEmi);
    planEntries = generateFlatSchedule({
      installments: tenureCount,
      emi,
      startDate,
      frequency,
      principalPortionPerEmi: principalPerEmi,
      interestPortionPerEmi: interestPerEmi,
    });
  } else {
    // reducing balance — classic EMI amortization
    const perPeriodRate = convertRateToFrequency(interestRate, interestRatePeriod, frequency);
    const emi = computeReducingEmi(principal, perPeriodRate, tenureCount);
    planEntries = generateReducingSchedule({
      principal, perPeriodRate, emi,
      installments: tenureCount, startDate, frequency,
    });
    totalInterest = roundPaise(planEntries.reduce((s, e) => s + e.interestPortion, 0));
  }

  const totalRepayment = roundPaise(planEntries.reduce((s, e) => s + e.expectedAmount, 0));
  const emiAmount = planEntries.length > 0 ? planEntries[0].expectedAmount : 0;
  const endDate = planEntries.length > 0 ? planEntries[planEntries.length - 1].dueDate : null;

  return {
    principal, totalRepayment, emiAmount,
    installments: planEntries.length,
    totalInterest, endDate, planEntries,
  };
}

// ─── Interest Only ──────────────────────────────────────────────────────

function computeInterestOnly(input: ComputeLoanTermsInput): ComputedLoanTerms {
  const {
    disbursedAmount, interestType, interestRate, interestRatePeriod,
    frequency, tenureCount, startDate, upfrontFee,
  } = input;

  const principal = disbursedAmount;
  const daysPerInstallment = daysBetweenInstallments(frequency);

  let interestPerInstallment = 0;
  if (interestType !== 'none') {
    interestPerInstallment = roundPaise(
      computeSimpleInterest(principal, interestRate, interestRatePeriod, daysPerInstallment)
    );
  }

  const planEntries: PlanEntryDraft[] = [];

  // Day-0 upfront fee entry for front_loaded interest_only
  if (interestType === 'front_loaded' && upfrontFee && upfrontFee > 0) {
    planEntries.push({
      installmentNumber: 0,
      dueDate: startDate,
      expectedAmount: upfrontFee,
      principalPortion: 0,
      interestPortion: upfrontFee,
      preMarkedPaid: true,
    });
  }

  // Regular interest-only installments starting day 1
  for (let i = 0; i < tenureCount; i++) {
    const installmentNumber = i + 1;
    planEntries.push({
      installmentNumber,
      dueDate: addPeriod(startDate, installmentNumber, frequency),
      expectedAmount: interestPerInstallment,
      principalPortion: 0,
      interestPortion: interestPerInstallment,
    });
  }

  const totalInterest = roundPaise(planEntries.reduce((s, e) => s + e.interestPortion, 0));

  return {
    principal,
    totalRepayment: totalInterest,
    emiAmount: interestPerInstallment,
    installments: tenureCount,
    totalInterest,
    endDate: null, // rolling, no natural end
    planEntries,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────

function validateLoanTerms(input: ComputeLoanTermsInput): void {
  if (input.disbursedAmount <= 0) throw new Error('disbursedAmount must be positive');
  if (input.tenureCount <= 0) throw new Error('tenureCount must be positive');
  if (input.interestRate < 0) throw new Error('interestRate cannot be negative');
  if (input.upfrontFee !== undefined && input.upfrontFee < 0) {
    throw new Error('upfrontFee cannot be negative');
  }
}

function roundPaise(amount: number): number {
  return Math.round(amount * 100) / 100;
}

function daysBetweenInstallments(freq: CollectionFrequency): number {
  if (freq === 'daily') return 1;
  if (freq === 'weekly') return 7;
  return 30;
}

function tenureInDays(tenureCount: number, freq: CollectionFrequency): number {
  return tenureCount * daysBetweenInstallments(freq);
}

function addPeriod(startMs: number, periods: number, freq: CollectionFrequency): number {
  if (freq === 'daily') return startMs + periods * MS_PER_DAY;
  if (freq === 'weekly') return startMs + periods * 7 * MS_PER_DAY;
  const d = new Date(startMs);
  d.setMonth(d.getMonth() + periods);
  return d.getTime();
}

function computeSimpleInterest(
  principal: number,
  rate: number,
  ratePeriod: InterestRatePeriod,
  tenureDays: number,
): number {
  const daysInPeriod = { day: 1, week: 7, month: 30, year: 365 }[ratePeriod];
  const tenureInRatePeriods = tenureDays / daysInPeriod;
  return roundPaise(principal * rate * tenureInRatePeriods);
}

function convertRateToFrequency(
  rate: number,
  ratePeriod: InterestRatePeriod,
  freq: CollectionFrequency,
): number {
  // Use calendar-aware periods-per-year for reducing balance EMI math.
  // This matches standard loan accounting (year = 12 equal months, not 365 days).
  //   year → monthly: 24%/yr × (1/12) = 2%/month
  //   year → weekly:  24%/yr × (1/52) ≈ 0.4615%/week
  //   year → daily:   24%/yr × (1/365) ≈ 0.0658%/day
  const periodsPerYear = { day: 365, week: 52, month: 12, year: 1 };
  const rateAsAnnual = rate * periodsPerYear[ratePeriod];
  const freqPerYear = { daily: 365, weekly: 52, monthly: 12 }[freq];
  return rateAsAnnual / freqPerYear;
}

function computeReducingEmi(principal: number, perPeriodRate: number, installments: number): number {
  if (perPeriodRate === 0) return roundPaise(principal / installments);
  const r = perPeriodRate;
  const n = installments;
  const emi = (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  return roundPaise(emi);
}

interface FlatScheduleInput {
  installments: number;
  emi: number;
  startDate: number;
  frequency: CollectionFrequency;
  principalPortionPerEmi: number;
  interestPortionPerEmi: number;
}

function generateFlatSchedule(input: FlatScheduleInput): PlanEntryDraft[] {
  const { installments, emi, startDate, frequency, principalPortionPerEmi, interestPortionPerEmi } = input;
  const entries: PlanEntryDraft[] = [];
  for (let i = 0; i < installments; i++) {
    const installmentNumber = i + 1;
    entries.push({
      installmentNumber,
      dueDate: addPeriod(startDate, installmentNumber, frequency),
      expectedAmount: emi,
      principalPortion: principalPortionPerEmi,
      interestPortion: interestPortionPerEmi,
    });
  }
  return entries;
}

interface ReducingScheduleInput {
  principal: number;
  perPeriodRate: number;
  emi: number;
  installments: number;
  startDate: number;
  frequency: CollectionFrequency;
}

function generateReducingSchedule(input: ReducingScheduleInput): PlanEntryDraft[] {
  const { principal, perPeriodRate, emi, installments, startDate, frequency } = input;
  const entries: PlanEntryDraft[] = [];
  let outstanding = principal;

  for (let i = 0; i < installments; i++) {
    const installmentNumber = i + 1;
    const interestForPeriod = roundPaise(outstanding * perPeriodRate);
    const isLast = i === installments - 1;
    const principalForPeriod = isLast
      ? roundPaise(outstanding)
      : roundPaise(emi - interestForPeriod);
    const thisInstallment = isLast
      ? roundPaise(principalForPeriod + interestForPeriod)
      : emi;
    outstanding = roundPaise(outstanding - principalForPeriod);
    entries.push({
      installmentNumber,
      dueDate: addPeriod(startDate, installmentNumber, frequency),
      expectedAmount: thisInstallment,
      principalPortion: principalForPeriod,
      interestPortion: interestForPeriod,
    });
  }
  return entries;
}
