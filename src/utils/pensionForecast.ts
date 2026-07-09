// src/utils/pensionForecast.ts
// Pure pension-forecast math. No React, no Firebase — fully unit-tested.
// Simplifications are deliberate (stated in the in-app disclaimer): whole
// calendar years for age, no fees/inflation/tax, single editable annuity
// coefficient instead of actuarial tables.

import type { Account, PensionProfile, Transaction } from '../types';

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

// Mean of the last 3 FULL months of income-type transactions (transfer
// income legs included) landing on the given accounts. The current month is
// partial and would understate the figure, so it is excluded. Not rounded.
export function avgMonthlyDeposit(transactions: Transaction[], accountIds: string[], now: Date = new Date()): number {
  if (!accountIds || accountIds.length === 0) return 0;
  const idSet = new Set(accountIds);
  // Compare months as 'YYYY-MM' strings taken straight from the stored ISO
  // date — timezone-free. Mixing Date(y,m,d) (local) with parsed date-only
  // strings (UTC) shifts month boundaries in negative-UTC timezones.
  const months = new Set<string>();
  for (let i = 1; i <= 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  let total = 0;
  for (const t of transactions || []) {
    if (t.type !== 'income') continue;
    if (!t.account || !idSet.has(t.account)) continue;
    const ym = String(t.date || t.createdAt || '').slice(0, 7);
    if (!months.has(ym)) continue;
    total += t.amount || 0;
  }
  return total / 3;
}

export interface BasketForecast { current: number; projected: number; }

export interface ProfileForecast {
  currentAge: number;
  months: number;                 // 0 when already eligible
  alreadyEligible: boolean;
  pension: BasketForecast & { annuity: number };
  capital: BasketForecast;
  monthlyAuto: { pension: number; capital: number };
  monthlyUsed: { pension: number; capital: number };
}

export function forecastProfile(
  profile: PensionProfile,
  accounts: Account[],
  transactions: Transaction[],
  now: Date = new Date(),
  retireAgeOverride?: number,
): ProfileForecast {
  const accById = new Map((accounts || []).filter(a => a.isActive !== false).map(a => [a.id, a]));
  // Links to deleted or inactive accounts are ignored here (and pruned on next save).
  const links = (profile.links || []).filter(l => accById.has(l.accountId));
  const idsOf = (basket: string) => links.filter(l => l.basket === basket).map(l => l.accountId);
  const balanceOf = (ids: string[]) => ids.reduce((s, id) => s + ((accById.get(id) as Account).balance || 0), 0);

  const pensionIds = idsOf('pension');
  const capitalIds = idsOf('capital');
  const autoPension = avgMonthlyDeposit(transactions, pensionIds, now);
  const autoCapital = avgMonthlyDeposit(transactions, capitalIds, now);

  // Override replaces the TOTAL deposit, split proportionally to the auto
  // shares; when both auto shares are 0 everything goes to pension.
  let usedPension = autoPension;
  let usedCapital = autoCapital;
  const o = profile.monthlyOverride;
  if (o != null && Number.isFinite(o)) {
    const autoTotal = autoPension + autoCapital;
    if (autoTotal > 0) {
      usedPension = o * (autoPension / autoTotal);
      usedCapital = o * (autoCapital / autoTotal);
    } else {
      usedPension = o;
      usedCapital = 0;
    }
  }

  const currentAge = now.getFullYear() - profile.birthYear;
  const retireAge = retireAgeOverride ?? (Number.isFinite(profile.retireAge) ? profile.retireAge : 67);
  const months = Math.max(0, (retireAge - currentAge) * 12);
  const annual = profile.annualReturnPct ?? DEFAULT_ANNUAL_RETURN_PCT;
  const coef = profile.annuityCoef || DEFAULT_ANNUITY_COEF;

  const pensionCurrent = Math.round(balanceOf(pensionIds));
  const capitalCurrent = Math.round(balanceOf(capitalIds));
  const pensionProjected = projectSavings(pensionCurrent, usedPension, months, annual);
  const capitalProjected = projectSavings(capitalCurrent, usedCapital, months, annual);

  return {
    currentAge,
    months,
    alreadyEligible: months === 0,
    pension: { current: pensionCurrent, projected: pensionProjected, annuity: Math.round(pensionProjected / coef) },
    capital: { current: capitalCurrent, projected: capitalProjected },
    monthlyAuto: { pension: Math.round(autoPension), capital: Math.round(autoCapital) },
    monthlyUsed: { pension: Math.round(usedPension), capital: Math.round(usedCapital) },
  };
}

export interface FamilyForecast {
  pension: { current: number; projected: number; annuity: number };
  capital: { current: number; projected: number };
}

// Each profile is forecast at its OWN retireAge/assumptions, then summed.
export function forecastFamily(
  profiles: PensionProfile[],
  accounts: Account[],
  transactions: Transaction[],
  now: Date = new Date(),
): FamilyForecast {
  return (profiles || []).reduce<FamilyForecast>((acc, p) => {
    const f = forecastProfile(p, accounts, transactions, now);
    return {
      pension: {
        current: acc.pension.current + f.pension.current,
        projected: acc.pension.projected + f.pension.projected,
        annuity: acc.pension.annuity + f.pension.annuity,
      },
      capital: {
        current: acc.capital.current + f.capital.current,
        projected: acc.capital.projected + f.capital.projected,
      },
    };
  }, { pension: { current: 0, projected: 0, annuity: 0 }, capital: { current: 0, projected: 0 } });
}
