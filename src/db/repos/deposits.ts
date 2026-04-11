import { openDb, uuid, now } from '@/db';
import type { DepositRow, DepositStatus } from '@/db/types';

export interface NewDepositInput {
  orgId: string;
  depositorName: string;
  depositorPhone?: string | null;
  amount: number;
  interestRate: number;
  startDate?: number;
  maturityDate?: number | null;
}

export async function createDeposit(input: NewDepositInput): Promise<DepositRow> {
  if (input.amount <= 0) throw new Error('Amount must be positive');
  const db = await openDb();
  const row: DepositRow = {
    id: uuid(), server_id: null, org_id: input.orgId,
    depositor_name: input.depositorName.trim(),
    depositor_phone: input.depositorPhone?.trim() || null,
    amount: input.amount, interest_rate: input.interestRate,
    start_date: input.startDate ?? now(),
    maturity_date: input.maturityDate ?? null,
    interest_paid: 0, status: 'active',
    created_at: now(), dirty: 1,
  };
  await db.runAsync(
    `INSERT INTO deposits (id, server_id, org_id, depositor_name, depositor_phone,
       amount, interest_rate, start_date, maturity_date, interest_paid, status, created_at, dirty)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'active', ?, 1)`,
    [row.id, row.server_id, row.org_id, row.depositor_name, row.depositor_phone,
     row.amount, row.interest_rate, row.start_date, row.maturity_date, row.created_at]
  );
  return row;
}

export async function listDeposits(orgId: string): Promise<DepositRow[]> {
  const db = await openDb();
  return db.getAllAsync<DepositRow>(
    `SELECT * FROM deposits WHERE org_id = ? ORDER BY created_at DESC`, [orgId]
  );
}

export async function getTotalDeposits(orgId: string): Promise<number> {
  const db = await openDb();
  const row = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM deposits WHERE org_id = ? AND status = 'active'`, [orgId]
  );
  return row?.total ?? 0;
}

export async function getTotalInterestPaid(orgId: string): Promise<number> {
  const db = await openDb();
  const row = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(interest_paid), 0) AS total FROM deposits WHERE org_id = ?`, [orgId]
  );
  return row?.total ?? 0;
}

export async function recordInterestPayment(id: string, amount: number): Promise<void> {
  const db = await openDb();
  await db.runAsync(`UPDATE deposits SET interest_paid = interest_paid + ?, dirty = 1 WHERE id = ?`, [amount, id]);
}

export async function updateDepositStatus(id: string, status: DepositStatus): Promise<void> {
  const db = await openDb();
  await db.runAsync(`UPDATE deposits SET status = ?, dirty = 1 WHERE id = ?`, [status, id]);
}
