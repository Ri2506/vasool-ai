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
 * Top-up: increase principal on existing loan.
 * Records as negative principal return. Updates loan principal.
 * For interest-only loans: also updates EMI to reflect new interest on higher principal.
 */
export async function topUpLoan(
  orgId: string, loanId: string, additionalAmount: number, notes?: string
): Promise<void> {
  if (additionalAmount <= 0) return;
  const db = await openDb();

  await db.withTransactionAsync(async () => {
    // Read current loan BEFORE updating principal
    const loan = await db.getFirstAsync<{ principal: number; emi_amount: number; line_type: string | null }>(
      `SELECT l.principal, l.emi_amount, ln.type AS line_type FROM loans l
       LEFT JOIN lines ln ON ln.id = l.line_id WHERE l.id = ?`,
      [loanId]
    );
    if (!loan) throw new Error('Loan not found');

    const oldPrincipal = loan.principal;
    const newPrincipal = oldPrincipal + additionalAmount;

    // Record as negative return (top-up)
    await db.runAsync(
      `INSERT INTO principal_returns (id, server_id, loan_id, org_id, amount, date, notes, created_at, dirty)
       VALUES (?, NULL, ?, ?, ?, ?, ?, ?, 1)`,
      [uuid(), loanId, orgId, -additionalAmount, now(), notes ?? 'Top-up', now()]
    );

    // Update loan principal
    await db.runAsync(
      `UPDATE loans SET principal = ?, dirty = 1 WHERE id = ?`,
      [newPrincipal, loanId]
    );

    // For interest-only loans: recalculate EMI based on new principal
    const lt = loan.line_type;
    if (lt === 'daily_interest' || lt === 'weekly_interest') {
      if (oldPrincipal <= 0) throw new Error('Cannot compute rate: original principal is zero');
      const rate = loan.emi_amount / oldPrincipal;
      const newEmi = Math.max(1, Math.round(newPrincipal * rate));
      await db.runAsync(`UPDATE loans SET emi_amount = ?, dirty = 1 WHERE id = ?`, [newEmi, loanId]);
      await db.runAsync(
        `UPDATE plan_entries SET expected_amount = ?, dirty = 1 WHERE loan_id = ? AND status = 'pending'`,
        [newEmi, loanId]
      );
    }
  });
}
