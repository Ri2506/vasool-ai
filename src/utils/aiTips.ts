// Rule-based contextual tips for borrower cards.
// Per PRD §6.4: one-line tip appears at the top of a borrower's card.
// No API call, no AI model, no cost. Runs locally from the borrower's data.
// Feels intelligent because it says the right thing at the right moment.

import type { LoanRow, PlanEntryRow, CollectionRow } from '@/db/types';

export type TipVariant = 'danger' | 'warn' | 'success' | 'info';

export interface BorrowerTip {
  text: string;
  variant: TipVariant;
}

interface TipInput {
  loans: LoanRow[];
  planEntries: PlanEntryRow[];
  collections: CollectionRow[];
}

/**
 * Generate the single most relevant tip for a borrower.
 * Priority: danger > warn > info > success (worst first).
 */
export function generateBorrowerTip(input: TipInput): BorrowerTip | null {
  const { loans, planEntries, collections } = input;

  if (loans.length === 0) {
    return { text: 'New borrower — no loans yet', variant: 'info' };
  }

  const activeLoans = loans.filter((l) => l.status === 'active');
  const now = Date.now();

  // 1. Check for overdue (missed payments)
  const missedEntries = planEntries.filter(
    (pe) => pe.status === 'pending' && pe.due_date < now
  );
  if (missedEntries.length >= 3) {
    return {
      text: `Overdue ${missedEntries.length} payments — consider calling`,
      variant: 'danger',
    };
  }
  if (missedEntries.length > 0) {
    const daysOverdue = Math.floor((now - missedEntries[0].due_date) / 86400000);
    return {
      text: `Overdue ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} — follow up`,
      variant: 'danger',
    };
  }

  // 2. Check for partial payment pattern
  const recentCollections = collections
    .sort((a, b) => b.collected_at - a.collected_at)
    .slice(0, 5);
  const partialCount = recentCollections.filter(
    (c) => c.amount < c.expected_amount && c.amount > 0
  ).length;
  if (partialCount >= 3) {
    return {
      text: `Last ${partialCount} payments were partial — watch closely`,
      variant: 'warn',
    };
  }

  // 3. Check for payment slowdown (decreasing amounts)
  if (recentCollections.length >= 3) {
    const amounts = recentCollections.slice(0, 3).map((c) => c.amount);
    if (amounts[0] < amounts[1] && amounts[1] < amounts[2]) {
      return {
        text: 'Payment amounts decreasing — possible default risk',
        variant: 'warn',
      };
    }
  }

  // 4. Near completion (good news!)
  for (const loan of activeLoans) {
    const loanEntries = planEntries.filter((pe) => pe.loan_id === loan.id);
    const paid = loanEntries.filter((pe) =>
      pe.status === 'paid' || pe.status === 'advance_covered'
    ).length;
    const remaining = loan.total_installments - paid;
    if (remaining > 0 && remaining <= 5) {
      return {
        text: `Loan completes in ${remaining} payment${remaining !== 1 ? 's' : ''} — reliable borrower`,
        variant: 'success',
      };
    }
  }

  // 5. Good payment streak
  const streak = countStreak(collections);
  if (streak >= 10) {
    return {
      text: `${streak}-payment streak — excellent borrower`,
      variant: 'success',
    };
  }
  if (streak >= 5) {
    return {
      text: `${streak}-payment streak — on track`,
      variant: 'success',
    };
  }

  // 6. First collection
  if (collections.length === 0 && activeLoans.length > 0) {
    return {
      text: 'First collection — verify identity',
      variant: 'info',
    };
  }

  return null;
}

/** Count consecutive on-time full payments from most recent. */
function countStreak(collections: CollectionRow[]): number {
  const sorted = [...collections].sort((a, b) => b.collected_at - a.collected_at);
  let streak = 0;
  for (const c of sorted) {
    if (c.amount >= c.expected_amount) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}
