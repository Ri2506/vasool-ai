# VasoolAI — Project Guardrails for Claude

This file is loaded by Claude at the start of every session. It defines the
target user, the product principles, architectural rules, and the hard scope
boundaries for this project. Claude must respect these without exception.

---

## 1. What this is

**VasoolAI is the digital operations platform for Tamil Nadu's informal
lending businesses** — specifically thandal operators, small lending
businesses, and independent money lenders. It replaces the physical diary,
mental calculation, and cash reconciliation with a fraud-proof digital
system that supports dynamic loan structures and multi-line operations.

### Current tech stack (do not change without discussion)

- React Native 0.81 + Expo SDK 54 + TypeScript
- SQLite (expo-sqlite) as the local store, offline-first
- Supabase (Postgres + Edge Functions + Auth) as the server backend
- Zustand for auth/app state
- React Query for data fetching + cache invalidation
- React Navigation (stack + bottom tabs)
- Emerald Ledger design system (see `src/theme/emeraldLedger.ts`)
- i18next with English + Tamil (Tamil is first-class, not translated)

---

## 2. Target user (definitive)

Three personas only. If a request does not serve one of these, push back.

### Persona 1 — Solo Thandal Operator (primary volume)
- 40-60 years old, Tier 2/3 Tamil Nadu city or market area
- Walks a single line of 40-100 shops every morning collecting ₹100/day
- ₹2-5 lakh of own/family capital
- No agents — he is the collector
- Uses paper diary today
- Will pay ₹1,999/year if it saves 30 min/day and catches math errors

### Persona 2 — Small Thandal/Lending Business (highest revenue per user)
- 45-60 years old, owns 3-5 lines, employs 2-4 family members as agents
- ₹10-40 lakh portfolio, 150-400 active borrowers
- Uses master diary + sub-diaries + Excel
- Strongly suspects agent skimming but can't prove it
- Will pay ₹1,999-4,999/year if it catches fraud

### Persona 3 — Independent Money Lender (feature-rich)
- 35-45 years old, smartphone-native, tried other apps
- ₹25-75 lakh portfolio, 80-200 borrowers, mixed products
- Runs daily + weekly + monthly loans with varying terms
- Needs dynamic loan configuration, not rigid presets
- Will switch apps if feature fit is clearly better

### NOT the target (explicitly reject)
- NBFCs, MFIs, banks, registered fintechs
- Pawnbrokers, chit fund companies, P2P platforms
- Shopkeepers tracking khata/udhaar
- Individual borrowers (no borrower-facing flow)
- Anyone with compliance officers, auditors, or RBI reporting

---

## 3. Product principles (non-negotiable)

1. **Offline-first, always**. Every feature must work with zero connectivity.
   Sync is opportunistic, never blocking.
2. **Tamil-first, not Tamil-translated**. Tamil typography uses 1.6× line
   height. Vocabulary is native (Nadapu/Nippu/Thittam/Vasool).
3. **Mobile-only**. No web dashboard. No tablet layouts. Phone-first.
4. **Configurable over templated**. Owner sets every loan term (tenure,
   interest type, rate, frequency, repayment type) per loan.
5. **Fraud-prevention is the core value prop**. Not convenience, not design,
   not AI. Every feature is measured against "does this stop agent fraud?"
6. **Role isolation is strict**. Agents literally cannot navigate to owner
   screens. Enforced at the navigator level with conditional `Stack.Screen`.
7. **Freemium with hard caps**, not a time-limited trial. Free forever if
   user stays small. Upgrade is natural when they grow.
8. **No speculative features**. If no real user has asked for it, do not
   build it. Observation drives roadmap, not imagination.

---

## 4. Architectural rules (enforced)

### Database
- Any new column requires a numbered migration in `src/db/schema.ts`.
- `SCHEMA_VERSION` is bumped whenever the DDL changes.
- Migrations must be idempotent and use `ADD COLUMN IF NOT EXISTS` (via
  PRAGMA table_info check).
- Existing rows must be backfilled cleanly — no null-pointer surprises.
- Every table has `id TEXT PRIMARY KEY`, `server_id TEXT`, `created_at INTEGER`,
  `dirty INTEGER DEFAULT 0`.

### Mutations
- Every write is transactional (`db.withTransactionAsync`).
- Every mutation sets `dirty = 1`.
- Every mutation's `onSuccess` invalidates all related React Query keys.
  Missing invalidations cause stale UI — this is a bug, not a polish issue.
- Error handling: every mutation in a screen must have `try/catch` with
  user-facing `Alert`, or an `onError` callback on the mutation.

### UI
- No hardcoded colors. Use `EL.*` tokens from `emeraldLedger.ts`.
- No hardcoded spacing. Use `Space.*` tokens.
- No hardcoded text that should be translatable — use `useTranslation()`.
- No placeholder/demo data in production paths (e.g., "Agent: Ravi"
  hardcoded is a ban).
- Touch targets ≥ `Touch.min` (48px).
- Every screen uses `SafeAreaView` wrapped in `Common.screen`.

### Navigation
- New routes are added to `src/navigation/types.ts` ParamList types first.
- Screens use `NativeStackScreenProps<StackParamList, 'RouteName'>` for
  typed props. No `(navigation as any).navigate(...)`.
- Owner-only screens go in `OwnerNavigator`. Agent-only in `AgentNavigator`.
  Shared screens are imported from `owner/` into the agent navigator
  (e.g., BatchCollectScreen).

### Code style
- No unused imports or variables.
- No dead `useTranslation()` calls.
- Function components only; no class components.
- Hooks at the top of the function; conditional hooks are forbidden.
- Extracted helper components at module scope, never defined inside
  another component (see React best practice `rerender-no-inline-components`).

---

## 5. Hard scope boundaries (do NOT build)

These are actively rejected features. If a user asks, redirect.

- ❌ Credit bureau integration (CIBIL, CRIF, Experian)
- ❌ Aadhaar API verification (KYC photo + ID number is fine — API isn't)
- ❌ Group loans / JLG / SHG structures (MFI feature)
- ❌ Borrower-facing app or portal
- ❌ Tally / Zoho / accounting software exports
- ❌ Multi-language support beyond Tamil + English
- ❌ Real AI/ML features (the "AI" in the name is just branding for now)
- ❌ Payment gateway for actual money movement (record-only, no processing)
- ❌ Family trust layer / heir handover / co-owner access (rejected by owner)
- ❌ Web dashboard, tablet layout, desktop app
- ❌ NBFC / MFI compliance reports or audit logs
- ❌ Razorpay/Stripe integration for anything except app subscription
- ❌ 24/7 support infrastructure (solo founder, best-effort only)
- ❌ WhatsApp Business API (too expensive; use MSG91 SMS + deep-link instead)

---

## 6. Data model — core domain (schema v10)

```
organizations        ← tenant boundary (org_id scopes everything)
  · sms_enabled      ← v9 org-level SMS kill switch
users                ← owner or agent (same phone can exist in multiple orgs)
borrowers            ← v9 adds sms_opt_out + id_number + id_type + id_photo_uri
lines                ← collection routes (agent_id = current agent)
loans                ← dynamic terms (repayment_type, interest_type, rate,
                        disbursed_amount, renewed_from_id)
plan_entries         ← scheduled installments (principal_portion + interest_portion)
collections          ← GPS + timestamp + plan_entry_id + payment_method
                        + gps_mocked + notes
principal_returns    ← separate principal returns for interest-only loans
expenses             ← agent field expenses; v8 adds gps + photo + notes
investments          ← owner capital injections
deposits             ← owner's deposit-taking side (savings from depositors)
guarantors           ← per-loan guarantor info
handovers            ← v6 EOD agent cash reconciliation with variance
loan_requests        ← v6 agent-proposed loans awaiting owner approval
sms_queue            ← v7 outbound SMS receipts (offline-first queue)
line_agent_assignments ← v10 append-only agent rotation history
notifications        ← in-app + push
referrals            ← refer-and-earn
```

Schema is at **v10** with defensive `ensureColumns()` re-running every
additive ALTER on every `openDb()` call, so legacy DBs self-heal.

---

## 7. Roadmap — what's done, what's left

### ✅ Month 1 — Dynamic Loan Configuration (SHIPPED)
- [x] Schema v3 migration + `loanCalc.ts` pure function + unit tests
- [x] NewLoanScreen 5-step wizard with live preview + paisa-notation toggle
- [x] Auto-closure + `extendInterestOnlyPlan` + Return Principal flow
- [x] Reports with principal/interest split + Capital at Risk
- [x] Top-up loan + Renew loan differentiation
- [x] Bulletproof duplicate-payment guards (status + cumulative + 5s rate-limit)
- [x] Dynamic LoanPlanScreen timeline (scheduled vs actual)
- [x] Borrower list grouped by line · per-borrower lifetime stats
- [x] Cash/account payment method + Daily Summary breakdown
- [x] Per-line agent assignment + stats

### ✅ Month 2 — Fraud Prevention Pack (SHIPPED)
- [x] Auto SMS receipts via MSG91 (Edge Function + dry-run fallback)
- [x] Owner approval for new loans (agent files request → owner approves)
- [x] EOD agent handover with variance + dispute flag
- [x] GPS mock-location detection (collections + expenses)
- [x] Photo evidence required for expenses ≥ ₹100
- [x] Promissory note PDF (bilingual English + Tamil)
- [x] FraudDashboard + push notifications for handover/approval events
- [x] Cash position with today's net + per-line breakdown

### ✅ Month 3 prep — Launch-Ready (SHIPPED)
- [x] Cutting-edge ToolsHub (dedicated screen, badges, categorised tiles)
- [x] Home top-bar pending-action badge
- [x] Onboarding tour (4 swipeable slides)
- [x] Crash reporter (local log + optional Supabase upload + diagnostics UI)
- [x] WhatsApp deep-link templates (overdue, receipt, new-loan)
- [x] Per-line agent rotation history
- [x] Backup / restore (JSON export + paste-to-restore)
- [x] Cloud sync layer (push/pull all 18 tables + `sync` Edge Function stub)
- [x] Subscription screen + free-tier hard caps (`planCaps.ts`)
- [x] Multi-org switcher (same phone → multiple orgs)
- [x] Reports PDF + Excel export (Outstanding · Nippu · Patti · Daily)
- [x] Agent-side loan-request status feedback card
- [x] Haptic feedback on critical flows
- [x] SMS settings screen + per-borrower opt-out + KYC fields
- [x] EAS config for Android app-bundle + iOS TestFlight
- [x] `LAUNCH_CHECKLIST.md` — 7-section playbook

### ⏳ Still remaining (external-only, not code)
- [ ] MSG91 account + DLT registration (1-week lead time, ₹5k one-time)
- [ ] Razorpay account + webhook deployment (`create-checkout` Edge Function)
- [ ] Play Store ₹2,200 dev account + app listing
- [ ] App Store $99 dev account + TestFlight review
- [ ] Landing page (vasoolai.com or .in)
- [ ] First 5 friendly-user onboarding calls
- [ ] Supabase Postgres migrations to mirror SQLite schema (for sync pull)

---

## 8. Pricing (locked)

### Free Forever
- 1 line, 1 agent, 30 active borrowers
- All 6 loan structures, offline, Tamil, Nadapu/Nippu
- Basic reports, manual WhatsApp deep-link reminders

### VasoolAI Pro — ₹1,999/year
- Unlimited lines, agents, borrowers
- Full fraud prevention pack (auto SMS, EOD handover, GPS trust, owner approval)
- Multi-line dashboard
- iOS app
- Scheduled WhatsApp reminders
- Supabase cloud backup

One tier, no confusion. Upgrade path is obvious.

---

## 9. Success metrics

| Milestone | Target |
|---|---|
| Month 3 launch | 50 users, 5 paying |
| Month 6 | 1,500 users, 75 paying (₹1.5L revenue) |
| Month 12 | 5,000 users, 250 paying (₹5L revenue) |
| Month 18 | 10,000 users, 500 paying (₹10L revenue) |
| Month 24 | 15,000 users, 750 paying (₹15L revenue) |

**Kill criteria**: Month 6 with <500 users = acquisition broken.
Month 12 with <5% free→paid = pricing/value prop wrong.

---

## 10. Development workflow

1. One feature branch per month (`month-1-loan-config`, `month-2-fraud-pack`,
   `month-3-launch`).
2. Every commit must pass `npx expo export --platform web` with 0 errors.
3. `loanCalc.ts` must pass its unit tests (`npm run test:calc`) before
   any dependent code ships.
4. No feature is "done" until:
   - Build passes
   - Tested manually in both owner and agent roles
   - Tested in both English and Tamil
   - Tested offline (airplane mode) and online

---

## 11. Questions Claude should ask before building

If any of these are unclear, ask before coding:

1. Which persona benefits from this feature? If none, reject.
2. Does this work offline? If no, redesign.
3. Is this role-gated correctly? Owner-only, agent-only, or shared?
4. Which React Query keys need invalidation on success?
5. What's the Tamil string? (Don't ship English-only UI.)
6. Does this violate any of the hard scope boundaries in Section 5?

---

## 12. File structure reference

```
vasool-ai/
├── src/
│   ├── components/common/    ← shared UI (ELCard, GlassHeader, etc.)
│   ├── db/
│   │   ├── schema.ts         ← DDL + SCHEMA_VERSION
│   │   ├── sqlite.ts         ← native adapter
│   │   ├── sqlite.web.ts     ← web adapter (sql.js)
│   │   ├── types.ts          ← row types
│   │   ├── sync.ts           ← push/pull dirty rows
│   │   └── repos/            ← CRUD per entity
│   ├── hooks/                ← React Query wrappers
│   ├── navigation/           ← Root + Auth + Owner + Agent navigators
│   ├── screens/
│   │   ├── auth/             ← 4 screens + OnboardingScreen
│   │   ├── owner/            ← 40+ screens (ToolsHub · FraudDashboard · Sync · Backup · Diagnostics · OrgSwitcher · MultiLineDashboard · SmsSettings · etc.)
│   │   └── agent/            ← 6 screens (AgentEOD added)
│   ├── store/                ← zustand stores
│   ├── theme/emeraldLedger.ts
│   ├── utils/                ← loanCalc, format, workingDays, pdfExport
│   └── lib/                  ← supabase, notifications, whisper, etc.
├── supabase/
│   ├── functions/            ← Edge Functions
│   └── migrations/           ← Postgres schema
└── CLAUDE.md                 ← this file
```

---

**Last updated:** Month 1 + Month 2 complete, Month 3 feature-complete.
Remaining work is external accounts (MSG91, Razorpay, store listings) —
see `LAUNCH_CHECKLIST.md` for the actionable playbook.
