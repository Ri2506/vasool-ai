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

  // Profit = collected - lent - expenses
  const monthProfit = monthCollected - monthLent - monthExpenses;

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

  return {
    monthProfit,
    monthCollected,
    monthLent,
    monthExpenses,
    availableToLend,
    totalInvested,
    nextWeekForecast,
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
