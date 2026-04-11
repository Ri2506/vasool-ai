// SQLite DDL for the local cache. Mirrors supabase/migrations/0001_init.sql
// but uses TEXT for UUIDs (SQLite has no UUID type) and INTEGER epoch ms
// for dates (SQLite has no TIMESTAMPTZ). Every table carries server_id
// (nullable — populated after first successful push) and `dirty` (1 if the
// row has local changes not yet pushed to Supabase).
//
// Schema history:
//  v1 — initial tables
//  v2 — added guarantors, deposits, principal_returns
//  v3 — added dynamic loan config (repayment_type, interest_type,
//       interest_rate, disbursed_amount on loans; principal_portion,
//       interest_portion on plan_entries)

export const SCHEMA_VERSION = 3;

export const DDL = [
  `CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY,
    server_id TEXT,
    name TEXT NOT NULL,
    owner_id TEXT,
    plan TEXT NOT NULL DEFAULT 'free',
    language TEXT NOT NULL DEFAULT 'en',
    working_days TEXT NOT NULL DEFAULT '["mon","tue","wed","thu","fri","sat"]',
    created_at INTEGER NOT NULL,
    dirty INTEGER NOT NULL DEFAULT 0
  )`,

  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    server_id TEXT,
    org_id TEXT NOT NULL,
    auth_user_id TEXT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    role TEXT NOT NULL,
    pin_hash TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    dirty INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS users_org_idx ON users(org_id)`,
  `CREATE INDEX IF NOT EXISTS users_phone_idx ON users(phone)`,

  `CREATE TABLE IF NOT EXISTS borrowers (
    id TEXT PRIMARY KEY,
    server_id TEXT,
    org_id TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    photo_url TEXT,
    notes TEXT,
    created_at INTEGER NOT NULL,
    dirty INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS borrowers_org_idx ON borrowers(org_id)`,

  `CREATE TABLE IF NOT EXISTS lines (
    id TEXT PRIMARY KEY,
    server_id TEXT,
    org_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    agent_id TEXT,
    created_at INTEGER NOT NULL,
    dirty INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS lines_org_idx ON lines(org_id)`,

  `CREATE TABLE IF NOT EXISTS loans (
    id TEXT PRIMARY KEY,
    server_id TEXT,
    org_id TEXT NOT NULL,
    borrower_id TEXT NOT NULL,
    line_id TEXT,
    principal REAL NOT NULL,
    emi_amount REAL NOT NULL,
    total_installments INTEGER NOT NULL,
    total_repayment REAL NOT NULL,
    start_date INTEGER NOT NULL,
    expected_end_date INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    renewed_from_id TEXT,
    grace_period_days INTEGER NOT NULL DEFAULT 0,
    product_description TEXT,
    penalty_type TEXT,
    penalty_amount REAL NOT NULL DEFAULT 0,
    repayment_type TEXT NOT NULL DEFAULT 'principal_plus_interest',
    interest_type TEXT NOT NULL DEFAULT 'front_loaded',
    interest_rate REAL NOT NULL DEFAULT 0,
    disbursed_amount REAL,
    created_at INTEGER NOT NULL,
    dirty INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS loans_org_idx ON loans(org_id)`,
  `CREATE INDEX IF NOT EXISTS loans_borrower_idx ON loans(borrower_id)`,
  `CREATE INDEX IF NOT EXISTS loans_status_idx ON loans(status)`,

  `CREATE TABLE IF NOT EXISTS plan_entries (
    id TEXT PRIMARY KEY,
    server_id TEXT,
    loan_id TEXT NOT NULL,
    installment_number INTEGER NOT NULL,
    due_date INTEGER NOT NULL,
    expected_amount REAL NOT NULL,
    principal_portion REAL NOT NULL DEFAULT 0,
    interest_portion REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    dirty INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS plan_entries_loan_idx ON plan_entries(loan_id)`,
  `CREATE INDEX IF NOT EXISTS plan_entries_due_idx ON plan_entries(due_date)`,

  `CREATE TABLE IF NOT EXISTS collections (
    id TEXT PRIMARY KEY,
    server_id TEXT,
    loan_id TEXT NOT NULL,
    org_id TEXT NOT NULL,
    agent_id TEXT,
    amount REAL NOT NULL,
    expected_amount REAL NOT NULL,
    shortfall REAL NOT NULL DEFAULT 0,
    is_advance INTEGER NOT NULL DEFAULT 0,
    advance_periods INTEGER NOT NULL DEFAULT 0,
    collected_at INTEGER NOT NULL,
    gps_lat REAL,
    gps_lng REAL,
    is_synced INTEGER NOT NULL DEFAULT 0,
    offline_id TEXT,
    created_at INTEGER NOT NULL,
    dirty INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS collections_org_idx ON collections(org_id)`,
  `CREATE INDEX IF NOT EXISTS collections_loan_idx ON collections(loan_id)`,
  `CREATE INDEX IF NOT EXISTS collections_collected_at_idx ON collections(collected_at)`,

  `CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    server_id TEXT,
    org_id TEXT NOT NULL,
    user_id TEXT,
    category TEXT NOT NULL,
    amount REAL NOT NULL,
    date INTEGER NOT NULL,
    is_synced INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    dirty INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS expenses_org_idx ON expenses(org_id)`,

  `CREATE TABLE IF NOT EXISTS investments (
    id TEXT PRIMARY KEY,
    server_id TEXT,
    org_id TEXT NOT NULL,
    amount REAL NOT NULL,
    source TEXT,
    date INTEGER NOT NULL,
    notes TEXT,
    created_at INTEGER NOT NULL,
    dirty INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS investments_org_idx ON investments(org_id)`,

  `CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    server_id TEXT,
    org_id TEXT NOT NULL,
    user_id TEXT,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    dirty INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id, is_read)`,

  `CREATE TABLE IF NOT EXISTS referrals (
    id TEXT PRIMARY KEY,
    server_id TEXT,
    org_id TEXT NOT NULL,
    referral_code TEXT NOT NULL,
    referred_org_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at INTEGER NOT NULL,
    completed_at INTEGER,
    dirty INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS referrals_org_idx ON referrals(org_id)`,
  `CREATE INDEX IF NOT EXISTS referrals_code_idx ON referrals(referral_code)`,

  `CREATE TABLE IF NOT EXISTS guarantors (
    id TEXT PRIMARY KEY,
    server_id TEXT,
    org_id TEXT NOT NULL,
    loan_id TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    relationship TEXT,
    photo_url TEXT,
    created_at INTEGER NOT NULL,
    dirty INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS guarantors_loan_idx ON guarantors(loan_id)`,

  `CREATE TABLE IF NOT EXISTS deposits (
    id TEXT PRIMARY KEY,
    server_id TEXT,
    org_id TEXT NOT NULL,
    depositor_name TEXT NOT NULL,
    depositor_phone TEXT,
    amount REAL NOT NULL,
    interest_rate REAL NOT NULL DEFAULT 0,
    start_date INTEGER NOT NULL,
    maturity_date INTEGER,
    interest_paid REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    created_at INTEGER NOT NULL,
    dirty INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS deposits_org_idx ON deposits(org_id)`,

  `CREATE TABLE IF NOT EXISTS principal_returns (
    id TEXT PRIMARY KEY,
    server_id TEXT,
    loan_id TEXT NOT NULL,
    org_id TEXT NOT NULL,
    amount REAL NOT NULL,
    date INTEGER NOT NULL,
    notes TEXT,
    created_at INTEGER NOT NULL,
    dirty INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS principal_returns_loan_idx ON principal_returns(loan_id)`,

  // Tiny meta table for schema versioning. Used by migrate() in db/index.ts.
  `CREATE TABLE IF NOT EXISTS _meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
];

/**
 * Versioned ALTER statements for upgrading existing databases.
 * Each entry's SQL runs when the stored schema_version is less than the key.
 * Statements should be idempotent where possible; the migrate() runner
 * wraps each in a try/catch so "duplicate column" errors are tolerated —
 * that makes it safe to re-run on already-migrated databases.
 */
export const MIGRATIONS: Record<number, string[]> = {
  3: [
    // Dynamic loan config — add to loans table
    `ALTER TABLE loans ADD COLUMN repayment_type TEXT NOT NULL DEFAULT 'principal_plus_interest'`,
    `ALTER TABLE loans ADD COLUMN interest_type TEXT NOT NULL DEFAULT 'front_loaded'`,
    `ALTER TABLE loans ADD COLUMN interest_rate REAL NOT NULL DEFAULT 0`,
    `ALTER TABLE loans ADD COLUMN disbursed_amount REAL`,
    // Principal/interest split — add to plan_entries
    `ALTER TABLE plan_entries ADD COLUMN principal_portion REAL NOT NULL DEFAULT 0`,
    `ALTER TABLE plan_entries ADD COLUMN interest_portion REAL NOT NULL DEFAULT 0`,
    // Backfill: existing loans linked to *_interest lines become interest_only
    `UPDATE loans
       SET repayment_type = 'interest_only'
     WHERE line_id IN (
       SELECT id FROM lines
        WHERE type = 'daily_interest'
           OR type = 'weekly_interest'
           OR type = 'monthly_interest'
     )`,
    // Backfill: disbursed_amount defaults to principal for old rows
    `UPDATE loans SET disbursed_amount = principal WHERE disbursed_amount IS NULL`,
  ],
};
