// Unit tests for computeLoanTerms covering all 6 loan structures.
//
// Run with:  npm run test:calc
// Internally: npx tsx src/utils/loanCalc.test.ts
//
// Uses Node's built-in assert. No jest/vitest dependency.

import assert from 'node:assert/strict';
import { computeLoanTerms, type ComputeLoanTermsInput } from './loanCalc';

// Fixed start date for reproducible due_date assertions: 2026-04-01 00:00 IST
const START = new Date(2026, 3, 1, 0, 0, 0, 0).getTime();
const MS_PER_DAY = 86_400_000;

let passCount = 0;
let failCount = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    passCount++;
    // eslint-disable-next-line no-console
    console.log(`  \u2713 ${name}`);
  } catch (e) {
    failCount++;
    // eslint-disable-next-line no-console
    console.error(`  \u2717 ${name}`);
    // eslint-disable-next-line no-console
    console.error(`     ${(e as Error).message}`);
  }
}

function approxEqual(a: number, b: number, tolerance = 1): void {
  assert.ok(
    Math.abs(a - b) <= tolerance,
    `expected ~${b}, got ${a} (diff ${Math.abs(a - b).toFixed(2)} > ${tolerance})`,
  );
}

// ─── Case 1: Thandal classic (flat % of principal, 100 days daily) ─────
//
// NEW semantics: interest rate is a FLAT percentage of principal (one time),
// NOT time-based. This matches real thandal usage where lender says
// "20% on 10,000" meaning 2,000 total interest regardless of tenure.

test('Case 1: Thandal classic — ₹10K at 20% flat, 100 days daily → ₹120/day', () => {
  const input: ComputeLoanTermsInput = {
    disbursedAmount: 10000,
    repaymentType: 'principal_plus_interest',
    interestType: 'front_loaded',
    interestRate: 0.20, // 20% flat of principal
    interestRatePeriod: 'month',
    frequency: 'daily',
    tenureCount: 100,
    startDate: START,
  };
  const result = computeLoanTerms(input);
  assert.equal(result.principal, 10000);
  // Interest = 10000 × 0.20 = 2000 (ONE TIME, flat)
  approxEqual(result.totalInterest, 2000);
  approxEqual(result.totalRepayment, 12000);
  approxEqual(result.emiAmount, 120);
  assert.equal(result.installments, 100);
  assert.equal(result.planEntries.length, 100);
  assert.equal(result.planEntries[0].dueDate, START + MS_PER_DAY);
  assert.equal(result.planEntries[99].dueDate, START + 100 * MS_PER_DAY);
});

// ─── Case 2: Same flat % but weekly tenure ─────────────────────────────

test('Case 2: Flat % — ₹50K at 15% flat, 10 weekly installments', () => {
  const input: ComputeLoanTermsInput = {
    disbursedAmount: 50000,
    repaymentType: 'principal_plus_interest',
    interestType: 'flat',
    interestRate: 0.15,
    interestRatePeriod: 'month',
    frequency: 'weekly',
    tenureCount: 10,
    startDate: START,
  };
  const result = computeLoanTerms(input);
  assert.equal(result.principal, 50000);
  // Interest = 50000 × 0.15 = 7500 flat, regardless of how many weeks
  approxEqual(result.totalInterest, 7500);
  approxEqual(result.totalRepayment, 57500);
  assert.equal(result.installments, 10);
  approxEqual(result.emiAmount, 5750);
  // Per-installment split: principal 5000, interest 750
  approxEqual(result.planEntries[0].principalPortion, 5000);
  approxEqual(result.planEntries[0].interestPortion, 750);
});

// ─── Case 3: Reducing balance EMI (monthly) ────────────────────────────

test('Case 3: Reducing balance — ₹1L at 2% monthly reducing, 12 months', () => {
  const input: ComputeLoanTermsInput = {
    disbursedAmount: 100000,
    repaymentType: 'principal_plus_interest',
    interestType: 'reducing',
    interestRate: 0.02, // 2%/month
    interestRatePeriod: 'month',
    frequency: 'monthly',
    tenureCount: 12,
    startDate: START,
  };
  const result = computeLoanTerms(input);
  assert.equal(result.principal, 100000);
  // EMI = 100000 × 0.02 × (1.02)^12 / ((1.02)^12 - 1) ≈ 9456
  approxEqual(result.emiAmount, 9456, 10);
  assert.equal(result.installments, 12);
  approxEqual(result.planEntries[0].interestPortion, 2000, 5);
  approxEqual(result.planEntries[0].principalPortion, 7456, 10);
  const lastEntry = result.planEntries[11];
  assert.ok(lastEntry.interestPortion < lastEntry.principalPortion);
});

// ─── Case 4: Interest-only rolling (daily) ─────────────────────────────

test('Case 4: Interest-only monthly — ₹10K at 3%/month, rolling 12 months', () => {
  const input: ComputeLoanTermsInput = {
    disbursedAmount: 10000,
    repaymentType: 'interest_only',
    interestType: 'flat',
    interestRate: 0.03, // 3% per month (rate is per-installment)
    interestRatePeriod: 'month',
    frequency: 'monthly',
    tenureCount: 12,
    startDate: START,
  };
  const result = computeLoanTerms(input);
  assert.equal(result.principal, 10000);
  // Each month: 10000 × 0.03 = ₹300/month
  approxEqual(result.emiAmount, 300);
  assert.equal(result.installments, 12);
  assert.equal(result.planEntries[0].principalPortion, 0);
  approxEqual(result.planEntries[0].interestPortion, 300);
  assert.equal(result.endDate, null);
  // Total scheduled interest over 12 months = ₹3,600
  approxEqual(result.totalInterest, 3600);
});

// ─── Case 5: Interest-only with upfront fee ────────────────────────────

test('Case 5: Interest-only + upfront fee — ₹10K + ₹500 fee + ₹300/month', () => {
  const input: ComputeLoanTermsInput = {
    disbursedAmount: 10000,
    repaymentType: 'interest_only',
    interestType: 'front_loaded',
    interestRate: 0.03, // 3%/month → ₹300/month
    interestRatePeriod: 'month',
    frequency: 'monthly',
    tenureCount: 12,
    startDate: START,
    upfrontFee: 500,
  };
  const result = computeLoanTerms(input);
  assert.equal(result.principal, 10000);
  // First entry is the day-0 upfront fee, pre-marked paid
  assert.equal(result.planEntries[0].installmentNumber, 0);
  assert.equal(result.planEntries[0].expectedAmount, 500);
  assert.equal(result.planEntries[0].preMarkedPaid, true);
  assert.equal(result.planEntries[0].dueDate, START);
  // Installments 1..12 are monthly ₹300 interest
  assert.equal(result.planEntries.length, 13); // 12 regular + 1 day-0
  approxEqual(result.planEntries[1].expectedAmount, 300);
  assert.equal(result.planEntries[1].installmentNumber, 1);
  assert.equal(result.endDate, null);
});

// ─── Case 6: Zero interest friend loan ─────────────────────────────────

test('Case 6: Zero interest — ₹5K borrowed, 50 days daily, no interest', () => {
  const input: ComputeLoanTermsInput = {
    disbursedAmount: 5000,
    repaymentType: 'principal_plus_interest',
    interestType: 'none',
    interestRate: 0,
    interestRatePeriod: 'month',
    frequency: 'daily',
    tenureCount: 50,
    startDate: START,
  };
  const result = computeLoanTerms(input);
  assert.equal(result.principal, 5000);
  assert.equal(result.totalInterest, 0);
  assert.equal(result.totalRepayment, 5000);
  approxEqual(result.emiAmount, 100, 0.01);
  assert.equal(result.installments, 50);
  // Every installment is 100% principal
  assert.equal(result.planEntries[0].interestPortion, 0);
  assert.equal(result.planEntries[0].principalPortion, 100);
  assert.equal(result.planEntries[49].dueDate, START + 50 * MS_PER_DAY);
});

// ─── Validation cases ──────────────────────────────────────────────────

test('Validation: negative disbursedAmount throws', () => {
  assert.throws(() =>
    computeLoanTerms({
      disbursedAmount: -1000,
      repaymentType: 'principal_plus_interest',
      interestType: 'none',
      interestRate: 0,
      interestRatePeriod: 'month',
      frequency: 'daily',
      tenureCount: 10,
      startDate: START,
    }),
  );
});

test('Validation: zero tenure throws', () => {
  assert.throws(() =>
    computeLoanTerms({
      disbursedAmount: 1000,
      repaymentType: 'principal_plus_interest',
      interestType: 'none',
      interestRate: 0,
      interestRatePeriod: 'month',
      frequency: 'daily',
      tenureCount: 0,
      startDate: START,
    }),
  );
});

test('Validation: negative interestRate throws', () => {
  assert.throws(() =>
    computeLoanTerms({
      disbursedAmount: 1000,
      repaymentType: 'principal_plus_interest',
      interestType: 'flat',
      interestRate: -0.01,
      interestRatePeriod: 'month',
      frequency: 'daily',
      tenureCount: 10,
      startDate: START,
    }),
  );
});

// ─── Edge case: monthly front-loaded (money lender style) ──────────────

test('Edge: Money lender ₹25K at 18% flat, 6 monthly installments', () => {
  const input: ComputeLoanTermsInput = {
    disbursedAmount: 25000,
    repaymentType: 'principal_plus_interest',
    interestType: 'flat',
    interestRate: 0.18,
    interestRatePeriod: 'month',
    frequency: 'monthly',
    tenureCount: 6,
    startDate: START,
  };
  const result = computeLoanTerms(input);
  // 25000 × 0.18 = 4500 interest (flat, one time)
  approxEqual(result.totalInterest, 4500);
  approxEqual(result.totalRepayment, 29500);
  assert.equal(result.installments, 6);
  approxEqual(result.emiAmount, 4917, 2);
});

// ─── Summary ────────────────────────────────────────────────────────────

// eslint-disable-next-line no-console
console.log(`\nloanCalc tests: ${passCount} passed, ${failCount} failed\n`);
if (failCount > 0) {
  process.exit(1);
}
