# Pension Forecast Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Per-person pension forecast (projected savings, monthly annuity, lump-sum capital) with early-retirement age comparison, fed by real account balances and deposit history.

**Architecture:** Pure math in `src/utils/pensionForecast.ts` (fully unit-tested), profiles persisted as a Firestore single-doc (`pensionProfiles`) via `dataService` following the goals/projects pattern, one new screen (`PensionForecastScreen`) in the Dashboard stack, and a teaser card on `InvestmentsScreen`.

**Tech Stack:** React Native (Expo SDK 53), TypeScript for services/utils, plain JS for screens, Firebase Firestore via `@react-native-firebase`, Jest.

**Spec:** `docs/superpowers/specs/2026-07-08-pension-forecast-design.md`

## Global Constraints

- All user-facing strings via i18n, added to ALL 11 language files (`en ru he es fr de pt ar zh hi ja`).
- iOS RTL rules (CLAUDE.md): `StyleSheet.create` only inside a `createSt()` factory called in the component; `flexDirection: i18n.row()` for rows; never `<Text style={{flex:1}}>` inside a row — use `RowText`; `textAlign: i18n.textAlign()` on labels/inputs.
- Colors only from `colors` (theme); currency symbol via `sym()` from `src/utils/currency`.
- Destructive actions use `ConfirmModal`, never `Alert`.
- No new native dependencies (no slider libs — steppers only).
- Every dataService/util function gets a test; UI screens get none (project convention).
- Commits: `feat:` / `test:` prefixes; run `npx tsc --noEmit` and `npx eslint <changed files> --quiet` before each commit.
- Jest on this machine: always `npx jest <pattern> --runInBand` (parallel workers crash Node).

---

### Task 1: Types + pensionProfiles storage in dataService

**Files:**
- Modify: `src/types/index.ts` (after the `QuickTemplate` block, ~line 196)
- Modify: `src/services/dataService.ts` (KEYS ~line 42, after `saveGoals` ~line 577, `clearAllData` singleDocs ~line 971, `exportData` ~line 1021, `importData` mode-agnostic block ~line 1075)
- Test: `__tests__/dataService.firestore.test.js` (append inside the main `describe`, before the final `});`)

**Interfaces:**
- Consumes: existing `getDocData`/`setDocData`/`getUid`/`KEYS` internals of dataService.
- Produces: `PensionBasket`, `PensionAccountLink`, `PensionProfile` types; `dataService.getPensionProfiles(): Promise<PensionProfile[]>`; `dataService.savePensionProfiles(profiles: PensionProfile[]): Promise<boolean>`; `pensionProfiles` key in `exportData()` result and accepted by `importData()`.

- [ ] **Step 1: Write the failing test**

Append to `__tests__/dataService.firestore.test.js` before the final `});`:

```js
  // ─── PENSION PROFILES ───────────────────────
  test('pension profiles: save/get, export, import, clearAllData', async () => {
    const profiles = [{
      id: 'p1', name: 'Alex', birthYear: 1980, retireAge: 62,
      links: [{ accountId: 'a1', basket: 'pension' }],
    }];
    await dataService.savePensionProfiles(profiles);
    expect((await dataService.getPensionProfiles()).length).toBe(1);

    const data = await dataService.exportData();
    expect(data.pensionProfiles.length).toBe(1);

    await dataService.clearAllData();
    expect(await dataService.getPensionProfiles()).toEqual([]);

    const ok = await dataService.importData({ pensionProfiles: profiles });
    expect(ok).toBe(true);
    expect((await dataService.getPensionProfiles())[0].name).toBe('Alex');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest dataService.firestore --runInBand`
Expected: FAIL — `dataService.savePensionProfiles is not a function`

- [ ] **Step 3: Implement types**

In `src/types/index.ts`, insert after the `QuickTemplate` interface block (before `// ─── Streaks ───`):

```ts
// ─── Pension forecast ────────────────────────────────────
export type PensionBasket = 'pension' | 'capital';

export interface PensionAccountLink {
  accountId: string;
  basket: PensionBasket;   // pension → annuity; capital → lump sum
}

export interface PensionProfile {
  id: string;
  name: string;                    // 'Алекс'
  birthYear: number;               // 1980
  retireAge: number;               // persisted stepper value, 55–75
  annualReturnPct?: number;        // default 4 (percent, annual)
  annuityCoef?: number;            // default 200 (מקדם המרה)
  monthlyOverride?: number | null; // total ₪/month; null/undefined → auto
  links: PensionAccountLink[];
  createdAt?: string;
}
```

- [ ] **Step 4: Implement storage in dataService**

In `src/services/dataService.ts`:

a) Add `PensionProfile` to the existing type import from `'../types'`.

b) In `KEYS` add (before the legacy SHOPPING_LIST line):

```ts
  PENSION_PROFILES: 'qaizo_pension_profiles',
```

c) After `saveGoals` add:

```ts
  // ─── PENSION PROFILES ─────────────────────────────────────
  async getPensionProfiles(): Promise<PensionProfile[]> {
    const uid = getUid();
    if (uid) return getDocData('pensionProfiles', []);
    try { const data = await AsyncStorage.getItem(KEYS.PENSION_PROFILES); return data ? JSON.parse(data) : []; } catch (e) { return []; }
  },

  async savePensionProfiles(profiles: PensionProfile[]): Promise<boolean> {
    const uid = getUid();
    if (uid) return setDocData('pensionProfiles', profiles);
    try { await AsyncStorage.setItem(KEYS.PENSION_PROFILES, JSON.stringify(profiles)); return true; } catch (e) { return false; }
  },
```

d) In `clearAllData` extend `singleDocs`:

```ts
        const singleDocs = ['categories', 'budgets', 'settings', 'tags', 'streaks', 'projects', 'goals', 'quickTemplates', 'pensionProfiles', 'shoppingList'];
```

e) In `exportData` add `pensionProfiles`:

```ts
      const [transactions, accounts, investments, categories, settings, budgets, recurring, tags, streaks, projects, goals, quickTemplates, pensionProfiles] = await Promise.all([
        this.getTransactions(), this.getAccounts(), this.getInvestments(),
        this.getCategories(), this.getSettings(), this.getBudgets(),
        this.getRecurring(), this.getTags(), this.getStreaks(), this.getProjects(), this.getGoals(),
        this.getQuickTemplates(), this.getPensionProfiles(),
      ]);
      return { transactions, accounts, investments, categories, settings, budgets, recurring, tags, streaks, projects, goals, quickTemplates, pensionProfiles, exportedAt: new Date().toISOString() };
```

f) In `importData`, after the quickTemplates lines add (snake_case alias comes from `migrateToFirestore` lowercasing `PENSION_PROFILES`):

```ts
      const pensionProfiles = data.pensionProfiles || data.pension_profiles;
      if (pensionProfiles) await this.savePensionProfiles(pensionProfiles);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest dataService.firestore --runInBand`
Expected: PASS (all tests, incl. the new one)

- [ ] **Step 6: Verify types + lint, commit**

```bash
npx tsc --noEmit
npx eslint src/services/dataService.ts src/types/index.ts __tests__/dataService.firestore.test.js --quiet
git add src/types/index.ts src/services/dataService.ts __tests__/dataService.firestore.test.js
git commit -m "feat(pension): PensionProfile type + pensionProfiles storage in dataService"
```

---

### Task 2: Math core — monthlyRate + projectSavings

**Files:**
- Create: `src/utils/pensionForecast.ts`
- Test: `__tests__/pensionForecast.test.js` (new)

**Interfaces:**
- Consumes: nothing (pure).
- Produces: `monthlyRate(annualPct: number): number`; `projectSavings(balance: number, monthlyDeposit: number, months: number, annualPct: number): number` (rounded ₪); constants `DEFAULT_ANNUAL_RETURN_PCT = 4`, `DEFAULT_ANNUITY_COEF = 200`.

- [ ] **Step 1: Write the failing tests**

Create `__tests__/pensionForecast.test.js`:

```js
// Tests for the pure pension forecast math.
const {
  monthlyRate, projectSavings,
} = require('../src/utils/pensionForecast');

describe('monthlyRate', () => {
  test('4% annual → ~0.327% monthly (compound)', () => {
    expect(monthlyRate(4)).toBeCloseTo(0.0032737, 6);
  });
  test('0% → 0', () => {
    expect(monthlyRate(0)).toBe(0);
  });
});

describe('projectSavings', () => {
  test('zero return: balance + deposits linearly', () => {
    expect(projectSavings(100000, 0, 12, 0)).toBe(100000);
    expect(projectSavings(100000, 1000, 12, 0)).toBe(112000);
  });

  test('balance-only growth at 4% over 10 years ≈ ×1.4802', () => {
    expect(projectSavings(100000, 0, 120, 4)).toBe(148024);
  });

  test('deposits-only at 4% over 12 months ≈ 12 218', () => {
    expect(projectSavings(0, 1000, 12, 4)).toBe(12218);
  });

  test('zero months → balance as is', () => {
    expect(projectSavings(55555, 9999, 0, 4)).toBe(55555);
  });

  test('garbage inputs treated as zeros', () => {
    expect(projectSavings(NaN, NaN, 12, 0)).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest pensionForecast --runInBand`
Expected: FAIL — cannot find module `../src/utils/pensionForecast`

- [ ] **Step 3: Write the implementation**

Create `src/utils/pensionForecast.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest pensionForecast --runInBand`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
npx tsc --noEmit
npx eslint src/utils/pensionForecast.ts __tests__/pensionForecast.test.js --quiet
git add src/utils/pensionForecast.ts __tests__/pensionForecast.test.js
git commit -m "feat(pension): projection math (monthlyRate, projectSavings) with tests"
```

---

### Task 3: avgMonthlyDeposit — real deposits from transactions

**Files:**
- Modify: `src/utils/pensionForecast.ts`
- Test: `__tests__/pensionForecast.test.js`

**Interfaces:**
- Consumes: `Transaction` fields `type`, `account`, `amount`, `date`, `createdAt`.
- Produces: `avgMonthlyDeposit(transactions: Transaction[], accountIds: string[], now?: Date): number` — mean over the last 3 FULL months of `type === 'income'` transactions (transfer income legs included by virtue of their type) landing on the given accounts; current month excluded; NOT rounded (callers round).

- [ ] **Step 1: Write the failing tests**

Append to `__tests__/pensionForecast.test.js` (add `avgMonthlyDeposit` to the require):

```js
describe('avgMonthlyDeposit', () => {
  // Fixed "now": 2026-07-08 → full months are Apr, May, Jun 2026
  const now = new Date(2026, 6, 8);
  const txs = [
    { type: 'income', account: 'a1', amount: 1000, date: '2026-04-15' },
    { type: 'income', account: 'a1', amount: 2000, date: '2026-06-01', isTransfer: true }, // transfer leg counts
    { type: 'income', account: 'a1', amount: 500,  date: '2026-07-05' },  // current month — excluded
    { type: 'income', account: 'a1', amount: 999,  date: '2026-03-31' },  // too old — excluded
    { type: 'expense', account: 'a1', amount: 700, date: '2026-05-10' },  // not income — excluded
    { type: 'income', account: 'a2', amount: 900,  date: '2026-05-10' },  // other account — excluded
  ];

  test('averages the last 3 full months on the linked accounts', () => {
    expect(avgMonthlyDeposit(txs, ['a1'], now)).toBe(1000); // (1000+2000)/3
  });

  test('several linked accounts are summed', () => {
    expect(avgMonthlyDeposit(txs, ['a1', 'a2'], now)).toBe(1300); // (1000+2000+900)/3
  });

  test('no linked accounts → 0', () => {
    expect(avgMonthlyDeposit(txs, [], now)).toBe(0);
  });

  test('falls back to createdAt when date is missing', () => {
    const t = [{ type: 'income', account: 'a1', amount: 300, createdAt: '2026-05-02T10:00:00Z' }];
    expect(avgMonthlyDeposit(t, ['a1'], now)).toBe(100);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest pensionForecast --runInBand`
Expected: FAIL — `avgMonthlyDeposit is not a function`

- [ ] **Step 3: Write the implementation**

Append to `src/utils/pensionForecast.ts`:

```ts
// Mean of the last 3 FULL months of income-type transactions (transfer
// income legs included) landing on the given accounts. The current month is
// partial and would understate the figure, so it is excluded. Not rounded.
export function avgMonthlyDeposit(transactions: Transaction[], accountIds: string[], now: Date = new Date()): number {
  if (!accountIds || accountIds.length === 0) return 0;
  const idSet = new Set(accountIds);
  const start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 1); // exclusive
  let total = 0;
  for (const t of transactions || []) {
    if (t.type !== 'income') continue;
    if (!t.account || !idSet.has(t.account)) continue;
    const td = new Date(t.date || t.createdAt || 0);
    if (isNaN(td.getTime()) || td < start || td >= end) continue;
    total += t.amount || 0;
  }
  return total / 3;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest pensionForecast --runInBand`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
npx tsc --noEmit
npx eslint src/utils/pensionForecast.ts __tests__/pensionForecast.test.js --quiet
git add src/utils/pensionForecast.ts __tests__/pensionForecast.test.js
git commit -m "feat(pension): avgMonthlyDeposit from real transactions"
```

---

### Task 4: forecastProfile + forecastFamily

**Files:**
- Modify: `src/utils/pensionForecast.ts`
- Test: `__tests__/pensionForecast.test.js`

**Interfaces:**
- Consumes: `projectSavings`, `avgMonthlyDeposit` (Tasks 2–3); `PensionProfile`, `Account`, `Transaction` types.
- Produces:

```ts
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
forecastProfile(profile: PensionProfile, accounts: Account[], transactions: Transaction[], now?: Date, retireAgeOverride?: number): ProfileForecast
forecastFamily(profiles: PensionProfile[], accounts: Account[], transactions: Transaction[], now?: Date): { pension: { current, projected, annuity }, capital: { current, projected } }
```

- [ ] **Step 1: Write the failing tests**

Append to `__tests__/pensionForecast.test.js` (extend the require with `forecastProfile, forecastFamily`):

```js
describe('forecastProfile', () => {
  const now = new Date(2026, 6, 8); // age = 2026 - birthYear
  const accounts = [
    { id: 'pen1', type: 'investment', balance: 100000 },
    { id: 'cap1', type: 'investment', balance: 50000 },
  ];
  const baseProfile = {
    id: 'p1', name: 'Alex', birthYear: 1980, retireAge: 56, // age 46 → 120 months
    annualReturnPct: 4, annuityCoef: 200,
    links: [
      { accountId: 'pen1', basket: 'pension' },
      { accountId: 'cap1', basket: 'capital' },
      { accountId: 'ghost', basket: 'pension' }, // deleted account — ignored
    ],
  };

  test('no deposits: balances grow, annuity = projected/coef', () => {
    const f = forecastProfile(baseProfile, accounts, [], now);
    expect(f.currentAge).toBe(46);
    expect(f.months).toBe(120);
    expect(f.alreadyEligible).toBe(false);
    expect(f.pension.current).toBe(100000);
    expect(f.pension.projected).toBe(148024);           // ×1.04^10
    expect(f.pension.annuity).toBe(Math.round(148024 / 200)); // 740
    expect(f.capital.projected).toBe(74012);            // 50000 ×1.04^10
  });

  test('auto deposits flow into the right basket', () => {
    const txs = [
      { type: 'income', account: 'pen1', amount: 3000, date: '2026-05-10' },
      { type: 'income', account: 'cap1', amount: 1500, date: '2026-06-10' },
    ];
    const f = forecastProfile(baseProfile, accounts, txs, now);
    expect(f.monthlyAuto).toEqual({ pension: 1000, capital: 500 });
    expect(f.monthlyUsed).toEqual({ pension: 1000, capital: 500 });
  });

  test('monthlyOverride replaces the total, split ∝ auto shares', () => {
    const txs = [
      { type: 'income', account: 'pen1', amount: 9000, date: '2026-05-10' }, // auto 3000
      { type: 'income', account: 'cap1', amount: 3000, date: '2026-06-10' }, // auto 1000
    ];
    const f = forecastProfile({ ...baseProfile, monthlyOverride: 2000 }, accounts, txs, now);
    expect(f.monthlyUsed).toEqual({ pension: 1500, capital: 500 });
  });

  test('override with zero auto shares → all to pension', () => {
    const f = forecastProfile({ ...baseProfile, monthlyOverride: 1200 }, accounts, [], now);
    expect(f.monthlyUsed).toEqual({ pension: 1200, capital: 0 });
  });

  test('retireAgeOverride recomputes without touching the profile', () => {
    const f = forecastProfile(baseProfile, accounts, [], now, 66); // 240 months
    expect(f.months).toBe(240);
  });

  test('already eligible: projected = current, annuity from current pot', () => {
    const f = forecastProfile({ ...baseProfile, birthYear: 1950 }, accounts, [], now); // age 76 > 56
    expect(f.alreadyEligible).toBe(true);
    expect(f.months).toBe(0);
    expect(f.pension.projected).toBe(100000);
    expect(f.pension.annuity).toBe(500); // 100000/200
  });

  test('defaults: return 4%, coef 200 when fields absent', () => {
    const p = { id: 'p2', name: 'X', birthYear: 1980, retireAge: 56, links: [{ accountId: 'pen1', basket: 'pension' }] };
    const f = forecastProfile(p, accounts, [], now);
    expect(f.pension.projected).toBe(148024);
    expect(f.pension.annuity).toBe(740);
  });
});

describe('forecastFamily', () => {
  const now = new Date(2026, 6, 8);
  const accounts = [
    { id: 'pen1', type: 'investment', balance: 100000 },
    { id: 'pen2', type: 'investment', balance: 100000 },
  ];
  const p1 = { id: 'p1', name: 'A', birthYear: 1980, retireAge: 56, annualReturnPct: 4, annuityCoef: 200, links: [{ accountId: 'pen1', basket: 'pension' }] };
  const p2 = { id: 'p2', name: 'B', birthYear: 1980, retireAge: 56, annualReturnPct: 0, annuityCoef: 200, links: [{ accountId: 'pen2', basket: 'pension' }] };

  test('sums per-profile results at each profile own settings', () => {
    const fam = forecastFamily([p1, p2], accounts, [], now);
    expect(fam.pension.current).toBe(200000);
    expect(fam.pension.projected).toBe(148024 + 100000);
    expect(fam.pension.annuity).toBe(740 + 500);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest pensionForecast --runInBand`
Expected: FAIL — `forecastProfile is not a function`

- [ ] **Step 3: Write the implementation**

Append to `src/utils/pensionForecast.ts`:

```ts
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
  const accById = new Map((accounts || []).map(a => [a.id, a]));
  // Links to deleted accounts are ignored here (and pruned on next save).
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
  const retireAge = retireAgeOverride ?? profile.retireAge;
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest pensionForecast --runInBand`
Expected: PASS (all suites in the file)

- [ ] **Step 5: Commit**

```bash
npx tsc --noEmit
npx eslint src/utils/pensionForecast.ts __tests__/pensionForecast.test.js --quiet
git add src/utils/pensionForecast.ts __tests__/pensionForecast.test.js
git commit -m "feat(pension): forecastProfile + forecastFamily with tests"
```

---

### Task 5: i18n keys × 11 languages

**Files:**
- Modify: `src/i18n/en.ts`, `ru.ts`, `he.ts`, `es.ts`, `fr.ts`, `de.ts`, `pt.ts`, `ar.ts`, `zh.ts`, `hi.ts`, `ja.ts` — append the block at the end of each file's object (before the closing `};`).

**Interfaces:**
- Produces: 31 `pf*`-prefixed keys used by Tasks 6–7. The `{age}` placeholder is replaced via `.replace()` in the UI. Existing shared keys reused by the UI (NOT added here): `cancel`, `save`, `delete`, `edit`.

- [ ] **Step 1: Append the key block to every language file**

`en.ts`:

```ts
  // Pension forecast
  pfTitle: 'Pension Forecast',
  pfTeaser: 'See your future pension',
  pfSetup: 'Set up',
  pfRetireAge: 'Retirement age',
  pfSavedBy: 'Saved by {age}',
  pfAnnuity: 'Annuity',
  pfPerMonth: '/mo',
  pfCapital: 'Capital (lump sum)',
  pfCompare: 'Age comparison',
  pfAge: 'Age',
  pfProjectedCol: 'Saved',
  pfAccountsSection: 'Linked accounts',
  pfAddAccounts: 'Link accounts',
  pfNoAccounts: 'Link your pension and savings accounts to see the forecast',
  pfBasketPension: 'Pension',
  pfBasketCapital: 'Capital',
  pfAssumptions: 'Assumptions',
  pfReturn: 'Annual return',
  pfCoef: 'Annuity coefficient',
  pfCoefHint: 'Take it from your fund statement (default 200)',
  pfMonthlyDeposit: 'Monthly deposit',
  pfAuto: 'auto',
  pfResetAuto: 'Reset to auto',
  pfFamily: 'Family',
  pfAddProfile: 'New profile',
  pfProfileName: 'Name',
  pfBirthYear: 'Birth year',
  pfBirthYearInvalid: 'Enter a year between 1930 and 2015',
  pfAlreadyEligible: 'Retirement age reached — figures show current savings',
  pfDeleteProfile: 'Delete profile?',
  pfDisclaimer: 'Estimate based on your assumptions (whole years, no fees/inflation/tax). Not financial or pension advice.',
```

`ru.ts`:

```ts
  // Пенсионный прогноз
  pfTitle: 'Пенсионный прогноз',
  pfTeaser: 'Узнай свою будущую пенсию',
  pfSetup: 'Настроить',
  pfRetireAge: 'Возраст выхода',
  pfSavedBy: 'Накоплено к {age}',
  pfAnnuity: 'Кицва',
  pfPerMonth: '/мес',
  pfCapital: 'Капитал (разово)',
  pfCompare: 'Сравнение возрастов',
  pfAge: 'Возраст',
  pfProjectedCol: 'Накоплено',
  pfAccountsSection: 'Привязанные счета',
  pfAddAccounts: 'Привязать счета',
  pfNoAccounts: 'Привяжи пенсионные и накопительные счета, чтобы увидеть прогноз',
  pfBasketPension: 'Пенсия',
  pfBasketCapital: 'Капитал',
  pfAssumptions: 'Допущения',
  pfReturn: 'Годовая доходность',
  pfCoef: 'Коэффициент кицвы',
  pfCoefHint: 'Возьми из отчёта фонда (по умолчанию 200)',
  pfMonthlyDeposit: 'Взнос в месяц',
  pfAuto: 'авто',
  pfResetAuto: 'Вернуть авто',
  pfFamily: 'Семья',
  pfAddProfile: 'Новый профиль',
  pfProfileName: 'Имя',
  pfBirthYear: 'Год рождения',
  pfBirthYearInvalid: 'Введи год между 1930 и 2015',
  pfAlreadyEligible: 'Возраст выхода уже достигнут — показаны текущие накопления',
  pfDeleteProfile: 'Удалить профиль?',
  pfDisclaimer: 'Оценка по заданным допущениям (целые годы, без комиссий/инфляции/налогов). Не является финансовой или пенсионной консультацией.',
```

`he.ts`:

```ts
  // תחזית פנסיה
  pfTitle: 'תחזית פנסיה',
  pfTeaser: 'גלה את הפנסיה העתידית שלך',
  pfSetup: 'הגדרה',
  pfRetireAge: 'גיל פרישה',
  pfSavedBy: 'נצבר עד גיל {age}',
  pfAnnuity: 'קצבה',
  pfPerMonth: '/חודש',
  pfCapital: 'הון (חד־פעמי)',
  pfCompare: 'השוואת גילאים',
  pfAge: 'גיל',
  pfProjectedCol: 'נצבר',
  pfAccountsSection: 'חשבונות מקושרים',
  pfAddAccounts: 'קישור חשבונות',
  pfNoAccounts: 'קשר חשבונות פנסיה וחיסכון כדי לראות את התחזית',
  pfBasketPension: 'פנסיה',
  pfBasketCapital: 'הון',
  pfAssumptions: 'הנחות',
  pfReturn: 'תשואה שנתית',
  pfCoef: 'מקדם המרה',
  pfCoefHint: 'קח מדוח הקרן שלך (ברירת מחדל 200)',
  pfMonthlyDeposit: 'הפקדה חודשית',
  pfAuto: 'אוטו',
  pfResetAuto: 'חזרה לאוטו',
  pfFamily: 'משפחה',
  pfAddProfile: 'פרופיל חדש',
  pfProfileName: 'שם',
  pfBirthYear: 'שנת לידה',
  pfBirthYearInvalid: 'הזן שנה בין 1930 ל־2015',
  pfAlreadyEligible: 'גיל הפרישה כבר הושג — מוצג החיסכון הנוכחי',
  pfDeleteProfile: 'למחוק את הפרופיל?',
  pfDisclaimer: 'הערכה לפי ההנחות שהוגדרו (שנים שלמות, ללא דמי ניהול/אינפלציה/מס). אינה ייעוץ פיננסי או פנסיוני.',
```

`es.ts`:

```ts
  // Pronóstico de pensión
  pfTitle: 'Pronóstico de pensión',
  pfTeaser: 'Descubre tu pensión futura',
  pfSetup: 'Configurar',
  pfRetireAge: 'Edad de jubilación',
  pfSavedBy: 'Ahorrado a los {age}',
  pfAnnuity: 'Renta mensual',
  pfPerMonth: '/mes',
  pfCapital: 'Capital (pago único)',
  pfCompare: 'Comparación de edades',
  pfAge: 'Edad',
  pfProjectedCol: 'Ahorrado',
  pfAccountsSection: 'Cuentas vinculadas',
  pfAddAccounts: 'Vincular cuentas',
  pfNoAccounts: 'Vincula tus cuentas de pensión y ahorro para ver el pronóstico',
  pfBasketPension: 'Pensión',
  pfBasketCapital: 'Capital',
  pfAssumptions: 'Supuestos',
  pfReturn: 'Rentabilidad anual',
  pfCoef: 'Coeficiente de renta',
  pfCoefHint: 'Tómalo del informe de tu fondo (por defecto 200)',
  pfMonthlyDeposit: 'Aporte mensual',
  pfAuto: 'auto',
  pfResetAuto: 'Volver a auto',
  pfFamily: 'Familia',
  pfAddProfile: 'Nuevo perfil',
  pfProfileName: 'Nombre',
  pfBirthYear: 'Año de nacimiento',
  pfBirthYearInvalid: 'Introduce un año entre 1930 y 2015',
  pfAlreadyEligible: 'Edad de jubilación alcanzada — se muestran los ahorros actuales',
  pfDeleteProfile: '¿Eliminar perfil?',
  pfDisclaimer: 'Estimación basada en tus supuestos (años completos, sin comisiones/inflación/impuestos). No es asesoramiento financiero ni de pensiones.',
```

`fr.ts`:

```ts
  // Prévision de retraite
  pfTitle: 'Prévision de retraite',
  pfTeaser: 'Découvrez votre future pension',
  pfSetup: 'Configurer',
  pfRetireAge: 'Âge de départ',
  pfSavedBy: 'Épargné à {age} ans',
  pfAnnuity: 'Rente mensuelle',
  pfPerMonth: '/mois',
  pfCapital: 'Capital (versement unique)',
  pfCompare: 'Comparaison des âges',
  pfAge: 'Âge',
  pfProjectedCol: 'Épargné',
  pfAccountsSection: 'Comptes liés',
  pfAddAccounts: 'Lier des comptes',
  pfNoAccounts: 'Liez vos comptes retraite et épargne pour voir la prévision',
  pfBasketPension: 'Retraite',
  pfBasketCapital: 'Capital',
  pfAssumptions: 'Hypothèses',
  pfReturn: 'Rendement annuel',
  pfCoef: 'Coefficient de rente',
  pfCoefHint: 'À prendre dans le relevé de votre fonds (200 par défaut)',
  pfMonthlyDeposit: 'Versement mensuel',
  pfAuto: 'auto',
  pfResetAuto: 'Revenir en auto',
  pfFamily: 'Famille',
  pfAddProfile: 'Nouveau profil',
  pfProfileName: 'Nom',
  pfBirthYear: 'Année de naissance',
  pfBirthYearInvalid: 'Saisissez une année entre 1930 et 2015',
  pfAlreadyEligible: 'Âge de départ atteint — épargne actuelle affichée',
  pfDeleteProfile: 'Supprimer le profil ?',
  pfDisclaimer: 'Estimation selon vos hypothèses (années entières, hors frais/inflation/impôts). Ne constitue pas un conseil financier ou retraite.',
```

`de.ts`:

```ts
  // Rentenprognose
  pfTitle: 'Rentenprognose',
  pfTeaser: 'Entdecke deine künftige Rente',
  pfSetup: 'Einrichten',
  pfRetireAge: 'Rentenalter',
  pfSavedBy: 'Angespart bis {age}',
  pfAnnuity: 'Monatsrente',
  pfPerMonth: '/Monat',
  pfCapital: 'Kapital (Einmalzahlung)',
  pfCompare: 'Altersvergleich',
  pfAge: 'Alter',
  pfProjectedCol: 'Angespart',
  pfAccountsSection: 'Verknüpfte Konten',
  pfAddAccounts: 'Konten verknüpfen',
  pfNoAccounts: 'Verknüpfe deine Renten- und Sparkonten, um die Prognose zu sehen',
  pfBasketPension: 'Rente',
  pfBasketCapital: 'Kapital',
  pfAssumptions: 'Annahmen',
  pfReturn: 'Jahresrendite',
  pfCoef: 'Rentenkoeffizient',
  pfCoefHint: 'Aus dem Fondsbericht übernehmen (Standard 200)',
  pfMonthlyDeposit: 'Monatliche Einzahlung',
  pfAuto: 'auto',
  pfResetAuto: 'Zurück zu auto',
  pfFamily: 'Familie',
  pfAddProfile: 'Neues Profil',
  pfProfileName: 'Name',
  pfBirthYear: 'Geburtsjahr',
  pfBirthYearInvalid: 'Jahr zwischen 1930 und 2015 eingeben',
  pfAlreadyEligible: 'Rentenalter erreicht — aktuelle Ersparnisse werden angezeigt',
  pfDeleteProfile: 'Profil löschen?',
  pfDisclaimer: 'Schätzung auf Basis deiner Annahmen (ganze Jahre, ohne Gebühren/Inflation/Steuern). Keine Finanz- oder Rentenberatung.',
```

`pt.ts`:

```ts
  // Previsão de pensão
  pfTitle: 'Previsão de pensão',
  pfTeaser: 'Veja a sua pensão futura',
  pfSetup: 'Configurar',
  pfRetireAge: 'Idade de reforma',
  pfSavedBy: 'Poupado até aos {age}',
  pfAnnuity: 'Renda mensal',
  pfPerMonth: '/mês',
  pfCapital: 'Capital (pagamento único)',
  pfCompare: 'Comparação de idades',
  pfAge: 'Idade',
  pfProjectedCol: 'Poupado',
  pfAccountsSection: 'Contas associadas',
  pfAddAccounts: 'Associar contas',
  pfNoAccounts: 'Associe as suas contas de pensão e poupança para ver a previsão',
  pfBasketPension: 'Pensão',
  pfBasketCapital: 'Capital',
  pfAssumptions: 'Pressupostos',
  pfReturn: 'Retorno anual',
  pfCoef: 'Coeficiente de renda',
  pfCoefHint: 'Retire do relatório do seu fundo (padrão 200)',
  pfMonthlyDeposit: 'Depósito mensal',
  pfAuto: 'auto',
  pfResetAuto: 'Voltar ao auto',
  pfFamily: 'Família',
  pfAddProfile: 'Novo perfil',
  pfProfileName: 'Nome',
  pfBirthYear: 'Ano de nascimento',
  pfBirthYearInvalid: 'Introduza um ano entre 1930 e 2015',
  pfAlreadyEligible: 'Idade de reforma atingida — a mostrar poupança atual',
  pfDeleteProfile: 'Eliminar perfil?',
  pfDisclaimer: 'Estimativa com base nos seus pressupostos (anos inteiros, sem comissões/inflação/impostos). Não constitui aconselhamento financeiro ou de pensões.',
```

`ar.ts`:

```ts
  // توقعات التقاعد
  pfTitle: 'توقعات التقاعد',
  pfTeaser: 'اكتشف معاشك المستقبلي',
  pfSetup: 'إعداد',
  pfRetireAge: 'سن التقاعد',
  pfSavedBy: 'المدخرات حتى سن {age}',
  pfAnnuity: 'معاش شهري',
  pfPerMonth: '/شهر',
  pfCapital: 'رأس مال (دفعة واحدة)',
  pfCompare: 'مقارنة الأعمار',
  pfAge: 'العمر',
  pfProjectedCol: 'المدخرات',
  pfAccountsSection: 'حسابات مرتبطة',
  pfAddAccounts: 'ربط حسابات',
  pfNoAccounts: 'اربط حسابات التقاعد والادخار لرؤية التوقعات',
  pfBasketPension: 'تقاعد',
  pfBasketCapital: 'رأس مال',
  pfAssumptions: 'افتراضات',
  pfReturn: 'عائد سنوي',
  pfCoef: 'معامل المعاش',
  pfCoefHint: 'خذه من تقرير الصندوق (الافتراضي 200)',
  pfMonthlyDeposit: 'إيداع شهري',
  pfAuto: 'تلقائي',
  pfResetAuto: 'العودة للتلقائي',
  pfFamily: 'العائلة',
  pfAddProfile: 'ملف جديد',
  pfProfileName: 'الاسم',
  pfBirthYear: 'سنة الميلاد',
  pfBirthYearInvalid: 'أدخل سنة بين 1930 و2015',
  pfAlreadyEligible: 'تم بلوغ سن التقاعد — تُعرض المدخرات الحالية',
  pfDeleteProfile: 'حذف الملف؟',
  pfDisclaimer: 'تقدير مبني على افتراضاتك (سنوات كاملة، بدون رسوم/تضخم/ضرائب). ليس نصيحة مالية أو تقاعدية.',
```

`zh.ts`:

```ts
  // 养老金预测
  pfTitle: '养老金预测',
  pfTeaser: '查看你未来的养老金',
  pfSetup: '设置',
  pfRetireAge: '退休年龄',
  pfSavedBy: '{age}岁时累计',
  pfAnnuity: '月领金额',
  pfPerMonth: '/月',
  pfCapital: '资本（一次性）',
  pfCompare: '年龄对比',
  pfAge: '年龄',
  pfProjectedCol: '累计',
  pfAccountsSection: '已关联账户',
  pfAddAccounts: '关联账户',
  pfNoAccounts: '关联你的养老金和储蓄账户以查看预测',
  pfBasketPension: '养老金',
  pfBasketCapital: '资本',
  pfAssumptions: '假设条件',
  pfReturn: '年化收益率',
  pfCoef: '年金系数',
  pfCoefHint: '请参考基金报告（默认200）',
  pfMonthlyDeposit: '每月存入',
  pfAuto: '自动',
  pfResetAuto: '恢复自动',
  pfFamily: '家庭',
  pfAddProfile: '新建档案',
  pfProfileName: '姓名',
  pfBirthYear: '出生年份',
  pfBirthYearInvalid: '请输入1930到2015之间的年份',
  pfAlreadyEligible: '已达到退休年龄 — 显示当前储蓄',
  pfDeleteProfile: '删除档案？',
  pfDisclaimer: '基于你的假设估算（整年计算，不含费用/通胀/税）。不构成财务或养老建议。',
```

`hi.ts`:

```ts
  // पेंशन पूर्वानुमान
  pfTitle: 'पेंशन पूर्वानुमान',
  pfTeaser: 'अपनी भविष्य की पेंशन देखें',
  pfSetup: 'सेट करें',
  pfRetireAge: 'सेवानिवृत्ति आयु',
  pfSavedBy: '{age} की आयु तक बचत',
  pfAnnuity: 'मासिक पेंशन',
  pfPerMonth: '/माह',
  pfCapital: 'पूंजी (एकमुश्त)',
  pfCompare: 'आयु तुलना',
  pfAge: 'आयु',
  pfProjectedCol: 'बचत',
  pfAccountsSection: 'जुड़े खाते',
  pfAddAccounts: 'खाते जोड़ें',
  pfNoAccounts: 'पूर्वानुमान देखने के लिए पेंशन और बचत खाते जोड़ें',
  pfBasketPension: 'पेंशन',
  pfBasketCapital: 'पूंजी',
  pfAssumptions: 'मान्यताएँ',
  pfReturn: 'वार्षिक रिटर्न',
  pfCoef: 'पेंशन गुणांक',
  pfCoefHint: 'अपने फंड की रिपोर्ट से लें (डिफ़ॉल्ट 200)',
  pfMonthlyDeposit: 'मासिक जमा',
  pfAuto: 'ऑटो',
  pfResetAuto: 'ऑटो पर लौटें',
  pfFamily: 'परिवार',
  pfAddProfile: 'नई प्रोफ़ाइल',
  pfProfileName: 'नाम',
  pfBirthYear: 'जन्म वर्ष',
  pfBirthYearInvalid: '1930 और 2015 के बीच वर्ष दर्ज करें',
  pfAlreadyEligible: 'सेवानिवृत्ति आयु पूरी — वर्तमान बचत दिखाई जा रही है',
  pfDeleteProfile: 'प्रोफ़ाइल हटाएँ?',
  pfDisclaimer: 'आपकी मान्यताओं पर आधारित अनुमान (पूर्ण वर्ष, बिना शुल्क/मुद्रास्फीति/कर)। यह वित्तीय या पेंशन सलाह नहीं है।',
```

`ja.ts`:

```ts
  // 年金予測
  pfTitle: '年金予測',
  pfTeaser: '将来の年金を確認',
  pfSetup: '設定',
  pfRetireAge: '退職年齢',
  pfSavedBy: '{age}歳時点の貯蓄',
  pfAnnuity: '月額年金',
  pfPerMonth: '/月',
  pfCapital: '資本（一時金）',
  pfCompare: '年齢比較',
  pfAge: '年齢',
  pfProjectedCol: '貯蓄額',
  pfAccountsSection: '連携済み口座',
  pfAddAccounts: '口座を連携',
  pfNoAccounts: '年金・貯蓄口座を連携すると予測が表示されます',
  pfBasketPension: '年金',
  pfBasketCapital: '資本',
  pfAssumptions: '前提条件',
  pfReturn: '年間リターン',
  pfCoef: '年金係数',
  pfCoefHint: 'ファンドのレポートから取得（デフォルト200）',
  pfMonthlyDeposit: '毎月の積立',
  pfAuto: '自動',
  pfResetAuto: '自動に戻す',
  pfFamily: '家族',
  pfAddProfile: '新しいプロフィール',
  pfProfileName: '名前',
  pfBirthYear: '生年',
  pfBirthYearInvalid: '1930〜2015の年を入力してください',
  pfAlreadyEligible: '退職年齢に到達 — 現在の貯蓄を表示中',
  pfDeleteProfile: 'プロフィールを削除しますか？',
  pfDisclaimer: '設定した前提に基づく概算です（年単位、手数料・インフレ・税金は考慮せず）。財務・年金アドバイスではありません。',
```

- [ ] **Step 2: Verify no duplicate keys and types pass**

Run: `npx tsc --noEmit`
Expected: clean (duplicate object keys in a TS object literal are a compile error — this is the duplicate check)

- [ ] **Step 3: Commit**

```bash
npx eslint src/i18n --quiet
git add src/i18n
git commit -m "feat(pension): i18n keys x 11 languages"
```

---

### Task 6: PensionForecastScreen + navigation

**Files:**
- Create: `src/screens/PensionForecastScreen.js`
- Modify: `src/navigation/AppNavigator.js` (import block ~line 33; `DashboardStackScreen` list ~line 66)

**Interfaces:**
- Consumes: `dataService.getPensionProfiles/savePensionProfiles/getAccounts/getTransactions`; `forecastProfile`, `forecastFamily`, `DEFAULT_ANNUAL_RETURN_PCT`, `DEFAULT_ANNUITY_COEF` from `../utils/pensionForecast`; `Card`, `ConfirmModal`, `SwipeModal`, `RowText` components; `sym()`; `i18n`.
- Produces: route name `'PensionForecast'` in the Dashboard stack (used by Task 7 teaser).

- [ ] **Step 1: Create the screen**

Create `src/screens/PensionForecastScreen.js` with exactly:

```jsx
// src/screens/PensionForecastScreen.js
// Пенсионный прогноз: профили по людям, две корзины (кицва/капитал),
// степпер возраста + сравнение возрастов. Математика — utils/pensionForecast.
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Amount from '../components/Amount';
import Card from '../components/Card';
import ConfirmModal from '../components/ConfirmModal';
import RowText from '../components/RowText';
import SwipeModal from '../components/SwipeModal';
import i18n from '../i18n';
import dataService from '../services/dataService';
import { colors } from '../theme/colors';
import { sym } from '../utils/currency';
import {
  DEFAULT_ANNUAL_RETURN_PCT, DEFAULT_ANNUITY_COEF,
  forecastFamily, forecastProfile,
} from '../utils/pensionForecast';

const AGE_MIN = 55;
const AGE_MAX = 75;
const genId = () => `pp_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export default function PensionForecastScreen() {
  const navigation = useNavigation();
  const [profiles, setProfiles] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [selectedId, setSelectedId] = useState(null); // profile id | 'family'
  const [assumptionsOpen, setAssumptionsOpen] = useState(false);
  // profile create/edit modal
  const [showEdit, setShowEdit] = useState(false);
  const [editId, setEditId] = useState(null);
  const [name, setName] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [links, setLinks] = useState([]); // draft [{accountId, basket}]
  const [yearErr, setYearErr] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  // deposit override editing
  const [overrideDraft, setOverrideDraft] = useState(null); // string | null
  const st = createSt();

  const loadData = async () => {
    const [pp, accs, txs] = await Promise.all([
      dataService.getPensionProfiles(),
      dataService.getAccounts(),
      dataService.getTransactions(),
    ]);
    setProfiles(pp);
    setAccounts(accs);
    setTransactions(txs);
    setSelectedId(prev => prev && (prev === 'family' || pp.find(p => p.id === prev)) ? prev : (pp[0]?.id || null));
  };
  useFocusEffect(useCallback(() => { loadData(); }, []));

  const investAccounts = accounts.filter(a => a.type === 'investment' && a.isActive !== false);
  const accName = (id) => accounts.find(a => a.id === id)?.name || '?';
  const selected = selectedId === 'family' ? null : profiles.find(p => p.id === selectedId);

  // Persist profiles + prune links to accounts that no longer exist.
  const persist = async (next) => {
    const accIds = new Set(accounts.map(a => a.id));
    const pruned = next.map(p => ({ ...p, links: (p.links || []).filter(l => accIds.has(l.accountId)) }));
    setProfiles(pruned);
    await dataService.savePensionProfiles(pruned);
  };

  const patchSelected = (patch) => {
    if (!selected) return;
    persist(profiles.map(p => p.id === selected.id ? { ...p, ...patch } : p));
  };

  // ── profile modal ──
  const openAdd = () => {
    setEditId(null); setName(''); setBirthYear(''); setLinks([]); setYearErr(false);
    setShowEdit(true);
  };
  const openEdit = (p) => {
    setEditId(p.id); setName(p.name); setBirthYear(String(p.birthYear));
    setLinks((p.links || []).map(l => ({ ...l }))); setYearErr(false);
    setShowEdit(true);
  };
  const saveProfile = () => {
    const year = parseInt(birthYear, 10);
    if (!Number.isFinite(year) || year < 1930 || year > 2015) { setYearErr(true); return; }
    if (!name.trim()) return;
    if (editId) {
      persist(profiles.map(p => p.id === editId ? { ...p, name: name.trim(), birthYear: year, links } : p));
    } else {
      const p = {
        id: genId(), name: name.trim(), birthYear: year, retireAge: 67,
        links, createdAt: new Date().toISOString(),
      };
      persist([...profiles, p]);
      setSelectedId(p.id);
    }
    setShowEdit(false);
  };
  const confirmDelete = () => {
    const rest = profiles.filter(p => p.id !== deleteTarget.id);
    persist(rest);
    setDeleteTarget(null); setShowEdit(false);
    setSelectedId(rest[0]?.id || null);
  };
  const toggleDraftLink = (accountId) => {
    setLinks(prev => {
      const found = prev.find(l => l.accountId === accountId);
      if (!found) return [...prev, { accountId, basket: 'pension' }];
      return prev.filter(l => l.accountId !== accountId);
    });
  };
  const toggleDraftBasket = (accountId) => {
    setLinks(prev => prev.map(l => l.accountId === accountId
      ? { ...l, basket: l.basket === 'pension' ? 'capital' : 'pension' } : l));
  };

  // ── forecast data ──
  const fam = profiles.length > 0 ? forecastFamily(profiles, accounts, transactions) : null;
  const fc = selected ? forecastProfile(selected, accounts, transactions) : null;
  const compareAges = selected
    ? ([selected.retireAge, 64, 67].filter((v, i, a) => a.indexOf(v) === i).length === 3
        ? [selected.retireAge, 64, 67].sort((a, b) => a - b)
        : [60, 64, 67])
    : [];

  const basketBadge = (basket) => (
    <View style={[st.badge, { backgroundColor: basket === 'pension' ? `${colors.green}22` : `${colors.blue}22` }]}>
      <Text style={[st.badgeTxt, { color: basket === 'pension' ? colors.green : colors.blue }]}>
        {i18n.t(basket === 'pension' ? 'pfBasketPension' : 'pfBasketCapital')}
      </Text>
    </View>
  );

  // retireAge === null → family view (no single age to show)
  const renderResult = (r, retireAge, alreadyEligible) => (
    <Card>
      <Text style={st.resultLabel}>
        {retireAge == null ? i18n.t('pfFamily') : i18n.t('pfSavedBy').replace('{age}', String(retireAge))}
      </Text>
      <Amount value={r.pension.projected + r.capital.projected} style={st.resultTotal} numberOfLines={1} adjustsFontSizeToFit />
      {alreadyEligible && <Text style={st.eligibleNote}>{i18n.t('pfAlreadyEligible')}</Text>}
      <View style={st.basketRow}>
        <View style={[st.dot, { backgroundColor: colors.green }]} />
        <RowText style={st.basketLabel}>{i18n.t('pfAnnuity')}</RowText>
        <Text style={st.basketValue}>~{r.pension.annuity.toLocaleString()} {sym()}{i18n.t('pfPerMonth')}</Text>
      </View>
      <View style={st.basketRow}>
        <View style={[st.dot, { backgroundColor: colors.blue }]} />
        <RowText style={st.basketLabel}>{i18n.t('pfCapital')}</RowText>
        <Text style={st.basketValue}>{r.capital.projected.toLocaleString()} {sym()}</Text>
      </View>
    </Card>
  );

  return (
    <View style={st.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={st.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={st.backBtn}>
            <Feather name={i18n.backIcon()} size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={st.title}>{i18n.t('pfTitle')}</Text>
          <View style={{ width: 44 }} />
        </View>

        {/* Profile chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.chipsRow}>
          {profiles.map(p => (
            <TouchableOpacity key={p.id} style={[st.chip, selectedId === p.id && st.chipActive]}
              onPress={() => setSelectedId(p.id)} onLongPress={() => openEdit(p)} delayLongPress={350}>
              <Text style={[st.chipTxt, selectedId === p.id && st.chipTxtActive]}>{p.name}</Text>
            </TouchableOpacity>
          ))}
          {profiles.length >= 2 && (
            <TouchableOpacity style={[st.chip, selectedId === 'family' && st.chipActive]} onPress={() => setSelectedId('family')}>
              <Text style={[st.chipTxt, selectedId === 'family' && st.chipTxtActive]}>{i18n.t('pfFamily')}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={st.chipAdd} onPress={openAdd}>
            <Feather name="plus" size={16} color={colors.green} />
          </TouchableOpacity>
        </ScrollView>

        {profiles.length === 0 && (
          <Card>
            <View style={st.empty}>
              <Feather name="umbrella" size={44} color={colors.textMuted} />
              <Text style={st.emptyTitle}>{i18n.t('pfTeaser')}</Text>
              <TouchableOpacity style={st.setupBtn} onPress={openAdd}>
                <Text style={st.setupBtnTxt}>{i18n.t('pfAddProfile')}</Text>
              </TouchableOpacity>
            </View>
          </Card>
        )}

        {/* ── Family view ── */}
        {selectedId === 'family' && fam && renderResult(fam, null, false)}
        {selectedId === 'family' && fam && (
          <Text style={st.familyNote}>{i18n.t('pfDisclaimer')}</Text>
        )}

        {/* ── Single profile ── */}
        {selected && fc && (
          <>
            {/* Age stepper */}
            <Card>
              <View style={st.stepperRow}>
                <RowText style={st.stepperLabel}>{i18n.t('pfRetireAge')}</RowText>
                <View style={st.stepper}>
                  <TouchableOpacity style={st.stepBtn} onPress={() => patchSelected({ retireAge: Math.max(AGE_MIN, selected.retireAge - 1) })}>
                    <Feather name="minus" size={18} color={colors.text} />
                  </TouchableOpacity>
                  <Text style={st.stepVal}>{selected.retireAge}</Text>
                  <TouchableOpacity style={st.stepBtn} onPress={() => patchSelected({ retireAge: Math.min(AGE_MAX, selected.retireAge + 1) })}>
                    <Feather name="plus" size={18} color={colors.text} />
                  </TouchableOpacity>
                </View>
              </View>
            </Card>

            {/* Result */}
            {(selected.links || []).length === 0 ? (
              <Card>
                <View style={st.empty}>
                  <Feather name="link" size={36} color={colors.textMuted} />
                  <Text style={st.emptyText}>{i18n.t('pfNoAccounts')}</Text>
                  <TouchableOpacity style={st.setupBtn} onPress={() => openEdit(selected)}>
                    <Text style={st.setupBtnTxt}>{i18n.t('pfAddAccounts')}</Text>
                  </TouchableOpacity>
                </View>
              </Card>
            ) : (
              <>
                {renderResult(fc, selected.retireAge, fc.alreadyEligible)}

                {/* Comparison table */}
                <Card>
                  <Text style={st.sectionTitle}>{i18n.t('pfCompare')}</Text>
                  <View style={st.tblHead}>
                    <RowText style={[st.tblCell, st.tblHeadTxt]}>{i18n.t('pfAge')}</RowText>
                    <RowText style={[st.tblCell, st.tblHeadTxt, st.tblNum]}>{i18n.t('pfProjectedCol')}</RowText>
                    <RowText style={[st.tblCell, st.tblHeadTxt, st.tblNum]}>{i18n.t('pfAnnuity')}</RowText>
                    <RowText style={[st.tblCell, st.tblHeadTxt, st.tblNum]}>{i18n.t('pfBasketCapital')}</RowText>
                  </View>
                  {compareAges.map(age => {
                    const r = forecastProfile(selected, accounts, transactions, new Date(), age);
                    const isChosen = age === selected.retireAge;
                    return (
                      <View key={age} style={[st.tblRow, isChosen && st.tblRowActive]}>
                        <RowText style={[st.tblCell, isChosen && st.tblCellActive]}>{age}</RowText>
                        <RowText style={[st.tblCell, st.tblNum, isChosen && st.tblCellActive]}>{Math.round(r.pension.projected + r.capital.projected).toLocaleString()}</RowText>
                        <RowText style={[st.tblCell, st.tblNum, isChosen && st.tblCellActive]}>~{r.pension.annuity.toLocaleString()}</RowText>
                        <RowText style={[st.tblCell, st.tblNum, isChosen && st.tblCellActive]}>{r.capital.projected.toLocaleString()}</RowText>
                      </View>
                    );
                  })}
                </Card>
              </>
            )}

            {/* Linked accounts */}
            <Card>
              <View style={st.sectionHead}>
                <RowText style={st.sectionTitle}>{i18n.t('pfAccountsSection')}</RowText>
                <TouchableOpacity onPress={() => openEdit(selected)}>
                  <Feather name="edit-2" size={16} color={colors.textDim} />
                </TouchableOpacity>
              </View>
              {(selected.links || []).filter(l => accounts.find(a => a.id === l.accountId)).map(l => (
                <TouchableOpacity key={l.accountId} style={st.accRow} onPress={() => {
                  patchSelected({ links: selected.links.map(x => x.accountId === l.accountId ? { ...x, basket: x.basket === 'pension' ? 'capital' : 'pension' } : x) });
                }}>
                  <RowText style={st.accName}>{accName(l.accountId)}</RowText>
                  {basketBadge(l.basket)}
                </TouchableOpacity>
              ))}
            </Card>

            {/* Assumptions (collapsed) */}
            <Card>
              <TouchableOpacity style={st.sectionHead} onPress={() => setAssumptionsOpen(v => !v)}>
                <RowText style={st.sectionTitle}>{i18n.t('pfAssumptions')}</RowText>
                <Feather name={assumptionsOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textDim} />
              </TouchableOpacity>
              {assumptionsOpen && (
                <>
                  {/* Annual return stepper 0–10 step 0.5 */}
                  <View style={st.stepperRow}>
                    <RowText style={st.assumpLabel}>{i18n.t('pfReturn')}</RowText>
                    <View style={st.stepper}>
                      <TouchableOpacity style={st.stepBtn} onPress={() => patchSelected({ annualReturnPct: Math.max(0, (selected.annualReturnPct ?? DEFAULT_ANNUAL_RETURN_PCT) - 0.5) })}>
                        <Feather name="minus" size={16} color={colors.text} />
                      </TouchableOpacity>
                      <Text style={st.stepVal}>{(selected.annualReturnPct ?? DEFAULT_ANNUAL_RETURN_PCT).toFixed(1)}%</Text>
                      <TouchableOpacity style={st.stepBtn} onPress={() => patchSelected({ annualReturnPct: Math.min(10, (selected.annualReturnPct ?? DEFAULT_ANNUAL_RETURN_PCT) + 0.5) })}>
                        <Feather name="plus" size={16} color={colors.text} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Annuity coefficient */}
                  <View style={st.stepperRow}>
                    <RowText style={st.assumpLabel}>{i18n.t('pfCoef')}</RowText>
                    <TextInput
                      style={[st.coefInput, { textAlign: 'center' }]}
                      keyboardType="numeric"
                      defaultValue={String(selected.annuityCoef ?? DEFAULT_ANNUITY_COEF)}
                      onEndEditing={(e) => {
                        const v = parseFloat((e.nativeEvent.text || '').replace(',', '.'));
                        patchSelected({ annuityCoef: Number.isFinite(v) && v > 0 ? v : DEFAULT_ANNUITY_COEF });
                      }}
                    />
                  </View>
                  <Text style={st.hint}>{i18n.t('pfCoefHint')}</Text>

                  {/* Monthly deposit: auto value + override */}
                  <View style={st.stepperRow}>
                    <RowText style={st.assumpLabel}>{i18n.t('pfMonthlyDeposit')}</RowText>
                    {selected.monthlyOverride == null && overrideDraft == null ? (
                      <TouchableOpacity style={st.autoRow} onPress={() => setOverrideDraft(String(fc.monthlyAuto.pension + fc.monthlyAuto.capital))}>
                        <Text style={st.autoVal}>{(fc.monthlyAuto.pension + fc.monthlyAuto.capital).toLocaleString()} {sym()} · {i18n.t('pfAuto')}</Text>
                        <Feather name="edit-2" size={14} color={colors.textDim} />
                      </TouchableOpacity>
                    ) : (
                      <TextInput
                        style={[st.coefInput, { textAlign: 'center' }]}
                        keyboardType="numeric"
                        autoFocus={overrideDraft != null}
                        defaultValue={overrideDraft ?? String(selected.monthlyOverride)}
                        onEndEditing={(e) => {
                          const v = parseFloat((e.nativeEvent.text || '').replace(',', '.'));
                          setOverrideDraft(null);
                          patchSelected({ monthlyOverride: Number.isFinite(v) && v >= 0 ? v : null });
                        }}
                      />
                    )}
                  </View>
                  {selected.monthlyOverride != null && (
                    <TouchableOpacity onPress={() => { setOverrideDraft(null); patchSelected({ monthlyOverride: null }); }}>
                      <Text style={st.resetAuto}>{i18n.t('pfResetAuto')}</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </Card>

            <Text style={st.disclaimer}>{i18n.t('pfDisclaimer')}</Text>
          </>
        )}
      </ScrollView>

      {/* Profile create/edit modal */}
      <SwipeModal visible={showEdit} onClose={() => setShowEdit(false)}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={st.modalTitle}>{editId ? i18n.t('edit') : i18n.t('pfAddProfile')}</Text>

          <Text style={st.fieldLabel}>{i18n.t('pfProfileName')}</Text>
          <TextInput style={[st.input, { textAlign: i18n.textAlign() }]} value={name} onChangeText={setName}
            placeholder={i18n.t('pfProfileName')} placeholderTextColor={colors.textMuted} />

          <Text style={st.fieldLabel}>{i18n.t('pfBirthYear')}</Text>
          <TextInput style={[st.input, { textAlign: i18n.textAlign() }, yearErr && st.inputErr]} value={birthYear}
            onChangeText={(v) => { setBirthYear(v); setYearErr(false); }}
            keyboardType="numeric" placeholder="1980" placeholderTextColor={colors.textMuted} maxLength={4} />
          {yearErr && <Text style={st.errTxt}>{i18n.t('pfBirthYearInvalid')}</Text>}

          <Text style={st.fieldLabel}>{i18n.t('pfAccountsSection')}</Text>
          {investAccounts.map(a => {
            const link = links.find(l => l.accountId === a.id);
            return (
              <View key={a.id} style={st.pickRow}>
                <TouchableOpacity style={st.pickLeft} onPress={() => toggleDraftLink(a.id)}>
                  <Feather name={link ? 'check-square' : 'square'} size={20} color={link ? colors.green : colors.textMuted} />
                  <RowText style={st.accName}>  {a.name}</RowText>
                </TouchableOpacity>
                {link && (
                  <TouchableOpacity onPress={() => toggleDraftBasket(a.id)}>
                    {basketBadge(link.basket)}
                  </TouchableOpacity>
                )}
              </View>
            );
          })}

          <TouchableOpacity style={st.saveBtn} onPress={saveProfile}>
            <Text style={st.saveBtnTxt}>{i18n.t('save')}</Text>
          </TouchableOpacity>
          {editId && (
            <TouchableOpacity style={st.deleteBtn} onPress={() => setDeleteTarget(profiles.find(p => p.id === editId))}>
              <Text style={st.deleteBtnTxt}>{i18n.t('delete')}</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </SwipeModal>

      <ConfirmModal
        visible={!!deleteTarget}
        title={i18n.t('pfDeleteProfile')}
        message={deleteTarget?.name}
        confirmText={i18n.t('delete')}
        cancelText={i18n.t('cancel')}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </View>
  );
}

const createSt = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: i18n.row(), alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 60, paddingBottom: 12 },
  backBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.cardBorder },
  title: { color: colors.text, fontSize: 22, fontWeight: '800' },

  chipsRow: { flexDirection: i18n.row(), gap: 8, paddingHorizontal: 20, paddingBottom: 12, alignItems: 'center' },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder },
  chipActive: { backgroundColor: colors.green, borderColor: colors.green },
  chipTxt: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
  chipTxtActive: { color: colors.bg, fontWeight: '700' },
  chipAdd: { width: 34, height: 34, borderRadius: 17, backgroundColor: `${colors.green}18`, justifyContent: 'center', alignItems: 'center' },

  empty: { alignItems: 'center', paddingVertical: 24, gap: 10 },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  emptyText: { color: colors.textMuted, fontSize: 13, textAlign: 'center', paddingHorizontal: 12 },
  setupBtn: { backgroundColor: colors.green, paddingHorizontal: 22, paddingVertical: 10, borderRadius: 12, marginTop: 4 },
  setupBtnTxt: { color: colors.bg, fontSize: 14, fontWeight: '700' },

  stepperRow: { flexDirection: i18n.row(), alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  stepperLabel: { color: colors.text, fontSize: 15, fontWeight: '600' },
  assumpLabel: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
  stepper: { flexDirection: i18n.row(), alignItems: 'center', gap: 10, backgroundColor: colors.bg, borderRadius: 12, paddingHorizontal: 6, paddingVertical: 4, borderWidth: 1, borderColor: colors.cardBorder },
  stepBtn: { width: 34, height: 34, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  stepVal: { color: colors.text, fontSize: 16, fontWeight: '800', minWidth: 44, textAlign: 'center' },

  resultLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '600', textAlign: i18n.textAlign() },
  resultTotal: { color: colors.text, fontSize: 30, fontWeight: '800', marginVertical: 6, textAlign: i18n.textAlign() },
  eligibleNote: { color: colors.orange, fontSize: 12, marginBottom: 6, textAlign: i18n.textAlign() },
  basketRow: { flexDirection: i18n.row(), alignItems: 'center', gap: 8, paddingVertical: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  basketLabel: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
  basketValue: { color: colors.text, fontSize: 15, fontWeight: '700' },

  sectionHead: { flexDirection: i18n.row(), alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: '700', marginBottom: 8, textAlign: i18n.textAlign() },
  tblHead: { flexDirection: i18n.row(), borderBottomWidth: 1, borderBottomColor: colors.divider, paddingBottom: 6 },
  tblHeadTxt: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  tblRow: { flexDirection: i18n.row(), paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.divider },
  tblRowActive: { backgroundColor: `${colors.green}0E`, borderRadius: 8 },
  tblCell: { flexBasis: 0, flexGrow: 1, color: colors.textDim, fontSize: 12 },
  tblNum: { textAlign: 'center' },
  tblCellActive: { color: colors.text, fontWeight: '700' },

  accRow: { flexDirection: i18n.row(), alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.divider },
  accName: { color: colors.text, fontSize: 14, fontWeight: '500' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeTxt: { fontSize: 11, fontWeight: '700' },

  hint: { color: colors.textMuted, fontSize: 11, marginTop: 2, marginBottom: 6, textAlign: i18n.textAlign() },
  coefInput: { backgroundColor: colors.bg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, color: colors.text, fontSize: 15, fontWeight: '700', borderWidth: 1, borderColor: colors.cardBorder, minWidth: 90 },
  autoRow: { flexDirection: i18n.row(), alignItems: 'center', gap: 8 },
  autoVal: { color: colors.text, fontSize: 14, fontWeight: '700' },
  resetAuto: { color: colors.green, fontSize: 12, fontWeight: '600', marginTop: 4, textAlign: i18n.textAlign() },

  familyNote: { color: colors.textMuted, fontSize: 11, marginHorizontal: 24, marginTop: 8, textAlign: i18n.textAlign() },
  disclaimer: { color: colors.textMuted, fontSize: 11, marginHorizontal: 24, marginTop: 8, lineHeight: 16, textAlign: i18n.textAlign() },

  modalTitle: { color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: 16, textAlign: i18n.textAlign() },
  fieldLabel: { color: colors.textDim, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 4, marginTop: 10, textAlign: i18n.textAlign() },
  input: { backgroundColor: colors.bg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: colors.text, fontSize: 15, borderWidth: 1, borderColor: colors.cardBorder },
  inputErr: { borderColor: colors.red },
  errTxt: { color: colors.red, fontSize: 11, marginTop: 4, textAlign: i18n.textAlign() },
  pickRow: { flexDirection: i18n.row(), alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.divider },
  pickLeft: { flexDirection: i18n.row(), alignItems: 'center', flexShrink: 1 },
  saveBtn: { backgroundColor: colors.green, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 18 },
  saveBtnTxt: { color: colors.bg, fontSize: 16, fontWeight: '700' },
  deleteBtn: { paddingVertical: 12, alignItems: 'center' },
  deleteBtnTxt: { color: colors.red, fontSize: 14, fontWeight: '600' },
});
```

- [ ] **Step 2: Register the route**

In `src/navigation/AppNavigator.js`:

a) Add to the import block (after the `AnalyticsScreen` import):

```js
import PensionForecastScreen from '../screens/PensionForecastScreen';
```

b) In `DashboardStackScreen`, after the `Investments` screen line add:

```jsx
      <DashboardStack.Screen name="PensionForecast" component={PensionForecastScreen} />
```

- [ ] **Step 3: Verify tsc + eslint**

```bash
npx tsc --noEmit
npx eslint src/screens/PensionForecastScreen.js src/navigation/AppNavigator.js --quiet
```

Expected: both clean.

- [ ] **Step 4: Commit**

```bash
git add src/screens/PensionForecastScreen.js src/navigation/AppNavigator.js
git commit -m "feat(pension): PensionForecastScreen with profiles, stepper, comparison table"
```

---

### Task 7: Teaser card on InvestmentsScreen

**Files:**
- Modify: `src/screens/InvestmentsScreen.js` (imports ~line 14; `loadData` ~line 38; JSX right after the `totalCard` Card ~line 224; styles at the bottom of `createStyles`)

**Interfaces:**
- Consumes: route `'PensionForecast'` (Task 6), `dataService.getPensionProfiles`, `forecastProfile` (Task 4).

- [ ] **Step 1: Wire data**

a) Add import after the `sym` import:

```js
import { forecastProfile } from '../utils/pensionForecast';
```

b) Add state after `const [transactions, setTransactions] = useState([]);`:

```js
  const [pensionProfiles, setPensionProfiles] = useState([]);
```

c) In `loadData`, extend the `Promise.all` to also fetch profiles:

```js
    const [inv, accs, txs, pp] = await Promise.all([
      dataService.getInvestments(),
      dataService.getAccounts(),
      dataService.getTransactions(),
      dataService.getPensionProfiles(),
    ]);
```

and after `setTransactions(txs);` add:

```js
    setPensionProfiles(pp);
```

NOTE: `invAccounts` is filtered to active accounts, but the forecast needs
raw accounts — add alongside the existing `setInvAccounts(...)` line:

```js
    setAllAccounts(accs);
```

with state:

```js
  const [allAccounts, setAllAccounts] = useState([]);
```

- [ ] **Step 2: Render the teaser card**

Insert right AFTER the closing `</Card>` of the `totalCard` block (the one containing `totalInvested` / `monthlyContribution`):

```jsx
        {/* Pension forecast teaser */}
        <Card style={{ marginHorizontal: 20 }}>
          <TouchableOpacity onPress={() => navigation.navigate('PensionForecast')} activeOpacity={0.7}>
            <View style={styles.pfHead}>
              <Feather name="umbrella" size={18} color={colors.green} />
              <RowText style={styles.pfTitle}>{i18n.t('pfTitle')}</RowText>
              <Feather name={i18n.chevronRight()} size={18} color={colors.textMuted} />
            </View>
            {pensionProfiles.length === 0 ? (
              <View style={styles.pfEmptyRow}>
                <RowText style={styles.pfEmptyTxt}>{i18n.t('pfTeaser')}</RowText>
                <View style={styles.pfSetupBtn}><Text style={styles.pfSetupTxt}>{i18n.t('pfSetup')}</Text></View>
              </View>
            ) : (
              pensionProfiles.map(p => {
                const f = forecastProfile(p, allAccounts, transactions);
                return (
                  <View key={p.id} style={styles.pfRow}>
                    <RowText style={styles.pfName}>{p.name} · {p.retireAge}</RowText>
                    <Text style={styles.pfVal}>~{f.pension.annuity.toLocaleString()} {sym()}{i18n.t('pfPerMonth')}</Text>
                  </View>
                );
              })
            )}
          </TouchableOpacity>
        </Card>
```

Also add `RowText` to the component imports:

```js
import RowText from '../components/RowText';
```

- [ ] **Step 3: Add styles**

At the end of the `createStyles` StyleSheet object add:

```js
  pfHead: { flexDirection: i18n.row(), alignItems: 'center', gap: 8, marginBottom: 6 },
  pfTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  pfEmptyRow: { flexDirection: i18n.row(), alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  pfEmptyTxt: { color: colors.textMuted, fontSize: 13, flexShrink: 1 },
  pfSetupBtn: { backgroundColor: `${colors.green}18`, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10 },
  pfSetupTxt: { color: colors.green, fontSize: 13, fontWeight: '700' },
  pfRow: { flexDirection: i18n.row(), alignItems: 'center', justifyContent: 'space-between', paddingVertical: 5 },
  pfName: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
  pfVal: { color: colors.text, fontSize: 14, fontWeight: '700' },
```

(If `createStyles` in this file is NOT already a factory taking i18n into account, keep the existing pattern of the file — the styles above use `i18n.row()` so they must live inside the per-render factory like the rest of the screen.)

- [ ] **Step 4: Verify + commit**

```bash
npx tsc --noEmit
npx eslint src/screens/InvestmentsScreen.js --quiet
git add src/screens/InvestmentsScreen.js
git commit -m "feat(pension): forecast teaser card on Investments screen"
```

---

### Task 8: Full verification + docs

**Files:**
- Modify: `FEATURES.md` (new section after "Investments")

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: all suites pass (421 baseline + new pensionForecast + extended dataService tests).

- [ ] **Step 2: tsc + eslint over everything changed**

```bash
npx tsc --noEmit
npx eslint src/utils/pensionForecast.ts src/services/dataService.ts src/types/index.ts src/screens/PensionForecastScreen.js src/screens/InvestmentsScreen.js src/navigation/AppNavigator.js src/i18n --quiet
```

Expected: clean.

- [ ] **Step 3: Add FEATURES.md section**

After the `## Investments` section add:

```markdown
## Pension forecast

Per-person retirement projection built from real account balances and
deposit history.

- Profiles (e.g. two spouses) with birth year and retirement age; a
  Family view sums all profiles
- Two baskets per profile: pension (monthly annuity) and capital
  (hishtalmut/gemel — lump sum)
- Monthly deposits auto-averaged from the last 3 full months of
  transactions, manual override supported
- Age stepper (55–75) with live recompute + 3-age comparison table
- Editable assumptions: annual return %, annuity coefficient
- Explicitly an estimate — not financial/pension advice (disclaimer)
```

(Also add `Pension forecast` to the table of contents list, renumbering the
entries after Investments.)

- [ ] **Step 4: Manual smoke checklist (device/emulator, Metro)**

1. Investments → teaser card visible with «Настроить» CTA.
2. Create profile (name + birth year + link accounts with baskets) → result card shows.
3. Move age stepper → numbers change; comparison table highlights chosen age.
4. Assumptions: change return % and coefficient → annuity changes.
5. Override deposit → forecast changes; «Вернуть авто» restores.
6. Second profile → Family chip appears, totals sum.
7. Hebrew UI: RTL rows flip, text right-aligned.

- [ ] **Step 5: Commit**

```bash
git add FEATURES.md
git commit -m "docs: pension forecast section in FEATURES.md"
```
