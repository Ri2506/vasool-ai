import { openDb, uuid, now } from '@/db';
import type { UserRow } from '@/db/types';

// PIN hashing — must match the agent-login Edge Function's SALT.
const SALT = 'vasool-ai-pin-salt-v1';

async function sha256(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function hashPin(pin: string): Promise<string> {
  return sha256(`${SALT}:${pin}`);
}

export interface NewAgentInput {
  orgId: string;
  name: string;
  phone: string;
  pin: string;
}

export async function createAgent(input: NewAgentInput): Promise<UserRow> {
  const db = await openDb();
  const pinHash = await hashPin(input.pin);
  const row: UserRow = {
    id: uuid(),
    server_id: null,
    org_id: input.orgId,
    auth_user_id: null,
    name: input.name.trim(),
    phone: input.phone.trim(),
    role: 'agent',
    pin_hash: pinHash,
    is_active: 1,
    created_at: now(),
    dirty: 1,
  };
  await db.runAsync(
    `INSERT INTO users (id, server_id, org_id, auth_user_id, name, phone, role, pin_hash, is_active, created_at, dirty)
     VALUES (?, ?, ?, ?, ?, ?, 'agent', ?, 1, ?, 1)`,
    [row.id, row.server_id, row.org_id, row.auth_user_id, row.name, row.phone, row.pin_hash, row.created_at]
  );
  return row;
}

export async function listAgents(orgId: string): Promise<UserRow[]> {
  const db = await openDb();
  return db.getAllAsync<UserRow>(
    `SELECT * FROM users WHERE org_id = ? AND role = 'agent' ORDER BY name COLLATE NOCASE`,
    [orgId]
  );
}

export async function updateAgentPin(id: string, newPin: string): Promise<void> {
  const db = await openDb();
  const pinHash = await hashPin(newPin);
  await db.runAsync(`UPDATE users SET pin_hash = ?, dirty = 1 WHERE id = ?`, [pinHash, id]);
}

export async function toggleAgentActive(id: string, isActive: boolean): Promise<void> {
  const db = await openDb();
  await db.runAsync(`UPDATE users SET is_active = ?, dirty = 1 WHERE id = ?`, [isActive ? 1 : 0, id]);
}

export async function deleteAgent(id: string): Promise<void> {
  const db = await openDb();
  await db.runAsync(`DELETE FROM users WHERE id = ? AND role = 'agent'`, [id]);
}
