import { openDb, uuid, now } from '@/db';
import type { InvestmentRow } from '@/db/types';

export interface NewInvestmentInput {
  orgId: string;
  amount: number;
  source?: string | null;
  notes?: string | null;
}

export async function createInvestment(input: NewInvestmentInput): Promise<InvestmentRow> {
  const db = await openDb();
  const row: InvestmentRow = {
    id: uuid(),
    server_id: null,
    org_id: input.orgId,
    amount: input.amount,
    source: input.source?.trim() || null,
    date: now(),
    notes: input.notes?.trim() || null,
    created_at: now(),
    dirty: 1,
  };
  await db.runAsync(
    `INSERT INTO investments (id, server_id, org_id, amount, source, date, notes, created_at, dirty)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [row.id, row.server_id, row.org_id, row.amount, row.source, row.date, row.notes, row.created_at]
  );
  return row;
}

export async function listInvestments(orgId: string): Promise<InvestmentRow[]> {
  const db = await openDb();
  return db.getAllAsync<InvestmentRow>(
    `SELECT * FROM investments WHERE org_id = ? ORDER BY date DESC`,
    [orgId]
  );
}

export async function getTotalInvested(orgId: string): Promise<number> {
  const db = await openDb();
  const row = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM investments WHERE org_id = ?`,
    [orgId]
  );
  return row?.total ?? 0;
}
