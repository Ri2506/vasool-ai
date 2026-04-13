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
//  v4 — added payment_method on collections ('cash' | 'account') so daily
//       summaries can split cash from bank-transfer collections. Defaults
//       to 'cash' for existing rows (thandal is cash-first historically).
//  v5 — added plan_entry_id + notes on collections so each payment is
//       hard-linked to the installment it pays. Enables true duplicate
//       prevention and the dynamic LoanPlanScreen timeline.
//  v6 — handovers table for EOD agent cash reconciliation, loan_requests
//       table for owner approval workflow, and loans.requires_approval flag.
//       Together these form the Month 2 fraud-prevention foundation.
//  v7 — sms_queue for outbound receipts (offline-first: rows queue locally,
//       push to MSG91 Edge Function when network comes back).
//  v8 — GPS trust + photo evidence: gps_mocked flag on collections/expenses,
//       photo_uri on expenses for >₹100 expense proof.
//  v9 — sms_enabled on organizations + sms_opt_out on borrowers
//       Lets the owner globally pause receipts and individual borrowers
//       opt out (e.g., "don't text me, I'll call").
//  v10 — line_agent_assignments — append-only history of which agent was
//       on which line and when. Used for accountability ("who was on
//       Koyambedu line on March 12?") and rotation analytics.

export const SCHEMA_VERSION = 10;

export const DDL = [
  `CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY,
    server_id TEXT,
    name TEXT NOT NULL,
    owner_id TEXT,
    plan TEXT NOT NULL DEFAULT 'free',
    language TEXT NOT NULL DEFAULT 'en',
    working_days TEXT NOT NULL DEFAULT '["mon","tue","wed","thu","fri","sat"]',
    sms_enabled INTEGER NOT NULL DEFAULT 1,
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
    sms_opt_out INTEGER NOT NULL DEFAULT 0,
    id_number TEXT,
    id_type TEXT,
    id_photo_uri TEXT,
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
    payment_method TEXT NOT NULL DEFAULT 'cash',
    plan_entry_id TEXT,
    notes TEXT,
    gps_mocked INTEGER NOT NULL DEFAULT 0,
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
    gps_lat REAL,
    gps_lng REAL,
    gps_mocked INTEGER NOT NULL DEFAULT 0,
    photo_uri TEXT,
    photo_url TEXT,
    notes TEXT,
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

  // Handovers — End-of-day cash reconciliation between agent and owner.
  // One row per agent per day. Status flow:
  //   pending   → row auto-created when agent has any activity
  //   submitted → agent tapped "Submit EOD" with cash amount
  //   confirmed → owner tapped "Cash received" with their counted amount
  //   disputed  → owner counted < submitted, flag for review
  `CREATE TABLE IF NOT EXISTS handovers (
    id TEXT PRIMARY KEY,
    server_id TEXT,
    org_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    date INTEGER NOT NULL,
    collected_amount REAL NOT NULL DEFAULT 0,
    expected_amount REAL NOT NULL DEFAULT 0,
    expenses_amount REAL NOT NULL DEFAULT 0,
    cash_handed_over REAL,
    cash_received REAL,
    variance REAL,
    notes TEXT,
    agent_submitted_at INTEGER,
    owner_confirmed_at INTEGER,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at INTEGER NOT NULL,
    dirty INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS handovers_org_date_idx ON handovers(org_id, date)`,
  `CREATE INDEX IF NOT EXISTS handovers_agent_idx ON handovers(agent_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS handovers_unique_per_day ON handovers(org_id, agent_id, date)`,

  // Loan requests — Owner approval workflow. When an agent proposes a new
  // loan, a loan_requests row is created instead of a loan directly. Owner
  // reviews on their phone and approves → real loan + plan_entries are
  // created. Stops "ghost loan" fraud (SKS lost ₹4.5 crore to this).
  `CREATE TABLE IF NOT EXISTS loan_requests (
    id TEXT PRIMARY KEY,
    server_id TEXT,
    org_id TEXT NOT NULL,
    requested_by TEXT NOT NULL,
    borrower_id TEXT NOT NULL,
    line_id TEXT,
    disbursed_amount REAL NOT NULL,
    repayment_type TEXT NOT NULL,
    interest_type TEXT NOT NULL,
    interest_rate REAL NOT NULL DEFAULT 0,
    interest_rate_period TEXT NOT NULL DEFAULT 'month',
    frequency TEXT NOT NULL,
    tenure_count INTEGER NOT NULL,
    start_date INTEGER NOT NULL,
    upfront_fee REAL,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    reviewed_by TEXT,
    reviewed_at INTEGER,
    rejection_reason TEXT,
    approved_loan_id TEXT,
    created_at INTEGER NOT NULL,
    dirty INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS loan_requests_org_idx ON loan_requests(org_id, status)`,

  // Append-only history of line ↔ agent assignments. A new row is
  // inserted every time the owner reassigns a line (with `unassigned_at`
  // updated on the previous row). Lets the owner answer "who was on this
  // line on the day of the dispute?" for any past date.
  `CREATE TABLE IF NOT EXISTS line_agent_assignments (
    id TEXT PRIMARY KEY,
    server_id TEXT,
    org_id TEXT NOT NULL,
    line_id TEXT NOT NULL,
    agent_id TEXT,
    assigned_at INTEGER NOT NULL,
    unassigned_at INTEGER,
    assigned_by TEXT,
    note TEXT,
    created_at INTEGER NOT NULL,
    dirty INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS line_agent_history_line_idx ON line_agent_assignments(line_id)`,
  `CREATE INDEX IF NOT EXISTS line_agent_history_agent_idx ON line_agent_assignments(agent_id)`,

  // SMS queue — outbound receipts + reminders. Queued locally when a
  // collection is recorded (or handover confirmed), flushed to MSG91 via
  // the send-receipt-sms Edge Function when network is available.
  // kind: 'receipt' (collection ack) | 'reminder' (due today) | 'overdue'
  `CREATE TABLE IF NOT EXISTS sms_queue (
    id TEXT PRIMARY KEY,
    server_id TEXT,
    org_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    to_phone TEXT NOT NULL,
    body TEXT NOT NULL,
    related_id TEXT,
    status TEXT NOT NULL DEFAULT 'queued',
    attempts INTEGER NOT NULL DEFAULT 0,
    last_attempt_at INTEGER,
    last_error TEXT,
    sent_at INTEGER,
    created_at INTEGER NOT NULL,
    dirty INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS sms_queue_status_idx ON sms_queue(status)`,
  `CREATE INDEX IF NOT EXISTS sms_queue_org_idx ON sms_queue(org_id)`,

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
  4: [
    // Track cash vs account (bank transfer/UPI) on each collection so daily
    // summaries can split them. Existing rows default to 'cash' — thandal
    // collections were historically all cash so this is a safe backfill.
    `ALTER TABLE collections ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'cash'`,
  ],
  5: [
    // Hard-link each collection to the plan_entry it paid. This enables:
    //   - True duplicate-payment prevention (can't insert two collections
    //     for the same plan_entry once it's fully paid)
    //   - Dynamic LoanPlanScreen showing actual paid date vs scheduled
    //   - Recent Payments showing "Day 5 paid: ₹500"
    `ALTER TABLE collections ADD COLUMN plan_entry_id TEXT`,
    `ALTER TABLE collections ADD COLUMN notes TEXT`,
    `CREATE INDEX IF NOT EXISTS collections_plan_entry_idx ON collections(plan_entry_id)`,
    // Best-effort backfill: link each existing collection to the next
    // chronologically-ordered paid/partial plan entry on the same loan.
    // Uses a correlated subquery to find the matching entry by date order.
    `UPDATE collections SET plan_entry_id = (
       SELECT pe.id FROM plan_entries pe
        WHERE pe.loan_id = collections.loan_id
          AND pe.status IN ('paid', 'partial')
        ORDER BY ABS(pe.due_date - collections.collected_at) ASC
        LIMIT 1
     )
     WHERE plan_entry_id IS NULL`,
  ],
  6: [
    // Month 2 fraud-prevention foundation — handovers + loan_requests.
    // Tables themselves are created by the DDL above (CREATE IF NOT EXISTS).
    // No ALTERs needed for this version on existing DBs.
  ],
  7: [
    // sms_queue — offline-first outbound SMS queue.
    // Table is created by DDL above.
  ],
  8: [
    // GPS trust — both collections and expenses record whether the location
    // came from a mock-location provider (developer options on Android,
    // Jailbroken iOS with location spoofing). Defaults to 0 (trusted).
    `ALTER TABLE collections ADD COLUMN gps_mocked INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE expenses ADD COLUMN gps_lat REAL`,
    `ALTER TABLE expenses ADD COLUMN gps_lng REAL`,
    `ALTER TABLE expenses ADD COLUMN gps_mocked INTEGER NOT NULL DEFAULT 0`,
    // Photo evidence — expenses > ₹100 require a receipt photo. Stored as
    // local file URI (expo-file-system), optional upload URL for synced rows.
    `ALTER TABLE expenses ADD COLUMN photo_uri TEXT`,
    `ALTER TABLE expenses ADD COLUMN photo_url TEXT`,
    `ALTER TABLE expenses ADD COLUMN notes TEXT`,
  ],
  9: [
    // SMS preferences — global on/off + per-borrower opt-out + KYC fields.
    `ALTER TABLE organizations ADD COLUMN sms_enabled INTEGER NOT NULL DEFAULT 1`,
    `ALTER TABLE borrowers ADD COLUMN sms_opt_out INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE borrowers ADD COLUMN id_number TEXT`,
    `ALTER TABLE borrowers ADD COLUMN id_type TEXT`,
    `ALTER TABLE borrowers ADD COLUMN id_photo_uri TEXT`,
  ],
  10: [
    // line_agent_assignments table is created via CREATE IF NOT EXISTS in DDL.
    // Backfill: seed an "open" assignment row for every line that already
    // has an agent_id so the history view isn't empty for legacy data.
    `INSERT INTO line_agent_assignments (id, server_id, org_id, line_id, agent_id,
       assigned_at, unassigned_at, assigned_by, note, created_at, dirty)
     SELECT lower(hex(randomblob(16))), NULL, ln.org_id, ln.id, ln.agent_id,
            ln.created_at, NULL, NULL, 'Backfilled from existing assignment',
            ln.created_at, 1
     FROM lines ln
     WHERE ln.agent_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM line_agent_assignments laa
         WHERE laa.line_id = ln.id AND laa.unassigned_at IS NULL
       )`,
  ],
};
