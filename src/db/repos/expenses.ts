import { openDb, uuid, now } from '@/db';
import type { ExpenseCategory, ExpenseRow } from '@/db/types';

// Fraud-prevention policy: expenses ≥ this amount require a photo receipt.
// Tunable — exported so UI can reference the same number.
export const EXPENSE_PHOTO_THRESHOLD = 100;

export interface NewExpenseInput {
  orgId: string;
  userId?: string | null;
  category: ExpenseCategory;
  amount: number;
  date?: number;
  // Fraud-prevention fields
  gpsLat?: number | null;
  gpsLng?: number | null;
  gpsMocked?: boolean;
  photoUri?: string | null;
  notes?: string | null;
}

export async function createExpense(input: NewExpenseInput): Promise<ExpenseRow> {
  if (input.amount <= 0) throw new Error('Amount must be positive');
  if (input.amount >= EXPENSE_PHOTO_THRESHOLD && !input.photoUri) {
    throw new Error(
      `Expenses of ₹${EXPENSE_PHOTO_THRESHOLD} or more need a photo receipt for owner proof.`
    );
  }
  const db = await openDb();
  const row: ExpenseRow = {
    id: uuid(),
    server_id: null,
    org_id: input.orgId,
    user_id: input.userId ?? null,
    category: input.category,
    amount: input.amount,
    date: input.date ?? now(),
    gps_lat: input.gpsLat ?? null,
    gps_lng: input.gpsLng ?? null,
    gps_mocked: input.gpsMocked ? 1 : 0,
    photo_uri: input.photoUri ?? null,
    photo_url: null,
    notes: input.notes?.trim() || null,
    is_synced: 0,
    created_at: now(),
    dirty: 1,
  };
  await db.runAsync(
    `INSERT INTO expenses (id, server_id, org_id, user_id, category, amount, date,
       gps_lat, gps_lng, gps_mocked, photo_uri, photo_url, notes,
       is_synced, created_at, dirty)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 1)`,
    [
      row.id, row.server_id, row.org_id, row.user_id, row.category,
      row.amount, row.date,
      row.gps_lat, row.gps_lng, row.gps_mocked, row.photo_uri, row.photo_url, row.notes,
      row.created_at,
    ]
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
