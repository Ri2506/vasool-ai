import { openDb, uuid, now } from '@/db';
import type { CollectionRow } from '@/db/types';

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
  });

  return collection;
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

export async function getCollectionsForLoan(loanId: string): Promise<CollectionRow[]> {
  const db = await openDb();
  return db.getAllAsync<CollectionRow>(
    `SELECT * FROM collections WHERE loan_id = ? ORDER BY collected_at DESC`,
    [loanId]
  );
}
