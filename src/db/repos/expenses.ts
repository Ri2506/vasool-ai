import { openDb, uuid, now } from '@/db';
import type { ExpenseCategory, ExpenseRow } from '@/db/types';

export interface NewExpenseInput {
  orgId: string;
  userId?: string | null;
  category: ExpenseCategory;
  amount: number;
  date?: number;
}

export async function createExpense(input: NewExpenseInput): Promise<ExpenseRow> {
  if (input.amount <= 0) throw new Error('Amount must be positive');
  const db = await openDb();
  const row: ExpenseRow = {
    id: uuid(),
    server_id: null,
    org_id: input.orgId,
    user_id: input.userId ?? null,
    category: input.category,
    amount: input.amount,
    date: input.date ?? now(),
    is_synced: 0,
    created_at: now(),
    dirty: 1,
  };
  await db.runAsync(
    `INSERT INTO expenses (id, server_id, org_id, user_id, category, amount, date, is_synced, created_at, dirty)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 1)`,
    [row.id, row.server_id, row.org_id, row.user_id, row.category, row.amount, row.date, row.created_at]
  );
  return row;
}

export async function listExpenses(orgId: string): Promise<ExpenseRow[]> {
  const db = await openDb();
  return db.getAllAsync<ExpenseRow>(
    `SELECT * FROM expenses WHERE org_id = ? ORDER BY date DESC, created_at DESC`,
    [orgId]
  );
}

export async function getTodayExpenseTotal(orgId: string): Promise<number> {
  const db = await openDb();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startMs = today.getTime();
  const endMs = startMs + 86400000;
  const row = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE org_id = ? AND date >= ? AND date < ?`,
    [orgId, startMs, endMs]
  );
  return row?.total ?? 0;
}
