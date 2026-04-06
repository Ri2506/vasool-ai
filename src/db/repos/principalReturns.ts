import { openDb, uuid, now } from '@/db';
import type { PrincipalReturnRow } from '@/db/types';

export async function recordPrincipalReturn(
  orgId: string, loanId: string, amount: number, notes?: string
): Promise<PrincipalReturnRow> {
  const db = await openDb();
  const row: PrincipalReturnRow = {
    id: uuid(), server_id: null, loan_id: loanId, org_id: orgId,
    amount, date: now(), notes: notes?.trim() || null,
    created_at: now(), dirty: 1,
  };
  await db.runAsync(
    `INSERT INTO principal_returns (id, server_id, loan_id, org_id, amount, date, notes, created_at, dirty)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [row.id, row.server_id, row.loan_id, row.org_id, row.amount, row.date, row.notes, row.created_at]
  );
  return row;
}

export async function getPrincipalReturns(loanId: string): Promise<PrincipalReturnRow[]> {
  const db = await openDb();
  return db.getAllAsync<PrincipalReturnRow>(
    `SELECT * FROM principal_returns WHERE loan_id = ? ORDER BY date DESC`, [loanId]
  );
}

export async function getTotalPrincipalReturned(loanId: string): Promise<number> {
  const db = await openDb();
  const row = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM principal_returns WHERE loan_id = ?`, [loanId]
  );
  return row?.total ?? 0;
}

/**
 * Top-up: increase principal on existing loan. Records as negative principal return.
 */
export async function topUpLoan(
  orgId: string, loanId: string, additionalAmount: number, notes?: string
): Promise<void> {
  const db = await openDb();
  // Record as negative return (top-up)
  await db.runAsync(
    `INSERT INTO principal_returns (id, server_id, loan_id, org_id, amount, date, notes, created_at, dirty)
     VALUES (?, NULL, ?, ?, ?, ?, ?, ?, 1)`,
    [uuid(), loanId, orgId, -additionalAmount, now(), notes ?? 'Top-up', now()]
  );
  // Update loan principal
  await db.runAsync(
    `UPDATE loans SET principal = principal + ?, dirty = 1 WHERE id = ?`,
    [additionalAmount, loanId]
  );
}
