# Cross-Currency Transfer — Design

**Date:** 2026-06-29
**Component:** `AddTransactionModal` (transfer flow) + new pure helper in `utils`
**Status:** Approved (design), pending implementation plan

## Problem

When transferring between two accounts that hold different currencies, the app
currently writes both legs of the transfer with the **same amount** and the
**global** currency symbol (`currency: sym()`), ignoring each account's own
currency:

```js
// AddTransactionModal.js (current)
addTransaction({ type: 'expense', amount: parseFloat(amount), currency: sym(), account: selAcc, ... });
addTransaction({ type: 'income',  amount: parseFloat(amount), currency: sym(), account: toAcc, ... });
```

So moving `614.4 ₪` from a shekel wallet to a dollar wallet credits the dollar
wallet with `614.4` (treated as dollars), which is wrong. The user needs to see
the converted amount in the destination currency **and** be able to correct or
round it (e.g. "I moved 600 ₪ and 200 $ actually landed").

Primary use case: fiat → fiat (e.g. cash ₪ wallet → cash $ wallet — buying
foreign currency). The same mechanism also applies to any account pair whose
currencies differ.

## Scope

- **In scope:** Any transfer where the *from* account's currency code differs
  from the *to* account's currency code. Works for all account types (cash,
  bank, credit, crypto, asset) since it operates purely on each account's
  `currency`.
- **Out of scope:** Crypto holdings modelling. A crypto account's displayed
  balance is computed from `holdings` × live price and ignores stored
  `balance`/transactions. A transfer into a crypto account is still recorded
  (visible in history, debits the source), but the crypto tile balance will not
  move. This is a pre-existing limitation of the crypto model and is left
  unchanged. No accounts are hidden from the transfer pickers.

## Behaviour

### Trigger
Only in `type === 'transfer'`, and only when
`fromCode !== toCode`, where the code is resolved from the account's `currency`
symbol:

```js
const codeOf = (acc) => CURRENCIES.find(c => c.symbol === acc?.currency)?.code || code();
```

If currencies match (or either account has no explicit currency and both fall
back to the global code), the form behaves exactly as today — no extra field.

### UI (inside the transfer block, after the "To" account picker)
A new **"Зачислить" (destination amount)** field appears:

- Numeric input (`decimal-pad`), shown in the destination account's currency
  symbol.
- **Pre-filled** with `convert(sourceAmount, fromCode, toCode)` via
  `exchangeRateService` (live rate), rounded to 2 decimals.
- **Editable** — user can type the exact amount that arrived.
- A small **"round" icon button** rounds the current destination amount to the
  nearest whole unit.
- A small helper line below shows the rate, e.g. `1 ₪ ≈ 0.274 $`.

### Auto-recompute rule
- When the **source amount** changes or the **destination account** changes,
  the destination amount is recomputed from the live rate — **unless** the user
  has manually edited it.
- A `toAmountEdited` flag tracks manual edits. It is **reset** (back to
  auto-compute) whenever the destination account changes.
- Manually editing the destination field sets `toAmountEdited = true`, so the
  user's value sticks while they tweak the source amount.

### State (added to AddTransactionModal)
- `toAmount: string` — destination amount input value.
- `toAmountEdited: boolean` — whether the user overrode the auto-computed value.

These reset on modal open alongside the existing state resets.

## Data model

A new **pure helper** centralises leg construction and is unit-tested:

```ts
// src/utils/transferLegs.ts
interface TransferAccount { id: string; name?: string; currency?: string; }
interface TransferLegsInput {
  fromAcc: TransferAccount;
  toAcc: TransferAccount;
  sourceAmount: number;   // in fromAcc currency
  toAmount: number;       // in toAcc currency (converted or user-edited)
  transferPairId: string;
  date: string;
  tags?: string[];
  note?: string;
}
// Returns [expenseLeg, incomeLeg] ready for dataService.addTransaction.
export function buildTransferLegs(input: TransferLegsInput): [object, object];
```

- **Expense leg** (on `fromAcc`): `amount = sourceAmount`,
  `currency = fromAcc.currency`, `recipient = toAcc.name`, `note = note || → toName`.
- **Income leg** (on `toAcc`): `amount = toAmount`,
  `currency = toAcc.currency`, `recipient = fromAcc.name`, `note = note || ← fromName`.
- Both legs keep `categoryId: 'transfer'`, `icon: 'repeat'`, `isTransfer: true`,
  shared `transferPairId`, `date`, `tags`.
- When currencies are equal, `toAmount === sourceAmount`, so behaviour is
  identical to today.

`AddTransactionModal.handleSave` (the `type === 'transfer'` branch and the
transfer-edit branch) calls `buildTransferLegs` instead of inlining the two
`addTransaction` payloads. The previous hard-coded `currency: sym()` is removed
in favour of each account's own currency.

### Edit mode
When opening an existing transfer for edit:
- Source amount = the expense leg's `amount` (already restored today).
- `toAmount` = the partner income leg's `amount` (newly restored), with
  `toAmountEdited = true` so it isn't overwritten on open.
- On save, both legs are updated with their respective amounts/currencies via
  the same helper logic (the edit branch updates the two existing docs rather
  than adding new ones, but uses the same amount/currency assignment).

## Balance updates
`dataService.addTransaction` / `updateTransaction` already adjust each account's
balance by the leg amount. Because each leg now carries the correct per-account
amount, fiat/bank/cash account balances update correctly (source −sourceAmount,
destination +toAmount). Crypto destination balance is unaffected (see Scope).

## Error / edge handling
- Rate unknown to `exchangeRateService` (and no static fallback) → `convert`
  returns the source amount (rate ≈ 1). The destination field is still editable,
  so the user can correct it. The rate helper line is hidden when no real rate
  is available (rate === 1 for differing codes).
- `toAmount` empty or non-positive → treated as invalid; save is blocked the
  same way an empty source amount is (no silent zero-amount leg).
- Same-account guard (`selAcc === toAcc`) is unchanged.

## Testing
- `__tests__/transferLegs.test.js` for the pure helper:
  - same currency → both legs equal amount, correct currencies.
  - different currency → expense in source currency/amount, income in dest
    currency/amount (the edited `toAmount`), shared `transferPairId`.
  - recipient/note wiring (`→`/`←`) and `isTransfer`/`categoryId` invariants.
- Existing `currency.convert` / `getRate` already have coverage; no change to
  their contracts.

## i18n
New keys in `en` / `ru` / `he` (and the remaining locales as needed):
- `transferReceive` — label for the destination amount field ("Зачислить" /
  "לקבל" / "Receive").
- `round` — round button label/aria (if not already present).
Rate helper line uses currency symbols, no new translatable string.

## Out-of-scope / explicitly NOT doing
- No coin/holdings editor for crypto transfers.
- No change to the crypto balance computation.
- No multi-hop or fee modelling.
