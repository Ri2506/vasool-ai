// EOD agent cash handover — the linchpin of fraud prevention.
//
// Every day every agent walks a line, collects cash, and at end-of-day must
// "hand over" that cash to the owner. The manual book equivalent is a
// separate sheet with running totals; this repo digitizes it so that:
//
//   1. Auto-tally — collected_amount and expenses_amount are sums computed
//      from the source-of-truth tables (collections + expenses) at the time
//      the agent submits. The agent can't fudge them.
//   2. Submit — agent enters cash_handed_over (what they're giving owner).
//      Variance auto-computes: handed_over - (collected - expenses).
//   3. Confirm — owner enters cash_received (what they actually counted).
//      If owner_received < agent_handed → 'disputed' status.
//
// One row per (org_id, agent_id, date). Date is normalised to start-of-day
// epoch ms so the unique index works regardless of submit time.

import { openDb, uuid, now } from '@/db';
import type { HandoverRow, HandoverStatus } from '@/db/types';

export interface HandoverWithAgent extends HandoverRow {
  agent_name: string | null;
  agent_phone: string | null;
}

function startOfDay(timestamp: number): number {
  const d = new Date(timestamp);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Compute today's auto-tally for a specific agent — what they collected,
 * what was expected, what they spent. Used to pre-fill the EOD sheet.
 */
export interface AgentTally {
  collected: number;
  expected: number;
  expenses: number;
  collectionCount: number;
}

export async function getAgentTallyForDate(
  orgId: string,
  agentId: string,
  date: number,
): Promise<AgentTally> {
  const db = await openDb();
  const startMs = startOfDay(date);
  const endMs = startMs + 86_400_000;

  const collected = await db.getFirstAsync<{ total: number; cnt: number }>(
    `SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS cnt
     FROM collections
     WHERE org_id = ? AND agent_id = ?
       AND collected_at >= ? AND collected_at < ?`,
    [orgId, agentId, startMs, endMs],
  );

  const expected = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(pe.expected_amount), 0) AS total
     FROM plan_entries pe
     JOIN loans l ON l.id = pe.loan_id
     LEFT JOIN lines ln ON ln.id = l.line_id
     WHERE l.org_id = ? AND ln.agent_id = ?
       AND pe.due_date >= ? AND pe.due_date < ?`,
    [orgId, agentId, startMs, endMs],
  );

  const expenses = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM expenses
     WHERE org_id = ? AND user_id = ? AND date >= ? AND date < ?`,
    [orgId, agentId, startMs, endMs],
  );

  return {
    collected: collected?.total ?? 0,
    expected: expected?.total ?? 0,
    expenses: expenses?.total ?? 0,
    collectionCount: collected?.cnt ?? 0,
  };
}

/**
 * Get or create today's pending handover for an agent. Idempotent — if
 * a row exists already (any status), return it as-is.
 */
export async function getOrCreateTodayHandover(
  orgId: string,
  agentId: string,
): Promise<HandoverRow> {
  const db = await openDb();
  const today = startOfDay(Date.now());

  const existing = await db.getFirstAsync<HandoverRow>(
    `SELECT * FROM handovers WHERE org_id = ? AND agent_id = ? AND date = ?`,
    [orgId, agentId, today],
  );
  if (existing) return existing;

  const tally = await getAgentTallyForDate(orgId, agentId, today);
  const row: HandoverRow = {
    id: uuid(),
    server_id: null,
    org_id: orgId,
    agent_id: agentId,
    date: today,
    collected_amount: tally.collected,
    expected_amount: tally.expected,
    expenses_amount: tally.expenses,
    cash_handed_over: null,
    cash_received: null,
    variance: null,
    notes: null,
    agent_submitted_at: null,
    owner_confirmed_at: null,
    status: 'pending',
    created_at: now(),
    dirty: 1,
  };
  await db.runAsync(
    `INSERT INTO handovers (id, server_id, org_id, agent_id, date,
       collected_amount, expected_amount, expenses_amount,
       cash_handed_over, cash_received, variance, notes,
       agent_submitted_at, owner_confirmed_at, status, created_at, dirty)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      row.id, row.server_id, row.org_id, row.agent_id, row.date,
      row.collected_amount, row.expected_amount, row.expenses_amount,
      row.cash_handed_over, row.cash_received, row.variance, row.notes,
      row.agent_submitted_at, row.owner_confirmed_at, row.status, row.created_at,
    ],
  );
  return row;
}

/**
 * Agent submits EOD — refreshes the auto-tally from collections/expenses
 * (in case more came in since the row was created), records the cash they
 * claim to be handing over, and computes initial variance.
 */
export async function submitHandover(
  handoverId: string,
  cashHandedOver: number,
  notes?: string,
): Promise<HandoverRow> {
  const db = await openDb();
  const row = await db.getFirstAsync<HandoverRow>(
    `SELECT * FROM handovers WHERE id = ?`,
    [handoverId],
  );
  if (!row) throw new Error('Handover not found');
  if (row.status === 'confirmed') {
    throw new Error('Already confirmed by owner — cannot resubmit.');
  }

  // Refresh auto-tally — protects against race where last-minute collection
  // came in between row creation and submit.
  const tally = await getAgentTallyForDate(row.org_id, row.agent_id, row.date);
  const variance = cashHandedOver - (tally.collected - tally.expenses);

  await db.runAsync(
    `UPDATE handovers
     SET collected_amount = ?, expected_amount = ?, expenses_amount = ?,
         cash_handed_over = ?, variance = ?, notes = ?,
         agent_submitted_at = ?, status = 'submitted', dirty = 1
     WHERE id = ?`,
    [
      tally.collected, tally.expected, tally.expenses,
      cashHandedOver, variance, notes ?? null,
      now(), handoverId,
    ],
  );

  return (await db.getFirstAsync<HandoverRow>(
    `SELECT * FROM handovers WHERE id = ?`,
    [handoverId],
  ))!;
}

/**
 * Owner confirms the cash they actually counted. If less than agent
 * claimed, status becomes 'disputed'. Otherwise 'confirmed'.
 */
export async function confirmHandover(
  handoverId: string,
  cashReceived: number,
): Promise<HandoverRow> {
  const db = await openDb();
  const row = await db.getFirstAsync<HandoverRow>(
    `SELECT * FROM handovers WHERE id = ?`,
    [handoverId],
  );
  if (!row) throw new Error('Handover not found');
  if (row.status === 'pending') {
    throw new Error('Agent has not submitted EOD yet.');
  }

  const claimed = row.cash_handed_over ?? 0;
  // Variance from owner's perspective: received - expected_net
  const expectedNet = row.collected_amount - row.expenses_amount;
  const variance = cashReceived - expectedNet;
  // Status: if owner counted less than agent claimed, that's a dispute.
  // Small overpayment from agent's side (agent gave more than tally)
  // is fine and becomes a positive variance.
  const status: HandoverStatus = cashReceived < claimed - 1 ? 'disputed' : 'confirmed';

  await db.runAsync(
    `UPDATE handovers
     SET cash_received = ?, variance = ?, owner_confirmed_at = ?,
         status = ?, dirty = 1
     WHERE id = ?`,
    [cashReceived, variance, now(), status, handoverId],
  );

  return (await db.getFirstAsync<HandoverRow>(
    `SELECT * FROM handovers WHERE id = ?`,
    [handoverId],
  ))!;
}

/**
 * Owner inbox — all handovers, newest first. Joined with agent name/phone
 * so the list shows everything in one row.
 */
export async function listHandoversForOwner(
  orgId: string,
  status?: HandoverStatus,
): Promise<HandoverWithAgent[]> {
  const db = await openDb();
  const baseSql = `SELECT h.*, u.name AS agent_name, u.phone AS agent_phone
                   FROM handovers h
                   LEFT JOIN users u ON u.id = h.agent_id
                   WHERE h.org_id = ?`;
  const tail = ` ORDER BY h.date DESC, h.created_at DESC LIMIT 60`;
  if (status) {
    return db.getAllAsync<HandoverWithAgent>(
      `${baseSql} AND h.status = ?${tail}`,
      [orgId, status],
    );
  }
  return db.getAllAsync<HandoverWithAgent>(`${baseSql}${tail}`, [orgId]);
}

/**
 * Per-agent variance history — for the fraud dashboard. Sums variances
 * across all confirmed handovers per agent in the last N days.
 */
export interface AgentVarianceRow {
  agent_id: string;
  agent_name: string;
  total_collected: number;
  total_handed_over: number;
  net_variance: number;
  handover_count: number;
  disputed_count: number;
}

export async function getAgentVarianceSummary(
  orgId: string,
  days: number = 30,
): Promise<AgentVarianceRow[]> {
  const db = await openDb();
  const cutoff = startOfDay(Date.now()) - days * 86_400_000;
  return db.getAllAsync<AgentVarianceRow>(
    `SELECT
       h.agent_id,
       COALESCE(u.name, 'Unknown') AS agent_name,
       COALESCE(SUM(h.collected_amount), 0) AS total_collected,
       COALESCE(SUM(h.cash_handed_over), 0) AS total_handed_over,
       COALESCE(SUM(h.variance), 0) AS net_variance,
       COUNT(h.id) AS handover_count,
       SUM(CASE WHEN h.status = 'disputed' THEN 1 ELSE 0 END) AS disputed_count
     FROM handovers h
     LEFT JOIN users u ON u.id = h.agent_id
     WHERE h.org_id = ? AND h.date >= ?
     GROUP BY h.agent_id
     ORDER BY ABS(net_variance) DESC`,
    [orgId, cutoff],
  );
}

export async function getHandoverById(id: string): Promise<HandoverRow | null> {
  const db = await openDb();
  const row = await db.getFirstAsync<HandoverRow>(
    `SELECT * FROM handovers WHERE id = ?`,
    [id],
  );
  return row ?? null;
}
