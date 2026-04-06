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

import type { LineType, PlanEntryStatus } from '@/db/types';

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
