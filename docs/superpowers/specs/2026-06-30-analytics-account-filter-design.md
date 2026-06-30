# Analytics Account Filter — Design

**Date:** 2026-06-30
**Component:** `AnalyticsScreen` + new `AccountFilterModal` + new `analyticsService.getAccountsBalanceHistory`
**Status:** Approved (design), pending implementation plan

## Problem

A user with many accounts (e.g. 9 credit cards) can already see balance dynamics
for **one** account at a time on `AccountHistoryScreen`. There is no way to pick a
**subset** of accounts (e.g. 3 specific credit cards, or all investment accounts)
and see a single, unified set of analytics for just that group.

The Analytics screen currently computes everything from the full transaction set
across all accounts. We want to let the user narrow Analytics to a chosen group of
accounts, and have the whole screen — including the balance-dynamics graph and the
cash-flow chart — reflect that group.

## Goal

Add an account filter at the top of `AnalyticsScreen`. Selecting a subset of
accounts recomputes the entire screen (quick overview, cash flow, balance dynamics,
category pies, account-balances list) from only those accounts' transactions, as one
combined (summed) view. Default is "all accounts" — untouched behaviour is identical
to today.

## Architecture — single choke point

`AnalyticsScreen.loadData` already fetches `allTxs` and derives everything from it.
Introduce one filtering step and feed all existing computations from the result:

```js
const isAll = selectedAccountIds.length === 0 || selectedAccountIds.length === accounts.length;
const selectedSet = new Set(selectedAccountIds);
const txs = isAll ? allTxs : allTxs.filter(t => selectedSet.has(t.account));
```

Every downstream call (`getCashFlow`, `getQuickStats`, pie/income totals, day-of-week,
top payees) already takes a transaction array, so they need no changes — they simply
receive the filtered array.

State added to `AnalyticsScreen`:
- `selectedAccountIds: string[]` — empty means "all" (default).
- `accounts: Account[]` — loaded list (already fetched for the balances section; lift
  it so the filter and balance-history can use it).
- `showAccountFilter: boolean` — modal visibility.

`loadData` re-runs when `selectedAccountIds` changes (add it to the effect deps /
call loadData on apply).

## Balance dynamics for a set of accounts

`getBalanceHistory(txs, days)` (used for "all") computes a global balance trajectory
and is kept unchanged for the default case. For a selected subset we need the summed
current balance of the chosen accounts as the seed, so add a pure generalisation of
the existing single-account `getAccountBalanceHistory`:

```ts
// analyticsService.ts
getAccountsBalanceHistory(
  transactions: Transaction[],
  accountIds: string[],
  sumCurrentBalance: number,  // Σ current balance of the selected accounts
  periodDays = 30,
): { date: string; day: number; balance: number }[]
```

Algorithm mirrors `getAccountBalanceHistory` but filters `t.account ∈ accountIds`
and seeds the running balance with `sumCurrentBalance`, walking day-by-day backwards
applying daily deltas (income +, expense −; transfer legs are standalone in/out and
affect balance naturally). When `isAll`, the screen keeps using `getBalanceHistory`.

The caller computes `sumCurrentBalance = accounts.filter(a => selectedSet.has(a.id))
.reduce((s,a) => s + (a.balance||0), 0)`.

## UI — selection control + modal

**Trigger (top of AnalyticsScreen):** a chip/button below the period selector
showing the current selection — `i18n.t('allAccounts')` when all, otherwise a short
summary like `"3 счёта"` (count) — that opens the modal.

**New component `AccountFilterModal`** (`SwipeModal`-based, mirrors `AccountPickerModal`
structure but multi-select):
- **Type-preset chips** at top: "All" plus one chip per account *type the user
  actually has* (bank / credit / investment / crypto / cash / asset). Tapping a preset
  sets the selection to every account of that type. "All" selects everything (= default).
- **Account list grouped by type** with a checkbox per account; tapping toggles one
  account, allowing manual refinement (e.g. preset "credit", then untick one card).
- The modal edits a local draft selection; a footer **"Apply"** commits it to
  `AnalyticsScreen.selectedAccountIds` and closes. Closing via swipe/back without
  Apply discards the draft (keeps the previous selection).
- Selecting zero accounts is treated as "all" (no empty analytics).

**Account-balances list (bottom of Analytics):** filtered to the selected accounts so
it matches the rest of the screen.

## Behaviour / defaults

- Default selection = all accounts; the screen renders exactly as today until the
  user opens the filter.
- Period selector (7d/30d/3m/6m/1y) is unchanged and applies on top of the account
  filter.
- Selection is **in-screen state, not persisted** — it resets to "all" on app
  restart / fresh mount. (Persisting last selection can be added later; left out now
  to avoid the surprise of a silently-filtered screen.)

## Edge cases

- **Transfers:** a transfer leg on a selected account affects that account's balance
  dynamics (correct). Income/expense analytics keep excluding `isTransfer`, unchanged.
- **Crypto accounts:** their displayed balance comes from live holdings value, not
  from stored balance/transactions, so the transaction-derived balance-dynamics line
  won't reflect coin price moves. This is a pre-existing limitation of the crypto
  model and is out of scope here; documented, not fixed.
- **Empty selection:** falls back to "all".
- **Account deleted while selected:** filter uses ids; a stale id simply matches no
  transactions — harmless. Re-opening the modal shows the current account list.

## Testing

- **TDD** for `getAccountsBalanceHistory`:
  - single account in the set → identical to `getAccountBalanceHistory`.
  - two accounts → seed = summed balance; daily deltas combine both accounts' txs.
  - txs for non-selected accounts are ignored.
  - empty period / no txs → flat line at `sumCurrentBalance`.
- Existing analytics functions are unchanged (still receive a tx array); no new tests
  needed for them.
- UI (modal toggles, choke-point filtering) is exercised manually on device.

## i18n

New keys (en/ru/he): `allAccounts`, `accountsSelected` (e.g. "{n} accounts"),
`filterAccounts` (modal title), `apply` (if not already present), preset labels reuse
existing account-type keys (`bank`, `credit`, `investment`, `crypto`, `cash`, `asset`).

## Out of scope

- Overlaying multiple per-account lines (we show one combined/summed line).
- Persisting the selection across sessions.
- Fixing crypto holdings-value in balance dynamics.
- Per-account comparison on `AccountHistoryScreen` (this lives in Analytics).
