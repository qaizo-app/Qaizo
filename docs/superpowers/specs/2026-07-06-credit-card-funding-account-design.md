# Credit Card → Funding Account + Shortfall Warning — Design

**Date:** 2026-07-06
**Component:** `AccountsScreen` (account form + tiles + status calc) + new pure helper
**Status:** Approved (design), pending implementation plan

## Problem

A user with many credit cards funds them from a bank/cash account. Each card is
charged on its billing day (already shown as a corner badge). The important, and
currently invisible, question is: **will the funding account have enough money on
the billing days to cover the card charges?** If not, the user hits an overdraft
they could have seen coming.

Today `AccountsScreen.getAccountStatus` projects an account's end-of-month
balance from its own recurring payments only. It does not know that credit cards
draw from a specific account, so it cannot warn about a card-charge shortfall.

## Goal

Let the user link each credit card to the account it is charged from, and warn on
that funding account's tile when its projected balance won't cover the upcoming
card charges (plus its existing recurring) before end of month.

## Charge amount model

On the billing day a card deducts either:
- a **fixed** monthly amount, if the user set one (revolving credit), or
- the **whole accumulated debt**, if no fixed amount is set.

No separate "card type" toggle — the presence of a fixed amount decides.

## Data model (added to a credit account)

- `fundingAccountId?: string` — id of the bank/cash account this card is charged
  from. Absent → card not linked (no effect on any funding account).
- `fixedCharge?: number` — optional monthly charge amount. Absent / 0 → the full
  accumulated debt is used.

Both are only meaningful for `type === 'credit'`. Saved via the existing account
form (`AccountsScreen` save payload), like `billingDay`/`overdraft`.

## Pure helper (tested)

```ts
// src/utils/cardCharge.ts
interface ChargeableCard { balance?: number; fixedCharge?: number; }
// Amount that will leave the funding account for this card this cycle.
export function cardMonthlyCharge(card: ChargeableCard): number;
```
- `fixedCharge > 0` → return `fixedCharge`.
- else → return the debt magnitude: `Math.max(0, -(card.balance || 0))`
  (a credit card's balance is negative when in debt; a non-negative balance means
  nothing to charge → 0).

## Status calculation (extend `getAccountStatus`)

For a **bank or cash** account `A` (funding accounts), extend the existing
projection to also subtract the charges of cards linked to `A` whose billing day
is still ahead this month:

```
projected = balance
          + Σ upcoming recurring on A before end of month        (existing)
          − Σ cardMonthlyCharge(card) for each credit card where
              card.fundingAccountId === A.id
              AND card.billingDay is on/after today and ≤ end of month
```

- "billing day still ahead" = `card.billingDay >= now.getDate()` (a card already
  charged earlier this month is already reflected in `A`'s balance).
- If `projected < minAllowed` (`minAllowed = -(A.overdraft || 0)`) → status
  `warning`, with `shortfall = minAllowed − projected` (a positive number).
- `overdraft` status (already-negative balance) is unchanged.

The subtraction of linked-card charges is extracted into a pure
`fundingShortfall(account, allAccounts, recurring, now)` helper that returns the
shortfall number (`0` when the projection covers everything). `getAccountStatus`
keeps returning its status **string** — it just calls `fundingShortfall` and, if
`> 0`, returns `'warning'` (unless already `'overdraft'` from a negative balance).
So the tile needs no return-type change; `AccountHistoryScreen` calls the same
`fundingShortfall` helper directly to display N. Cash accounts join bank in
getting a status (they can fund cards); mortgage/loan/investment/crypto/asset
stay `'ok'`.

## Display

Split across two screens — the tile stays a glanceable **icon only**, the full
text lives inside the account (a warning sentence would look cramped in the small
square tile).

- **Accounts screen tile (`renderTile`):** a card-charge shortfall sets the
  account's status to `warning`, which already renders the existing warning
  border + `alert-triangle` icon in the tile corner. No text added to the tile —
  the icon is the signal to open the account.
- **Account detail (`AccountHistoryScreen`), on open:** when the opened account
  has a card-charge shortfall, show a warning banner near the top:
  > ⚠️ {i18n.t('cardChargeShortfall')} N ₪  — e.g. "не хватит 3 000 ₪ на списание карт"

  `AccountHistoryScreen` already loads `recurring` (for its upcoming block); it
  also loads the full `accounts` list so the shared `fundingShortfall` helper can
  find the cards linked to this account and compute N. Banner shown only when
  `shortfall > 0`.

## Settings UI (account form, credit only)

When `type === 'credit'`, add two controls to the form (near billingDay):
- **"Charges from"** (`chargeFromAccount`) → opens `AccountPickerModal` filtered to
  bank/cash accounts; stores `fundingAccountId`. Clearable (no link).
- **"Charge amount"** (`chargeAmount`) → optional numeric input; empty = full debt
  (placeholder hint). Stores `fixedCharge`.

## Edge cases

- Card with no `fundingAccountId` → ignored by every account's projection.
- Funding account deleted / inactive → a stale `fundingAccountId` simply matches
  no active account; no crash (lookup returns nothing).
- Multiple cards linked to the same account → all their charges sum.
- Currency: cards and their funding account are assumed same currency (typical).
  If they differ, convert the charge to the funding account's currency using the
  existing `convert()` before subtracting. (Keep it simple: convert per card.)
- `fixedCharge` set but larger than debt → still use `fixedCharge` (revolving can
  exceed current statement); that's intended.

## Testing

- **TDD** `cardMonthlyCharge`: fixed set → fixed; no fixed + debt → debt; no fixed
  + non-negative balance → 0; fixed=0 treated as unset.
- **TDD** a pure `fundingShortfall(account, cards, recurring, now)` helper that
  returns the projected balance / shortfall, so the billing-day-ahead and
  summation logic is tested without the screen:
  - card ahead this month counts; card already past this month excluded.
  - only cards with matching `fundingAccountId` count.
  - recurring still included.
  - no linked cards → same as today.
- Screen wiring (form fields, tile line) verified manually on device.

## i18n

New keys (en/ru/he): `chargeFromAccount`, `chargeAmount`, `chargeAmountHint`
("empty = full debt"), `cardChargeShortfall` ("not enough for card charges").

## Out of scope

- Auto-executing the card charge (materialising a transfer on billing day).
- Inferring the funding account automatically.
- Cross-currency card/funding beyond a simple per-card `convert()`.
- Sparkline / other tile additions (separate idea).
