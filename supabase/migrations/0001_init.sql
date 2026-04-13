-- VasoolAI initial Postgres schema — mirrors SQLite schema v10.
--
-- Design choices:
--   * Ids are TEXT (not uuid) so client-generated UUIDs from expo-sqlite
--     round-trip with zero coercion. The `id` IS the canonical id; there's
--     no separate server_id on the server side (local SQLite keeps
--     server_id for compatibility but we always mirror id=id).
--   * All money amounts are double precision — matches SQLite REAL and
--     the existing client TS types. Paise-based integer money is a future
--     migration; not worth the churn now.
--   * Every table has `updated_at timestamptz default now()` + a trigger
--     that bumps it on UPDATE. The `sync` Edge Function pulls by
--     `updated_at >= lastPulledAt`.
--   * `dirty` column isn't stored on the server — it's a client-side push
--     marker only. The push path strips it before upsert.
--   * org_id FKs are deferrable so the sync push can upsert a batch in
--     any order.

-- ── Trigger helper: bump updated_at on every UPDATE ──
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ── organizations ──
create table if not exists organizations (
  id                text primary key,
  name              text not null,
  owner_id          text,
  plan              text not null default 'free' check (plan in ('free', 'pro')),
  language          text not null default 'en' check (language in ('en', 'ta')),
  working_days      text not null default '["mon","tue","wed","thu","fri","sat"]',
  sms_enabled       integer not null default 1 check (sms_enabled in (0, 1)),
  created_at        bigint not null,
  updated_at        timestamptz not null default now()
);
create trigger organizations_updated_at before update on organizations
  for each row execute function set_updated_at();

-- ── users ──
-- auth_user_id links to Supabase auth.users.id (uuid) so the user can
-- look up their org memberships from their JWT sub.
create table if not exists users (
  id                text primary key,
  org_id            text not null references organizations(id) on delete cascade deferrable initially deferred,
  auth_user_id      uuid,
  name              text not null,
  phone             text not null,
  role              text not null check (role in ('owner', 'agent')),
  pin_hash          text,
  is_active         integer not null default 1 check (is_active in (0, 1)),
  created_at        bigint not null,
  updated_at        timestamptz not null default now()
);
create index users_org_idx on users(org_id);
create index users_phone_idx on users(phone);
create index users_auth_user_idx on users(auth_user_id);
create trigger users_updated_at before update on users
  for each row execute function set_updated_at();

-- ── borrowers (with v9 KYC fields) ──
create table if not exists borrowers (
  id                text primary key,
  org_id            text not null references organizations(id) on delete cascade deferrable initially deferred,
  name              text not null,
  phone             text,
  address           text,
  photo_url         text,
  notes             text,
  sms_opt_out       integer not null default 0 check (sms_opt_out in (0, 1)),
  id_number         text,
  id_type           text,
  id_photo_uri      text,
  created_at        bigint not null,
  updated_at        timestamptz not null default now()
);
create index borrowers_org_idx on borrowers(org_id);
create index borrowers_name_idx on borrowers(org_id, name);
create trigger borrowers_updated_at before update on borrowers
  for each row execute function set_updated_at();

-- ── lines (collection routes) ──
create table if not exists lines (
  id                text primary key,
  org_id            text not null references organizations(id) on delete cascade deferrable initially deferred,
  name              text not null,
  type              text not null,
  agent_id          text references users(id) on delete set null deferrable initially deferred,
  created_at        bigint not null,
  updated_at        timestamptz not null default now()
);
create index lines_org_idx on lines(org_id);
create index lines_agent_idx on lines(agent_id);
create trigger lines_updated_at before update on lines
  for each row execute function set_updated_at();

-- ── loans (schema v3 dynamic config) ──
create table if not exists loans (
  id                    text primary key,
  org_id                text not null references organizations(id) on delete cascade deferrable initially deferred,
  borrower_id           text not null references borrowers(id) on delete cascade deferrable initially deferred,
  line_id               text references lines(id) on delete set null deferrable initially deferred,
  principal             double precision not null,
  emi_amount            double precision not null,
  total_installments    integer not null,
  total_repayment       double precision not null,
  start_date            bigint not null,
  expected_end_date     bigint not null,
  status                text not null default 'active' check (status in ('active', 'closed', 'defaulted', 'written_off')),
  renewed_from_id       text references loans(id) on delete set null deferrable initially deferred,
  grace_period_days     integer not null default 0,
  product_description   text,
  penalty_type          text,
  penalty_amount        double precision not null default 0,
  repayment_type        text not null default 'principal_plus_interest',
  interest_type         text not null default 'front_loaded',
  interest_rate         double precision not null default 0,
  disbursed_amount      double precision,
  created_at            bigint not null,
  updated_at            timestamptz not null default now()
);
create index loans_org_idx on loans(org_id);
create index loans_borrower_idx on loans(borrower_id);
create index loans_line_idx on loans(line_id);
create index loans_status_idx on loans(status);
create trigger loans_updated_at before update on loans
  for each row execute function set_updated_at();

-- ── plan_entries (scheduled installments) ──
create table if not exists plan_entries (
  id                    text primary key,
  loan_id               text not null references loans(id) on delete cascade deferrable initially deferred,
  installment_number    integer not null,
  due_date              bigint not null,
  expected_amount       double precision not null,
  principal_portion     double precision not null default 0,
  interest_portion      double precision not null default 0,
  status                text not null default 'pending' check (status in ('pending', 'paid', 'partial', 'missed', 'advance_covered')),
  created_at            bigint,
  updated_at            timestamptz not null default now()
);
create index plan_entries_loan_idx on plan_entries(loan_id);
create index plan_entries_due_idx on plan_entries(due_date);
create index plan_entries_status_idx on plan_entries(status);
create trigger plan_entries_updated_at before update on plan_entries
  for each row execute function set_updated_at();

-- ── collections (with plan_entry_id + gps_mocked) ──
create table if not exists collections (
  id                text primary key,
  org_id            text not null references organizations(id) on delete cascade deferrable initially deferred,
  loan_id           text not null references loans(id) on delete cascade deferrable initially deferred,
  agent_id          text references users(id) on delete set null deferrable initially deferred,
  plan_entry_id     text references plan_entries(id) on delete set null deferrable initially deferred,
  amount            double precision not null check (amount >= 0),
  expected_amount   double precision not null,
  shortfall         double precision not null default 0,
  is_advance        integer not null default 0 check (is_advance in (0, 1)),
  advance_periods   integer not null default 0,
  payment_method    text not null default 'cash' check (payment_method in ('cash', 'account')),
  notes             text,
  collected_at      bigint not null,
  gps_lat           double precision,
  gps_lng           double precision,
  gps_mocked        integer not null default 0 check (gps_mocked in (0, 1)),
  is_synced         integer not null default 1,
  offline_id        text,
  created_at        bigint not null,
  updated_at        timestamptz not null default now()
);
create index collections_org_idx on collections(org_id);
create index collections_loan_idx on collections(loan_id);
create index collections_agent_idx on collections(agent_id);
create index collections_plan_entry_idx on collections(plan_entry_id);
create index collections_collected_at_idx on collections(collected_at);
create trigger collections_updated_at before update on collections
  for each row execute function set_updated_at();

-- ── principal_returns (for interest-only loans) ──
create table if not exists principal_returns (
  id                text primary key,
  org_id            text not null references organizations(id) on delete cascade deferrable initially deferred,
  loan_id           text not null references loans(id) on delete cascade deferrable initially deferred,
  amount            double precision not null,
  date              bigint not null,
  notes             text,
  created_at        bigint not null,
  updated_at        timestamptz not null default now()
);
create index principal_returns_loan_idx on principal_returns(loan_id);
create trigger principal_returns_updated_at before update on principal_returns
  for each row execute function set_updated_at();

-- ── expenses (with v8 gps + photo fields) ──
create table if not exists expenses (
  id                text primary key,
  org_id            text not null references organizations(id) on delete cascade deferrable initially deferred,
  user_id           text references users(id) on delete set null deferrable initially deferred,
  category          text not null,
  amount            double precision not null check (amount >= 0),
  date              bigint not null,
  gps_lat           double precision,
  gps_lng           double precision,
  gps_mocked        integer not null default 0 check (gps_mocked in (0, 1)),
  photo_uri         text,
  photo_url         text,
  notes             text,
  is_synced         integer not null default 1,
  created_at        bigint not null,
  updated_at        timestamptz not null default now()
);
create index expenses_org_idx on expenses(org_id);
create index expenses_date_idx on expenses(date);
create trigger expenses_updated_at before update on expenses
  for each row execute function set_updated_at();

-- ── investments ──
create table if not exists investments (
  id                text primary key,
  org_id            text not null references organizations(id) on delete cascade deferrable initially deferred,
  amount            double precision not null,
  source            text,
  date              bigint not null,
  notes             text,
  created_at        bigint not null,
  updated_at        timestamptz not null default now()
);
create index investments_org_idx on investments(org_id);
create trigger investments_updated_at before update on investments
  for each row execute function set_updated_at();

-- ── guarantors ──
create table if not exists guarantors (
  id                text primary key,
  org_id            text not null references organizations(id) on delete cascade deferrable initially deferred,
  loan_id           text not null references loans(id) on delete cascade deferrable initially deferred,
  name              text not null,
  phone             text,
  address           text,
  relationship      text,
  photo_url         text,
  created_at        bigint not null,
  updated_at        timestamptz not null default now()
);
create index guarantors_loan_idx on guarantors(loan_id);
create trigger guarantors_updated_at before update on guarantors
  for each row execute function set_updated_at();

-- ── deposits (savings side) ──
create table if not exists deposits (
  id                text primary key,
  org_id            text not null references organizations(id) on delete cascade deferrable initially deferred,
  depositor_name    text not null,
  depositor_phone   text,
  amount            double precision not null,
  interest_rate     double precision not null default 0,
  start_date        bigint not null,
  maturity_date     bigint,
  interest_paid     double precision not null default 0,
  status            text not null default 'active' check (status in ('active', 'matured', 'withdrawn')),
  created_at        bigint not null,
  updated_at        timestamptz not null default now()
);
create index deposits_org_idx on deposits(org_id);
create trigger deposits_updated_at before update on deposits
  for each row execute function set_updated_at();

-- ── handovers (EOD cash reconciliation) ──
create table if not exists handovers (
  id                    text primary key,
  org_id                text not null references organizations(id) on delete cascade deferrable initially deferred,
  agent_id              text not null references users(id) on delete cascade deferrable initially deferred,
  date                  bigint not null,
  collected_amount      double precision not null default 0,
  expected_amount       double precision not null default 0,
  expenses_amount       double precision not null default 0,
  cash_handed_over      double precision,
  cash_received         double precision,
  variance              double precision,
  notes                 text,
  agent_submitted_at    bigint,
  owner_confirmed_at    bigint,
  status                text not null default 'pending' check (status in ('pending', 'submitted', 'confirmed', 'disputed')),
  created_at            bigint not null,
  updated_at            timestamptz not null default now()
);
create unique index handovers_unique_per_day on handovers(org_id, agent_id, date);
create index handovers_agent_idx on handovers(agent_id);
create index handovers_status_idx on handovers(status);
create trigger handovers_updated_at before update on handovers
  for each row execute function set_updated_at();

-- ── loan_requests (owner approval workflow) ──
create table if not exists loan_requests (
  id                      text primary key,
  org_id                  text not null references organizations(id) on delete cascade deferrable initially deferred,
  requested_by            text not null references users(id) on delete cascade deferrable initially deferred,
  borrower_id             text not null references borrowers(id) on delete cascade deferrable initially deferred,
  line_id                 text references lines(id) on delete set null deferrable initially deferred,
  disbursed_amount        double precision not null,
  repayment_type          text not null,
  interest_type           text not null,
  interest_rate           double precision not null default 0,
  interest_rate_period    text not null default 'month',
  frequency               text not null,
  tenure_count            integer not null,
  start_date              bigint not null,
  upfront_fee             double precision,
  notes                   text,
  status                  text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by             text references users(id) on delete set null deferrable initially deferred,
  reviewed_at             bigint,
  rejection_reason        text,
  approved_loan_id        text references loans(id) on delete set null deferrable initially deferred,
  created_at              bigint not null,
  updated_at              timestamptz not null default now()
);
create index loan_requests_org_status_idx on loan_requests(org_id, status);
create trigger loan_requests_updated_at before update on loan_requests
  for each row execute function set_updated_at();

-- ── sms_queue (offline-first outbound SMS) ──
create table if not exists sms_queue (
  id                text primary key,
  org_id            text not null references organizations(id) on delete cascade deferrable initially deferred,
  kind              text not null check (kind in ('receipt', 'reminder', 'overdue', 'custom')),
  to_phone          text not null,
  body              text not null,
  related_id        text,
  status            text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'skipped')),
  attempts          integer not null default 0,
  last_attempt_at   bigint,
  last_error        text,
  sent_at           bigint,
  created_at        bigint not null,
  updated_at        timestamptz not null default now()
);
create index sms_queue_org_idx on sms_queue(org_id);
create index sms_queue_status_idx on sms_queue(status);
create trigger sms_queue_updated_at before update on sms_queue
  for each row execute function set_updated_at();

-- ── line_agent_assignments (append-only rotation history) ──
create table if not exists line_agent_assignments (
  id                text primary key,
  org_id            text not null references organizations(id) on delete cascade deferrable initially deferred,
  line_id           text not null references lines(id) on delete cascade deferrable initially deferred,
  agent_id          text references users(id) on delete set null deferrable initially deferred,
  assigned_at       bigint not null,
  unassigned_at     bigint,
  assigned_by       text references users(id) on delete set null deferrable initially deferred,
  note              text,
  created_at        bigint not null,
  updated_at        timestamptz not null default now()
);
create index line_agent_history_line_idx on line_agent_assignments(line_id);
create index line_agent_history_agent_idx on line_agent_assignments(agent_id);
create trigger line_agent_assignments_updated_at before update on line_agent_assignments
  for each row execute function set_updated_at();

-- ── notifications ──
create table if not exists notifications (
  id                text primary key,
  org_id            text not null references organizations(id) on delete cascade deferrable initially deferred,
  user_id           text references users(id) on delete cascade deferrable initially deferred,
  type              text not null,
  message           text not null,
  is_read           integer not null default 0 check (is_read in (0, 1)),
  created_at        bigint not null,
  updated_at        timestamptz not null default now()
);
create index notifications_user_idx on notifications(user_id, is_read);
create trigger notifications_updated_at before update on notifications
  for each row execute function set_updated_at();

-- ── referrals ──
create table if not exists referrals (
  id                text primary key,
  org_id            text not null references organizations(id) on delete cascade deferrable initially deferred,
  referral_code     text not null,
  referred_org_id   text,
  status            text not null default 'pending' check (status in ('pending', 'signed_up', 'converted', 'rewarded')),
  created_at        bigint not null,
  completed_at      bigint,
  updated_at        timestamptz not null default now()
);
create index referrals_org_idx on referrals(org_id);
create index referrals_code_idx on referrals(referral_code);
create trigger referrals_updated_at before update on referrals
  for each row execute function set_updated_at();

-- ── crash_reports (optional — for Diagnostics upload) ──
create table if not exists crash_reports (
  id                bigserial primary key,
  ts                timestamptz not null,
  type              text not null,
  message           text not null,
  stack             text,
  context           text,
  platform          text not null,
  org_id            text references organizations(id) on delete set null,
  created_at        timestamptz not null default now()
);
create index crash_reports_ts_idx on crash_reports(ts desc);
