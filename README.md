# VasoolAI

**AI-Powered Microfinance Collection Platform**

Replace paper patti-note ledgers with a mobile app that's faster than writing on paper. Built for money lenders and their collection agents in Tamil Nadu, India.

One app, two roles: **Owner** (full dashboard) + **Agent** (simplified collection list).

## Screenshots

| Home | Borrowers | Reports | Settings |
|------|-----------|---------|----------|
| Smart cards (P&L, available-to-lend) + due-today list + batch collect | Search + avatar list + add/edit | Daily / Lines / Outstanding tabs | Language toggle + working days + export |

| Collect | New Loan | Loan Plan | Expenses |
|---------|----------|-----------|----------|
| Three-layer input: chips + numpad + advance multipliers | Auto-suggest EMI + live summary | Tabular repayment schedule | Category chips + numpad |

## Features

### Core (Vasool Drive parity)
- 5 line types: Daily, Weekly, Monthly EMI, Monthly Interest, Enterprise
- Borrower management (add, edit, search, delete)
- Loan creation with auto-calculated repayment plans
- Collection recording with shortfall tracking
- Expense + investment tracking
- Reports: daily summary, line summary, outstanding balances
- CSV data export (borrowers, collections, expenses)
- Tamil + English with auto-detect
- Cloud sync via Supabase

### Speed upgrades (why users switch)
- **One-tap collection** — pre-filled EMI, 1 tap = recorded
- **Batch collect mode** — rapid-fire list, no screen transitions, progress bar
- **Three-layer amount input** — quick chips + 56px numpad + advance multipliers
- **Advance payment** — 2x/3x/5x/7x/10x multipliers, auto-marks future days
- **GPS stamping** on every collection
- **Offline-first** — works at zero bars, syncs when connectivity returns
- **Sundays auto-skipped** in due date calculations

### Smart features (why users stay)
- **Profit card** — "This month profit: ₹45,000" on home screen
- **Available to lend** — auto-calculated from cash flow
- **Cash flow forecast** — "Next week expected: ₹85,000"
- **Monthly auto-summary** — one-screen P&L breakdown
- **Overdue dashboard** — prioritized follow-up list sorted by days overdue
- **Agent summary** — end-of-day totals with share capability

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React Native + Expo (SDK 55) |
| Navigation | React Navigation v7 (native stack + bottom tabs) |
| State | Zustand (global) + React Query (server) |
| Local DB | expo-sqlite (native) / sql.js (web fallback) |
| Backend | Supabase (PostgreSQL + Auth + Edge Functions) |
| Auth | Phone OTP (owner) + PIN via Edge Function (agent) |
| Language | i18next (English + Tamil) |
| Icons | @expo/vector-icons (MaterialCommunityIcons) |
| GPS | expo-location |

## Project Structure

```
vasool-ai/
├── App.tsx                         # Entry: i18n + auth + SQLite + navigation
├── src/
│   ├── components/common/          # Button, Card, Avatar, Badge, ProgressBar,
│   │                               # NumberPad, QuickAmountChips, Skeleton,
│   │                               # OfflineBanner, ErrorBoundary, TabIcon
│   ├── constants/                  # colors, typography, config
│   ├── db/
│   │   ├── sqlite.ts              # Native SQLite adapter (expo-sqlite)
│   │   ├── sqlite.web.ts          # Web SQLite adapter (sql.js WASM)
│   │   ├── schema.ts              # DDL for 10 local tables
│   │   ├── types.ts               # TypeScript row interfaces
│   │   ├── sync.ts                # Two-way Supabase sync
│   │   └── repos/                 # borrowers, lines, loans, collections,
│   │                              # expenses, investments, reports
│   ├── hooks/                     # React Query hooks for all data
│   ├── i18n/                      # en.json + ta.json + resolver
│   ├── lib/                       # Supabase client, secureStorage
│   ├── navigation/                # Root, Auth, Owner, Agent navigators
│   ├── screens/
│   │   ├── auth/                  # Language, PhoneLogin, OTP, PinLogin
│   │   ├── owner/                 # Home, Borrowers, BorrowerDetail, BorrowerEdit,
│   │   │                          # NewLoan, LoanPlan, Collect, BatchCollect,
│   │   │                          # Lines, Reports, Settings, Expenses,
│   │   │                          # Investments, MonthlySummary, Overdue
│   │   └── agent/                 # AgentHome, AgentExpense, AgentSummary
│   ├── store/                     # Zustand: authStore, appStore
│   └── utils/                     # format (₹), loanCalc, workingDays, exportData
└── supabase/
    ├── migrations/0001_init.sql   # 10 tables + RLS + helper functions
    └── functions/                 # bootstrap-owner, agent-login, sync
```

## Getting Started

### Prerequisites
- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- A Supabase project ([supabase.com](https://supabase.com))

### Setup

```bash
# Clone
git clone git@github.com:Ri2506/vasool-ai.git
cd vasool-ai

# Install
npm install

# Configure Supabase
cp .env.example .env
# Fill in EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY

# Apply database schema
# Paste supabase/migrations/0001_init.sql into your Supabase SQL editor

# Run on web
npx expo start --web

# Run on device (requires Expo Go or custom dev client)
npx expo start
```

### Demo Mode
On the phone login screen, tap **"Try as demo owner"** to bypass OTP auth and explore the full app with local data.

## Database Schema

10 tables with Row Level Security:

| Table | Purpose |
|-------|---------|
| organizations | Multi-tenant root (name, plan, language, working days) |
| users | Owner + agents (phone, role, PIN hash) |
| borrowers | Name, phone, address, notes |
| lines | Collection routes (5 types) |
| loans | Principal, EMI, installments, status |
| plan_entries | Repayment schedule (date, amount, status per installment) |
| collections | Amount, GPS, timestamp, shortfall, advance tracking |
| expenses | Category (petrol/food/travel/phone/other), amount |
| investments | Capital invested (amount, source, notes) |
| notifications | In-app notifications |

## Edge Functions (Supabase)

| Function | Purpose |
|----------|---------|
| `bootstrap-owner` | Auto-creates org + user row on first OTP login |
| `agent-login` | Verifies agent PIN (SHA-256 hash), returns user profile |
| `sync` | Two-way sync: pushes dirty local rows, pulls remote changes |

## Roadmap

- [x] **Phase 1**: Vasool Drive feature parity + speed upgrades
- [x] **Phase 2**: Smart cards, monthly summary, overdue dashboard, sync, export
- [ ] **Phase 3**: Voice input (Whisper API), AI risk scoring, AI chat assistant
- [ ] **Phase 4**: WhatsApp receipts, Razorpay billing, Hindi/Telugu/Kannada

## Design Principles

1. **Faster than paper** — every action takes fewer seconds than writing
2. **WhatsApp-simple** — can a WhatsApp user do this without training?
3. **Intelligence is invisible** — smart numbers appear where the user already is

## License

Proprietary. All rights reserved.
