// Loan calculations + repayment plan generation.
// Keep it simple: money lenders think in totals, not APRs.
// Input: principal, EMI amount, number of installments, line type.
// Output: plan entries (date + expected amount per installment) + summary.

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
  dueDate: number; // epoch ms
  expectedAmount: number;
  status: PlanEntryStatus;
}

export interface LoanSummary {
  totalRepayment: number;
  interest: number;
  expectedEndDate: number;
  plan: PlanInstallment[];
}

/**
 * Build the full repayment schedule for a loan.
 *
 * - daily: N working days starting on startDate, skipping Sundays.
 * - weekly: N weekly installments (same weekday as startDate).
 * - monthly_emi / monthly_interest: N monthly installments.
 * - enterprise: treated as monthly for now; Sprint 3 adds custom cadence.
 *
 * Total repayment = emiAmount × totalInstallments (money lenders quote
 * flat totals, not compounding interest — matches Vasool Drive).
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

  let dates: number[];
  switch (lineType) {
    case 'daily':
      dates = generateWorkingDates(startDate, totalInstallments, workingDays);
      break;
    case 'weekly':
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

  const totalRepayment = emiAmount * totalInstallments;
  const interest = Math.max(0, totalRepayment - principal);
  const expectedEndDate = dates[dates.length - 1] ?? Number(startDate);

  return { totalRepayment, interest, expectedEndDate, plan };
}

/**
 * Suggest a round EMI for a given principal + installment count.
 * Used when the user enters principal first and we want to pre-fill EMI.
 * Assumes a 20% total markup (typical for local money lending).
 */
export function suggestEmi(principal: number, installments: number): number {
  if (installments <= 0) return 0;
  const total = Math.round(principal * 1.2);
  const raw = total / installments;
  // Round to nearest ₹10 for clean numbers.
  return Math.max(1, Math.round(raw / 10) * 10);
}
