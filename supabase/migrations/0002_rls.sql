-- Row-level security — every table is scoped to org_id.
--
-- Model: the signed-in auth.users row maps to zero or more `users` rows
-- (one per org they belong to). A user "is a member of org X" iff there
-- exists a users row with that org_id and auth_user_id = auth.uid() and
-- is_active = 1.
--
-- Helper `public.is_org_member(text)` is security-definer so it can read
-- the users table regardless of RLS. All per-table policies delegate to
-- it so the logic lives in exactly one place.

-- ── Helper: membership check ──
create or replace function public.is_org_member(target_org_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where org_id = target_org_id
      and auth_user_id = auth.uid()
      and is_active = 1
  );
$$;

create or replace function public.is_org_owner(target_org_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where org_id = target_org_id
      and auth_user_id = auth.uid()
      and is_active = 1
      and role = 'owner'
  );
$$;

-- ── Enable RLS on every table ──
alter table organizations            enable row level security;
alter table users                    enable row level security;
alter table borrowers                enable row level security;
alter table lines                    enable row level security;
alter table loans                    enable row level security;
alter table plan_entries             enable row level security;
alter table collections              enable row level security;
alter table principal_returns        enable row level security;
alter table expenses                 enable row level security;
alter table investments              enable row level security;
alter table guarantors               enable row level security;
alter table deposits                 enable row level security;
alter table handovers                enable row level security;
alter table loan_requests            enable row level security;
alter table sms_queue                enable row level security;
alter table line_agent_assignments   enable row level security;
alter table notifications            enable row level security;
alter table referrals                enable row level security;
alter table crash_reports            enable row level security;

-- ── organizations ──
-- Readable by any member. Writes only by owner (owner can rename org,
-- change language, toggle sms_enabled).
create policy "org_select" on organizations
  for select using (is_org_member(id));
create policy "org_owner_update" on organizations
  for update using (is_org_owner(id))
  with check (is_org_owner(id));
-- Insert goes through the bootstrap_owner() RPC (security definer), not
-- via direct table insert, so no insert policy is needed for end users.

-- ── users ──
-- A user can read everyone in any org they belong to. Only owners add/
-- modify/deactivate other users.
create policy "users_select" on users
  for select using (is_org_member(org_id));
create policy "users_owner_write" on users
  for all using (is_org_owner(org_id))
  with check (is_org_owner(org_id));

-- ── borrowers ──
create policy "borrowers_select" on borrowers
  for select using (is_org_member(org_id));
create policy "borrowers_write" on borrowers
  for all using (is_org_member(org_id))
  with check (is_org_member(org_id));

-- ── lines ──
create policy "lines_select" on lines
  for select using (is_org_member(org_id));
create policy "lines_owner_write" on lines
  for all using (is_org_owner(org_id))
  with check (is_org_owner(org_id));

-- ── loans ──
-- Agents can read (to service their lines); only owners create/update/
-- close loans directly. Agents propose via loan_requests instead.
create policy "loans_select" on loans
  for select using (is_org_member(org_id));
create policy "loans_owner_write" on loans
  for all using (is_org_owner(org_id))
  with check (is_org_owner(org_id));

-- ── plan_entries ──
-- Readable by any member; writes also allowed for any member because
-- recording a collection flips the entry to 'paid'.
create policy "plan_entries_select" on plan_entries
  for select using (
    exists (select 1 from loans l where l.id = plan_entries.loan_id and is_org_member(l.org_id))
  );
create policy "plan_entries_write" on plan_entries
  for all using (
    exists (select 1 from loans l where l.id = plan_entries.loan_id and is_org_member(l.org_id))
  )
  with check (
    exists (select 1 from loans l where l.id = plan_entries.loan_id and is_org_member(l.org_id))
  );

-- ── collections ──
-- Agents record their own collections. Owners can see everything.
create policy "collections_select" on collections
  for select using (is_org_member(org_id));
create policy "collections_write" on collections
  for all using (is_org_member(org_id))
  with check (is_org_member(org_id));

-- ── principal_returns ──
create policy "principal_returns_select" on principal_returns
  for select using (is_org_member(org_id));
create policy "principal_returns_write" on principal_returns
  for all using (is_org_member(org_id))
  with check (is_org_member(org_id));

-- ── expenses ──
create policy "expenses_select" on expenses
  for select using (is_org_member(org_id));
create policy "expenses_write" on expenses
  for all using (is_org_member(org_id))
  with check (is_org_member(org_id));

-- ── investments ──
-- Owner-only (agent shouldn't know total capital).
create policy "investments_owner" on investments
  for all using (is_org_owner(org_id))
  with check (is_org_owner(org_id));

-- ── guarantors ──
create policy "guarantors_select" on guarantors
  for select using (is_org_member(org_id));
create policy "guarantors_write" on guarantors
  for all using (is_org_member(org_id))
  with check (is_org_member(org_id));

-- ── deposits ──
-- Owner-only (who lent money to the org).
create policy "deposits_owner" on deposits
  for all using (is_org_owner(org_id))
  with check (is_org_owner(org_id));

-- ── handovers ──
-- Agent submits, owner confirms. Both need read+write.
create policy "handovers_select" on handovers
  for select using (is_org_member(org_id));
create policy "handovers_write" on handovers
  for all using (is_org_member(org_id))
  with check (is_org_member(org_id));

-- ── loan_requests ──
-- Agent files, owner approves/rejects. Both need read+write.
create policy "loan_requests_select" on loan_requests
  for select using (is_org_member(org_id));
create policy "loan_requests_write" on loan_requests
  for all using (is_org_member(org_id))
  with check (is_org_member(org_id));

-- ── sms_queue ──
create policy "sms_queue_select" on sms_queue
  for select using (is_org_member(org_id));
create policy "sms_queue_write" on sms_queue
  for all using (is_org_member(org_id))
  with check (is_org_member(org_id));

-- ── line_agent_assignments ──
create policy "line_agent_assignments_select" on line_agent_assignments
  for select using (is_org_member(org_id));
create policy "line_agent_assignments_owner_write" on line_agent_assignments
  for all using (is_org_owner(org_id))
  with check (is_org_owner(org_id));

-- ── notifications ──
-- A user sees only notifications aimed at them (user_id = self) OR
-- org-wide ones (user_id is null). Any member can mark read.
create policy "notifications_select" on notifications
  for select using (
    is_org_member(org_id)
    and (
      user_id is null
      or exists (select 1 from users u where u.id = notifications.user_id and u.auth_user_id = auth.uid())
    )
  );
create policy "notifications_update" on notifications
  for update using (is_org_member(org_id))
  with check (is_org_member(org_id));

-- ── referrals ──
create policy "referrals_owner" on referrals
  for all using (is_org_owner(org_id))
  with check (is_org_owner(org_id));

-- ── crash_reports ──
-- Users can only insert their own org's reports. Reads are forbidden
-- (admins query directly via service role).
create policy "crash_reports_insert" on crash_reports
  for insert with check (org_id is null or is_org_member(org_id));
