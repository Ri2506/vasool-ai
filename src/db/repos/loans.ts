import { openDb, uuid, now } from '@/db';
import type {
  LoanRow,
  LoanStatus,
  PlanEntryRow,
  PenaltyType,
  RepaymentType,
  InterestType,
  CollectionFrequency,
} from '@/db/types';
import {
  computeLoan,
  computeLoanTerms,
  type LoanInput,
  type ComputeLoanTermsInput,
  type ComputedLoanTerms,
} from '@/utils/loanCalc';

/**
 * Create a loan AND its repayment plan atomically in a single SQLite
 * transaction. Both the loan row and every plan_entry row are marked
 * dirty=1 so the Sprint 3 sync layer pushes them together.
 */
export interface CreateLoanInput extends LoanInput {
  orgId: string;
  borrowerId: string;
  lineId?: string | null;
  gracePeriodDays?: number;
  productDescription?: string;
  penaltyType?: 'flat' | 'percentage';
  penaltyAmount?: number;
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

  // Derive schema-v3 fields from the legacy inputs.
  // This path (createLoanWithPlan) is kept working until the NewLoanScreen
  // refactor (Month 1 Week 2) switches to computeLoanTerms.
  const isInterestOnly =
    input.lineType === 'daily_interest' ||
    input.lineType === 'weekly_interest' ||
    input.lineType === 'monthly_interest';
  const interestPerEmi = isInterestOnly
    ? input.emiAmount
    : Math.max(0, (summary.totalRepayment - input.principal) / input.totalInstallments);
  const principalPerEmi = isInterestOnly
    ? 0
    : Math.max(0, input.emiAmount - interestPerEmi);

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
    grace_period_days: input.gracePeriodDays ?? 0,
    product_description: input.productDescription ?? null,
    penalty_type: input.penaltyType ?? null,
    penalty_amount: input.penaltyAmount ?? 0,
    // Schema v3 additions
    repayment_type: isInterestOnly ? 'interest_only' : 'principal_plus_interest',
    interest_type: 'front_loaded', // legacy path: all loans are treated as front-loaded
    interest_rate: 0, // legacy path doesn't capture the rate explicitly
    disbursed_amount: input.principal,
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
    principal_portion: Math.round(principalPerEmi * 100) / 100,
    interest_portion: Math.round(interestPerEmi * 100) / 100,
    status: p.status,
    dirty: 1,
  }));

  const db = await openDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO loans (id, server_id, org_id, borrower_id, line_id,
         principal, emi_amount, total_installments, total_repayment,
         start_date, expected_end_date, status, renewed_from_id,
         grace_period_days, product_description, penalty_type, penalty_amount,
         repayment_type, interest_type, interest_rate, disbursed_amount,
         created_at, dirty)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        loan.id, loan.server_id, loan.org_id, loan.borrower_id, loan.line_id,
        loan.principal, loan.emi_amount, loan.total_installments, loan.total_repayment,
        loan.start_date, loan.expected_end_date, loan.status, loan.renewed_from_id,
        loan.grace_period_days, loan.product_description, loan.penalty_type, loan.penalty_amount,
        loan.repayment_type, loan.interest_type, loan.interest_rate, loan.disbursed_amount,
        loan.created_at,
      ]
    );

    for (const p of planRows) {
      await db.runAsync(
        `INSERT INTO plan_entries (id, server_id, loan_id, installment_number,
           due_date, expected_amount, principal_portion, interest_portion, status, dirty)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          p.id,
          p.server_id,
          p.loan_id,
          p.installment_number,
          p.due_date,
          p.expected_amount,
          p.principal_portion,
          p.interest_portion,
          p.status,
        ]
      );
    }
  });

  return { loan, plan: planRows };
}

/**
 * Create a loan using the new dynamic loan config (Month 1, schema v3).
 *
 * Takes the raw owner inputs (disbursement, repayment type, interest type,
 * rate, frequency, tenure), runs them through computeLoanTerms() to get the
 * full schedule, then inserts the loan + plan_entries atomically.
 *
 * This is the target path for the refactored NewLoanScreen wizard. The older
 * createLoanWithPlan() remains for any legacy callers until fully migrated.
 */
export interface CreateLoanWithTermsInput {
  orgId: string;
  borrowerId: string;
  lineId?: string | null;

  // Dynamic loan terms
  disbursedAmount: number;
  repaymentType: RepaymentType;
  interestType: InterestType;
  interestRate: number;
  interestRatePeriod: ComputeLoanTermsInput['interestRatePeriod'];
  frequency: CollectionFrequency;
  tenureCount: number;
  startDate: number;
  upfrontFee?: number;

  // Optional extras
  gracePeriodDays?: number;
  productDescription?: string;
  penaltyType?: PenaltyType;
  penaltyAmount?: number;
  // If this loan is a renewal of a previously-closed loan, link it.
  // UI uses this to label the new loan as RENEWAL vs NEW on the borrower card.
  renewedFromId?: string | null;
}

export async function createLoanWithTerms(
  input: CreateLoanWithTermsInput
): Promise<CreatedLoan> {
  const terms = computeLoanTerms({
    disbursedAmount: input.disbursedAmount,
    repaymentType: input.repaymentType,
    interestType: input.interestType,
    interestRate: input.interestRate,
    interestRatePeriod: input.interestRatePeriod,
    frequency: input.frequency,
    tenureCount: input.tenureCount,
    startDate: input.startDate,
    upfrontFee: input.upfrontFee,
  });

  const loanId = uuid();

  const loan: LoanRow = {
    id: loanId,
    server_id: null,
    org_id: input.orgId,
    borrower_id: input.borrowerId,
    line_id: input.lineId ?? null,
    principal: terms.principal,
    emi_amount: terms.emiAmount,
    total_installments: terms.installments,
    total_repayment: terms.totalRepayment,
    start_date: input.startDate,
    // For interest-only the calculator returns null endDate (rolling loan).
    // Store the last scheduled entry's due date as a hint, or fall back to
    // startDate + 1 year if no entries at all (shouldn't happen).
    expected_end_date:
      terms.endDate ??
      (terms.planEntries.length > 0
        ? terms.planEntries[terms.planEntries.length - 1].dueDate
        : input.startDate + 365 * 86_400_000),
    status: 'active',
    renewed_from_id: input.renewedFromId ?? null,
    grace_period_days: input.gracePeriodDays ?? 0,
    product_description: input.productDescription ?? null,
    penalty_type: input.penaltyType ?? null,
    penalty_amount: input.penaltyAmount ?? 0,
    repayment_type: input.repaymentType,
    interest_type: input.interestType,
    interest_rate: input.interestRate,
    disbursed_amount: input.disbursedAmount,
    created_at: now(),
    dirty: 1,
  };

  const planRows: PlanEntryRow[] = terms.planEntries.map((p) => ({
    id: uuid(),
    server_id: null,
    loan_id: loanId,
    installment_number: p.installmentNumber,
    due_date: p.dueDate,
    expected_amount: p.expectedAmount,
    principal_portion: p.principalPortion,
    interest_portion: p.interestPortion,
    // Day-0 upfront fee entries are pre-marked paid (front-loaded interest_only).
    status: p.preMarkedPaid ? 'paid' : 'pending',
    dirty: 1,
  }));

  const db = await openDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO loans (id, server_id, org_id, borrower_id, line_id,
         principal, emi_amount, total_installments, total_repayment,
         start_date, expected_end_date, status, renewed_from_id,
         grace_period_days, product_description, penalty_type, penalty_amount,
         repayment_type, interest_type, interest_rate, disbursed_amount,
         created_at, dirty)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        loan.id, loan.server_id, loan.org_id, loan.borrower_id, loan.line_id,
        loan.principal, loan.emi_amount, loan.total_installments, loan.total_repayment,
        loan.start_date, loan.expected_end_date, loan.status, loan.renewed_from_id,
        loan.grace_period_days, loan.product_description, loan.penalty_type, loan.penalty_amount,
        loan.repayment_type, loan.interest_type, loan.interest_rate, loan.disbursed_amount,
        loan.created_at,
      ]
    );

    for (const p of planRows) {
      await db.runAsync(
        `INSERT INTO plan_entries (id, server_id, loan_id, installment_number,
           due_date, expected_amount, principal_portion, interest_portion, status, dirty)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          p.id,
          p.server_id,
          p.loan_id,
          p.installment_number,
          p.due_date,
          p.expected_amount,
          p.principal_portion,
          p.interest_portion,
          p.status,
        ]
      );
    }
  });

  return { loan, plan: planRows };
}

/**
 * Rolling interest-only loan extension.
 *
 * When a loan of type `interest_only` has all its scheduled plan_entries paid
 * but the principal is still outstanding (per `principal_returns`), we need
 * to generate the next window of interest collections so the agent can keep
 * collecting. This function is called from recordCollection() after the
 * transaction commits (nested transactions are forbidden in expo-sqlite).
 *
 * The new window is sized to match the original loan's initial window:
 *   daily   → next 90 interest collections
 *   weekly  → next 26
 *   monthly → next 12
 *
 * Principal and interest portions are preserved from the last existing entry
 * so the terms stay consistent until the owner explicitly changes them.
 */
export async function extendInterestOnlyPlan(loanId: string): Promise<void> {
  const db = await openDb();

  const loan = await db.getFirstAsync<{
    repayment_type: string;
    emi_amount: number;
    interest_rate: number;
    interest_type: string;
  }>(
    `SELECT repayment_type, emi_amount, interest_rate, interest_type
     FROM loans WHERE id = ?`,
    [loanId]
  );
  if (!loan || loan.repayment_type !== 'interest_only') return;

  // Find the highest existing installment_number so we continue numbering
  // from where we left off and don't collide on keys.
  const last = await db.getFirstAsync<{
    max_num: number;
    last_due: number;
    last_amount: number;
    last_interest: number;
  }>(
    `SELECT
       MAX(installment_number) AS max_num,
       MAX(due_date) AS last_due,
       MAX(expected_amount) AS last_amount,
       MAX(interest_portion) AS last_interest
     FROM plan_entries WHERE loan_id = ?`,
    [loanId]
  );
  if (!last) return;

  const startNumber = (last.max_num ?? 0) + 1;
  const baseDate = last.last_due ?? now();
  const expectedAmount = last.last_amount ?? loan.emi_amount;
  const interestPortion = last.last_interest ?? loan.emi_amount;

  // Infer cadence from the spacing of the last two existing entries.
  // Fallback: 1 day.
  const spacing = await db.getFirstAsync<{ gap: number }>(
    `SELECT (MAX(due_date) - MIN(due_date)) / NULLIF(COUNT(*) - 1, 0) AS gap
     FROM plan_entries WHERE loan_id = ?`,
    [loanId]
  );
  const gapMs = Math.max(86_400_000, spacing?.gap ?? 86_400_000);
  const dayMs = 86_400_000;
  // Window size: match the cadence
  const windowSize = gapMs < 2 * dayMs ? 90 : gapMs < 14 * dayMs ? 26 : 12;

  await db.withTransactionAsync(async () => {
    for (let i = 0; i < windowSize; i++) {
      const installmentNumber = startNumber + i;
      const dueDate = baseDate + (i + 1) * gapMs;
      await db.runAsync(
        `INSERT INTO plan_entries (id, server_id, loan_id, installment_number,
           due_date, expected_amount, principal_portion, interest_portion, status, dirty)
         VALUES (?, NULL, ?, ?, ?, ?, 0, ?, 'pending', 1)`,
        [uuid(), loanId, installmentNumber, dueDate, expectedAmount, interestPortion]
      );
    }
  });
}

export async function getLoanById(loanId: string): Promise<LoanRow | null> {
  const db = await openDb();
  const row = await db.getFirstAsync<LoanRow>(
    `SELECT * FROM loans WHERE id = ?`,
    [loanId]
  );
  return row ?? null;
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

/**
 * Enriched plan entry — joins plan_entries with collections to show
 * what actually happened vs what was scheduled. Powers the dynamic
 * LoanPlanScreen timeline.
 *
 * Each row contains:
 *   - Scheduled (due_date, expected_amount, principal/interest split)
 *   - Actual   (total_paid, last_paid_date, payment_count, days_late)
 *   - Status   (paid/partial/pending/missed/advance_covered)
 *   - Running outstanding balance after this entry
 */
export interface PlanTimelineEntry {
  id: string;
  loan_id: string;
  installment_number: number;
  due_date: number;
  expected_amount: number;
  principal_portion: number;
  interest_portion: number;
  status: string;
  // Actuals derived from collections joined on plan_entry_id
  paid_amount: number;
  payment_count: number;
  first_paid_at: number | null;
  last_paid_at: number | null;
  // Days between due_date and the date the entry became fully paid.
  // Negative = paid early (advance), 0 = on time, positive = late.
  // null = not yet paid.
  days_late: number | null;
  // Running outstanding total (sum of expected_amount of remaining entries).
  outstanding_after: number;
}

export async function getLoanPlanTimeline(loanId: string): Promise<PlanTimelineEntry[]> {
  const db = await openDb();
  const dayMs = 86_400_000;

  // Always read the bare plan first — guarantees the UI gets *something*
  // even if the collections join below fails (e.g. the plan_entry_id
  // column hasn't migrated yet on this device).
  const baseRows = await db.getAllAsync<PlanEntryRow>(
    `SELECT * FROM plan_entries WHERE loan_id = ? ORDER BY installment_number`,
    [loanId]
  );

  // Try to enrich with per-entry collection aggregates. If anything goes
  // wrong (missing column on legacy DB, etc.) fall back to base entries.
  type Agg = { id: string; paid_amount: number; payment_count: number; first_paid_at: number | null; last_paid_at: number | null };
  let aggMap = new Map<string, Agg>();
  try {
    const rows = await db.getAllAsync<Agg>(
      `SELECT
         pe.id AS id,
         COALESCE(SUM(c.amount), 0) AS paid_amount,
         COUNT(c.id) AS payment_count,
         MIN(c.collected_at) AS first_paid_at,
         MAX(c.collected_at) AS last_paid_at
       FROM plan_entries pe
       LEFT JOIN collections c ON c.plan_entry_id = pe.id
       WHERE pe.loan_id = ?
       GROUP BY pe.id`,
      [loanId]
    );
    aggMap = new Map(rows.map((r) => [r.id, r]));
  } catch (e) {
    // Column probably missing on a stale DB. Soft-fail and render base plan.
    // eslint-disable-next-line no-console
    console.warn('[getLoanPlanTimeline] collection join failed, using base plan:', e);
  }

  const total = baseRows.reduce((sum, r) => sum + r.expected_amount, 0);
  let runningPaid = 0;

  return baseRows.map((r) => {
    runningPaid += r.expected_amount;
    const agg = aggMap.get(r.id);
    const lastPaidAt = agg?.last_paid_at ?? null;
    const daysLate = lastPaidAt != null ? Math.round((lastPaidAt - r.due_date) / dayMs) : null;
    return {
      id: r.id,
      loan_id: r.loan_id,
      installment_number: r.installment_number,
      due_date: r.due_date,
      expected_amount: r.expected_amount,
      principal_portion: r.principal_portion ?? 0,
      interest_portion: r.interest_portion ?? 0,
      status: r.status,
      paid_amount: agg?.paid_amount ?? 0,
      payment_count: agg?.payment_count ?? 0,
      first_paid_at: agg?.first_paid_at ?? null,
      last_paid_at: lastPaidAt,
      days_late: daysLate,
      outstanding_after: Math.max(0, total - runningPaid),
    };
  });
}

export async function updateLoanStatus(id: string, status: LoanStatus): Promise<void> {
  const db = await openDb();
  await db.runAsync(
    `UPDATE loans SET status = ?, dirty = 1 WHERE id = ?`,
    [status, id]
  );
}
