// src/utils/pensionForecast.ts
// Pure pension-forecast math. No React, no Firebase — fully unit-tested.
// Simplifications are deliberate (stated in the in-app disclaimer): whole
// calendar years for age, no fees/inflation/tax, single editable annuity
// coefficient instead of actuarial tables.

export const DEFAULT_ANNUAL_RETURN_PCT = 4;
export const DEFAULT_ANNUITY_COEF = 200;

export function monthlyRate(annualPct: number): number {
  const pct = Number.isFinite(annualPct) ? annualPct : 0;
  return Math.pow(1 + pct / 100, 1 / 12) - 1;
}

// FV = balance·(1+r)^n + deposit·((1+r)^n − 1)/r ; r=0 → balance + deposit·n
export function projectSavings(balance: number, monthlyDeposit: number, months: number, annualPct: number): number {
  const n = Math.max(0, Math.round(months));
  const b = Number.isFinite(balance) ? balance : 0;
  const d = Number.isFinite(monthlyDeposit) ? monthlyDeposit : 0;
  if (n === 0) return Math.round(b);
  const r = monthlyRate(annualPct);
  if (r === 0) return Math.round(b + d * n);
  const growth = Math.pow(1 + r, n);
  return Math.round(b * growth + d * ((growth - 1) / r));
}
