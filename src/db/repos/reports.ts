import { openDb } from '@/db';

export interface DailySummaryRow {
  date: number;
  total_collected: number;
  cash_collected: number;
  account_collected: number;
  collection_count: number;
  total_expenses: number;
  // New loans disbursed that day
  loans_disbursed_count: number;
  loans_disbursed_amount: number;
  // Principal returns (from interest-only loans) collected that day.
  // These are separate from collections — they reduce outstanding principal.
  principal_returned: number;
  // Net cash movement: collected - (loans disbursed + expenses).
  // Positive = cash came in; negative = owner put cash out.
  net_cash_flow: number;
}

/**
 * Daily summaries for the last N days. Shows the full daily picture:
 *   - Collections (split by cash / account method)
 *   - Expenses
 *   - New loans disbursed (count + amount) — this is the owner's cash outflow
 *   - Principal returns from interest-only loans
 *
 * Only days that had at least one collection, loan disbursement, expense,
 * or principal return are returned — empty days are skipped to keep the
 * list short.
 */
export async function getDailySummaries(orgId: string, days: number = 30): Promise<DailySummaryRow[]> {
  const db = await openDb();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutoff = today.getTime() - days * 86400000;

  // Collections grouped by day, split by payment_method.
  const collected = await db.getAllAsync<{
    day: number;
    cash_total: number;
    account_total: number;
    total: number;
    cnt: number;
  }>(
    `SELECT (collected_at / 86400000) * 86400000 AS day,
            SUM(CASE WHEN payment_method = 'account' THEN amount ELSE 0 END) AS account_total,
            SUM(CASE WHEN payment_method != 'account' THEN amount ELSE 0 END) AS cash_total,
            SUM(amount) AS total,
            COUNT(*) AS cnt
     FROM collections WHERE org_id = ? AND collected_at >= ?
     GROUP BY day`,
    [orgId, cutoff]
  );

  // Expenses grouped by day
  const expenses = await db.getAllAsync<{ day: number; total: number }>(
    `SELECT (date / 86400000) * 86400000 AS day, SUM(amount) AS total
     FROM expenses WHERE org_id = ? AND date >= ?
     GROUP BY day`,
    [orgId, cutoff]
  );

  // Loans disbursed that day — use start_date so back-dated loans show on
  // their actual disbursement day, not when the row was created.
  const loans = await db.getAllAsync<{ day: number; total: number; cnt: number }>(
    `SELECT (start_date / 86400000) * 86400000 AS day,
            SUM(COALESCE(disbursed_amount, principal)) AS total,
            COUNT(*) AS cnt
     FROM loans WHERE org_id = ? AND start_date >= ?
     GROUP BY day`,
    [orgId, cutoff]
  );

  // Principal returns (positive amounts only; negative entries are top-ups).
  const returns = await db.getAllAsync<{ day: number; total: number }>(
    `SELECT (date / 86400000) * 86400000 AS day, SUM(amount) AS total
     FROM principal_returns WHERE org_id = ? AND date >= ? AND amount > 0
     GROUP BY day`,
    [orgId, cutoff]
  );

  const expMap = new Map(expenses.map((e) => [e.day, e.total]));
  const loanMap = new Map(loans.map((l) => [l.day, { total: l.total, cnt: l.cnt }]));
  const retMap = new Map(returns.map((r) => [r.day, r.total]));

  // Merge keys from all sources so a day with only a loan disbursement
  // (and no collection) still appears.
  const allDays = new Set<number>([
    ...collected.map((c) => c.day),
    ...Array.from(expMap.keys()),
    ...Array.from(loanMap.keys()),
    ...Array.from(retMap.keys()),
  ]);

  const collMap = new Map(collected.map((c) => [c.day, c]));

  const rows: DailySummaryRow[] = Array.from(allDays).map((day) => {
    const c = collMap.get(day);
    const totalCollected = c?.total ?? 0;
    const expensesAmt = expMap.get(day) ?? 0;
    const loanEntry = loanMap.get(day);
    const loansOut = loanEntry?.total ?? 0;
    const principalReturned = retMap.get(day) ?? 0;
    return {
      date: day,
      total_collected: totalCollected,
      cash_collected: c?.cash_total ?? 0,
      account_collected: c?.account_total ?? 0,
      collection_count: c?.cnt ?? 0,
      total_expenses: expensesAmt,
      loans_disbursed_count: loanEntry?.cnt ?? 0,
      loans_disbursed_amount: loansOut,
      principal_returned: principalReturned,
      net_cash_flow: totalCollected + principalReturned - loansOut - expensesAmt,
    };
  });

  return rows.sort((a, b) => b.date - a.date);
}

export interface OutstandingRow {
  borrower_id: string;
  borrower_name: string;
  borrower_phone: string | null;
  loan_id: string;
  principal: number;
  total_repayment: number;
  total_paid: number;
  outstanding: number;
  status: string;
}

export async function getOutstandingReport(orgId: string): Promise<OutstandingRow[]> {
  const db = await openDb();
  return db.getAllAsync<OutstandingRow>(
    `SELECT
       b.id AS borrower_id, b.name AS borrower_name, b.phone AS borrower_phone,
       l.id AS loan_id, l.principal, l.total_repayment, l.status,
       COALESCE(c.paid, 0) AS total_paid,
       l.total_repayment - COALESCE(c.paid, 0) AS outstanding
     FROM loans l
     JOIN borrowers b ON b.id = l.borrower_id
     LEFT JOIN (
       SELECT loan_id, SUM(amount) AS paid FROM collections GROUP BY loan_id
     ) c ON c.loan_id = l.id
     WHERE l.org_id = ? AND l.status IN ('active', 'overdue')
     ORDER BY outstanding DESC`,
    [orgId]
  );
}

export interface LineSummaryRow {
  line_id: string;
  line_name: string;
  line_type: string;
  borrower_count: number;
  total_due: number;
  total_collected: number;
}

export async function getLineSummary(orgId: string): Promise<LineSummaryRow[]> {
  const db = await openDb();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startMs = today.getTime();
  const endMs = startMs + 86400000;

  return db.getAllAsync<LineSummaryRow>(
    `SELECT
       ln.id AS line_id, ln.name AS line_name, ln.type AS line_type,
       COUNT(DISTINCT l.borrower_id) AS borrower_count,
       COALESCE(SUM(pe.expected_amount), 0) AS total_due,
       COALESCE(coll.total, 0) AS total_collected
     FROM lines ln
     LEFT JOIN loans l ON l.line_id = ln.id AND l.status = 'active'
     LEFT JOIN plan_entries pe ON pe.loan_id = l.id
       AND pe.due_date >= ? AND pe.due_date < ?
     LEFT JOIN (
       SELECT l2.line_id, SUM(c.amount) AS total
       FROM collections c
       JOIN loans l2 ON l2.id = c.loan_id
       WHERE c.collected_at >= ? AND c.collected_at < ?
       GROUP BY l2.line_id
     ) coll ON coll.line_id = ln.id
     WHERE ln.org_id = ?
     GROUP BY ln.id
     ORDER BY ln.name`,
    [startMs, endMs, startMs, endMs, orgId]
  );
}
