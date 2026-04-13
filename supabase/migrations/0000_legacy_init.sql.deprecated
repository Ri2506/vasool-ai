-- VasoolAI — initial schema
-- Sprint 1 migration. 10 tables + RLS. Apply via `supabase db push`
-- or paste into the SQL editor in the Supabase dashboard.

---------------------------------------------------------------------
-- 1. Organizations (multi-tenant root)
---------------------------------------------------------------------
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID REFERENCES auth.users(id),
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free','starter','pro','business')),
  language TEXT DEFAULT 'en' CHECK (language IN ('en','ta')),
  working_days JSONB DEFAULT '["mon","tue","wed","thu","fri","sat"]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

---------------------------------------------------------------------
-- 2. Users (owner + agents)
---------------------------------------------------------------------
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  auth_user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner','agent')),
  pin_hash TEXT, -- for agent PIN login
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX users_org_idx ON users(org_id);
CREATE INDEX users_phone_idx ON users(phone);

---------------------------------------------------------------------
-- 3. Borrowers
---------------------------------------------------------------------
CREATE TABLE borrowers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  photo_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX borrowers_org_idx ON borrowers(org_id);

---------------------------------------------------------------------
-- 4. Lines (collection routes)
---------------------------------------------------------------------
CREATE TABLE lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('daily','weekly','monthly_emi','monthly_interest','enterprise')),
  agent_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX lines_org_idx ON lines(org_id);

---------------------------------------------------------------------
-- 5. Loans
---------------------------------------------------------------------
CREATE TABLE loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  borrower_id UUID REFERENCES borrowers(id) ON DELETE CASCADE,
  line_id UUID REFERENCES lines(id),
  principal NUMERIC NOT NULL,
  emi_amount NUMERIC NOT NULL,
  total_installments INTEGER NOT NULL,
  total_repayment NUMERIC NOT NULL,
  start_date DATE NOT NULL,
  expected_end_date DATE NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','overdue','closed','defaulted')),
  renewed_from_id UUID REFERENCES loans(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX loans_org_idx ON loans(org_id);
CREATE INDEX loans_borrower_idx ON loans(borrower_id);
CREATE INDEX loans_status_idx ON loans(status);

---------------------------------------------------------------------
-- 6. Plan entries (repayment schedule)
---------------------------------------------------------------------
CREATE TABLE plan_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID REFERENCES loans(id) ON DELETE CASCADE,
  installment_number INTEGER NOT NULL,
  due_date DATE NOT NULL,
  expected_amount NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','paid','partial','missed','advance_covered'))
);
CREATE INDEX plan_entries_loan_idx ON plan_entries(loan_id);
CREATE INDEX plan_entries_due_idx ON plan_entries(due_date);

---------------------------------------------------------------------
-- 7. Collections
---------------------------------------------------------------------
CREATE TABLE collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID REFERENCES loans(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES users(id),
  amount NUMERIC NOT NULL,
  expected_amount NUMERIC NOT NULL,
  shortfall NUMERIC DEFAULT 0,
  is_advance BOOLEAN DEFAULT false,
  advance_periods INTEGER DEFAULT 0,
  collected_at TIMESTAMPTZ NOT NULL,
  gps_lat DOUBLE PRECISION,
  gps_lng DOUBLE PRECISION,
  is_synced BOOLEAN DEFAULT false,
  offline_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX collections_org_idx ON collections(org_id);
CREATE INDEX collections_loan_idx ON collections(loan_id);
CREATE INDEX collections_collected_at_idx ON collections(collected_at);

---------------------------------------------------------------------
-- 8. Expenses
---------------------------------------------------------------------
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  category TEXT NOT NULL CHECK (category IN ('petrol','food','travel','phone','other')),
  amount NUMERIC NOT NULL,
  date DATE NOT NULL,
  is_synced BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX expenses_org_idx ON expenses(org_id);

---------------------------------------------------------------------
-- 9. Investments (capital put into the business)
---------------------------------------------------------------------
CREATE TABLE investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  source TEXT,
  date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX investments_org_idx ON investments(org_id);

---------------------------------------------------------------------
-- 10. Notifications (PRD §8)
---------------------------------------------------------------------
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX notifications_user_idx ON notifications(user_id, is_read);

---------------------------------------------------------------------
-- Row Level Security
---------------------------------------------------------------------
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE borrowers     ENABLE ROW LEVEL SECURITY;
ALTER TABLE lines         ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans         ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_entries  ENABLE ROW LEVEL SECURITY;
ALTER TABLE collections   ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses      ENABLE ROW LEVEL SECURITY;
ALTER TABLE investments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Helper: resolve the current user's org_id via the users table
-- (users.auth_user_id links to auth.uid()).
-- search_path is pinned to `public` to prevent search_path hijacking
-- on SECURITY DEFINER functions (Supabase lint 0011).
CREATE OR REPLACE FUNCTION current_org_id() RETURNS UUID AS $$
  SELECT org_id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

-- Organizations: owner can see their own org
CREATE POLICY org_rw ON organizations
  FOR ALL USING (id = current_org_id());

-- All other tables: members of the org can CRUD their own data.
CREATE POLICY users_rw        ON users        FOR ALL USING (org_id = current_org_id());
CREATE POLICY borrowers_rw    ON borrowers    FOR ALL USING (org_id = current_org_id());
CREATE POLICY lines_rw        ON lines        FOR ALL USING (org_id = current_org_id());
CREATE POLICY loans_rw        ON loans        FOR ALL USING (org_id = current_org_id());
CREATE POLICY collections_rw  ON collections  FOR ALL USING (org_id = current_org_id());
CREATE POLICY expenses_rw     ON expenses     FOR ALL USING (org_id = current_org_id());
CREATE POLICY investments_rw  ON investments  FOR ALL USING (org_id = current_org_id());
CREATE POLICY notifications_rw ON notifications FOR ALL USING (org_id = current_org_id());

-- plan_entries has no org_id column; gate via its parent loan
CREATE POLICY plan_entries_rw ON plan_entries FOR ALL USING (
  loan_id IN (SELECT id FROM loans WHERE org_id = current_org_id())
);
