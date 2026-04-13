import { useQuery } from '@tanstack/react-query';

import { openDb } from '@/db';
import { useAuthStore } from '@/store/authStore';

export interface SmartCardData {
  monthProfit: number;
  monthCollected: number;
  monthLent: number;
  monthExpenses: number;
  availableToLend: number;
  totalInvested: number;
  nextWeekForecast: number;
  // Schema v3 additions — principal-vs-interest split
  monthInterestEarned: number;
  monthPrincipalRecovered: number;
  capitalAtRisk: number;
  // Today's cash flow breakdown for the "net today" line on Cash Position
  todayCollected: number;
  todayLent: number;
  todayExpenses: number;
  todayNet: number;
  // Per-line capital deployed + collected today
  byLine: Array<{
    lineId: string | null;
    lineName: string;
    outstanding: number;
    collectedToday: number;
    borrowerCount: number;
  }>;
}

async function computeSmartCards(orgId: string): Promise<SmartCardData> {
  const db = await openDb();
  const now = new Date();

  // Month boundaries
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();

  // This month's collections
  const collected = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM collections
     WHERE org_id = ? AND collected_at >= ? AND collected_at < ?`,
    [orgId, monthStart, monthEnd]
  );

  // This month's loans disbursed
  const lent = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(principal), 0) AS total FROM loans
     WHERE org_id = ? AND created_at >= ? AND created_at < ?`,
    [orgId, monthStart, monthEnd]
  );

  // This month's expenses
  const expenses = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM expenses
     WHERE org_id = ? AND date >= ? AND date < ?`,
    [orgId, monthStart, monthEnd]
  );

  // Total invested (all time)
  const invested = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM investments WHERE org_id = ?`,
    [orgId]
  );

  // All-time totals for available-to-lend
  const allCollections = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM collections WHERE org_id = ?`,
    [orgId]
  );
  const allLoans = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(principal), 0) AS total FROM loans WHERE org_id = ?`,
    [orgId]
  );
  const allExpenses = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE org_id = ?`,
    [orgId]
  );

  const monthCollected = collected?.total ?? 0;
  const monthLent = lent?.total ?? 0;
  const monthExpenses = expenses?.total ?? 0;
  const totalInvested = invested?.total ?? 0;

  // ── Principal vs Interest split (Month 1 Week 4) ─────────────────────
  //
  // For each loan, figure out how much of this month's collections was
  // interest (profit) vs principal recovery (just money coming back).
  //
  //   interest_only loans  → every rupee collected is pure interest income
  //                          (principal comes back via principal_returns)
  //   principal_plus_interest → each installment has a constant split
  //                          (interest_portion / principal_portion from plan_entries)
  //                          we estimate: count × avg_portion
  //
  // This replaces the old "collected - lent - expenses" formula which was
  // wildly wrong for any loan that crossed month boundaries.
  const loanSplits = await db.getAllAsync<{
    loan_id: string;
    repayment_type: string;
    collected_this_month: number;
    collection_count: number;
    avg_interest: number;
    avg_principal: number;
  }>(
    `SELECT
       l.id AS loan_id,
       l.repayment_type,
       COALESCE((
         SELECT SUM(c.amount)
         FROM collections c
         WHERE c.loan_id = l.id
           AND c.collected_at >= ? AND c.collected_at < ?
       ), 0) AS collected_this_month,
       COALESCE((
         SELECT COUNT(*)
         FROM collections c
         WHERE c.loan_id = l.id
           AND c.collected_at >= ? AND c.collected_at < ?
       ), 0) AS collection_count,
       COALESCE((
         SELECT AVG(pe.interest_portion)
         FROM plan_entries pe
         WHERE pe.loan_id = l.id
       ), 0) AS avg_interest,
       COALESCE((
         SELECT AVG(pe.principal_portion)
         FROM plan_entries pe
         WHERE pe.loan_id = l.id
       ), 0) AS avg_principal
     FROM loans l
     WHERE l.org_id = ?`,
    [monthStart, monthEnd, monthStart, monthEnd, orgId]
  );

  let monthInterestEarned = 0;
  let monthPrincipalRecovered = 0;
  for (const row of loanSplits) {
    const collected = Number(row.collected_this_month) || 0;
    const count = Number(row.collection_count) || 0;
    if (collected === 0) continue;
    if (row.repayment_type === 'interest_only') {
      // All collections on interest_only loans are interest income.
      // Principal recoveries happen via principal_returns (handled below).
      monthInterestEarned += collected;
    } else {
      // principal_plus_interest (or null for legacy rows): use the constant
      // portion split from plan_entries. count × avg gives the right totals
      // even when payments span multiple days or include partials.
      const interestPortion = Number(row.avg_interest) || 0;
      const principalPortion = Number(row.avg_principal) || 0;
      monthInterestEarned += count * interestPortion;
      monthPrincipalRecovered += count * principalPortion;
    }
  }

  // Add this month's principal returns (interest_only loans repaid)
  const monthPrincipalReturns = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM principal_returns
     WHERE org_id = ? AND amount > 0 AND date >= ? AND date < ?`,
    [orgId, monthStart, monthEnd]
  );
  monthPrincipalRecovered += monthPrincipalReturns?.total ?? 0;

  // Round for display
  monthInterestEarned = Math.round(monthInterestEarned);
  monthPrincipalRecovered = Math.round(monthPrincipalRecovered);

  // Real profit = interest earned - expenses
  // (principal recovery is NOT profit, just capital returning to the pool)
  const monthProfit = monthInterestEarned - monthExpenses;

  // Deposits from investors (PRD v2.1)
  const totalDeposits = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM deposits WHERE org_id = ? AND status = 'active'`,
    [orgId]
  );
  const depositInterestPaid = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(interest_paid), 0) AS total FROM deposits WHERE org_id = ?`,
    [orgId]
  );

  // Principal returns (money that came back from borrowers on interest-only loans)
  const principalReturns = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM principal_returns WHERE org_id = ? AND amount > 0`,
    [orgId]
  );

  // Available = invested + deposits + collections + principal_returns - loans - expenses - deposit_interest
  const availableToLend =
    totalInvested + (totalDeposits?.total ?? 0) + (allCollections?.total ?? 0)
    + (principalReturns?.total ?? 0)
    - (allLoans?.total ?? 0) - (allExpenses?.total ?? 0) - (depositInterestPaid?.total ?? 0);

  // Next week forecast — per loan type (7 days for daily, 1 for weekly, ~0.25 for monthly)
  const dailyEmi = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(l.emi_amount), 0) AS total FROM loans l
     LEFT JOIN lines ln ON ln.id = l.line_id
     WHERE l.org_id = ? AND l.status = 'active'
       AND (ln.type IN ('daily', 'daily_interest') OR ln.type IS NULL)`,
    [orgId]
  );
  const weeklyEmi = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(l.emi_amount), 0) AS total FROM loans l
     LEFT JOIN lines ln ON ln.id = l.line_id
     WHERE l.org_id = ? AND l.status = 'active'
       AND ln.type IN ('weekly', 'weekly_interest')`,
    [orgId]
  );
  const monthlyEmi = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(l.emi_amount), 0) AS total FROM loans l
     LEFT JOIN lines ln ON ln.id = l.line_id
     WHERE l.org_id = ? AND l.status = 'active'
       AND ln.type IN ('monthly_emi', 'monthly_interest', 'enterprise')`,
    [orgId]
  );
  // 7 days × daily + 1 × weekly + ~0.25 × monthly
  const nextWeekForecast = Math.round(
    (dailyEmi?.total ?? 0) * 7 + (weeklyEmi?.total ?? 0) * 1 + (monthlyEmi?.total ?? 0) * 0.25
  );

  // ── Capital at Risk (outstanding principal on active interest-only loans) ──
  //
  // For interest-only loans, principal only returns via principal_returns.
  // The amount currently "out there" and at risk is:
  //   sum(principal) - sum(principal_returns) for active interest_only loans
  //
  // This is critical for the owner to track: it answers "how much of my
  // capital is locked up in rolling loans that haven't started returning yet?"
  const interestOnlyPrincipal = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(principal), 0) AS total FROM loans
     WHERE org_id = ?
       AND repayment_type = 'interest_only'
       AND status = 'active'`,
    [orgId]
  );
  const interestOnlyReturned = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(pr.amount), 0) AS total FROM principal_returns pr
     JOIN loans l ON l.id = pr.loan_id
     WHERE l.org_id = ?
       AND l.repayment_type = 'interest_only'
       AND l.status = 'active'
       AND pr.amount > 0`,
    [orgId]
  );
  const capitalAtRisk = Math.max(
    0,
    (interestOnlyPrincipal?.total ?? 0) - (interestOnlyReturned?.total ?? 0)
  );

  // ── Today slice + per-line breakdown ──
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStartMs = todayStart.getTime();
  const todayEndMs = todayStartMs + 86_400_000;

  const todayColl = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM collections
     WHERE org_id = ? AND collected_at >= ? AND collected_at < ?`,
    [orgId, todayStartMs, todayEndMs]
  );
  const todayDisbursed = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(COALESCE(disbursed_amount, principal)), 0) AS total
     FROM loans WHERE org_id = ? AND start_date >= ? AND start_date < ?`,
    [orgId, todayStartMs, todayEndMs]
  );
  const todayExp = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM expenses
     WHERE org_id = ? AND date >= ? AND date < ?`,
    [orgId, todayStartMs, todayEndMs]
  );
  const todayCollected = todayColl?.total ?? 0;
  const todayLent = todayDisbursed?.total ?? 0;
  const todayExpenses = todayExp?.total ?? 0;
  const todayNet = todayCollected - todayLent - todayExpenses;

  const lineRows = await db.getAllAsync<{
    line_id: string | null;
    line_name: string | null;
    outstanding: number;
    collected_today: number;
    borrower_count: number;
  }>(
    `SELECT
       ln.id AS line_id,
       COALESCE(ln.name, 'No line') AS line_name,
       COALESCE(SUM(CASE WHEN l.status = 'active'
                         THEN l.total_repayment - COALESCE(pd.paid, 0)
                         ELSE 0 END), 0) AS outstanding,
       COALESCE(td.total, 0) AS collected_today,
       COUNT(DISTINCT CASE WHEN l.status = 'active' THEN l.borrower_id END) AS borrower_count
     FROM loans l
     LEFT JOIN lines ln ON ln.id = l.line_id
     LEFT JOIN (
       SELECT loan_id, SUM(amount) AS paid FROM collections GROUP BY loan_id
     ) pd ON pd.loan_id = l.id
     LEFT JOIN (
       SELECT l2.line_id, SUM(c.amount) AS total FROM collections c
       JOIN loans l2 ON l2.id = c.loan_id
       WHERE c.collected_at >= ? AND c.collected_at < ?
       GROUP BY l2.line_id
     ) td ON td.line_id = ln.id
     WHERE l.org_id = ?
     GROUP BY ln.id
     ORDER BY outstanding DESC`,
    [todayStartMs, todayEndMs, orgId]
  );
  const byLine = lineRows.map((r) => ({
    lineId: r.line_id,
    lineName: r.line_name ?? 'No line',
    outstanding: r.outstanding,
    collectedToday: r.collected_today,
    borrowerCount: r.borrower_count,
  }));

  return {
    monthProfit,
    monthCollected,
    monthLent,
    monthExpenses,
    availableToLend,
    totalInvested,
    nextWeekForecast,
    monthInterestEarned,
    monthPrincipalRecovered,
    capitalAtRisk,
    todayCollected,
    todayLent,
    todayExpenses,
    todayNet,
    byLine,
  };
}

export function useSmartCards() {
  const orgId = useAuthStore((s) => s.user?.orgId ?? null);
  return useQuery({
    queryKey: ['smartCards', orgId],
    enabled: !!orgId,
    queryFn: () => computeSmartCards(orgId!),
    refetchInterval: 30_000,
  });
}
