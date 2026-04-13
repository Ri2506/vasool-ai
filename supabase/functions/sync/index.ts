// Edge Function: sync — two-way reconciliation between mobile SQLite and
// the Supabase Postgres tables. Called from src/db/sync.ts.
//
// Request body:
//   {
//     lastPulledAt: number | null,    // epoch ms of last successful pull
//     changes: {
//       [table]: {
//         created: Row[],
//         updated: Row[],
//         deleted: string[],         // ids
//       }
//     }
//   }
//
// Response:
//   {
//     timestamp: number,              // server time of this response
//     changes: same shape, populated with rows updated since lastPulledAt
//   }
//
// Auth: the anon client passes the user's JWT — we resolve org_id from
// the JWT and scope every read/write to that org.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

interface ChangePayload {
  created?: Record<string, unknown>[];
  updated?: Record<string, unknown>[];
  deleted?: string[];
}

interface RequestBody {
  lastPulledAt: number | null;
  changes: Record<string, ChangePayload>;
}

// Tables we round-trip + the column the server uses to scope to the
// caller's org. Most tables have `org_id` directly; `plan_entries` is
// scoped indirectly through its loan_id (handled below).
const TABLE_ORG_KEY: Record<string, 'org_id' | 'via_loan'> = {
  organizations: 'org_id',
  users: 'org_id',
  borrowers: 'org_id',
  lines: 'org_id',
  loans: 'org_id',
  plan_entries: 'via_loan',
  collections: 'org_id',
  principal_returns: 'org_id',
  expenses: 'org_id',
  investments: 'org_id',
  guarantors: 'org_id',
  deposits: 'org_id',
  handovers: 'org_id',
  loan_requests: 'org_id',
  sms_queue: 'org_id',
  line_agent_assignments: 'org_id',
  notifications: 'org_id',
  referrals: 'org_id',
};
const TABLES = Object.keys(TABLE_ORG_KEY);

// Columns we never push to the server. `dirty` is a client-only marker;
// `updated_at` is server-managed via trigger.
const STRIPPED_COLS = new Set(['dirty', 'updated_at']);

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader) return jsonError('Missing Authorization', 401);

  // Resolve user from JWT
  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) return jsonError('Invalid user', 401);

  // Service role for cross-table writes (RLS would otherwise block bulk upsert)
  const admin = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Resolve user's org from `users` table
  const { data: profile, error: profileErr } = await admin
    .from('users')
    .select('id, org_id, role')
    .eq('auth_user_id', userData.user.id)
    .maybeSingle();
  if (profileErr || !profile) return jsonError('User profile not found', 403);
  const orgId = profile.org_id;

  let body: RequestBody;
  try { body = await req.json(); } catch { return jsonError('Invalid JSON', 400); }

  // ── Push: upsert any rows the client sent, scoped to this org ──
  for (const table of TABLES) {
    const change = body.changes?.[table];
    if (!change) continue;
    const rows = (change.created ?? []).concat(change.updated ?? []);
    if (rows.length === 0) continue;

    const orgKey = TABLE_ORG_KEY[table];
    const safe = rows.map((r) => {
      const cleaned: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(r)) {
        if (STRIPPED_COLS.has(k)) continue;
        cleaned[k] = v;
      }
      // Force org_id on every direct-org row to prevent cross-org writes.
      // plan_entries has no org_id column — its scope comes from loan_id,
      // which we validate separately below.
      if (orgKey === 'org_id') cleaned.org_id = orgId;
      return cleaned;
    });

    // For plan_entries, drop any row whose loan doesn't belong to this org.
    let toUpsert = safe;
    if (orgKey === 'via_loan') {
      const loanIds = Array.from(new Set(safe.map((r) => r.loan_id).filter(Boolean)));
      if (loanIds.length === 0) continue;
      const { data: validLoans } = await admin
        .from('loans').select('id').eq('org_id', orgId).in('id', loanIds);
      const allowed = new Set((validLoans ?? []).map((l: { id: string }) => l.id));
      toUpsert = safe.filter((r) => allowed.has(r.loan_id as string));
      if (toUpsert.length === 0) continue;
    }

    const { error } = await admin.from(table).upsert(toUpsert, { onConflict: 'id' });
    if (error) console.warn(`[sync] upsert ${table} failed:`, error.message);

    // Soft-deletes (only org-scoped tables)
    if (change.deleted && change.deleted.length > 0 && orgKey === 'org_id') {
      await admin.from(table).delete().in('id', change.deleted).eq('org_id', orgId);
    }
  }

  // ── Pull: rows updated server-side since lastPulledAt ──
  // Every table has updated_at (timestamptz) bumped via trigger. plan_entries
  // uses an indirect filter through loans for this org.
  const since = body.lastPulledAt ? new Date(body.lastPulledAt).toISOString() : '1970-01-01T00:00:00Z';
  const pulled: Record<string, ChangePayload> = {};

  // Pre-fetch this org's loan ids so plan_entries can be filtered.
  const { data: orgLoans } = await admin.from('loans').select('id').eq('org_id', orgId);
  const orgLoanIds = (orgLoans ?? []).map((l: { id: string }) => l.id);

  for (const table of TABLES) {
    const orgKey = TABLE_ORG_KEY[table];
    let query = admin.from(table).select('*').gte('updated_at', since).limit(500);
    if (orgKey === 'org_id') {
      query = query.eq('org_id', orgId);
    } else if (orgKey === 'via_loan') {
      if (orgLoanIds.length === 0) continue;
      query = query.in('loan_id', orgLoanIds);
    }
    const { data, error } = await query;
    if (error) {
      console.warn(`[sync] pull ${table} failed:`, error.message);
      continue;
    }
    if (data && data.length > 0) {
      // Strip server-only columns the SQLite client doesn't have so the
      // upsert on the device doesn't fail with "no such column".
      const cleaned = data.map((r: Record<string, unknown>) => {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(r)) {
          if (k === 'updated_at') continue;
          out[k] = v;
        }
        return out;
      });
      pulled[table] = { created: [], updated: cleaned };
    }
  }

  return new Response(
    JSON.stringify({ timestamp: Date.now(), changes: pulled }),
    { headers: { 'content-type': 'application/json' } },
  );
});

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status, headers: { 'content-type': 'application/json' },
  });
}
