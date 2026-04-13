import { openDb, uuid, now } from '@/db';
import type { LineRow, LineType } from '@/db/types';
import { assertWithinCap } from '@/utils/planCaps';

export async function listLines(orgId: string): Promise<LineRow[]> {
  const db = await openDb();
  return db.getAllAsync<LineRow>(
    `SELECT * FROM lines WHERE org_id = ? ORDER BY created_at DESC`,
    [orgId]
  );
}

export async function getLine(id: string): Promise<LineRow | null> {
  const db = await openDb();
  const row = await db.getFirstAsync<LineRow>(
    `SELECT * FROM lines WHERE id = ?`,
    [id]
  );
  return row ?? null;
}

export interface NewLineInput {
  orgId: string;
  name: string;
  type: LineType;
  agentId?: string | null;
}

export async function createLine(input: NewLineInput): Promise<LineRow> {
  await assertWithinCap(input.orgId, 'lines');
  const db = await openDb();
  const row: LineRow = {
    id: uuid(),
    server_id: null,
    org_id: input.orgId,
    name: input.name.trim(),
    type: input.type,
    agent_id: input.agentId ?? null,
    created_at: now(),
    dirty: 1,
  };
  await db.runAsync(
    `INSERT INTO lines (id, server_id, org_id, name, type, agent_id, created_at, dirty)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    [row.id, row.server_id, row.org_id, row.name, row.type, row.agent_id, row.created_at]
  );
  return row;
}

/**
 * Assign (or unassign) an agent to a line. Pass null to unassign.
 * Multiple lines can share the same agent. A line can have only one agent.
 *
 * Side effect: appends to line_agent_assignments so the rotation history
 * is preserved. The previously-open row (unassigned_at IS NULL) is closed
 * with the current timestamp, then a new open row is inserted (only if
 * the new agent is non-null).
 */
export async function assignLineAgent(
  lineId: string,
  agentId: string | null,
  options?: { assignedBy?: string | null; note?: string | null },
): Promise<void> {
  const db = await openDb();
  await db.withTransactionAsync(async () => {
    // Look up org_id so we can stamp the history row correctly.
    const lineRow = await db.getFirstAsync<{ org_id: string; agent_id: string | null }>(
      `SELECT org_id, agent_id FROM lines WHERE id = ?`,
      [lineId],
    );
    if (!lineRow) throw new Error('Line not found');

    // No-op early if the agent is the same.
    if ((lineRow.agent_id ?? null) === (agentId ?? null)) return;

    // Close any open history rows for this line.
    await db.runAsync(
      `UPDATE line_agent_assignments
       SET unassigned_at = ?, dirty = 1
       WHERE line_id = ? AND unassigned_at IS NULL`,
      [now(), lineId],
    );

    // Update the canonical line row.
    await db.runAsync(
      `UPDATE lines SET agent_id = ?, dirty = 1 WHERE id = ?`,
      [agentId, lineId],
    );

    // Open a new history row only if there's an agent now (skip on unassign).
    if (agentId) {
      await db.runAsync(
        `INSERT INTO line_agent_assignments (id, server_id, org_id, line_id, agent_id,
           assigned_at, unassigned_at, assigned_by, note, created_at, dirty)
         VALUES (?, NULL, ?, ?, ?, ?, NULL, ?, ?, ?, 1)`,
        [
          uuid(), lineRow.org_id, lineId, agentId,
          now(), options?.assignedBy ?? null, options?.note ?? null, now(),
        ],
      );
    }
  });
}

/**
 * Full assignment history for a single line — newest first. Joined with
 * users so the UI shows agent names instead of UUIDs.
 */
export interface LineAssignmentHistoryRow {
  id: string;
  line_id: string;
  agent_id: string | null;
  agent_name: string | null;
  assigned_at: number;
  unassigned_at: number | null;
  note: string | null;
  duration_ms: number | null;
}

export async function getLineAssignmentHistory(lineId: string): Promise<LineAssignmentHistoryRow[]> {
  const db = await openDb();
  const rows = await db.getAllAsync<LineAssignmentHistoryRow>(
    `SELECT laa.id, laa.line_id, laa.agent_id, u.name AS agent_name,
            laa.assigned_at, laa.unassigned_at, laa.note, NULL AS duration_ms
     FROM line_agent_assignments laa
     LEFT JOIN users u ON u.id = laa.agent_id
     WHERE laa.line_id = ?
     ORDER BY laa.assigned_at DESC`,
    [lineId],
  );
  // Compute duration in JS — keeps the SQL portable across native + sql.js.
  return rows.map((r) => ({
    ...r,
    duration_ms: (r.unassigned_at ?? Date.now()) - r.assigned_at,
  }));
}

export interface LineStatsRow {
  line_id: string;
  line_name: string;
  line_type: string;
  agent_id: string | null;
  agent_name: string | null;
  borrower_count: number;
  active_loan_count: number;
  outstanding_principal: number;
  // Today
  today_due_amount: number;
  today_collected_amount: number;
  today_collection_count: number;
  // Last 30 days
  month_collected_amount: number;
}

/**
 * Per-line stats for the Lines screen. Each line shows borrower count,
 * outstanding amount, today's progress (due vs collected), and the agent
 * currently assigned. Owner uses this to see which lines are pulling their
 * weight and which need attention.
 */
export async function getLineStats(orgId: string): Promise<LineStatsRow[]> {
  const db = await openDb();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startMs = today.getTime();
  const endMs = startMs + 86400000;
  const monthAgo = startMs - 30 * 86400000;

  return db.getAllAsync<LineStatsRow>(
    `SELECT
       ln.id AS line_id,
       ln.name AS line_name,
       ln.type AS line_type,
       ln.agent_id,
       u.name AS agent_name,
       COUNT(DISTINCT CASE WHEN l.status = 'active' THEN l.borrower_id END) AS borrower_count,
       COUNT(DISTINCT CASE WHEN l.status = 'active' THEN l.id END) AS active_loan_count,
       COALESCE(SUM(CASE WHEN l.status = 'active'
                         THEN l.total_repayment - COALESCE(pd.paid, 0)
                         ELSE 0 END), 0) AS outstanding_principal,
       COALESCE(SUM(CASE WHEN pe.due_date >= ? AND pe.due_date < ?
                          AND pe.status IN ('pending', 'partial')
                          AND l.status = 'active'
                         THEN pe.expected_amount ELSE 0 END), 0) AS today_due_amount,
       COALESCE(td.today_total, 0) AS today_collected_amount,
       COALESCE(td.today_cnt, 0) AS today_collection_count,
       COALESCE(md.month_total, 0) AS month_collected_amount
     FROM lines ln
     LEFT JOIN loans l ON l.line_id = ln.id
     LEFT JOIN plan_entries pe ON pe.loan_id = l.id
     LEFT JOIN users u ON u.id = ln.agent_id
     LEFT JOIN (
       SELECT l2.id AS loan_id, SUM(c.amount) AS paid
       FROM collections c JOIN loans l2 ON l2.id = c.loan_id
       GROUP BY l2.id
     ) pd ON pd.loan_id = l.id
     LEFT JOIN (
       SELECT l3.line_id,
              SUM(c.amount) AS today_total,
              COUNT(c.id) AS today_cnt
       FROM collections c JOIN loans l3 ON l3.id = c.loan_id
       WHERE c.collected_at >= ? AND c.collected_at < ?
       GROUP BY l3.line_id
     ) td ON td.line_id = ln.id
     LEFT JOIN (
       SELECT l4.line_id, SUM(c.amount) AS month_total
       FROM collections c JOIN loans l4 ON l4.id = c.loan_id
       WHERE c.collected_at >= ?
       GROUP BY l4.line_id
     ) md ON md.line_id = ln.id
     WHERE ln.org_id = ?
     GROUP BY ln.id
     ORDER BY ln.name COLLATE NOCASE`,
    [startMs, endMs, startMs, endMs, monthAgo, orgId]
  );
}

/**
 * Per-agent collection totals for a specific line (last 30 days).
 * Used by the line-detail view to show "who is actually collecting"
 * when multiple agents share a line temporarily.
 */
export interface LineAgentStatsRow {
  agent_id: string;
  agent_name: string;
  collection_count: number;
  total_amount: number;
}

export async function getLineAgentStats(lineId: string): Promise<LineAgentStatsRow[]> {
  const db = await openDb();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monthAgo = today.getTime() - 30 * 86400000;

  return db.getAllAsync<LineAgentStatsRow>(
    `SELECT
       c.agent_id,
       u.name AS agent_name,
       COUNT(c.id) AS collection_count,
       SUM(c.amount) AS total_amount
     FROM collections c
     JOIN loans l ON l.id = c.loan_id
     LEFT JOIN users u ON u.id = c.agent_id
     WHERE l.line_id = ? AND c.collected_at >= ?
     GROUP BY c.agent_id
     ORDER BY total_amount DESC`,
    [lineId, monthAgo]
  );
}

export async function deleteLine(id: string): Promise<void> {
  const db = await openDb();
  // Guard against deleting a line that has active loans
  const active = await db.getFirstAsync<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM loans WHERE line_id = ? AND status = 'active'`,
    [id]
  );
  if (active && active.cnt > 0) {
    throw new Error(`Cannot delete line — ${active.cnt} active loan${active.cnt > 1 ? 's' : ''} still using it`);
  }
  await db.runAsync(`DELETE FROM lines WHERE id = ?`, [id]);
}
