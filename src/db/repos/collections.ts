import { openDb, uuid, now } from '@/db';
import type { CollectionRow } from '@/db/types';

// Module-level set tracking loan IDs that need their interest-only plan
// extended after the current recordCollection transaction commits.
// Can't extend inside the same transaction because extendInterestOnlyPlan
// opens its own (expo-sqlite doesn't allow nested transactions).
const _pendingExtensions = new Set<string>();

export interface DueTodayItem {
  plan_entry_id: string;
  loan_id: string;
  borrower_id: string;
  borrower_name: string;
  borrower_phone: string | null;
  line_name: string | null;
  line_type: string | null;
  expected_amount: number;
  installment_number: number;
  due_date: number;
  loan_principal: number;
  loan_emi: number;
  loan_status: string;
}

/**
 * Get all plan entries due today (or overdue) that haven't been paid yet,
 * joined with borrower + loan + line info. This powers the Home dashboard
 * "due today" list and the BatchCollectScreen.
 */
export async function getDueToday(orgId: string): Promise<DueTodayItem[]> {
  const db = await openDb();
  // Today at 00:00 epoch ms
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();
  // End of today
  const endOfDay = todayMs + 86400000 - 1;

  return db.getAllAsync<DueTodayItem>(
    `SELECT
       pe.id AS plan_entry_id,
       pe.loan_id,
       l.borrower_id,
       b.name AS borrower_name,
       b.phone AS borrower_phone,
       ln.name AS line_name,
       ln.type AS line_type,
       pe.expected_amount,
       pe.installment_number,
       pe.due_date,
       l.principal AS loan_principal,
       l.emi_amount AS loan_emi,
       l.status AS loan_status
     FROM plan_entries pe
     JOIN loans l ON l.id = pe.loan_id
     JOIN borrowers b ON b.id = l.borrower_id
     LEFT JOIN lines ln ON ln.id = l.line_id
     WHERE l.org_id = ?
       AND l.status = 'active'
       AND pe.status IN ('pending', 'partial')
       AND pe.due_date <= ?
     ORDER BY pe.due_date ASC, b.name COLLATE NOCASE`,
    [orgId, endOfDay]
  );
}

export interface RecordCollectionInput {
  orgId: string;
  loanId: string;
  planEntryId: string;
  amount: number;
  expectedAmount: number;
  agentId?: string | null;
  isAdvance?: boolean;
  advancePeriods?: number;
  gpsLat?: number | null;
  gpsLng?: number | null;
}

/**
 * Record a collection and update the corresponding plan_entry status.
 * Runs in a transaction so either both succeed or neither does.
 */
export async function recordCollection(
  input: RecordCollectionInput
): Promise<CollectionRow> {
  if (input.amount <= 0) throw new Error('Amount must be positive');
  const db = await openDb();
  const shortfall = Math.max(0, input.expectedAmount - input.amount);
  const collection: CollectionRow = {
    id: uuid(),
    server_id: null,
    org_id: input.orgId,
    loan_id: input.loanId,
    agent_id: input.agentId ?? null,
    amount: input.amount,
    expected_amount: input.expectedAmount,
    shortfall,
    is_advance: input.isAdvance ? 1 : 0,
    advance_periods: input.advancePeriods ?? 0,
    collected_at: now(),
    gps_lat: input.gpsLat ?? null,
    gps_lng: input.gpsLng ?? null,
    is_synced: 0,
    offline_id: uuid(),
    created_at: now(),
    dirty: 1,
  };

  // Determine plan_entry status after payment
  let newStatus: string;
  if (input.amount >= input.expectedAmount) {
    newStatus = 'paid';
  } else if (input.amount > 0) {
    newStatus = 'partial';
  } else {
    newStatus = 'missed';
  }

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO collections (id, server_id, org_id, loan_id, agent_id,
         amount, expected_amount, shortfall, is_advance, advance_periods,
         collected_at, gps_lat, gps_lng, is_synced, offline_id, created_at, dirty)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 1)`,
      [
        collection.id, collection.server_id, collection.org_id,
        collection.loan_id, collection.agent_id,
        collection.amount, collection.expected_amount, collection.shortfall,
        collection.is_advance, collection.advance_periods,
        collection.collected_at, collection.gps_lat, collection.gps_lng,
        collection.offline_id, collection.created_at,
      ]
    );

    // Update plan entry status
    await db.runAsync(
      `UPDATE plan_entries SET status = ?, dirty = 1 WHERE id = ?`,
      [newStatus, input.planEntryId]
    );

    // If advance payment, mark next N entries as advance_covered
    if (input.isAdvance && (input.advancePeriods ?? 0) > 0) {
      const periods = input.advancePeriods!;
      // Get the next N pending entries for this loan after the current one
      const nextEntries = await db.getAllAsync<{ id: string }>(
        `SELECT id FROM plan_entries
         WHERE loan_id = ? AND status = 'pending' AND id != ?
         ORDER BY installment_number
         LIMIT ?`,
        [input.loanId, input.planEntryId, periods]
      );
      for (const entry of nextEntries) {
        await db.runAsync(
          `UPDATE plan_entries SET status = 'advance_covered', dirty = 1 WHERE id = ?`,
          [entry.id]
        );
      }
    }

    // Auto loan closure (schema v3 — uses loans.repayment_type directly,
    // no more fragile line_type string matching).
    //
    //   principal_plus_interest → close when all plan entries paid
    //   interest_only           → extend plan if principal not returned,
    //                             close only when all entries paid AND
    //                             principal fully returned via principal_returns
    const remaining = await db.getFirstAsync<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM plan_entries
       WHERE loan_id = ? AND status IN ('pending', 'partial')`,
      [input.loanId]
    );

    if (remaining && remaining.cnt === 0) {
      const loan = await db.getFirstAsync<{
        repayment_type: string;
        principal: number;
      }>(
        `SELECT repayment_type, principal FROM loans WHERE id = ?`,
        [input.loanId]
      );

      if (loan?.repayment_type === 'interest_only') {
        // Check whether principal has been fully returned via principal_returns
        const returned = await db.getFirstAsync<{ total: number }>(
          `SELECT COALESCE(SUM(amount), 0) AS total FROM principal_returns
           WHERE loan_id = ? AND amount > 0`,
          [input.loanId]
        );
        const principalReturned = returned?.total ?? 0;
        const principalOwed = loan.principal ?? 0;

        if (principalReturned >= principalOwed) {
          // Principal fully returned AND no more scheduled entries → close.
          await db.runAsync(
            `UPDATE loans SET status = 'closed', dirty = 1 WHERE id = ?`,
            [input.loanId]
          );
        } else {
          // Rolling interest-only loan — principal still outstanding, so
          // extend the plan with another window of interest collections.
          // We flag the loan for extension; the actual extension runs
          // post-transaction via extendInterestOnlyPlan() (called from
          // the repo wrapper below so it doesn't nest transactions).
          _pendingExtensions.add(input.loanId);
        }
      } else {
        // principal_plus_interest (or null for legacy rows) → close immediately
        await db.runAsync(
          `UPDATE loans SET status = 'closed', dirty = 1 WHERE id = ?`,
          [input.loanId]
        );
      }
    }
  });

  // Run any interest-only plan extensions outside the transaction.
  // extendInterestOnlyPlan() opens its own transaction so nesting is forbidden.
  if (_pendingExtensions.has(input.loanId)) {
    _pendingExtensions.delete(input.loanId);
    try {
      const { extendInterestOnlyPlan } = await import('@/db/repos/loans');
      await extendInterestOnlyPlan(input.loanId);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[recordCollection] extendInterestOnlyPlan failed:', e);
    }
  }

  return collection;
}

/**
 * Get Nadapu/Nippu status for a borrower's active loans.
 * Nippu = overdue beyond grace period. Nadapu = on schedule.
 */
export async function getBorrowerPaymentStatus(
  borrowerId: string
): Promise<{ isNippu: boolean; daysOverdue: number; rating: number }> {
  const db = await openDb();
  const todayMs = Date.now();

  // Check for overdue entries considering grace period
  const overdue = await db.getFirstAsync<{ days: number; grace: number }>(
    `SELECT
       CAST((${todayMs} - MIN(pe.due_date)) / 86400000 AS INTEGER) AS days,
       COALESCE(l.grace_period_days, 0) AS grace
     FROM plan_entries pe
     JOIN loans l ON l.id = pe.loan_id
     WHERE l.borrower_id = ? AND l.status = 'active'
       AND pe.status IN ('pending', 'partial')
       AND pe.due_date < ${todayMs}
     GROUP BY l.id
     ORDER BY days DESC LIMIT 1`,
    [borrowerId]
  );

  const daysOverdue = Number(overdue?.days ?? 0);
  const grace = Number(overdue?.grace ?? 0);
  const isNippu = daysOverdue > grace;

  // Payment rating: on-time / total
  const stats = await db.getFirstAsync<{ on_time: number; total: number }>(
    `SELECT
       SUM(CASE WHEN pe.status IN ('paid', 'advance_covered') THEN 1 ELSE 0 END) AS on_time,
       COUNT(*) AS total
     FROM plan_entries pe
     JOIN loans l ON l.id = pe.loan_id
     WHERE l.borrower_id = ? AND pe.due_date < ${todayMs}`,
    [borrowerId]
  );
  const onTime = Number(stats?.on_time ?? 0);
  const total = Number(stats?.total ?? 0);
  let rating = 0;
  if (total > 0) {
    const pct = (onTime / total) * 100;
    if (pct >= 90) rating = 5;
    else if (pct >= 75) rating = 4;
    else if (pct >= 60) rating = 3;
    else if (pct >= 40) rating = 2;
    else rating = 1;
  }

  return { isNippu, daysOverdue, rating };
}

/**
 * Today's collection summary for an org: total collected, count, pending.
 */
export interface DaySummary {
  totalCollected: number;
  collectionCount: number;
  totalExpected: number;
  dueCount: number;
}

export async function getTodaySummary(orgId: string): Promise<DaySummary> {
  const db = await openDb();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startMs = today.getTime();
  const endMs = startMs + 86400000;

  const collected = await db.getFirstAsync<{ total: number; cnt: number }>(
    `SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS cnt
     FROM collections
     WHERE org_id = ? AND collected_at >= ? AND collected_at < ?`,
    [orgId, startMs, endMs]
  );

  const due = await db.getFirstAsync<{ total: number; cnt: number }>(
    `SELECT COALESCE(SUM(pe.expected_amount), 0) AS total, COUNT(*) AS cnt
     FROM plan_entries pe
     JOIN loans l ON l.id = pe.loan_id
     WHERE l.org_id = ? AND l.status = 'active'
       AND pe.due_date >= ? AND pe.due_date < ?
       AND pe.status IN ('pending', 'partial')`,
    [orgId, startMs, endMs]
  );

  return {
    totalCollected: collected?.total ?? 0,
    collectionCount: collected?.cnt ?? 0,
    totalExpected: due?.total ?? 0,
    dueCount: due?.cnt ?? 0,
  };
}

export async function getTodayCollections(orgId: string): Promise<Array<{borrower_name: string; amount: number}>> {
  const db = await openDb();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const rows = await db.getAllAsync<{borrower_name: string; amount: number}>(
    `SELECT b.name AS borrower_name, c.amount
     FROM collections c
     JOIN loans l ON l.id = c.loan_id
     JOIN borrowers b ON b.id = l.borrower_id
     WHERE c.org_id = ? AND c.collected_at >= ?
     ORDER BY c.collected_at DESC`,
    [orgId, today.getTime()]
  );
  return rows;
}

export async function getCollectionsForLoan(loanId: string): Promise<CollectionRow[]> {
  const db = await openDb();
  return db.getAllAsync<CollectionRow>(
    `SELECT * FROM collections WHERE loan_id = ? ORDER BY collected_at DESC`,
    [loanId]
  );
}
