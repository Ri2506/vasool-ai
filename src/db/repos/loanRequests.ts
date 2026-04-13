// Owner-approval workflow for new loans.
//
// When an agent proposes a new loan, we create a `loan_requests` row
// instead of directly creating a loan. The owner reviews on their phone
// and either approves (which then creates the real loan + plan_entries
// via the normal createLoanWithTerms path) or rejects.
//
// This is the single biggest anti-fraud feature: it prevents an agent
// from creating "ghost loans" — the SKS fraud that cost ₹4.5 crore.

import { openDb, uuid, now } from '@/db';
import type {
  LoanRequestRow,
  LoanRequestStatus,
  RepaymentType,
  InterestType,
  InterestRatePeriod,
  CollectionFrequency,
} from '@/db/types';
import { createLoanWithTerms, type CreateLoanWithTermsInput } from './loans';

export interface LoanRequestWithMeta extends LoanRequestRow {
  borrower_name: string | null;
  borrower_phone: string | null;
  line_name: string | null;
  requested_by_name: string | null;
}

export interface CreateLoanRequestInput {
  orgId: string;
  requestedBy: string;
  borrowerId: string;
  lineId?: string | null;
  disbursedAmount: number;
  repaymentType: RepaymentType;
  interestType: InterestType;
  interestRate: number;
  interestRatePeriod: InterestRatePeriod;
  frequency: CollectionFrequency;
  tenureCount: number;
  startDate: number;
  upfrontFee?: number;
  notes?: string;
}

export async function createLoanRequest(
  input: CreateLoanRequestInput,
): Promise<LoanRequestRow> {
  const db = await openDb();
  const row: LoanRequestRow = {
    id: uuid(),
    server_id: null,
    org_id: input.orgId,
    requested_by: input.requestedBy,
    borrower_id: input.borrowerId,
    line_id: input.lineId ?? null,
    disbursed_amount: input.disbursedAmount,
    repayment_type: input.repaymentType,
    interest_type: input.interestType,
    interest_rate: input.interestRate,
    interest_rate_period: input.interestRatePeriod,
    frequency: input.frequency,
    tenure_count: input.tenureCount,
    start_date: input.startDate,
    upfront_fee: input.upfrontFee ?? null,
    notes: input.notes?.trim() || null,
    status: 'pending',
    reviewed_by: null,
    reviewed_at: null,
    rejection_reason: null,
    approved_loan_id: null,
    created_at: now(),
    dirty: 1,
  };
  await db.runAsync(
    `INSERT INTO loan_requests (id, server_id, org_id, requested_by, borrower_id,
       line_id, disbursed_amount, repayment_type, interest_type, interest_rate,
       interest_rate_period, frequency, tenure_count, start_date, upfront_fee,
       notes, status, reviewed_by, reviewed_at, rejection_reason, approved_loan_id,
       created_at, dirty)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      row.id, row.server_id, row.org_id, row.requested_by, row.borrower_id,
      row.line_id, row.disbursed_amount, row.repayment_type, row.interest_type,
      row.interest_rate, row.interest_rate_period, row.frequency,
      row.tenure_count, row.start_date, row.upfront_fee,
      row.notes, row.status, row.reviewed_by, row.reviewed_at,
      row.rejection_reason, row.approved_loan_id, row.created_at,
    ],
  );
  return row;
}

/**
 * Approve a pending request — creates the real loan + plan_entries via
 * the usual createLoanWithTerms() path, then marks the request as
 * approved and links the two.
 */
export async function approveLoanRequest(
  requestId: string,
  reviewerUserId: string,
): Promise<{ loanId: string }> {
  const db = await openDb();
  const req = await db.getFirstAsync<LoanRequestRow>(
    `SELECT * FROM loan_requests WHERE id = ?`,
    [requestId],
  );
  if (!req) throw new Error('Loan request not found');
  if (req.status !== 'pending') {
    throw new Error(`Request already ${req.status}`);
  }

  // Build the input for the existing loan creator — reuses all of our
  // dynamic loan calc logic so approved loans behave identically to
  // owner-created loans.
  const input: CreateLoanWithTermsInput = {
    orgId: req.org_id,
    borrowerId: req.borrower_id,
    lineId: req.line_id,
    disbursedAmount: req.disbursed_amount,
    repaymentType: req.repayment_type,
    interestType: req.interest_type,
    interestRate: req.interest_rate,
    interestRatePeriod: req.interest_rate_period,
    frequency: req.frequency,
    tenureCount: req.tenure_count,
    startDate: req.start_date,
    upfrontFee: req.upfront_fee ?? undefined,
  };
  const { loan } = await createLoanWithTerms(input);

  await db.runAsync(
    `UPDATE loan_requests
     SET status = 'approved', reviewed_by = ?, reviewed_at = ?,
         approved_loan_id = ?, dirty = 1
     WHERE id = ?`,
    [reviewerUserId, now(), loan.id, requestId],
  );

  return { loanId: loan.id };
}

export async function rejectLoanRequest(
  requestId: string,
  reviewerUserId: string,
  reason?: string,
): Promise<void> {
  const db = await openDb();
  const req = await db.getFirstAsync<{ status: string }>(
    `SELECT status FROM loan_requests WHERE id = ?`,
    [requestId],
  );
  if (!req) throw new Error('Loan request not found');
  if (req.status !== 'pending') {
    throw new Error(`Request already ${req.status}`);
  }
  await db.runAsync(
    `UPDATE loan_requests
     SET status = 'rejected', reviewed_by = ?, reviewed_at = ?,
         rejection_reason = ?, dirty = 1
     WHERE id = ?`,
    [reviewerUserId, now(), reason?.trim() || null, requestId],
  );
}

export async function cancelLoanRequest(requestId: string): Promise<void> {
  const db = await openDb();
  await db.runAsync(
    `UPDATE loan_requests SET status = 'cancelled', dirty = 1
     WHERE id = ? AND status = 'pending'`,
    [requestId],
  );
}

/**
 * Owner inbox — pending requests first, then recent reviewed.
 * Joined with borrower, line, and requesting agent for context.
 */
export async function listLoanRequestsForOwner(
  orgId: string,
  status?: LoanRequestStatus,
): Promise<LoanRequestWithMeta[]> {
  const db = await openDb();
  const baseSql = `SELECT lr.*,
                          b.name AS borrower_name,
                          b.phone AS borrower_phone,
                          ln.name AS line_name,
                          u.name AS requested_by_name
                   FROM loan_requests lr
                   LEFT JOIN borrowers b ON b.id = lr.borrower_id
                   LEFT JOIN lines ln ON ln.id = lr.line_id
                   LEFT JOIN users u ON u.id = lr.requested_by
                   WHERE lr.org_id = ?`;
  const tail = ` ORDER BY
                   CASE lr.status WHEN 'pending' THEN 0 ELSE 1 END,
                   lr.created_at DESC
                 LIMIT 60`;
  if (status) {
    return db.getAllAsync<LoanRequestWithMeta>(
      `${baseSql} AND lr.status = ?${tail}`,
      [orgId, status],
    );
  }
  return db.getAllAsync<LoanRequestWithMeta>(`${baseSql}${tail}`, [orgId]);
}

/**
 * Agent's own requests — to give agents visibility into approval status
 * after they file a loan request. Filters by requested_by = userId so
 * each agent sees only what they submitted.
 */
export async function listLoanRequestsByAgent(
  orgId: string,
  userId: string,
): Promise<LoanRequestWithMeta[]> {
  const db = await openDb();
  return db.getAllAsync<LoanRequestWithMeta>(
    `SELECT lr.*,
            b.name AS borrower_name,
            b.phone AS borrower_phone,
            ln.name AS line_name,
            u.name AS requested_by_name
     FROM loan_requests lr
     LEFT JOIN borrowers b ON b.id = lr.borrower_id
     LEFT JOIN lines ln ON ln.id = lr.line_id
     LEFT JOIN users u ON u.id = lr.requested_by
     WHERE lr.org_id = ? AND lr.requested_by = ?
     ORDER BY lr.created_at DESC LIMIT 30`,
    [orgId, userId],
  );
}

export async function getPendingRequestCount(orgId: string): Promise<number> {
  const db = await openDb();
  const row = await db.getFirstAsync<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM loan_requests WHERE org_id = ? AND status = 'pending'`,
    [orgId],
  );
  return row?.cnt ?? 0;
}
