import { useQuery } from '@tanstack/react-query';
import { openDb } from '@/db';
import { useAuthStore } from '@/store/authStore';

export interface BorrowerStatus {
  borrower_id: string;
  is_nippu: boolean;
  days_overdue: number;
  rating: number; // 0-5
  emi: number;
  line_type: string;
  days_paid: number;
  total_days: number;
}

/**
 * Batch fetch Nadapu/Nippu status + payment rating for all borrowers in org.
 * Single query, efficient for list rendering.
 */
async function getAllBorrowerStatuses(orgId: string): Promise<Record<string, BorrowerStatus>> {
  const db = await openDb();
  // Midnight for consistent all-calendar-day counting
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nowMs = today.getTime();

  // Per-LOAN overdue check (not MAX across loans — each loan has its own grace).
  // A borrower is Nippu if ANY of their loans is overdue beyond its grace period.
  const overdueRows = await db.getAllAsync<{
    borrower_id: string;
    days: number;
    grace: number;
  }>(
    `SELECT l.borrower_id,
       CAST((${nowMs} - MIN(pe.due_date)) / 86400000 AS INTEGER) AS days,
       COALESCE(l.grace_period_days, 0) AS grace
     FROM plan_entries pe
     JOIN loans l ON l.id = pe.loan_id
     WHERE l.org_id = ? AND l.status = 'active'
       AND pe.status IN ('pending', 'partial')
       AND pe.due_date < ${nowMs}
     GROUP BY l.id
     HAVING CAST((${nowMs} - MIN(pe.due_date)) / 86400000 AS INTEGER) > COALESCE(l.grace_period_days, 0)`,
    [orgId]
  );

  // Get payment stats per borrower
  const ratingRows = await db.getAllAsync<{
    borrower_id: string;
    on_time: number;
    total: number;
  }>(
    `SELECT l.borrower_id,
       SUM(CASE WHEN pe.status IN ('paid', 'advance_covered') THEN 1 ELSE 0 END) AS on_time,
       COUNT(*) AS total
     FROM plan_entries pe
     JOIN loans l ON l.id = pe.loan_id
     WHERE l.org_id = ? AND pe.due_date < ${nowMs}
     GROUP BY l.borrower_id`,
    [orgId]
  );

  // Loan info (EMI, line type, progress)
  const loanInfoRows = await db.getAllAsync<{
    borrower_id: string;
    emi: number;
    line_type: string;
    days_paid: number;
    total_days: number;
  }>(
    `SELECT l.borrower_id,
       l.emi_amount AS emi,
       COALESCE(ln.type, 'daily') AS line_type,
       (SELECT COUNT(*) FROM plan_entries pe2 WHERE pe2.loan_id = l.id AND pe2.status IN ('paid','advance_covered')) AS days_paid,
       l.total_installments AS total_days
     FROM loans l
     LEFT JOIN lines ln ON ln.id = l.line_id
     WHERE l.org_id = ? AND l.status = 'active'
     GROUP BY l.borrower_id`,
    [orgId]
  );

  const result: Record<string, BorrowerStatus> = {};

  // Process overdue
  for (const row of overdueRows) {
    const days = Number(row.days);
    const grace = Number(row.grace);
    result[row.borrower_id] = {
      borrower_id: row.borrower_id,
      is_nippu: days > grace,
      days_overdue: days,
      rating: 0,
      emi: 0,
      line_type: 'daily',
      days_paid: 0,
      total_days: 0,
    };
  }

  // Process ratings
  for (const row of ratingRows) {
    const onTime = Number(row.on_time);
    const total = Number(row.total);
    let rating = 0;
    if (total > 0) {
      const pct = (onTime / total) * 100;
      if (pct >= 90) rating = 5;
      else if (pct >= 75) rating = 4;
      else if (pct >= 60) rating = 3;
      else if (pct >= 40) rating = 2;
      else rating = 1;
    }
    if (!result[row.borrower_id]) {
      result[row.borrower_id] = {
        borrower_id: row.borrower_id,
        is_nippu: false,
        days_overdue: 0,
        rating,
        emi: 0,
        line_type: 'daily',
        days_paid: 0,
        total_days: 0,
      };
    } else {
      result[row.borrower_id].rating = rating;
    }
  }

  // Process loan info
  for (const row of loanInfoRows) {
    if (!result[row.borrower_id]) {
      result[row.borrower_id] = {
        borrower_id: row.borrower_id,
        is_nippu: false,
        days_overdue: 0,
        rating: 0,
        emi: Number(row.emi) || 0,
        line_type: row.line_type || 'daily',
        days_paid: Number(row.days_paid) || 0,
        total_days: Number(row.total_days) || 0,
      };
    } else {
      result[row.borrower_id].emi = Number(row.emi) || 0;
      result[row.borrower_id].line_type = row.line_type || 'daily';
      result[row.borrower_id].days_paid = Number(row.days_paid) || 0;
      result[row.borrower_id].total_days = Number(row.total_days) || 0;
    }
  }

  return result;
}

export function useBorrowerStatuses() {
  const orgId = useAuthStore((s) => s.user?.orgId ?? null);
  return useQuery({
    queryKey: ['borrower-statuses', orgId],
    enabled: !!orgId,
    queryFn: () => getAllBorrowerStatuses(orgId!),
    refetchInterval: 60_000,
  });
}
