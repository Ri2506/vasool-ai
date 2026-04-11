import { openDb, uuid, now } from '@/db';
import type { LineRow, LineType } from '@/db/types';

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
