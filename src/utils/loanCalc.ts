// Loan calculations + repayment plan generation.
// Supports 7 line types per PRD v2.1.
//
// Interest-only types (daily_interest, weekly_interest):
//   Borrower pays interest daily/weekly. Principal NOT included in payments.
//   Principal is returned separately. Loan stays open until principal returned.
//   totalInstallments = number of interest payments to generate in the plan.
//   totalRepayment = interest only (principal tracked separately).

import type { LineType, PlanEntryStatus } from '@/db/types';
import {
  DEFAULT_WORKING_DAYS,
  generateMonthlyDates,
  generateWeeklyDates,
  generateWorkingDates,
  type DayKey,
} from './workingDays';

export interface LoanInput {
  principal: number;
  emiAmount: number;
  totalInstallments: number;
  lineType: LineType;
  startDate: Date | number;
  workingDays?: DayKey[];
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
 * Build the full repayment schedule for a loan.
 *
 * 7 line types:
 * - daily: fixed EMI every working day, principal included
 * - weekly: fixed EMI every week, principal included
 * - monthly_emi: fixed monthly EMI, principal included
 * - monthly_interest: interest-only monthly, principal returned at end
 * - enterprise: flexible monthly, optional product_description
 * - daily_interest: interest-only daily. Principal NOT in payments.
 * - weekly_interest: interest-only weekly. Principal NOT in payments.
 */
export function computeLoan(input: LoanInput): LoanSummary {
  const {
    principal,
    emiAmount,
    totalInstallments,
    lineType,
    startDate,
    workingDays = DEFAULT_WORKING_DAYS,
  } = input;

  const isInterestOnly = lineType === 'daily_interest' || lineType === 'weekly_interest' || lineType === 'monthly_interest';

  let dates: number[];
  switch (lineType) {
    case 'daily':
    case 'daily_interest':
      dates = generateWorkingDates(startDate, totalInstallments, workingDays);
      break;
    case 'weekly':
    case 'weekly_interest':
      dates = generateWeeklyDates(startDate, totalInstallments);
      break;
    case 'monthly_emi':
    case 'monthly_interest':
    case 'enterprise':
      dates = generateMonthlyDates(startDate, totalInstallments);
      break;
  }

  const plan: PlanInstallment[] = dates.map((dueDate, i) => ({
    installmentNumber: i + 1,
    dueDate,
    expectedAmount: emiAmount,
    status: 'pending',
  }));

  const totalInterestPayments = emiAmount * totalInstallments;

  // For interest-only: totalRepayment = interest payments only.
  // Principal is returned separately and tracked via principal_returns table.
  // For regular: totalRepayment = EMI × installments (includes principal + interest).
  const totalRepayment = isInterestOnly ? totalInterestPayments : totalInterestPayments;
  const interest = isInterestOnly ? totalInterestPayments : Math.max(0, totalRepayment - principal);
  const expectedEndDate = dates[dates.length - 1] ?? Number(startDate);

  return { totalRepayment, interest, expectedEndDate, plan, isInterestOnly };
}

/**
 * Suggest a round EMI for a given principal + installment count.
 * For regular loans: 20% markup → EMI.
 * For interest-only: suggest daily/weekly interest rate (e.g. 0.3% daily).
 */
export function suggestEmi(principal: number, installments: number, lineType?: LineType): number {
  if (installments <= 0) return 0;

  if (lineType === 'daily_interest') {
    // Typical: ₹300/day per ₹1,00,000 = 0.3% daily
    const daily = Math.round(principal * 0.003);
    return Math.max(10, Math.round(daily / 10) * 10);
  }
  if (lineType === 'weekly_interest') {
    // Typical: ₹2,000/week per ₹1,00,000 = 2% weekly
    const weekly = Math.round(principal * 0.02);
    return Math.max(10, Math.round(weekly / 10) * 10);
  }

  const total = Math.round(principal * 1.2);
  const raw = total / installments;
  return Math.max(1, Math.round(raw / 10) * 10);
}

/**
 * Check if a borrower is Nadapu (on schedule) or Nippu (overdue).
 * Takes grace period into account.
 */
export function isNippu(
  missedDays: number,
  gracePeriodDays: number
): boolean {
  return missedDays > gracePeriodDays;
}

/**
 * Calculate payment rating (1-5 stars) from payment history.
 * 90%+ on-time = 5 stars, 75-89% = 4, 60-74% = 3, 40-59% = 2, <40% = 1
 */
export function calculatePaymentRating(
  onTimePayments: number,
  totalExpectedPayments: number
): number {
  if (totalExpectedPayments === 0) return 0;
  const pct = (onTimePayments / totalExpectedPayments) * 100;
  if (pct >= 90) return 5;
  if (pct >= 75) return 4;
  if (pct >= 60) return 3;
  if (pct >= 40) return 2;
  return 1;
}

/**
 * Calculate penalty for a late payment.
 */
export function calculatePenalty(
  emiAmount: number,
  daysLate: number,
  penaltyType: 'flat' | 'percentage' | null,
  penaltyAmount: number
): number {
  if (!penaltyType || penaltyAmount <= 0 || daysLate <= 0) return 0;
  if (penaltyType === 'flat') return penaltyAmount * daysLate;
  // percentage: e.g. 5% per day
  return Math.round((emiAmount * penaltyAmount * daysLate) / 100);
}
