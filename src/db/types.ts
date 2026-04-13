// Shared TypeScript row types for the local SQLite cache.
// Mirror the Supabase schema in supabase/migrations/0001_init.sql.
//
// Local rows carry two extra sync columns:
//   - server_id: UUID on the server (null until first push succeeds)
//   - dirty: 1 if the row has local changes not yet pushed

export type Role = 'owner' | 'agent';
export type Plan = 'free' | 'starter' | 'pro' | 'business';
export type Language = 'en' | 'ta';
export type LineType = 'daily' | 'weekly' | 'monthly_emi' | 'monthly_interest' | 'enterprise' | 'daily_interest' | 'weekly_interest';
export type LoanStatus = 'active' | 'overdue' | 'closed' | 'defaulted';
export type PlanEntryStatus = 'pending' | 'paid' | 'partial' | 'missed' | 'advance_covered';
export type ExpenseCategory = 'petrol' | 'food' | 'travel' | 'phone' | 'other';
export type PenaltyType = 'flat' | 'percentage';
export type DepositStatus = 'active' | 'matured' | 'closed';

// Dynamic loan config (Month 1 — schema v3)
export type RepaymentType = 'principal_plus_interest' | 'interest_only';
export type InterestType = 'front_loaded' | 'flat' | 'reducing' | 'none';
export type CollectionFrequency = 'daily' | 'weekly' | 'monthly';
export type PaymentMethod = 'cash' | 'account';
export type InterestRatePeriod = 'day' | 'week' | 'month' | 'year';

export interface BaseRow {
  id: string;          // local UUID (generated client-side)
  server_id: string | null;
  dirty: 0 | 1;
  created_at: number;  // epoch ms
}

export interface OrganizationRow extends BaseRow {
  name: string;
  owner_id: string | null;
  plan: Plan;
  language: Language;
  working_days: string; // JSON-encoded array
  sms_enabled: 0 | 1;
}

export interface UserRow extends BaseRow {
  org_id: string;
  auth_user_id: string | null;
  name: string;
  phone: string;
  role: Role;
  pin_hash: string | null;
  is_active: 0 | 1;
}

export type IdType = 'aadhaar' | 'pan' | 'voter' | 'driving_license' | 'passport' | 'other';

export interface BorrowerRow extends BaseRow {
  org_id: string;
  name: string;
  phone: string | null;
  address: string | null;
  photo_url: string | null;
  notes: string | null;
  sms_opt_out: 0 | 1;
  id_number: string | null;
  id_type: IdType | null;
  id_photo_uri: string | null;
}

export interface LineRow extends BaseRow {
  org_id: string;
  name: string;
  type: LineType;
  agent_id: string | null;
}

export interface LoanRow extends BaseRow {
  org_id: string;
  borrower_id: string;
  line_id: string | null;
  principal: number;
  emi_amount: number;
  total_installments: number;
  total_repayment: number;
  start_date: number;
  expected_end_date: number;
  status: LoanStatus;
  renewed_from_id: string | null;
  grace_period_days: number;
  product_description: string | null;
  penalty_type: PenaltyType | null;
  penalty_amount: number;
  // Dynamic loan config (schema v3)
  repayment_type: RepaymentType;
  interest_type: InterestType;
  interest_rate: number;
  disbursed_amount: number | null;
}

export interface PlanEntryRow {
  id: string;
  server_id: string | null;
  dirty: 0 | 1;
  loan_id: string;
  installment_number: number;
  due_date: number;
  expected_amount: number;
  principal_portion: number;
  interest_portion: number;
  status: PlanEntryStatus;
}

export interface CollectionRow extends BaseRow {
  org_id: string;
  loan_id: string;
  agent_id: string | null;
  amount: number;
  expected_amount: number;
  shortfall: number;
  is_advance: 0 | 1;
  advance_periods: number;
  payment_method: PaymentMethod;
  plan_entry_id: string | null;
  notes: string | null;
  collected_at: number;
  gps_lat: number | null;
  gps_lng: number | null;
  gps_mocked: 0 | 1;
  is_synced: 0 | 1;
  offline_id: string | null;
}

export interface ExpenseRow extends BaseRow {
  org_id: string;
  user_id: string | null;
  category: ExpenseCategory;
  amount: number;
  date: number;
  gps_lat: number | null;
  gps_lng: number | null;
  gps_mocked: 0 | 1;
  photo_uri: string | null;
  photo_url: string | null;
  notes: string | null;
  is_synced: 0 | 1;
}

export interface InvestmentRow extends BaseRow {
  org_id: string;
  amount: number;
  source: string | null;
  date: number;
  notes: string | null;
}

export interface NotificationRow extends BaseRow {
  org_id: string;
  user_id: string | null;
  type: string;
  message: string;
  is_read: 0 | 1;
}

export interface GuarantorRow extends BaseRow {
  org_id: string;
  loan_id: string;
  name: string;
  phone: string | null;
  address: string | null;
  relationship: string | null;
  photo_url: string | null;
}

export interface DepositRow extends BaseRow {
  org_id: string;
  depositor_name: string;
  depositor_phone: string | null;
  amount: number;
  interest_rate: number;
  start_date: number;
  maturity_date: number | null;
  interest_paid: number;
  status: DepositStatus;
}

export interface PrincipalReturnRow extends BaseRow {
  loan_id: string;
  org_id: string;
  amount: number;
  date: number;
  notes: string | null;
}

export type HandoverStatus = 'pending' | 'submitted' | 'confirmed' | 'disputed';

export interface HandoverRow extends BaseRow {
  org_id: string;
  agent_id: string;
  date: number;
  collected_amount: number;
  expected_amount: number;
  expenses_amount: number;
  cash_handed_over: number | null;
  cash_received: number | null;
  variance: number | null;
  notes: string | null;
  agent_submitted_at: number | null;
  owner_confirmed_at: number | null;
  status: HandoverStatus;
}

export type SmsKind = 'receipt' | 'reminder' | 'overdue' | 'custom';
export type SmsStatus = 'queued' | 'sent' | 'failed' | 'skipped';

export interface SmsQueueRow extends BaseRow {
  org_id: string;
  kind: SmsKind;
  to_phone: string;
  body: string;
  related_id: string | null;
  status: SmsStatus;
  attempts: number;
  last_attempt_at: number | null;
  last_error: string | null;
  sent_at: number | null;
}

export type LoanRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface LoanRequestRow extends BaseRow {
  org_id: string;
  requested_by: string;
  borrower_id: string;
  line_id: string | null;
  disbursed_amount: number;
  repayment_type: RepaymentType;
  interest_type: InterestType;
  interest_rate: number;
  interest_rate_period: InterestRatePeriod;
  frequency: CollectionFrequency;
  tenure_count: number;
  start_date: number;
  upfront_fee: number | null;
  notes: string | null;
  status: LoanRequestStatus;
  reviewed_by: string | null;
  reviewed_at: number | null;
  rejection_reason: string | null;
  approved_loan_id: string | null;
}
