// Supabase Edge Function: agent-login
// POST { phone, pin } -> 200 { user: {...} } | 401 { error }
//
// Deployed via MCP (mcp__supabase__deploy_edge_function) with verify_jwt=false
// because this endpoint IS the auth — requiring a JWT before login is
// circular. Re-deploy with `supabase functions deploy agent-login
// --no-verify-jwt` if using the CLI instead.
//
// PIN hashing: SHA-256 with a global salt (Sprint 1). Sprint 3 will move to
// per-org salt + Argon2 KDF.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.46.0";

const SALT = "vasool-ai-pin-salt-v1";

async function sha256(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
      "access-control-allow-methods": "POST, OPTIONS",
    },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return json(200, {});
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  let payload: { phone?: string; pin?: string };
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const phone = (payload.phone ?? "").trim();
  const pin = (payload.pin ?? "").trim();

  if (!/^\d{10}$/.test(phone) || !/^\d{4}$/.test(pin)) {
    return json(400, { error: "Invalid phone or PIN format" });
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json(500, { error: "Server misconfigured" });

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  const { data: user, error } = await supabase
    .from("users")
    .select("id, org_id, name, phone, role, pin_hash, is_active")
    .eq("phone", phone)
    .eq("role", "agent")
    .eq("is_active", true)
    .maybeSingle();

  if (error || !user) return json(401, { error: "Invalid phone or PIN" });

  const expected = await sha256(`${SALT}:${pin}`);
  if (user.pin_hash !== expected) return json(401, { error: "Invalid phone or PIN" });

  return json(200, {
    user: {
      id: user.id,
      orgId: user.org_id,
      name: user.name,
      phone: user.phone,
      role: user.role,
    },
  });
});
