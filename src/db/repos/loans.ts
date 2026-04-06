import { openDb, uuid, now } from '@/db';
import type { LoanRow, LoanStatus, PlanEntryRow } from '@/db/types';
import { computeLoan, type LoanInput } from '@/utils/loanCalc';

/**
 * Create a loan AND its repayment plan atomically in a single SQLite
 * transaction. Both the loan row and every plan_entry row are marked
 * dirty=1 so the Sprint 3 sync layer pushes them together.
 */
export interface CreateLoanInput extends LoanInput {
  orgId: string;
  borrowerId: string;
  lineId?: string | null;
}

export interface CreatedLoan {
  loan: LoanRow;
  plan: PlanEntryRow[];
}

export async function createLoanWithPlan(
  input: CreateLoanInput
): Promise<CreatedLoan> {
  const summary = computeLoan(input);
  const loanId = uuid();
  const startMs =
    typeof input.startDate === 'number' ? input.startDate : input.startDate.getTime();

  const loan: LoanRow = {
    id: loanId,
    server_id: null,
    org_id: input.orgId,
    borrower_id: input.borrowerId,
    line_id: input.lineId ?? null,
    principal: input.principal,
    emi_amount: input.emiAmount,
    total_installments: input.totalInstallments,
    total_repayment: summary.totalRepayment,
    start_date: startMs,
    expected_end_date: summary.expectedEndDate,
    status: 'active',
    renewed_from_id: null,
    created_at: now(),
    dirty: 1,
  };

  const planRows: PlanEntryRow[] = summary.plan.map((p) => ({
    id: uuid(),
    server_id: null,
    loan_id: loanId,
    installment_number: p.installmentNumber,
    due_date: p.dueDate,
    expected_amount: p.expectedAmount,
    status: p.status,
    dirty: 1,
  }));

  const db = await openDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO loans (id, server_id, org_id, borrower_id, line_id,
         principal, emi_amount, total_installments, total_repayment,
         start_date, expected_end_date, status, renewed_from_id, created_at, dirty)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        loan.id,
        loan.server_id,
        loan.org_id,
        loan.borrower_id,
        loan.line_id,
        loan.principal,
        loan.emi_amount,
        loan.total_installments,
        loan.total_repayment,
        loan.start_date,
        loan.expected_end_date,
        loan.status,
        loan.renewed_from_id,
        loan.created_at,
      ]
    );

    for (const p of planRows) {
      await db.runAsync(
        `INSERT INTO plan_entries (id, server_id, loan_id, installment_number,
           due_date, expected_amount, status, dirty)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          p.id,
          p.server_id,
          p.loan_id,
          p.installment_number,
          p.due_date,
          p.expected_amount,
          p.status,
        ]
      );
    }
  });

  return { loan, plan: planRows };
}

export async function listLoansForBorrower(borrowerId: string): Promise<LoanRow[]> {
  const db = await openDb();
  return db.getAllAsync<LoanRow>(
    `SELECT * FROM loans WHERE borrower_id = ? ORDER BY created_at DESC`,
    [borrowerId]
  );
}

export async function listActiveLoans(orgId: string): Promise<LoanRow[]> {
  const db = await openDb();
  return db.getAllAsync<LoanRow>(
    `SELECT * FROM loans WHERE org_id = ? AND status = 'active' ORDER BY created_at DESC`,
    [orgId]
  );
}

export async function listPlanEntries(loanId: string): Promise<PlanEntryRow[]> {
  const db = await openDb();
  return db.getAllAsync<PlanEntryRow>(
    `SELECT * FROM plan_entries WHERE loan_id = ? ORDER BY installment_number`,
    [loanId]
  );
}

export async function updateLoanStatus(id: string, status: LoanStatus): Promise<void> {
  const db = await openDb();
  await db.runAsync(
    `UPDATE loans SET status = ?, dirty = 1 WHERE id = ?`,
    [status, id]
  );
}
