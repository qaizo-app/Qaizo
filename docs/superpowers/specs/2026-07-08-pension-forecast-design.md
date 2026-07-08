# Pension Forecast — Design

**Date:** 2026-07-08
**Status:** Approved by user (chat), pending spec review
**Owner:** Sean (services/math) + Alex (UI)

## Problem

Users accumulate pension savings across several accounts (pension funds,
keren hishtalmut, kupat gemel) but have no idea what monthly annuity
(кицва / קצבה) that translates to, or what early retirement costs. The
app already knows the balances and the real monthly deposits — turning
them into a forecast is cheap for the user and high-value.

This is the first slice of the backlog item "Pension/insurance
optimization advisor" (Priority 4), deliberately scoped down to a
calculator — **not** an advisor.

## Decisions made with the user

1. **Per-person profiles** (e.g. Алекс, Алекса), each with its own birth
   year, retirement age and linked accounts, **plus a Family view** that
   sums the results of all profiles.
2. **Two baskets** per profile: `pension` (feeds the monthly annuity) and
   `capital` (hishtalmut/gemel — paid out as a lump sum, no annuity).
3. **Contributions:** auto-computed from real transactions (average of
   the last 3 full months per basket) with a manual override.
4. **Scenario UX:** an age stepper that recalculates live + a 3-age
   comparison table so the cost of each early year is visible.
5. **Placement:** separate screen (`PensionForecastScreen`) reached from
   a teaser card on the Investments screen (approach A).

## Non-goals

- No fund recommendations, no fee comparison, no "switch to fund X" —
  pension *advice* is a licensed activity in Israel. This is a calculator
  over user-entered assumptions, with an explicit disclaimer.
- No actuarial precision: no fees, no inflation adjustment, no tax, no
  birth-month precision, no gender-specific annuity coefficients. The
  annuity coefficient is a single editable number (default 200) the user
  can copy from their fund statement.
- No employer/employee split — one monthly deposit figure per basket.
- Multi-currency conversion: linked account balances are summed as-is
  (the user's pension accounts are all ₪; revisit if that changes).

## Data model

New Firestore single-doc collection `pensionProfiles` (same pattern as
`goals` / `projects`), holding an array:

```ts
// src/types/index.ts
export type PensionBasket = 'pension' | 'capital';

export interface PensionAccountLink {
  accountId: string;
  basket: PensionBasket;
}

export interface PensionProfile {
  id: string;
  name: string;                    // 'Алекс'
  birthYear: number;               // 1980
  retireAge: number;               // persisted stepper value, 55–75
  annualReturnPct?: number;        // default 4 (percent, annual)
  annuityCoef?: number;            // default 200
  monthlyOverride?: number | null; // ₪/month; null/undefined → auto
  links: PensionAccountLink[];
  createdAt?: string;
}
```

- `dataService.getPensionProfiles(): Promise<PensionProfile[]>` /
  `savePensionProfiles(profiles)` — `getDocData`/`setDocData` like goals.
- Added to `exportData`, `importData` and `clearAllData` single-doc list.
- Balances are **never** duplicated into the profile — always read live
  from the linked accounts at render time. A link whose `accountId` no
  longer resolves to an existing account is ignored at compute time
  (and pruned on next save).

## Math — `src/utils/pensionForecast.ts` (pure, fully tested)

```ts
monthlyRate(annualPct)           // (1 + pct/100)^(1/12) - 1
projectSavings(balance, monthlyDeposit, months, annualPct) // FV
  // FV = balance*(1+r)^n + deposit*((1+r)^n - 1)/r ; r=0 → balance + deposit*n
avgMonthlyDeposit(transactions, accountIds, now)
  // mean of the last 3 FULL months of type==='income' transactions
  // (includes transfer income legs) landing on the linked accounts
forecastProfile(profile, accounts, transactions, now) → {
  currentAge, months,
  pension: { current, projected, annuity },   // annuity = projected / coef
  capital: { current, projected },            // lump sum
  monthlyAuto: { pension, capital },          // pre-override figures
}
forecastFamily(profiles, accounts, transactions, now)
  // per-profile forecastProfile at each profile's own retireAge, summed
```

Rules:

- `currentAge = now.getFullYear() - birthYear` (no birth month — stated
  in the disclaimer).
- `months = (retireAge - currentAge) * 12`; if `months <= 0` the profile
  is "already eligible": projected = current balances, annuity computed
  from the current pension basket, UI shows an "already possible" note.
- Annuity rounded to whole ₪; projections rounded to whole ₪.
- `monthlyOverride` (when set) replaces the **total** auto deposit and is
  split between baskets proportionally to their auto shares (all to
  pension when both auto shares are 0).

## UI

### Teaser card — InvestmentsScreen

Under the "Всего вложено" summary card:

- No profiles → icon + "Узнай свою будущую кицву" + button «Настроить»
  → navigates to the screen (which opens the create-profile modal).
- Profiles exist → one row per profile: `Алекс · 62 → ~6 700 ₪/мес`,
  whole card taps into the screen.

### PensionForecastScreen (Dashboard stack)

Top to bottom:

1. **Profile chips:** `Алекс | Алекса | Семья | +`. Family chip appears
   automatically at 2+ profiles. Long-press a profile chip → edit modal.
2. **Age stepper** `−  62  +` (55–75). No slider — the project has no
   slider dependency and adding a native module for this isn't worth it;
   the stepper matches the reminder-hours pattern in Settings.
3. **Result card:** "Накоплено к 62: 1 340 000 ₪" + two basket rows:
   pension → "Кицва: ~6 700 ₪/мес", capital → "Капитал: 420 000 ₪
   разово". Live recompute on every change.
4. **Comparison table:** rows for {chosen, 64, 67} (deduped; if chosen
   is 64 or 67 → {60, 64, 67}); columns: age, projected, annuity,
   capital.
5. **Accounts section:** linked accounts with a basket badge (tap badge
   to toggle basket), «+ Добавить» opens a checkbox list of
   investment-type accounts (active only).
6. **Assumptions section (collapsed by default):** return % stepper
   (0–10, step 0.5), annuity coefficient input (hint: "возьми из отчёта
   фонда"), monthly deposit row showing the auto figure with a pencil →
   manual override + "вернуть авто" reset.
7. **Disclaimer** (muted text): estimate based on user assumptions; not
   financial or pension advice.

### Profile create/edit modal

Name, birth year (numeric input, validated 1930–2015), account picker
with per-account basket toggle. Delete profile from the edit modal
(ConfirmModal, per project rules). Family view has no settings of its
own — it renders summed results + a summed comparison table only.

### Project rules that apply

- `createSt()` StyleSheet factory, `i18n.row()` for all rows, `RowText`
  for flex:1 text in rows, header icon groups flip in RTL.
- All strings via i18n × 11 languages (~20 new keys), RU/HE/EN written
  carefully, the rest translated.
- Currency symbol via `sym()`.
- `ConfirmModal` for profile deletion.

## Edge cases

- No profiles → teaser CTA; no linked accounts in a profile → result
  card shows a "привяжи счета" empty state instead of zeros.
- `retireAge <= currentAge` → "выход уже возможен" state (see Math).
- Zero/absent contributions → forecast from balances alone (valid).
- Annual return 0 → linear formula branch (no division by zero).
- Deleted/inactive linked accounts → ignored at compute, pruned on save.
- Birth year outside 1930–2015 → validation error in the modal.

## Testing

- `__tests__/pensionForecast.test.js`: FV against hand-computed values,
  r=0 branch, months<=0 branch, annuity = projected/coef, auto deposit
  from 3 full months (transfer legs included, current month excluded),
  override replacing auto + proportional split, family summation,
  missing-account links ignored.
- `__tests__/dataService.firestore.test.js`: pensionProfiles present in
  export/import/clearAllData.
- UI screens/modals — no tests (project convention).

## Rollout

Ships in the next preview APK after implementation; no migration needed
(absent doc → empty array → teaser CTA).
