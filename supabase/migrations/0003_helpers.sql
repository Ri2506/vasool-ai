-- RPCs used by the mobile client's auth flow.
--
-- bootstrap_owner_by_phone(phone, display_name)
--   Called from the bootstrap-owner Edge Function after Supabase auth
--   verifies the OTP. Creates a new organization + owner user if the
--   phone is new, else returns the existing one. Idempotent.
--
-- sign_in_agent_by_pin(phone, pin_hash)
--   Looks up a users row by (phone, role='agent', is_active=1) and
--   compares pin_hash. Returns the session user shape on match.
--   Edge Function wraps this with rate limiting + logging.
--
-- Both are security definer — callable from Edge Functions using the
-- service role key. End users never call these directly.

-- ── gen_id: client-safe UUID-like text id (matches our uuid() helper) ──
create or replace function gen_id() returns text
language sql
as $$
  select lower(
    substr(hex_a, 1, 8)  || '-' ||
    substr(hex_a, 9, 4)  || '-4' ||
    substr(hex_a, 13, 3) || '-' ||
    substr(lpad(to_hex((ascii(substr(hex_a, 16, 1)) & 3) | 8), 1, '0'), 1, 1) ||
    substr(hex_a, 17, 3) || '-' ||
    substr(hex_a, 20, 12)
  )
  from (select encode(gen_random_bytes(16), 'hex') as hex_a) s;
$$;

-- ── bootstrap_owner_by_phone ──
create or replace function bootstrap_owner_by_phone(
  p_phone text,
  p_name text,
  p_auth_user_id uuid
) returns table (
  user_id text,
  org_id text,
  name text,
  phone text,
  role text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id text;
  v_org_id text;
  v_user_name text;
begin
  -- Already bootstrapped? Return the existing owner row.
  select u.id, u.org_id, u.name into v_user_id, v_org_id, v_user_name
  from public.users u
  where u.phone = p_phone and u.role = 'owner'
  limit 1;

  if v_user_id is not null then
    -- Make sure auth_user_id is kept in sync (Supabase OTP can mint a
    -- new auth.users row on every verify for some flows).
    update public.users set auth_user_id = p_auth_user_id where id = v_user_id;
    return query select v_user_id, v_org_id, v_user_name, p_phone, 'owner'::text;
    return;
  end if;

  -- New owner — create org + user atomically.
  v_org_id := gen_id();
  v_user_id := gen_id();

  insert into public.organizations (id, name, owner_id, created_at)
  values (v_org_id, coalesce(p_name, p_phone) || '''s finance', v_user_id,
          (extract(epoch from now()) * 1000)::bigint);

  insert into public.users (id, org_id, auth_user_id, name, phone, role, created_at)
  values (v_user_id, v_org_id, p_auth_user_id,
          coalesce(p_name, p_phone), p_phone, 'owner',
          (extract(epoch from now()) * 1000)::bigint);

  return query select v_user_id, v_org_id,
                      coalesce(p_name, p_phone), p_phone, 'owner'::text;
end;
$$;

-- Note: agent PIN sign-in is handled by the existing `agent-login` Edge
-- Function which queries users directly with the service role. No
-- separate RPC needed for it.

-- Grants — only the service role should call bootstrap. Revoke from
-- public/anon/authenticated so a compromised JWT can't hit it directly.
revoke all on function bootstrap_owner_by_phone(text, text, uuid) from public, anon, authenticated;
grant execute on function bootstrap_owner_by_phone(text, text, uuid) to service_role;
