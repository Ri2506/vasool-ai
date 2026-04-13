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
 * Top-up: increase principal on an existing active loan.
 *
 * Records as a negative principal_return (so lifetime "principal returned"
 * stays accurate) and bumps the loan's principal + disbursed_amount.
 *
 * For interest-only loans: rate is per-installment, so the per-installment
 * interest is `newPrincipal * interest_rate`. Pending entries and the loan's
 * emi_amount are updated to reflect the new interest.
 *
 * For principal_plus_interest loans: the math is more involved (the plan
 * schedule would need to be regenerated). We intentionally don't regenerate
 * the plan here — instead we require the caller to close the old loan and
 * create a new one. This keeps the flow predictable for the owner.
 */
export async function topUpLoan(
  orgId: string, loanId: string, additionalAmount: number, notes?: string
): Promise<void> {
  if (additionalAmount <= 0) return;
  const db = await openDb();

  await db.withTransactionAsync(async () => {
    const loan = await db.getFirstAsync<{
      principal: number;
      emi_amount: number;
      disbursed_amount: number | null;
      repayment_type: string | null;
      interest_rate: number | null;
    }>(
      `SELECT principal, emi_amount, disbursed_amount, repayment_type, interest_rate
       FROM loans WHERE id = ?`,
      [loanId]
    );
    if (!loan) throw new Error('Loan not found');
    if (loan.repayment_type && loan.repayment_type !== 'interest_only') {
      throw new Error(
        'Top-up is only supported on interest-only loans. For principal+interest loans, close this loan and start a new one.'
      );
    }

    const oldPrincipal = loan.principal;
    const newPrincipal = oldPrincipal + additionalAmount;
    const newDisbursed = (loan.disbursed_amount ?? oldPrincipal) + additionalAmount;

    // Record as negative principal return (top-up)
    await db.runAsync(
      `INSERT INTO principal_returns (id, server_id, loan_id, org_id, amount, date, notes, created_at, dirty)
       VALUES (?, NULL, ?, ?, ?, ?, ?, ?, 1)`,
      [uuid(), loanId, orgId, -additionalAmount, now(), notes ?? 'Top-up', now()]
    );

    // Recompute per-installment interest for interest-only
    // Prefer the stored rate; fall back to the existing emi/principal ratio
    // for legacy loans that don't have interest_rate set.
    const rate =
      loan.interest_rate && loan.interest_rate > 0
        ? loan.interest_rate
        : oldPrincipal > 0
        ? loan.emi_amount / oldPrincipal
        : 0;
    if (rate <= 0) throw new Error('Cannot compute per-installment interest rate.');
    const newEmi = Math.max(1, Math.round(newPrincipal * rate));

    await db.runAsync(
      `UPDATE loans SET principal = ?, disbursed_amount = ?, emi_amount = ?, dirty = 1 WHERE id = ?`,
      [newPrincipal, newDisbursed, newEmi, loanId]
    );
    await db.runAsync(
      `UPDATE plan_entries
       SET expected_amount = ?, interest_portion = ?, dirty = 1
       WHERE loan_id = ? AND status IN ('pending', 'partial')`,
      [newEmi, newEmi, loanId]
    );
  });
}
