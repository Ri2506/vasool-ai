// Borrower summary — aggregates everything the borrower list card and
// detail screen need in a single query:
//
//   - Active loans with per-loan paid/balance/progress
//   - Closed (past) loans with totals
//   - Lifetime stats: total loans taken, total lent, total paid, total interest earned
//   - Line assignment
//   - Next upcoming installment date and amount
//
// Used by:
//   - BorrowerListScreen (paid/balance per borrower, line grouping)
//   - BorrowerDetailScreen (full history + stats)

import { useQuery } from '@tanstack/react-query';

import { openDb } from '@/db';
import { useAuthStore } from '@/store/authStore';
import type { LoanRow, PlanEntryRow } from '@/db/types';

export interface LoanSummary {
  loan: LoanRow;
  line_name: string | null;
  line_type: string | null;
  total_paid: number;
  balance: number;
  total_repayment: number;
  paid_installments: number;
  total_installments: number;
  next_due_date: number | null;
  next_due_amount: number | null;
  // plan_entry id of the next pending/partial installment.
  // The Collect screen needs this to update the right plan entry and to
  // run the duplicate-payment guard. null = no pending entries.
  next_plan_entry_id: string | null;
  last_payment_date: number | null;
  principal_returned: number;
  // Differentiates display:
  // 'original' — first loan with this principal
  // 'topup'    — had its principal topped up (via principal_returns with negative amount)
  // 'renew'    — renewed_from_id points to a previous loan
  kind: 'original' | 'topup' | 'renew';
}

export interface BorrowerSummaryData {
  activeLoans: LoanSummary[];
  closedLoans: LoanSummary[];
  lifetime: {
    totalLoansTaken: number;
    totalLent: number; // Sum of disbursed amounts across all loans
    totalPaid: number; // Sum of all collection amounts across all loans
    totalInterestEarned: number; // total_paid - principal_recovered for P+I loans, all collections for I-only
    totalOutstanding: number; // Sum of balance on active loans
  };
  /**
   * Per-line grouping for the borrower — usually 1 line but some
   * operators put the same borrower on multiple lines.
   */
  lineAssignments: Array<{ line_id: string; line_name: string; active_count: number }>;
}

async function getBorrowerSummary(orgId: string, borrowerId: string): Promise<BorrowerSummaryData> {
  const db = await openDb();

  // All loans for this borrower, joined with their line info
  const loans = await db.getAllAsync<LoanRow & { line_name: string | null; line_type: string | null }>(
    `SELECT l.*, ln.name AS line_name, ln.type AS line_type
     FROM loans l
     LEFT JOIN lines ln ON ln.id = l.line_id
     WHERE l.borrower_id = ? AND l.org_id = ?
     ORDER BY l.created_at DESC`,
    [borrowerId, orgId]
  );

  const summaries: LoanSummary[] = [];

  for (const loan of loans) {
    // Total collected for this loan
    const paid = await db.getFirstAsync<{ total: number; count: number; last: number | null }>(
      `SELECT COALESCE(SUM(amount), 0) AS total,
              COUNT(*) AS count,
              MAX(collected_at) AS last
       FROM collections WHERE loan_id = ?`,
      [loan.id]
    );
    const totalPaid = paid?.total ?? 0;

    // Plan entries — count paid/advance_covered, find next pending
    const planStats = await db.getFirstAsync<{
      paid_count: number;
      total_count: number;
    }>(
      `SELECT
         SUM(CASE WHEN status IN ('paid', 'advance_covered') THEN 1 ELSE 0 END) AS paid_count,
         COUNT(*) AS total_count
       FROM plan_entries WHERE loan_id = ?`,
      [loan.id]
    );
    const nextDue = await db.getFirstAsync<{ id: string; due_date: number; expected_amount: number } | null>(
      `SELECT id, due_date, expected_amount FROM plan_entries
       WHERE loan_id = ? AND status IN ('pending', 'partial')
       ORDER BY due_date ASC LIMIT 1`,
      [loan.id]
    );

    // Principal returned (for interest-only loans)
    const pr = await db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM principal_returns
       WHERE loan_id = ? AND amount > 0`,
      [loan.id]
    );
    const principalReturned = pr?.total ?? 0;

    // Balance differs by repayment type
    let balance: number;
    if (loan.repayment_type === 'interest_only') {
      // For interest-only, "balance" = outstanding principal
      balance = Math.max(0, (loan.principal ?? 0) - principalReturned);
    } else {
      // For P+I, balance = total_repayment - total_paid
      balance = Math.max(0, (loan.total_repayment ?? 0) - totalPaid);
    }

    // Has this loan been topped up? Negative amount in principal_returns signals top-up.
    const topUp = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) AS count FROM principal_returns
       WHERE loan_id = ? AND amount < 0`,
      [loan.id]
    );
    const isTopUp = (topUp?.count ?? 0) > 0;

    const kind: LoanSummary['kind'] = loan.renewed_from_id
      ? 'renew'
      : isTopUp
      ? 'topup'
      : 'original';

    summaries.push({
      loan,
      line_name: loan.line_name ?? null,
      line_type: loan.line_type ?? null,
      total_paid: totalPaid,
      balance,
      total_repayment: loan.total_repayment ?? 0,
      paid_installments: Number(planStats?.paid_count ?? 0),
      total_installments: Number(planStats?.total_count ?? 0),
      next_due_date: nextDue?.due_date ?? null,
      next_due_amount: nextDue?.expected_amount ?? null,
      next_plan_entry_id: nextDue?.id ?? null,
      last_payment_date: paid?.last ?? null,
      principal_returned: principalReturned,
      kind,
    });
  }

  const activeLoans = summaries.filter((s) => s.loan.status === 'active');
  const closedLoans = summaries.filter((s) => s.loan.status !== 'active');

  // Lifetime stats
  const totalLent = summaries.reduce((s, ls) => s + (ls.loan.disbursed_amount ?? ls.loan.principal ?? 0), 0);
  const totalPaid = summaries.reduce((s, ls) => s + ls.total_paid, 0);
  const totalOutstanding = activeLoans.reduce((s, ls) => s + ls.balance, 0);

  // Interest earned: for closed P+I loans, total_paid - principal; for I-only, all collections are interest
  let totalInterestEarned = 0;
  for (const ls of summaries) {
    if (ls.loan.repayment_type === 'interest_only') {
      // Interest-only: every collection is interest income
      totalInterestEarned += ls.total_paid;
    } else {
      // P+I: interest earned is the ratio of interest_portion in plan entries × installments paid
      if (ls.total_installments > 0) {
        const interestPerEmi =
          ((ls.loan.total_repayment ?? 0) - (ls.loan.principal ?? 0)) /
          ls.total_installments;
        totalInterestEarned += interestPerEmi * ls.paid_installments;
      }
    }
  }

  // Line assignments
  const lineMap = new Map<string, { line_name: string; active_count: number }>();
  for (const ls of activeLoans) {
    const lineId = ls.loan.line_id ?? '_none';
    const name = ls.line_name ?? 'No line';
    const cur = lineMap.get(lineId);
    if (cur) cur.active_count += 1;
    else lineMap.set(lineId, { line_name: name, active_count: 1 });
  }
  const lineAssignments = Array.from(lineMap.entries()).map(([line_id, v]) => ({
    line_id,
    line_name: v.line_name,
    active_count: v.active_count,
  }));

  return {
    activeLoans,
    closedLoans,
    lifetime: {
      totalLoansTaken: summaries.length,
      totalLent: Math.round(totalLent),
      totalPaid: Math.round(totalPaid),
      totalInterestEarned: Math.round(totalInterestEarned),
      totalOutstanding: Math.round(totalOutstanding),
    },
    lineAssignments,
  };
}

export function useBorrowerSummary(borrowerId: string | undefined) {
  const orgId = useAuthStore((s) => s.user?.orgId ?? null);
  return useQuery({
    queryKey: ['borrower-summary', orgId, borrowerId],
    enabled: !!orgId && !!borrowerId,
    queryFn: () => getBorrowerSummary(orgId!, borrowerId!),
  });
}

/**
 * List summary — lightweight version for the borrower list screen.
 * Returns one row per borrower with aggregate paid/balance + line name.
 * Avoids N+1 query problem of calling useBorrowerSummary for every row.
 */
export interface BorrowerListSummary {
  borrower_id: string;
  line_id: string | null;
  line_name: string | null;
  active_loan_count: number;
  total_disbursed: number;
  total_paid: number;
  total_balance: number;
}

async function getBorrowerListSummaries(orgId: string): Promise<Map<string, BorrowerListSummary>> {
  const db = await openDb();

  const rows = await db.getAllAsync<{
    borrower_id: string;
    line_id: string | null;
    line_name: string | null;
    active_loan_count: number;
    total_disbursed: number;
    total_paid: number;
    total_repayment: number;
    repayment_type: string | null;
    principal: number;
    principal_returned: number;
  }>(
    `SELECT
       l.borrower_id,
       l.line_id,
       ln.name AS line_name,
       COUNT(DISTINCT l.id) AS active_loan_count,
       COALESCE(SUM(COALESCE(l.disbursed_amount, l.principal)), 0) AS total_disbursed,
       COALESCE((
         SELECT SUM(c.amount) FROM collections c
         JOIN loans l2 ON l2.id = c.loan_id
         WHERE l2.borrower_id = l.borrower_id AND l2.status = 'active'
       ), 0) AS total_paid,
       COALESCE(SUM(l.total_repayment), 0) AS total_repayment,
       MAX(l.repayment_type) AS repayment_type,
       COALESCE(SUM(l.principal), 0) AS principal,
       COALESCE((
         SELECT SUM(pr.amount) FROM principal_returns pr
         JOIN loans l3 ON l3.id = pr.loan_id
         WHERE l3.borrower_id = l.borrower_id AND pr.amount > 0
       ), 0) AS principal_returned
     FROM loans l
     LEFT JOIN lines ln ON ln.id = l.line_id
     WHERE l.org_id = ? AND l.status = 'active'
     GROUP BY l.borrower_id, l.line_id`,
    [orgId]
  );

  // Balance differs per loan type — approximate at the borrower level:
  // For simplicity, use total_repayment - total_paid for mixed portfolios.
  const map = new Map<string, BorrowerListSummary>();
  for (const r of rows) {
    // Pick the largest line assignment if borrower has loans on multiple lines.
    // (First row wins due to grouping.)
    if (map.has(r.borrower_id)) continue;
    const balance = Math.max(0, r.total_repayment - r.total_paid);
    map.set(r.borrower_id, {
      borrower_id: r.borrower_id,
      line_id: r.line_id,
      line_name: r.line_name,
      active_loan_count: Number(r.active_loan_count),
      total_disbursed: Math.round(r.total_disbursed),
      total_paid: Math.round(r.total_paid),
      total_balance: Math.round(balance),
    });
  }
  return map;
}

export function useBorrowerListSummaries() {
  const orgId = useAuthStore((s) => s.user?.orgId ?? null);
  return useQuery({
    queryKey: ['borrower-list-summaries', orgId],
    enabled: !!orgId,
    queryFn: () => getBorrowerListSummaries(orgId!),
  });
}
