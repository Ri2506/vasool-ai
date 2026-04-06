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

  // Available = invested + all collections - all loans - all expenses
  const availableToLend =
    totalInvested + (allCollections?.total ?? 0) - (allLoans?.total ?? 0) - (allExpenses?.total ?? 0);

  // Next week forecast: count active daily/weekly EMIs × working days
  const activeEmiSum = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(emi_amount), 0) AS total FROM loans
     WHERE org_id = ? AND status = 'active'`,
    [orgId]
  );
  // Rough estimate: 6 working days next week × active EMI sum
  const nextWeekForecast = (activeEmiSum?.total ?? 0) * 6;

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
