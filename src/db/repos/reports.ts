import { openDb } from '@/db';

export interface DailySummaryRow {
  date: number;
  total_collected: number;
  total_expected: number;
  collection_count: number;
  due_count: number;
  total_expenses: number;
}

export async function getDailySummaries(orgId: string, days: number = 30): Promise<DailySummaryRow[]> {
  const db = await openDb();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutoff = today.getTime() - days * 86400000;

  // Collections grouped by day
  const collected = await db.getAllAsync<{ day: number; total: number; cnt: number }>(
    `SELECT (collected_at / 86400000) * 86400000 AS day,
            SUM(amount) AS total, COUNT(*) AS cnt
     FROM collections WHERE org_id = ? AND collected_at >= ?
     GROUP BY day ORDER BY day DESC`,
    [orgId, cutoff]
  );

  // Expenses grouped by day
  const expenses = await db.getAllAsync<{ day: number; total: number }>(
    `SELECT (date / 86400000) * 86400000 AS day, SUM(amount) AS total
     FROM expenses WHERE org_id = ? AND date >= ?
     GROUP BY day`,
    [orgId, cutoff]
  );
  const expMap = new Map(expenses.map((e) => [e.day, e.total]));

  return collected.map((c) => ({
    date: c.day,
    total_collected: c.total,
    total_expected: 0,
    collection_count: c.cnt,
    due_count: 0,
    total_expenses: expMap.get(c.day) ?? 0,
  }));
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
