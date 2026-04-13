# VasoolAI — Launch Checklist (Month 3)

This is the actionable list to take VasoolAI from "feature-complete in dev"
to "live for first 50 users." Track progress here as items get done.

---

## A. Backend & secrets

- [ ] **Supabase project on a paid plan** (free tier sleeps after 7d inactivity)
- [ ] **MSG91 account** + DLT registration complete (₹5k one-time)
  - [ ] Sender ID approved (6-char, e.g. `VASOOL`)
  - [ ] Transactional Flow template approved with body `{#var#}`
  - [ ] Auth key generated
- [ ] **Set Supabase secrets** (run from `supabase/`):
  ```bash
  supabase secrets set MSG91_AUTH_KEY=...
  supabase secrets set MSG91_FLOW_ID=...
  supabase secrets set MSG91_SENDER_ID=VASOOL
  ```
- [ ] **Deploy Edge Function**:
  ```bash
  supabase functions deploy send-receipt-sms
  ```
- [ ] **Verify dry-run vs live**: send a test collection, check MSG91 dashboard
      for the SMS delivery, check `sms_queue.status = 'sent'` in DB.

## B. Mobile build (EAS)

- [ ] Install EAS CLI: `npm install -g eas-cli && eas login`
- [ ] Already configured: `app.json` (permissions strings, plugins) and
      `eas.json` (preview + production profiles). No further config needed.
- [ ] **Android internal preview**:
  ```bash
  eas build --platform android --profile preview
  ```
  Distribute APK to ~5 trusted thandal operators for daily-use feedback.
- [ ] **iOS TestFlight**:
  ```bash
  eas build --platform ios --profile preview
  eas submit --platform ios
  ```
- [ ] **Production builds** (only after preview signoff):
  ```bash
  eas build --platform all --profile production
  ```

## C. Store listings

- [ ] **Play Store** developer account (₹2,200 one-time)
  - [ ] App listing in English + Tamil
  - [ ] 8 screenshots: Home, Collect, BorrowerDetail, LoanPlan timeline,
        Handover, FraudDashboard, Tools, Settings
  - [ ] Privacy policy URL (host on landing page)
  - [ ] Data Safety form: collects location, photos, contacts (declared
        in `app.json` permissions strings)
- [ ] **App Store** developer account ($99/yr)
  - [ ] App listing in English + Tamil
  - [ ] Same 8 screenshots resized for iPhone 6.7"
  - [ ] App Privacy nutrition labels match Play Store

## D. Landing page

- [ ] Domain: vasoolai.com or vasoolai.in
- [ ] One-pager: hero, problem (paper diary fraud), 3 features
      (handover · loan approval · auto SMS), pricing (Free / ₹1,999 Pro),
      Play Store + App Store badges, founder photo + WhatsApp number for
      direct support
- [ ] Tamil version on `/ta`

## E. Soft-launch playbook

Phase 1 — **5 friendly users** (week 1)
- Direct WhatsApp install link + 30-min onboarding call each
- Watch FraudDashboard daily for any disputes
- Collect feedback in a shared Notion doc

Phase 2 — **50 users** (weeks 2–4)
- Open Play Store internal track
- Run targeted Instagram ads in Coimbatore / Madurai / Chennai
  (~₹50/user CAC target)
- Free forever — track free → Pro conversion

Phase 3 — **First paying user goal**: ₹1,999 within 14 days of any user
joining. If <5% convert by week 4, audit pricing.

## F. Pre-launch QA (do these manually before each store submission)

- [ ] Owner login → Phone OTP → Home shows correct totals
- [ ] Add new line → Add agent → Assign agent to line
- [ ] Agent login (PIN) → Sees only assigned line's borrowers
- [ ] Create new loan as owner → Plan generates correctly
- [ ] Agent records collection → Receipt SMS appears in queue
- [ ] Agent submits EOD → Owner gets push notification
- [ ] Owner confirms cash → Agent's screen updates
- [ ] Agent files loan request → Owner gets push notification
- [ ] Owner approves → Real loan + plan created
- [ ] Add expense ≥ ₹100 without photo → Blocked with helpful error
- [ ] Add ID + photo to a borrower → Saves and reloads correctly
- [ ] Toggle org SMS off → No new SMS queues; existing queue keeps sending
- [ ] Toggle borrower SMS off → That borrower's collection doesn't queue SMS
- [ ] Airplane mode → Record a collection → Comes back online → SMS sends
- [ ] Tamil language toggle → All screens render Tamil correctly

## G. Production-grade gaps to address before scale

These don't block launch but should land in Month 4:

- **Sync layer** — pushing dirty rows to Supabase isn't fully wired.
  Currently SQLite is the source of truth; cloud is opportunistic.
- **Multi-device sync** — once sync is wired, owner + agent on different
  devices need to merge changes (last-write-wins is fine for v1).
- **Backup/restore UX** — Settings → Backup to Supabase / Restore
  from Supabase. Critical for the "phone broke" scenario.
- **Onboarding tour** — 4-screen swipeable intro on first launch.
- **Error reporting** — wire Sentry or expo-error-recovery so we see
  field crashes.

---

## What's already done (Month 1 + Month 2)

✅ Dynamic loan config (6 product variants)
✅ Auto-closure + extendInterestOnlyPlan for I-only rolling loans
✅ Recurring borrower management + KYC fields
✅ EOD agent handover with cash variance tracking
✅ Owner approval workflow for agent-proposed loans
✅ Auto SMS receipts via MSG91 Edge Function (dry-run fallback)
✅ GPS mock-location detection + photo evidence for ≥₹100 expenses
✅ Promissory note PDF generator (bilingual)
✅ Fraud dashboard (single-pane variance, GPS, requests view)
✅ Cash position with today's net + per-line breakdown
✅ Push notifications for handover/loan-request alerts
✅ ToolsHub — dedicated screen with badges, separate from Settings
✅ Cutting-edge UI throughout (Emerald Ledger design system)
