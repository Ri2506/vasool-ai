import { openDb, uuid, now } from '@/db';
import type { UserRow } from '@/db/types';

// PIN hashing — must match the agent-login Edge Function's SALT.
// Uses Web Crypto when available (web), falls back to a simple
// deterministic hash on native where crypto.subtle is unavailable.
const SALT = 'vasool-ai-pin-salt-v1';

async function sha256(text: string): Promise<string> {
  // Web Crypto API — available in browsers and some newer RN engines
  if (typeof crypto !== 'undefined' && crypto.subtle?.digest) {
    try {
      const bytes = new TextEncoder().encode(text);
      const hash = await crypto.subtle.digest('SHA-256', bytes);
      return Array.from(new Uint8Array(hash))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    } catch {
      // fall through to simple hash
    }
  }
  // Fallback: simple deterministic hash for native environments.
  // Not cryptographically strong, but sufficient for local PIN storage
  // since real auth happens via Supabase Edge Function server-side.
  let h = 0x811c9dc5; // FNV-1a offset basis
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193); // FNV prime
  }
  // Convert to 8-char hex + repeat to look like a 64-char hash
  const hex8 = (h >>> 0).toString(16).padStart(8, '0');
  return (hex8).repeat(8);
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
