// Edge Function: bootstrap-owner
//
// Called from authStore.verifyOwnerOtp after Supabase OTP verification.
// The mobile client is already authenticated at this point — we just need
// to ensure the matching organizations + users rows exist.
//
// Body: { phone: "9876543210", name?: "Ravi" }
// Returns: { user: { id, orgId, name, phone, role } }

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

interface Body {
  phone: string;
  name?: string;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return jsonError('Method not allowed', 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader) return jsonError('Missing Authorization', 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;

  // Resolve the signed-in user from their JWT
  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: authErr } = await userClient.auth.getUser();
  if (authErr || !userData.user) return jsonError('Invalid user', 401);

  let body: Body;
  try { body = await req.json(); } catch { return jsonError('Invalid JSON', 400); }
  if (!body.phone) return jsonError('Missing phone', 400);

  // Service role to call the bootstrap RPC (RLS doesn't apply)
  const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await admin.rpc('bootstrap_owner_by_phone', {
    p_phone: body.phone,
    p_name: body.name ?? null,
    p_auth_user_id: userData.user.id,
  });
  if (error) return jsonError(error.message, 500);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return jsonError('Bootstrap returned empty', 500);

  return Response.json({
    user: {
      id: row.user_id,
      orgId: row.org_id,
      name: row.name,
      phone: row.phone,
      role: row.role,
    },
  });
});

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status, headers: { 'content-type': 'application/json' },
  });
}
