# Statement Import — Design Spec

**Date:** 2026-05-28
**Status:** Brainstorming approved by user; ready for implementation planning.

## 1. Problem

Users with many transactions must manually re-enter what they've already paid via
bank/credit-card apps, and have no easy way to verify "is this in my app or not?".
Reconciliation is the most painful UX in personal finance apps and most competitors
don't solve it.

## 2. Solution overview

Inside a specific account (AccountHistoryScreen), the user can scan an image of
their bank/credit-card statement. The app:

1. Extracts every transaction from the image using Gemini Vision.
2. Reconciles each extracted line against transactions already in the app for
   that account.
3. Presents a review screen with three sections (**New** / **Similar to existing**
   / **Already in account**).
4. Saves whatever the user confirms — as fresh transactions or as `confirmRecurring`
   calls for matched recurring templates.

The account is always the screen's account — no "pick account" step.

## 3. User flow

```
AccountHistoryScreen
  │
  │  tap "Import statement" button
  ▼
StatementScannerModal
  │
  │  step='pick'      — pick 1..N images (camera or gallery)
  │  step='analyzing' — Gemini Vision extraction
  │  step='review'    — 3-section review screen
  │  step='saving'    — bulk save
  ▼
back to AccountHistoryScreen (auto-refreshed)
```

## 4. Reconciliation rules

For each extracted transaction, classify against transactions of the **same
account** within the last 60 days, plus active recurring templates of that
account:

```
1. EXACT match:
     existing.find(tx =>
       tx.amount === extracted.amount
       AND tx.date === extracted.date)
   → kind: 'exact'              (default action: skip; goes to "Already in account" section)

2. NEAR match (if no exact found):
     existing.find(tx =>
       tx.amount === extracted.amount
       AND |tx.date - extracted.date| ≤ 2 days)
   → kind: 'similar'             (user must decide: "same" or "new")

3. RECURRING match:
     recurring.find(r =>
       fuzzyPayee(r.recipient, extracted.payee)
       AND |r.nextDate - extracted.date| ≤ 3 days
       AND r.isActive)
   // NOTE: amount is intentionally NOT in the filter — variable utility bills
   // (Cellcom, electricity) drift between months; payee + date are the signal.
   → kind: 'recurring' { diffPct = |r.amount - extracted.amount| / r.amount }
     - If multiple candidates: ambiguous, show all options.

`fuzzyPayee(a, b)` — case-insensitive substring match in either direction:
`a.toLowerCase().includes(b.toLowerCase())  ||  b.toLowerCase().includes(a.toLowerCase())`.
Both arguments are trimmed; non-alphanumerics are reduced to single spaces so
"Cellcom *123" still matches "Cellcom".

4. Otherwise:
   → kind: 'new'                 (default action: pre-checked for add)
```

### Recurring-match save behaviour

When the user confirms a recurring match, we call
`dataService.confirmRecurring(id, { amount: extracted.amount, date: extracted.date })`.
The template's `r.amount` stays untouched — it remains the "typical" value, while
this month's actual charge is recorded with `extracted.amount`. The infra already
supports this via the existing `overrides.amount` parameter.

A warning chip is shown if `diffPct > 5%`.

## 5. Smart categorization

For transactions classified as `'new'`, suggest a category from (in priority order):

```
1. HISTORY:
     match = userHistory(last 6 months, all accounts)
       .filter(t => fuzzyPayee(t.recipient, extracted.payee))
       .sortByDate(desc).first()
     if match → categoryId = match.categoryId, source: 'history'

2. RECURRING:
     match = recurring.find(r => fuzzyPayee(r.recipient, extracted.payee))
     if match → categoryId = match.categoryId, source: 'recurring'

3. AI / KEYWORDS:
     Apply the existing CATEGORY_KEYWORDS heuristic from aiService.parseTransaction
     to the payee string.
     if match → categoryId = match, source: 'ai'

4. FALLBACK:
     categoryId = 'other', source: 'fallback'
```

The review row displays the chosen category icon/name plus a tiny label of the
source (e.g. "from history" / "recurring" / "AI") so the user understands the
provenance.

## 6. Review UI

Single screen, three collapsible sections in this order:

### 6.1 New (N)

- Pre-checked for add.
- Each row: checkbox · category icon/chip (tap → CategoryPickerModal) · date ·
  payee · amount.
- Sub-label: small "from history" / "recurring" / "AI" source hint.
- Long-press a row: remove it from import entirely (single, intentional gesture).
- Tap amount → inline edit.
- Tap date → DatePickerModal.

### 6.2 Similar to existing (M)

- Each row is a card showing:
  - Top: extracted transaction (date · payee · amount).
  - Divider + label "looks like an existing transaction" or "looks like a
    recurring payment".
  - Middle: the candidate transaction (or all candidates if ambiguous).
  - Two buttons: **"Same — skip"** / **"It's new — add"**.
- No default — user must decide. Counter at top only includes resolved ones.
- For recurring matches: button label becomes **"Confirm as recurring"** (uses
  `confirmRecurring`) vs **"Add as new"**.

### 6.3 Already in account (K)

- Collapsed by default.
- Tap header → expand list of `exact` matches as plain rows (no action — just
  proof to the user that we recognized them).

### Top bar

- Back button (closes modal, discards).
- Save button — shows count of currently-checked items to add. Disabled if 0.

### Low-confidence guard

If the extracted row has `confidence: 'low'` (Gemini flagged uncertainty, or
the payee is gibberish), the row appears in **New** but the checkbox is OFF by
default. User has to opt-in.

## 7. Architecture

### 7.1 New files

| File | Responsibility | Approx LOC |
|---|---|---|
| `src/components/StatementScannerModal.js` | Multi-step UI flow + state machine | ~400 |
| `src/components/StatementReviewSection.js` | One of the 3 review sections | ~150 |
| `src/components/StatementSimilarCard.js` | "Looks like X" card with two action buttons | ~80 |
| `src/utils/statementReconcile.ts` | Pure reconcile algorithm | ~100 |
| `src/utils/statementCategorize.ts` | Pure categorization algorithm | ~60 |
| `__tests__/statementReconcile.test.js` | Unit tests | ~150 |
| `__tests__/statementCategorize.test.js` | Unit tests | ~80 |

### 7.2 Modified files

| File | Change |
|---|---|
| `src/services/aiService.ts` | Add `scanStatement(images, accountCurrency)` using Gemini Vision |
| `src/screens/AccountHistoryScreen.js` | Add "Import statement" entry-point button + modal state |
| `src/services/dataService.ts` | (Optional) `addTransactionsBulk(txs[])` — atomic bulk insert. Otherwise iterate `addTransaction`. |
| `src/i18n/{ru,he,en}.ts` | ~15 new keys for the UI strings |

### 7.3 Interfaces (contracts)

```ts
// src/services/aiService.ts
export interface ExtractedTx {
  date: string;        // 'YYYY-MM-DD'
  amount: number;      // signed: negative = charge, positive = refund/income
  payee: string;       // original text, NOT translated
  notes?: string;      // installment "2/4", foreign "$23.90", recurring marker, etc.
  confidence?: 'high' | 'medium' | 'low';
}

export function scanStatement(
  imageInput: string | string[],
  accountCurrency?: string,
): Promise<ExtractedTx[]>;
```

```ts
// src/utils/statementReconcile.ts
export type ReconcileResult =
  | { kind: 'exact';     extracted: ExtractedTx; match: Transaction }
  | { kind: 'similar';   extracted: ExtractedTx; candidates: Transaction[] }
  | { kind: 'recurring'; extracted: ExtractedTx; recurring: Recurring; diffPct: number; ambiguous?: Recurring[] }
  | { kind: 'new';       extracted: ExtractedTx };

export function reconcile(
  extracted: ExtractedTx[],
  existing: Transaction[],
  recurring: Recurring[],
): ReconcileResult[];
```

```ts
// src/utils/statementCategorize.ts
export type CategorySource = 'history' | 'recurring' | 'ai' | 'fallback';

export interface CategoryGuess {
  categoryId: string;
  source: CategorySource;
}

export function categorize(
  payee: string,
  history: Transaction[],
  recurring: Recurring[],
  aiHint?: string,
): CategoryGuess;
```

## 8. Gemini prompt

Refined from analysis of real Max credit-card statements and prior bank
screenshots:

```
You are reading a credit-card or bank statement image.
Extract EVERY individual transaction line as JSON:
[{
  date: 'YYYY-MM-DD',                   // purchase date if shown alongside charge date
  amount: number,                       // signed: negative = charge, positive = refund/income; in account currency
  payee: 'original text — DO NOT translate',
  notes?: 'foreign amount, installment X/Y, recurring marker',
  confidence?: 'high' | 'medium' | 'low'
}]

EXTRACT FROM:
- Domestic transaction list
- Foreign-purchase section (use the converted local-currency amount, not the foreign one)

DO NOT EXTRACT:
- Running balance lines ("יתרה ליום", "balance after", "remaining")
- Total / sum / subtotal lines ("סך הכל", "סך עסקאות", "סך חיובים", "Total", "Subtotal", "סה"כ")
- Section / column headers
- Payment-source breakdown sections ("פירוט תשלומים לפי מקור חיוב", account routing summaries)
- Card details, addresses, phone numbers, customer name, account/card numbers
- Marketing or promotional content, advertisements
- QR codes, barcodes

SPECIAL CASES:
- INSTALLMENTS ("תשלום X מתוך Y", "X/Y", monthly installment): amount = the per-installment value as printed, NOT the total. Put "תשלום X/Y" in notes.
- REPEATED LINES with identical payee+date+amount: each is a SEPARATE transaction; do NOT deduplicate.
- FOREIGN purchases: use the local-currency (ILS/USD/EUR…) converted amount. Put the original "<amount> <CCY>" in notes.
- Standing-order tags ("הוראת קבע" / "standing order"): copy the tag to notes.

Date: normalize any format (DD/MM/YYYY, YYYY-MM-DD, "Dublin 28/02/26") to YYYY-MM-DD. If only DD/MM is shown, assume current year.
Payee: keep original language. Do not translate or transliterate.
Confidence: mark 'low' when the text is unclear or the line is ambiguous; mark 'high' otherwise.
```

## 9. Error handling

| Failure | Behaviour |
|---|---|
| Gemini returned `null` / network error | Toast with reason from `_lastAIError` (same plumbing as the receipt scanner diagnostic). |
| Gemini returned an empty array | Toast: "No transactions recognized — try a different photo." |
| JSON parse failed | Capture raw response to Sentry; show generic error. |
| One row has invalid date/amount | Skip that row, show the others in review. |
| Bulk save: one `addTransaction` fails | Continue others; final toast: "Added N of M; some failed." Log details to Sentry. |
| User cancels mid-flow | Discard all in-memory state. No DB writes. |

## 10. Testing

| Surface | How |
|---|---|
| `reconcile` (pure) | Unit tests: exact match, ±2 day fuzzy, multiple candidates, recurring with variable amount, recurring ambiguous (2+ templates), no match. |
| `categorize` (pure) | Unit tests: history hit, recurring hit, AI hint, fallback, priority order. |
| `scanStatement` | Not unit-tested (network + Gemini). Optionally snapshot-test the prompt string. |
| `StatementScannerModal` | Manual e2e on device (Android + iOS), with the user's actual statement screenshots. |

## 11. Out of scope (for the MVP)

To keep the scope tight, the following are intentionally deferred:

- **CSV / file import** — only image-based scanning.
- **Multi-account inference** — the account is always the screen's account; no "auto-detect account from statement header".
- **Per-row Sentry reporting** of low-confidence extractions — only aggregate.
- **Automatic update of recurring template's `r.amount`** when the actual differs — stays untouched on purpose.
- **Currency conversion** for foreign purchases beyond using the statement's already-converted column — no API rate lookups.
- **Pending vs posted distinction** — both treated identically.

## 12. Open questions for implementation

These are decisions to revisit during implementation, not blockers:

1. Should `addTransactionsBulk` be implemented as an atomic Firestore batch, or
   is iterative `addTransaction` sufficient? (Atomic is cleaner; iterative is
   simpler. Likely start iterative.)
2. Exact wording for the 15 new i18n keys — settle when the UI is shaped.
3. Whether to persist user's "skip already-in-account section" preference.
