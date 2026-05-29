# Statement Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user scan a photo of a bank or credit-card statement from inside an account, reconcile each extracted line against existing & recurring transactions, and bulk-add the missing ones with smart categorisation.

**Architecture:** Pure utilities (`payeeMatch`, `statementReconcile`, `statementCategorize`) are written TDD-first and have full unit coverage. A new `aiService.scanStatement` wraps a Gemini-Vision call mirroring `scanReceipt`'s structure. A `StatementScannerModal` (multi-step: pick → analyzing → review → saving) orchestrates everything and is opened by a new button on `AccountHistoryScreen`. The bulk save iterates `dataService.addTransaction` / `confirmRecurring`; an atomic batch is deferred to follow-up.

**Tech Stack:** React Native + Expo SDK 54, TypeScript (utils/services), JS (screens/components), `@react-native-firebase/firestore`, Gemini 2.5 Flash, Jest, `expo-image-picker`, project patterns: `SwipeModal`, `RowText`, `createSt()` factory per CLAUDE.md.

**Spec reference:** [`docs/superpowers/specs/2026-05-28-statement-import-design.md`](../specs/2026-05-28-statement-import-design.md)

---

## File map

**New files**

| Path | Purpose |
|---|---|
| `src/utils/payeeMatch.ts` | `fuzzyPayee(a, b): boolean` shared helper |
| `src/utils/statementReconcile.ts` | `reconcile(extracted, existing, recurring): ReconcileResult[]` |
| `src/utils/statementCategorize.ts` | `categorize(payee, history, recurring, aiHint?): CategoryGuess` |
| `src/components/StatementSimilarCard.js` | Card for the "Similar" section with two action buttons |
| `src/components/StatementReviewSection.js` | Collapsible section (New / Similar / Already) |
| `src/components/StatementScannerModal.js` | Multi-step orchestrator |
| `__tests__/payeeMatch.test.js` | Unit tests |
| `__tests__/statementReconcile.test.js` | Unit tests |
| `__tests__/statementCategorize.test.js` | Unit tests |

**Modified files**

| Path | Change |
|---|---|
| `src/services/aiService.ts` | Add `ExtractedTx` interface + `scanStatement()` function; export from default object |
| `src/screens/AccountHistoryScreen.js` | Add "Import statement" button + modal state |
| `src/i18n/ru.ts` / `he.ts` / `en.ts` | Add ~15 new keys |

---

## Task 1: `fuzzyPayee` shared helper (TDD)

**Files:**
- Create: `src/utils/payeeMatch.ts`
- Test: `__tests__/payeeMatch.test.js`

- [ ] **Step 1: Write the failing test**

`__tests__/payeeMatch.test.js`:

```js
// __tests__/payeeMatch.test.js
const { fuzzyPayee } = require('../src/utils/payeeMatch');

describe('fuzzyPayee', () => {
  test('exact match (case-insensitive)', () => {
    expect(fuzzyPayee('Cellcom', 'cellcom')).toBe(true);
  });

  test('one side contains the other', () => {
    expect(fuzzyPayee('Cellcom *123', 'Cellcom')).toBe(true);
    expect(fuzzyPayee('Cellcom', 'Cellcom *123')).toBe(true);
  });

  test('case-insensitive substring', () => {
    expect(fuzzyPayee('CELLCOM SERVICES', 'cellcom')).toBe(true);
  });

  test('trims whitespace', () => {
    expect(fuzzyPayee('  Cellcom  ', 'Cellcom')).toBe(true);
  });

  test('collapses runs of non-alphanumerics to a space', () => {
    expect(fuzzyPayee('Cellcom—Mobile', 'cellcom mobile')).toBe(true);
    expect(fuzzyPayee('Hapoalim/Bank/Fee', 'hapoalim bank fee')).toBe(true);
  });

  test('Hebrew payees', () => {
    expect(fuzzyPayee('שופרסל דיל', 'שופרסל')).toBe(true);
  });

  test('no match returns false', () => {
    expect(fuzzyPayee('Cellcom', 'Hot Mobile')).toBe(false);
  });

  test('empty inputs return false', () => {
    expect(fuzzyPayee('', 'Cellcom')).toBe(false);
    expect(fuzzyPayee('Cellcom', '')).toBe(false);
    expect(fuzzyPayee('', '')).toBe(false);
  });

  test('null/undefined safe', () => {
    expect(fuzzyPayee(undefined, 'Cellcom')).toBe(false);
    expect(fuzzyPayee('Cellcom', null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/payeeMatch.test.js --forceExit`
Expected: FAIL — `Cannot find module '../src/utils/payeeMatch'`

- [ ] **Step 3: Write minimal implementation**

`src/utils/payeeMatch.ts`:

```ts
// src/utils/payeeMatch.ts
// Tiny case-insensitive substring matcher for payee/recipient strings.
// Used by statement reconciliation and smart categorisation so both layers
// agree on what "the same merchant" means.

function normalize(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ') // collapse runs of non-alphanumerics
    .trim();
}

export function fuzzyPayee(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;
  return na.includes(nb) || nb.includes(na);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/payeeMatch.test.js --forceExit`
Expected: PASS — 9 passed.

- [ ] **Step 5: TypeScript check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/utils/payeeMatch.ts __tests__/payeeMatch.test.js
git commit -m "feat(utils): fuzzyPayee — shared case-insensitive payee matcher"
```

---

## Task 2: `statementReconcile` utility (TDD)

**Files:**
- Create: `src/utils/statementReconcile.ts`
- Test: `__tests__/statementReconcile.test.js`

- [ ] **Step 1: Write the failing test**

`__tests__/statementReconcile.test.js`:

```js
// __tests__/statementReconcile.test.js
const { reconcile } = require('../src/utils/statementReconcile');

// Helpers
const tx = (overrides) => ({
  id: overrides.id || 'tx_' + Math.random().toString(36).slice(2, 8),
  type: 'expense',
  amount: 100,
  date: '2026-05-20',
  account: 'acc1',
  categoryId: 'food',
  recipient: 'Shop',
  ...overrides,
});

const rec = (overrides) => ({
  id: overrides.id || 'rec_' + Math.random().toString(36).slice(2, 8),
  type: 'expense',
  amount: 150,
  account: 'acc1',
  categoryId: 'phone',
  recipient: 'Cellcom',
  nextDate: '2026-05-28',
  isActive: true,
  ...overrides,
});

describe('reconcile', () => {
  test('exact match: same amount and same date', () => {
    const extracted = [{ date: '2026-05-20', amount: -100, payee: 'Shop' }];
    const existing = [tx({ amount: 100, date: '2026-05-20' })];
    const r = reconcile(extracted, existing, []);
    expect(r).toHaveLength(1);
    expect(r[0].kind).toBe('exact');
    expect(r[0].match.id).toBe(existing[0].id);
  });

  test('similar match: same amount, date within ±2 days', () => {
    const extracted = [{ date: '2026-05-22', amount: -100, payee: 'Shop' }];
    const existing = [tx({ amount: 100, date: '2026-05-20' })];
    const r = reconcile(extracted, existing, []);
    expect(r[0].kind).toBe('similar');
    expect(r[0].candidates).toHaveLength(1);
  });

  test('similar match collects multiple candidates within window', () => {
    const extracted = [{ date: '2026-05-21', amount: -100, payee: 'Shop' }];
    const existing = [
      tx({ id: 'a', amount: 100, date: '2026-05-20' }),
      tx({ id: 'b', amount: 100, date: '2026-05-22' }),
    ];
    const r = reconcile(extracted, existing, []);
    expect(r[0].kind).toBe('similar');
    expect(r[0].candidates.map(t => t.id).sort()).toEqual(['a', 'b']);
  });

  test('beyond ±2 days is NOT similar', () => {
    const extracted = [{ date: '2026-05-25', amount: -100, payee: 'Shop' }];
    const existing = [tx({ amount: 100, date: '2026-05-20' })];
    const r = reconcile(extracted, existing, []);
    expect(r[0].kind).toBe('new');
  });

  test('recurring match: payee + date within ±3 days, amount different', () => {
    const extracted = [{ date: '2026-05-29', amount: -152, payee: 'Cellcom *124' }];
    const recurring = [rec({ recipient: 'Cellcom', amount: 150, nextDate: '2026-05-28' })];
    const r = reconcile(extracted, [], recurring);
    expect(r[0].kind).toBe('recurring');
    expect(r[0].recurring.id).toBe(recurring[0].id);
    expect(r[0].diffPct).toBeCloseTo(0.0133, 3);
  });

  test('recurring match: inactive templates are ignored', () => {
    const extracted = [{ date: '2026-05-28', amount: -150, payee: 'Cellcom' }];
    const recurring = [rec({ recipient: 'Cellcom', isActive: false })];
    const r = reconcile(extracted, [], recurring);
    expect(r[0].kind).toBe('new');
  });

  test('recurring match: ambiguous when 2+ templates match', () => {
    const extracted = [{ date: '2026-05-28', amount: -250, payee: 'Hapoalim' }];
    const recurring = [
      rec({ id: 'r1', recipient: 'Hapoalim Bank Fee', amount: 50, nextDate: '2026-05-28' }),
      rec({ id: 'r2', recipient: 'Hapoalim Loan', amount: 1200, nextDate: '2026-05-28' }),
    ];
    const r = reconcile(extracted, [], recurring);
    expect(r[0].kind).toBe('recurring');
    expect(r[0].ambiguous?.map(x => x.id).sort()).toEqual(['r1', 'r2']);
  });

  test('no match → new', () => {
    const extracted = [{ date: '2026-05-20', amount: -42, payee: 'Random Shop' }];
    const r = reconcile(extracted, [], []);
    expect(r[0].kind).toBe('new');
  });

  test('exact match precedence over similar', () => {
    const extracted = [{ date: '2026-05-20', amount: -100, payee: 'Shop' }];
    const existing = [
      tx({ id: 'a', amount: 100, date: '2026-05-20' }),
      tx({ id: 'b', amount: 100, date: '2026-05-21' }),
    ];
    const r = reconcile(extracted, existing, []);
    expect(r[0].kind).toBe('exact');
    expect(r[0].match.id).toBe('a');
  });

  test('exact match precedence over recurring', () => {
    const extracted = [{ date: '2026-05-28', amount: -150, payee: 'Cellcom' }];
    const existing = [tx({ amount: 150, date: '2026-05-28', recipient: 'Cellcom' })];
    const recurring = [rec({ recipient: 'Cellcom', amount: 150, nextDate: '2026-05-28' })];
    const r = reconcile(extracted, existing, recurring);
    expect(r[0].kind).toBe('exact');
  });

  test('extracted.amount sign is normalized (negative = charge)', () => {
    // Caller may pass signed amounts; reconcile compares by absolute amount.
    const extracted = [{ date: '2026-05-20', amount: -100, payee: 'Shop' }];
    const existing = [tx({ amount: 100, date: '2026-05-20' })];
    const r = reconcile(extracted, existing, []);
    expect(r[0].kind).toBe('exact');
  });

  test('multiple extracted entries handled independently', () => {
    const extracted = [
      { date: '2026-05-20', amount: -100, payee: 'A' },
      { date: '2026-05-21', amount: -50,  payee: 'B' },
    ];
    const existing = [tx({ amount: 100, date: '2026-05-20' })];
    const r = reconcile(extracted, existing, []);
    expect(r).toHaveLength(2);
    expect(r[0].kind).toBe('exact');
    expect(r[1].kind).toBe('new');
  });

  test('empty inputs return empty result', () => {
    expect(reconcile([], [], [])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/statementReconcile.test.js --forceExit`
Expected: FAIL — `Cannot find module '../src/utils/statementReconcile'`

- [ ] **Step 3: Write minimal implementation**

`src/utils/statementReconcile.ts`:

```ts
// src/utils/statementReconcile.ts
// Pure reconciliation: classify each extracted statement line against
// transactions already in the app and active recurring templates.
//
// Caller responsibilities:
//   - `existing` is pre-filtered to the same account (typically last 60 days).
//   - `recurring` is pre-filtered to the same account and active.
//   - `extracted.amount` may be signed (negative = charge); we compare absolute values.
import type { Recurring, Transaction } from '../types';
import { fuzzyPayee } from './payeeMatch';

export interface ExtractedTx {
  date: string;
  amount: number;
  payee: string;
  notes?: string;
  confidence?: 'high' | 'medium' | 'low';
}

export type ReconcileResult =
  | { kind: 'exact';     extracted: ExtractedTx; match: Transaction }
  | { kind: 'similar';   extracted: ExtractedTx; candidates: Transaction[] }
  | { kind: 'recurring'; extracted: ExtractedTx; recurring: Recurring; diffPct: number; ambiguous?: Recurring[] }
  | { kind: 'new';       extracted: ExtractedTx };

const DAY_MS = 86_400_000;
const NEAR_DAYS = 2;
const RECURRING_DAYS = 3;

function dayDiff(a: string, b: string): number {
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  return Math.round(Math.abs(da - db) / DAY_MS);
}

function sameAmount(a: number, b: number): boolean {
  return Math.abs(Math.abs(a) - Math.abs(b)) < 0.005;
}

export function reconcile(
  extracted: ExtractedTx[],
  existing: Transaction[],
  recurring: Recurring[],
): ReconcileResult[] {
  return extracted.map((e): ReconcileResult => {
    // 1. exact (amount + date)
    const exact = existing.find(t => sameAmount(t.amount, e.amount) && t.date.slice(0, 10) === e.date);
    if (exact) return { kind: 'exact', extracted: e, match: exact };

    // 2. similar (amount + date within ±NEAR_DAYS)
    const similar = existing.filter(t => sameAmount(t.amount, e.amount) && dayDiff(t.date.slice(0, 10), e.date) <= NEAR_DAYS);
    if (similar.length > 0) return { kind: 'similar', extracted: e, candidates: similar };

    // 3. recurring (active + payee fuzzy + date within ±RECURRING_DAYS; amount IGNORED)
    const recHits = recurring.filter(r =>
      r.isActive
      && fuzzyPayee(r.recipient, e.payee)
      && dayDiff(r.nextDate.slice(0, 10), e.date) <= RECURRING_DAYS
    );
    if (recHits.length === 1) {
      const r = recHits[0];
      const diffPct = r.amount > 0 ? Math.abs(r.amount - Math.abs(e.amount)) / r.amount : 0;
      return { kind: 'recurring', extracted: e, recurring: r, diffPct };
    }
    if (recHits.length > 1) {
      const r = recHits[0];
      const diffPct = r.amount > 0 ? Math.abs(r.amount - Math.abs(e.amount)) / r.amount : 0;
      return { kind: 'recurring', extracted: e, recurring: r, diffPct, ambiguous: recHits };
    }

    // 4. nothing matched
    return { kind: 'new', extracted: e };
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/statementReconcile.test.js --forceExit`
Expected: PASS — 13 passed.

- [ ] **Step 5: TypeScript check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/utils/statementReconcile.ts __tests__/statementReconcile.test.js
git commit -m "feat(utils): statementReconcile — classify extracted vs existing & recurring"
```

---

## Task 3: `statementCategorize` utility (TDD)

**Files:**
- Create: `src/utils/statementCategorize.ts`
- Test: `__tests__/statementCategorize.test.js`

- [ ] **Step 1: Write the failing test**

`__tests__/statementCategorize.test.js`:

```js
// __tests__/statementCategorize.test.js
const { categorize } = require('../src/utils/statementCategorize');

const tx = (overrides) => ({
  id: 't',
  type: 'expense',
  amount: 100,
  date: '2026-05-20',
  account: 'acc1',
  categoryId: 'food',
  recipient: 'Generic',
  ...overrides,
});

const rec = (overrides) => ({
  id: 'r',
  type: 'expense',
  amount: 100,
  account: 'acc1',
  categoryId: 'phone',
  recipient: 'Cellcom',
  nextDate: '2026-05-28',
  isActive: true,
  ...overrides,
});

describe('categorize', () => {
  test('history hit takes precedence', () => {
    const r = categorize(
      'Cellcom *123',
      [tx({ recipient: 'Cellcom', categoryId: 'phone', date: '2026-04-01' })],
      [],
    );
    expect(r).toEqual({ categoryId: 'phone', source: 'history' });
  });

  test('most recent history entry wins when multiple match', () => {
    const r = categorize(
      'Cellcom',
      [
        tx({ recipient: 'Cellcom', categoryId: 'other', date: '2026-01-01' }),
        tx({ recipient: 'Cellcom', categoryId: 'phone', date: '2026-04-01' }),
      ],
      [],
    );
    expect(r.categoryId).toBe('phone');
  });

  test('recurring used when no history match', () => {
    const r = categorize(
      'Cellcom *123',
      [],
      [rec({ recipient: 'Cellcom', categoryId: 'phone' })],
    );
    expect(r).toEqual({ categoryId: 'phone', source: 'recurring' });
  });

  test('AI hint used when no history or recurring match', () => {
    const r = categorize('SomeRandomShop', [], [], 'restaurant');
    expect(r).toEqual({ categoryId: 'restaurant', source: 'ai' });
  });

  test('fallback to "other" when nothing matches', () => {
    const r = categorize('Unknown', [], []);
    expect(r).toEqual({ categoryId: 'other', source: 'fallback' });
  });

  test('history > recurring > ai > fallback (priority test)', () => {
    const r = categorize(
      'Cellcom',
      [tx({ recipient: 'Cellcom', categoryId: 'historyCat', date: '2026-04-01' })],
      [rec({ recipient: 'Cellcom', categoryId: 'recurringCat' })],
      'aiCat',
    );
    expect(r.source).toBe('history');
    expect(r.categoryId).toBe('historyCat');
  });

  test('empty payee → fallback', () => {
    expect(categorize('', [], [])).toEqual({ categoryId: 'other', source: 'fallback' });
  });

  test('does not match history rows without a recipient', () => {
    const r = categorize('Cellcom', [tx({ recipient: undefined, categoryId: 'phone' })], []);
    expect(r.source).not.toBe('history');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/statementCategorize.test.js --forceExit`
Expected: FAIL — `Cannot find module '../src/utils/statementCategorize'`

- [ ] **Step 3: Write minimal implementation**

`src/utils/statementCategorize.ts`:

```ts
// src/utils/statementCategorize.ts
// Pure categorisation: pick a categoryId for a new statement line by
// consulting the user's recent history → active recurring templates → an
// optional AI keyword hint → 'other' as a last resort.
//
// The caller filters history to whatever window is useful (the design says
// last 6 months, but the function itself is window-agnostic).
import type { Recurring, Transaction } from '../types';
import { fuzzyPayee } from './payeeMatch';

export type CategorySource = 'history' | 'recurring' | 'ai' | 'fallback';

export interface CategoryGuess {
  categoryId: string;
  source: CategorySource;
}

export function categorize(
  payee: string | null | undefined,
  history: Transaction[],
  recurring: Recurring[],
  aiHint?: string,
): CategoryGuess {
  if (!payee || !payee.trim()) {
    return { categoryId: 'other', source: 'fallback' };
  }

  // 1. History: most recent transaction with a matching payee
  let bestHistory: Transaction | null = null;
  for (const t of history) {
    if (!t.recipient) continue;
    if (!fuzzyPayee(t.recipient, payee)) continue;
    if (!bestHistory || (t.date || '') > (bestHistory.date || '')) {
      bestHistory = t;
    }
  }
  if (bestHistory) {
    return { categoryId: bestHistory.categoryId, source: 'history' };
  }

  // 2. Recurring template with matching payee
  const recHit = recurring.find(r => fuzzyPayee(r.recipient, payee));
  if (recHit) {
    return { categoryId: recHit.categoryId, source: 'recurring' };
  }

  // 3. AI hint (the caller likely ran parseTransaction or the AI returned it inline)
  if (aiHint) {
    return { categoryId: aiHint, source: 'ai' };
  }

  // 4. Fallback
  return { categoryId: 'other', source: 'fallback' };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/statementCategorize.test.js --forceExit`
Expected: PASS — 8 passed.

- [ ] **Step 5: TypeScript check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/utils/statementCategorize.ts __tests__/statementCategorize.test.js
git commit -m "feat(utils): statementCategorize — history > recurring > AI > fallback"
```

---

## Task 4: `aiService.scanStatement` (Gemini Vision)

**Files:**
- Modify: `src/services/aiService.ts` (add interface, function, export from default object)

- [ ] **Step 1: Find the end of the `scanReceiptItems` function to insert after**

Run: `grep -n "^async function scanReceiptItems\|^async function interpretChartQuery" src/services/aiService.ts`
Expected: two line numbers — `scanReceiptItems` start and the next function start. The new `scanStatement` is inserted between them.

- [ ] **Step 2: Import the `ExtractedTx` type from the util (single source of truth)**

`ExtractedTx` is already defined and exported from `src/utils/statementReconcile.ts` (created in Task 2). Re-using it keeps the contract in one place. In `src/services/aiService.ts`, add an import next to the other `../utils/...` imports near the top of the file:

```ts
import type { ExtractedTx } from '../utils/statementReconcile';
```

- [ ] **Step 3: Add the `scanStatement` function before `interpretChartQuery`**

Insert in `src/services/aiService.ts`, just before the `interpretChartQuery` declaration:

```ts
// ─── Statement scanner (bank / credit-card statements) ────────────────────
async function scanStatement(imageInput: any, accountCurrency?: string): Promise<ExtractedTx[]> {
  if (!GEMINI_API_KEY) {
    if (__DEV__) console.error('scanStatement: no API key');
    _lastAIError = { code: 'no_api_key', message: 'Gemini API key is not configured' };
    return [];
  }
  try {
    const imageList: string[] = Array.isArray(imageInput) ? imageInput : [imageInput];

    const detectMime = (b64: string) => {
      if (b64.startsWith('/9j/')) return 'image/jpeg';
      if (b64.startsWith('iVBOR')) return 'image/png';
      if (b64.startsWith('JVBER')) return 'application/pdf';
      if (b64.startsWith('UklGR')) return 'image/webp';
      return 'image/jpeg';
    };

    const mimes = imageList.map(detectMime);
    const imageParts = imageList.map((b64, i) => ({
      inlineData: { mimeType: mimes[i], data: b64 },
    }));

    if (__DEV__) console.log('scanStatement:', imageList.length, 'images, mimes:', mimes);

    const currencyHint = accountCurrency ? `Account currency: ${accountCurrency}.` : '';

    const prompt = `You are reading a credit-card or bank account statement image.
${currencyHint}
Extract EVERY individual transaction line as a JSON ARRAY (no prose, no markdown):
[{
  "date": "YYYY-MM-DD",
  "amount": <signed number, negative = charge/debit, positive = refund/credit/income>,
  "payee": "<original merchant text, do NOT translate>",
  "notes": "<optional: installment X/Y, foreign amount with currency, standing-order tag>",
  "confidence": "high" | "medium" | "low"
}]

EXTRACT FROM:
- Domestic transaction list (any list of dated rows with amounts)
- Foreign-purchase section — use the converted local-currency amount, NOT the foreign one

DO NOT EXTRACT:
- Running balance lines ("יתרה ליום", "balance after", "remaining balance")
- Total / sum / subtotal lines ("סך הכל", "סך עסקאות", "סך חיובים", "Total", "Subtotal", "סה\\"כ")
- Section or column headers / titles printed in distinct rows above the lists
- Payment-source breakdown sections ("פירוט תשלומים לפי מקור חיוב", account routing summaries)
- Card / account numbers, addresses, phone numbers, customer name
- Marketing or promotional content, advertisements, page footers
- QR codes, barcodes

SPECIAL CASES:
- INSTALLMENTS ("תשלום X מתוך Y", "X/Y", monthly installment): amount = per-installment value as printed (NOT the total). Put "תשלום X/Y" or equivalent in notes.
- REPEATED LINES with identical payee+date+amount: each line is a SEPARATE transaction. Do NOT deduplicate.
- FOREIGN purchases: use the converted ${accountCurrency || 'local'}-currency amount. Put the foreign amount with its currency in notes (e.g. "$23.90 USD").
- Standing-order markers ("הוראת קבע", "standing order"): copy the marker to notes.

Date: normalise any format (DD/MM/YYYY, YYYY-MM-DD, "Dublin 28/02/26") to YYYY-MM-DD. If only DD/MM is shown, assume the current year.
Payee: keep the original language and characters. No translation, no transliteration.
Confidence: "low" when the text is unclear / partially obscured / ambiguous; "high" otherwise. Default to "high" if unsure.

Return ONLY the JSON array. No surrounding text, no markdown fences.`;

    const requestBody = JSON.stringify({
      contents: [{ parts: [{ text: prompt }, ...imageParts] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
    });

    const fetchOpts = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: requestBody };
    let res = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, fetchOpts);
    if (!res.ok && (res.status >= 500 || res.status === 429)) {
      if (__DEV__) console.warn('scanStatement: primary', res.status, '— retrying on fallback model');
      res = await fetch(`${geminiUrl(GEMINI_MODEL_FALLBACK)}?key=${GEMINI_API_KEY}`, fetchOpts);
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      if (__DEV__) console.error('scanStatement API error:', res.status, errText);
      _lastAIError = {
        code: res.status === 429 ? 'rate_limit' : res.status === 401 || res.status === 403 ? 'auth' : res.status >= 500 ? 'server' : 'http_error',
        status: res.status,
        message: errText.slice(0, 200),
      };
      return [];
    }

    const data = await res.json() as GeminiResponse;
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (__DEV__) console.log('scanStatement raw text length:', text.length);

    // Strip markdown fences and isolate the JSON array.
    let jsonStr = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    const start = jsonStr.indexOf('[');
    const end = jsonStr.lastIndexOf(']');
    if (start >= 0 && end > start) jsonStr = jsonStr.slice(start, end + 1);

    let parsed: any;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      if (__DEV__) console.error('scanStatement JSON parse failed:', e);
      _lastAIError = { code: 'empty_response', message: 'Could not parse statement JSON' };
      return [];
    }

    if (!Array.isArray(parsed)) {
      _lastAIError = { code: 'empty_response', message: 'Response was not an array' };
      return [];
    }

    _lastAIError = null;
    return parsed.filter((row: any) =>
      row && typeof row.amount === 'number' && typeof row.date === 'string' && typeof row.payee === 'string'
    ) as ExtractedTx[];
  } catch (e: any) {
    if (__DEV__) console.error('scanStatement error:', e);
    _lastAIError = { code: 'network', message: String(e?.message || e) };
    return [];
  }
}
```

- [ ] **Step 4: Export `scanStatement` from the default object**

In `src/services/aiService.ts`, find the `export default { ... }` block and add `scanStatement,` next to `scanReceipt`:

```ts
export default {
  parseTransaction,
  parseTransactionSmart,
  detectCardBrand,
  CARD_BRAND_KEYWORDS,
  calculateTaxReserve,
  predictCashFlow,
  calculateDailyBudget,
  generateInsights,
  getPersonalAdvice,
  chatWithAI,
  interpretChartQuery,
  buildChartData,
  scanReceipt,
  scanReceiptItems,
  scanStatement,                       // ← add this
  translateCategoryName,
  callGemini,
  getLastAIError,
  MAAM_RATE,
  ESTIMATED_INCOME_TAX,
  BITUACH_LEUMI,
};
```

- [ ] **Step 5: TypeScript check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Full test suite still green**

Run: `npm test`
Expected: all tests pass (no aiService unit tests touch `scanStatement`, but the file must still compile and the existing 36 aiService tests still pass).

- [ ] **Step 7: Commit**

```bash
git add src/services/aiService.ts
git commit -m "feat(ai): scanStatement — Gemini Vision extraction of statement lines"
```

---

## Task 5: i18n keys

**Files:**
- Modify: `src/i18n/ru.ts`, `src/i18n/he.ts`, `src/i18n/en.ts`

- [ ] **Step 1: Find an anchor to insert near (the `scanReceiptAction` key is a natural neighbour)**

Run: `grep -n "scanReceiptAction" src/i18n/en.ts src/i18n/ru.ts src/i18n/he.ts`
Expected: one line per file.

- [ ] **Step 2: Add keys to `src/i18n/en.ts`**

Right after the `scanReceiptAction` line in `src/i18n/en.ts`, insert:

```ts
  importStatement: 'Import statement',
  importStatementTitle: 'Import from statement',
  analyzingStatement: 'Reading statement…',
  statementParseFailed: 'Could not read the statement',
  statementNoneFound: 'No transactions recognized — try another photo',
  statementSectionNew: 'New',
  statementSectionSimilar: 'Similar to existing',
  statementSectionAlreadyIn: 'Already in account',
  statementLooksLikeExisting: 'Looks like an existing transaction',
  statementLooksLikeRecurring: 'Looks like a recurring payment',
  statementBtnSameSkip: 'Same — skip',
  statementBtnItIsNew: 'It\'s new — add',
  statementBtnConfirmRecurring: 'Confirm as recurring',
  statementBtnAddSeparate: 'Add as separate',
  statementSaveBtn: 'Save {count}',
  statementImported: 'Added {count} transactions',
  statementSourceHistory: 'from history',
  statementSourceRecurring: 'recurring',
  statementSourceAi: 'AI',
```

- [ ] **Step 3: Add the same keys to `src/i18n/ru.ts`**

```ts
  importStatement: 'Импорт выписки',
  importStatementTitle: 'Импорт из выписки',
  analyzingStatement: 'Распознаю выписку…',
  statementParseFailed: 'Не удалось распознать выписку',
  statementNoneFound: 'Операции не найдены — попробуй другое фото',
  statementSectionNew: 'Новые',
  statementSectionSimilar: 'Похожи на существующие',
  statementSectionAlreadyIn: 'Уже в счёте',
  statementLooksLikeExisting: 'Похоже на существующую операцию',
  statementLooksLikeRecurring: 'Похоже на повторяющийся платёж',
  statementBtnSameSkip: 'Это та же — пропустить',
  statementBtnItIsNew: 'Это новая — добавить',
  statementBtnConfirmRecurring: 'Подтвердить как плановый',
  statementBtnAddSeparate: 'Добавить отдельно',
  statementSaveBtn: 'Сохранить {count}',
  statementImported: 'Добавлено {count} операций',
  statementSourceHistory: 'из истории',
  statementSourceRecurring: 'плановый',
  statementSourceAi: 'AI',
```

- [ ] **Step 4: Add the same keys to `src/i18n/he.ts`**

```ts
  importStatement: 'ייבוא דף תנועות',
  importStatementTitle: 'ייבוא מדף תנועות',
  analyzingStatement: 'מנתח את הדף…',
  statementParseFailed: 'לא ניתן לקרוא את הדף',
  statementNoneFound: 'לא זוהו תנועות — נסה תמונה אחרת',
  statementSectionNew: 'חדשות',
  statementSectionSimilar: 'דומות לקיימות',
  statementSectionAlreadyIn: 'כבר בחשבון',
  statementLooksLikeExisting: 'נראה כמו תנועה קיימת',
  statementLooksLikeRecurring: 'נראה כמו תשלום קבוע',
  statementBtnSameSkip: 'אותה תנועה — דלג',
  statementBtnItIsNew: 'זו חדשה — הוסף',
  statementBtnConfirmRecurring: 'אשר כתשלום קבוע',
  statementBtnAddSeparate: 'הוסף בנפרד',
  statementSaveBtn: 'שמור {count}',
  statementImported: 'נוספו {count} תנועות',
  statementSourceHistory: 'מההיסטוריה',
  statementSourceRecurring: 'תשלום קבוע',
  statementSourceAi: 'AI',
```

- [ ] **Step 5: TypeScript check (i18n files compile)**

Run: `npx tsc --noEmit`
Expected: exit 0 (no duplicate keys — our earlier dedup keeps the dicts clean).

- [ ] **Step 6: Commit**

```bash
git add src/i18n/en.ts src/i18n/ru.ts src/i18n/he.ts
git commit -m "i18n: keys for statement import flow"
```

---

## Task 6: `StatementSimilarCard.js` (leaf component)

**Files:**
- Create: `src/components/StatementSimilarCard.js`

- [ ] **Step 1: Create the component**

`src/components/StatementSimilarCard.js`:

```jsx
// src/components/StatementSimilarCard.js
// One row in the "Similar to existing" section of the statement import flow:
// shows the extracted line on top, the existing candidate (or recurring
// template) below, and two action buttons. No default — the user must choose.
import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import i18n from '../i18n';
import { colors } from '../theme/colors';
import Amount from './Amount';
import RowText from './RowText';

export default function StatementSimilarCard({ extracted, candidate, isRecurring, onSame, onNew }) {
  const st = createSt();
  return (
    <View style={st.card}>
      {/* Extracted (top) */}
      <View style={st.row}>
        <Text style={st.dim}>{extracted.date}</Text>
        <RowText style={st.payee} numberOfLines={1}>{extracted.payee}</RowText>
        <Amount value={extracted.amount} sign style={st.amount} />
      </View>

      <View style={st.divider} />

      {/* Hint */}
      <View style={st.hintRow}>
        <Feather name={isRecurring ? 'repeat' : 'corner-down-left'} size={12} color={colors.textMuted} />
        <Text style={st.hint}>
          {isRecurring ? i18n.t('statementLooksLikeRecurring') : i18n.t('statementLooksLikeExisting')}
        </Text>
      </View>

      {/* Candidate (bottom) */}
      <View style={st.row}>
        <Text style={st.dim}>{isRecurring ? candidate.nextDate : (candidate.date || '').slice(0, 10)}</Text>
        <RowText style={st.payee} numberOfLines={1}>{candidate.recipient || '—'}</RowText>
        <Amount value={candidate.amount} sign style={st.amount} />
      </View>

      {/* Actions */}
      <View style={st.btnRow}>
        <TouchableOpacity style={[st.btn, st.btnSecondary]} onPress={onSame} activeOpacity={0.7}>
          <Text style={st.btnSecondaryTxt}>{i18n.t('statementBtnSameSkip')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[st.btn, st.btnPrimary]} onPress={onNew} activeOpacity={0.7}>
          <Text style={st.btnPrimaryTxt}>
            {isRecurring ? i18n.t('statementBtnConfirmRecurring') : i18n.t('statementBtnItIsNew')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createSt = () => StyleSheet.create({
  card: { backgroundColor: colors.bg2, borderRadius: 14, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: colors.cardBorder },
  row: { flexDirection: i18n.row(), alignItems: 'center', gap: 8 },
  dim: { color: colors.textMuted, fontSize: 12, fontWeight: '600', minWidth: 64 },
  payee: { color: colors.text, fontSize: 14, fontWeight: '600', textAlign: i18n.textAlign() },
  amount: { fontSize: 14, fontWeight: '700' },
  divider: { height: 1, backgroundColor: colors.divider, marginVertical: 10 },
  hintRow: { flexDirection: i18n.row(), alignItems: 'center', gap: 6, marginBottom: 8 },
  hint: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  btnRow: { flexDirection: i18n.row(), gap: 8, marginTop: 12 },
  btn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', borderWidth: 1 },
  btnSecondary: { backgroundColor: 'transparent', borderColor: colors.cardBorder },
  btnSecondaryTxt: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
  btnPrimary: { backgroundColor: colors.green, borderColor: colors.green },
  btnPrimaryTxt: { color: colors.bg, fontSize: 13, fontWeight: '700' },
});
```

- [ ] **Step 2: Lint check**

Run: `npx eslint src/components/StatementSimilarCard.js --no-ignore`
Expected: 0 errors (warnings OK).

- [ ] **Step 3: Commit**

```bash
git add src/components/StatementSimilarCard.js
git commit -m "feat(components): StatementSimilarCard — review card with two action buttons"
```

---

## Task 7: `StatementReviewSection.js` (collapsible section wrapper)

**Files:**
- Create: `src/components/StatementReviewSection.js`

- [ ] **Step 1: Create the component**

`src/components/StatementReviewSection.js`:

```jsx
// src/components/StatementReviewSection.js
// Collapsible group header for one of the three review sections
// (New / Similar / Already-in-account). Renders its children only when open.
import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import i18n from '../i18n';
import { colors } from '../theme/colors';

export default function StatementReviewSection({ title, count, accent, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  const st = createSt();
  return (
    <View style={st.wrap}>
      <TouchableOpacity style={st.header} onPress={() => setOpen(o => !o)} activeOpacity={0.7}>
        <View style={[st.dot, { backgroundColor: accent || colors.textMuted }]} />
        <Text style={[st.title, { color: accent || colors.text }]}>{title}</Text>
        <Text style={st.count}>{count}</Text>
        <Feather name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
      </TouchableOpacity>
      {open && <View style={st.body}>{children}</View>}
    </View>
  );
}

const createSt = () => StyleSheet.create({
  wrap: { marginBottom: 14 },
  header: { flexDirection: i18n.row(), alignItems: 'center', gap: 8, paddingVertical: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  title: { flex: 1, fontSize: 13, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', textAlign: i18n.textAlign() },
  count: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  body: { },
});
```

- [ ] **Step 2: Lint check**

Run: `npx eslint src/components/StatementReviewSection.js --no-ignore`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/StatementReviewSection.js
git commit -m "feat(components): StatementReviewSection — collapsible group header"
```

---

## Task 8: `StatementScannerModal.js` (multi-step orchestrator)

**Files:**
- Create: `src/components/StatementScannerModal.js`

- [ ] **Step 1: Create the component**

`src/components/StatementScannerModal.js`:

```jsx
// src/components/StatementScannerModal.js
// Multi-step modal: pick image(s) → analyzing → review (3 sections) → saving.
// Account is implicit (passed via props from AccountHistoryScreen).
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import i18n from '../i18n';
import aiService from '../services/aiService';
import dataService from '../services/dataService';
import { categoryConfig, colors } from '../theme/colors';
import { catColor, catName } from '../utils/categoryName';
import { sym } from '../utils/currency';
import { reconcile } from '../utils/statementReconcile';
import { categorize } from '../utils/statementCategorize';
import Amount from './Amount';
import CategoryPickerModal from './CategoryPickerModal';
import RowText from './RowText';
import StatementReviewSection from './StatementReviewSection';
import StatementSimilarCard from './StatementSimilarCard';
import SwipeModal from './SwipeModal';

export default function StatementScannerModal({ visible, onClose, accountId, accountCurrency, onSaved }) {
  const [step, setStep] = useState('pick');           // 'pick' | 'analyzing' | 'review' | 'saving'
  const [images, setImages] = useState([]);            // [{ uri, base64 }]
  const [results, setResults] = useState([]);          // ReconcileResult[]
  const [catGuess, setCatGuess] = useState({});        // id → CategoryGuess (for 'new' results)
  const [rowState, setRowState] = useState({});        // id → { checked, decision, categoryId, date, amount }
  const [error, setError] = useState('');
  const [editCatIdx, setEditCatIdx] = useState(null);  // index of result whose category is being edited

  const st = createSt();

  // Reset on each open
  useEffect(() => {
    if (visible) {
      setStep('pick');
      setImages([]);
      setResults([]);
      setCatGuess({});
      setRowState({});
      setError('');
    }
  }, [visible]);

  const pickImage = async (useCamera) => {
    try {
      const options = { base64: true, quality: 0.85, allowsEditing: false, exif: false };
      const res = useCamera
        ? await (async () => {
            const perm = await ImagePicker.requestCameraPermissionsAsync();
            if (!perm.granted) { setError(i18n.t('cameraPermission')); return null; }
            return ImagePicker.launchCameraAsync(options);
          })()
        : await ImagePicker.launchImageLibraryAsync(options);
      if (!res || res.canceled || !res.assets?.[0]?.base64) return;
      setImages(prev => [...prev, { uri: res.assets[0].uri, base64: res.assets[0].base64 }]);
      setError('');
    } catch (e) {
      if (__DEV__) console.error('statement pickImage:', e);
      setError(i18n.t('scanFailed'));
    }
  };

  const analyze = async () => {
    if (images.length === 0) return;
    setStep('analyzing');
    setError('');
    try {
      const base64List = images.map(i => i.base64);
      const extracted = await aiService.scanStatement(base64List, accountCurrency);
      if (!extracted || extracted.length === 0) {
        setError(i18n.t('statementNoneFound'));
        setStep('pick');
        return;
      }

      // Load existing (this account, last 60 days) + recurring (this account, active) + history (all accounts, 6 months)
      const cutoffExist = new Date(); cutoffExist.setDate(cutoffExist.getDate() - 60);
      const cutoffHist  = new Date(); cutoffHist.setMonth(cutoffHist.getMonth() - 6);
      const [allTx, allRec] = await Promise.all([dataService.getTransactions(), dataService.getRecurring()]);
      const existing = allTx.filter(t => t.account === accountId && (t.date || '').slice(0, 10) >= cutoffExist.toISOString().slice(0, 10));
      const recurring = allRec.filter(r => r.account === accountId && r.isActive);
      const history = allTx.filter(t => (t.date || '').slice(0, 10) >= cutoffHist.toISOString().slice(0, 10));

      const reconciled = reconcile(extracted, existing, recurring);

      // For 'new' kind — guess a category up-front so the user can review it
      const guesses = {};
      const initial = {};
      reconciled.forEach((r, i) => {
        if (r.kind === 'new') {
          const g = categorize(r.extracted.payee, history, allRec);
          guesses[i] = g;
          initial[i] = {
            checked: r.extracted.confidence !== 'low',
            categoryId: g.categoryId,
            date: r.extracted.date,
            amount: r.extracted.amount,
          };
        } else if (r.kind === 'similar') {
          initial[i] = { decision: null }; // user must choose: 'same' | 'new'
        } else if (r.kind === 'recurring') {
          initial[i] = { checked: true, decision: null }; // 'confirm' | 'separate'
        }
        // 'exact' rows have no checkbox state — they appear collapsed in the Already section.
      });
      setCatGuess(guesses);
      setRowState(initial);
      setResults(reconciled);
      setStep('review');
    } catch (e) {
      if (__DEV__) console.error('statement analyze:', e);
      setError(i18n.t('statementParseFailed'));
      setStep('pick');
    }
  };

  const toggleRow = (i) => setRowState(s => ({ ...s, [i]: { ...s[i], checked: !s[i]?.checked } }));
  const setRowField = (i, field, value) => setRowState(s => ({ ...s, [i]: { ...s[i], [field]: value } }));

  const setSimilarDecision = (i, decision) => setRowState(s => ({ ...s, [i]: { ...s[i], decision, checked: decision === 'new' } }));
  const setRecurringDecision = (i, decision) => setRowState(s => ({ ...s, [i]: { ...s[i], decision, checked: true } }));

  // Counter — how many will actually be added when "Save" is pressed
  const saveCount = useMemo(() => {
    let n = 0;
    results.forEach((r, i) => {
      const s = rowState[i] || {};
      if (r.kind === 'new' && s.checked) n++;
      if (r.kind === 'similar' && s.decision === 'new') n++;
      if (r.kind === 'recurring' && s.decision != null) n++;     // either confirm or separate counts
    });
    return n;
  }, [results, rowState]);

  const save = async () => {
    setStep('saving');
    let ok = 0, fail = 0;
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const s = rowState[i] || {};
      try {
        if (r.kind === 'new' && s.checked) {
          const cfg = categoryConfig[s.categoryId] || {};
          const isCharge = r.extracted.amount < 0;
          await dataService.addTransaction({
            type: isCharge ? 'expense' : 'income',
            amount: Math.abs(s.amount ?? r.extracted.amount),
            categoryId: s.categoryId,
            categoryName: catName(s.categoryId),
            icon: cfg.icon,
            recipient: r.extracted.payee,
            note: r.extracted.notes || '',
            currency: accountCurrency || sym(),
            date: new Date(s.date || r.extracted.date).toISOString(),
            account: accountId,
            tags: [],
          });
          ok++;
        } else if (r.kind === 'similar' && s.decision === 'new') {
          // No category guess for similar matches; fall back to 'other'
          await dataService.addTransaction({
            type: r.extracted.amount < 0 ? 'expense' : 'income',
            amount: Math.abs(r.extracted.amount),
            categoryId: 'other',
            recipient: r.extracted.payee,
            note: r.extracted.notes || '',
            currency: accountCurrency || sym(),
            date: new Date(r.extracted.date).toISOString(),
            account: accountId,
            tags: [],
          });
          ok++;
        } else if (r.kind === 'recurring' && s.decision === 'confirm') {
          await dataService.confirmRecurring(r.recurring.id, {
            amount: Math.abs(r.extracted.amount),
            date: new Date(r.extracted.date).toISOString(),
          });
          ok++;
        } else if (r.kind === 'recurring' && s.decision === 'separate') {
          await dataService.addTransaction({
            type: r.extracted.amount < 0 ? 'expense' : 'income',
            amount: Math.abs(r.extracted.amount),
            categoryId: 'other',
            recipient: r.extracted.payee,
            note: r.extracted.notes || '',
            currency: accountCurrency || sym(),
            date: new Date(r.extracted.date).toISOString(),
            account: accountId,
            tags: [],
          });
          ok++;
        }
      } catch (e) {
        if (__DEV__) console.error('statement save row failed:', e);
        fail++;
      }
    }
    onSaved && onSaved({ added: ok, failed: fail });
    onClose && onClose();
  };

  // ---------------------------------------------------------------- Render
  return (
    <>
    <SwipeModal visible={visible} onClose={onClose}>
      {({ close }) => (
        <View style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={st.title}>{i18n.t('importStatementTitle')}</Text>

          {error ? (
            <View style={st.errCard}>
              <Feather name="alert-circle" size={16} color={colors.red} />
              <Text style={st.errTxt}>{error}</Text>
            </View>
          ) : null}

          {/* PICK */}
          {step === 'pick' && (
            <View>
              {images.length > 0 && (
                <View style={st.thumbRow}>
                  {images.map((img, i) => (
                    <View key={i} style={st.thumbWrap}>
                      <Image source={{ uri: img.uri }} style={st.thumb} resizeMode="cover" />
                      <TouchableOpacity style={st.thumbX} onPress={() => setImages(p => p.filter((_, j) => j !== i))}>
                        <Feather name="x" size={12} color={colors.bg} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
              <View style={st.pickRow}>
                <TouchableOpacity style={st.pickBtn} onPress={() => pickImage(true)} activeOpacity={0.7}>
                  <Feather name="camera" size={24} color={colors.green} />
                  <Text style={st.pickBtnTxt}>{i18n.t('takePhoto')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={st.pickBtn} onPress={() => pickImage(false)} activeOpacity={0.7}>
                  <Feather name="image" size={24} color={colors.blue} />
                  <Text style={st.pickBtnTxt}>{i18n.t('fromGallery')}</Text>
                </TouchableOpacity>
              </View>
              {images.length > 0 && (
                <TouchableOpacity style={st.actionBtn} onPress={analyze} activeOpacity={0.7}>
                  <Feather name="search" size={16} color={colors.bg} />
                  <Text style={st.actionBtnTxt}>{i18n.t('scanReceiptAction')} ({images.length})</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* ANALYZING */}
          {step === 'analyzing' && (
            <View style={st.center}>
              <ActivityIndicator size="large" color={colors.green} />
              <Text style={st.centerTxt}>{i18n.t('analyzingStatement')}</Text>
            </View>
          )}

          {/* REVIEW */}
          {step === 'review' && (() => {
            const news     = results.map((r, i) => ({ r, i })).filter(x => x.r.kind === 'new');
            const similars = results.map((r, i) => ({ r, i })).filter(x => x.r.kind === 'similar' || x.r.kind === 'recurring');
            const exacts   = results.map((r, i) => ({ r, i })).filter(x => x.r.kind === 'exact');

            return (
              <View>
                <StatementReviewSection
                  title={i18n.t('statementSectionNew')}
                  count={news.length}
                  accent={colors.green}
                  defaultOpen={true}
                >
                  {news.map(({ r, i }) => {
                    const s = rowState[i] || {};
                    const cat = s.categoryId || 'other';
                    const c = categoryConfig[cat] || {};
                    const guessSource = catGuess[i]?.source;
                    return (
                      <TouchableOpacity key={i} style={st.newRow} onPress={() => toggleRow(i)} activeOpacity={0.7}>
                        <Feather name={s.checked ? 'check-square' : 'square'} size={18} color={s.checked ? colors.green : colors.textMuted} />
                        <TouchableOpacity style={[st.catChip, { backgroundColor: (c.color || catColor(cat)) + '20' }]} onPress={() => setEditCatIdx(i)}>
                          <Feather name={c.icon || 'tag'} size={12} color={c.color || catColor(cat)} />
                          <Text style={[st.catChipTxt, { color: c.color || catColor(cat) }]} numberOfLines={1}>{catName(cat)}</Text>
                        </TouchableOpacity>
                        <RowText style={st.newPayee} numberOfLines={1}>
                          {r.extracted.payee}
                          {guessSource ? <Text style={st.srcHint}>  · {i18n.t('statementSource' + guessSource.charAt(0).toUpperCase() + guessSource.slice(1))}</Text> : null}
                        </RowText>
                        <Amount value={r.extracted.amount} sign style={st.newAmount} />
                      </TouchableOpacity>
                    );
                  })}
                </StatementReviewSection>

                <StatementReviewSection
                  title={i18n.t('statementSectionSimilar')}
                  count={similars.length}
                  accent={colors.yellow}
                  defaultOpen={true}
                >
                  {similars.map(({ r, i }) => {
                    if (r.kind === 'recurring') {
                      return (
                        <StatementSimilarCard
                          key={i}
                          extracted={r.extracted}
                          candidate={r.recurring}
                          isRecurring
                          onSame={() => setRecurringDecision(i, 'separate')}    // user says "treat as separate (skip recurring)"; default 'separate' just adds it
                          onNew={() => setRecurringDecision(i, 'confirm')}      // user says "confirm as the recurring template"
                        />
                      );
                    }
                    // 'similar'
                    const candidate = r.candidates[0]; // show first candidate; if multiple, future polish can iterate
                    return (
                      <StatementSimilarCard
                        key={i}
                        extracted={r.extracted}
                        candidate={candidate}
                        isRecurring={false}
                        onSame={() => setSimilarDecision(i, 'same')}
                        onNew={() => setSimilarDecision(i, 'new')}
                      />
                    );
                  })}
                </StatementReviewSection>

                <StatementReviewSection
                  title={i18n.t('statementSectionAlreadyIn')}
                  count={exacts.length}
                  accent={colors.textMuted}
                  defaultOpen={false}
                >
                  {exacts.map(({ r, i }) => (
                    <View key={i} style={st.exactRow}>
                      <Text style={st.exactDate}>{r.extracted.date}</Text>
                      <RowText style={st.exactPayee} numberOfLines={1}>{r.extracted.payee}</RowText>
                      <Amount value={r.extracted.amount} sign style={st.exactAmount} />
                    </View>
                  ))}
                </StatementReviewSection>
              </View>
            );
          })()}

          {step === 'saving' && (
            <View style={st.center}><ActivityIndicator size="large" color={colors.green} /></View>
          )}
        </ScrollView>

        {/* Footer Save button (only in review) */}
        {step === 'review' && (
          <View style={st.footer}>
            <TouchableOpacity
              style={[st.actionBtn, saveCount === 0 && { opacity: 0.4 }]}
              onPress={save}
              disabled={saveCount === 0}
              activeOpacity={0.7}
            >
              <Feather name="check" size={16} color={colors.bg} />
              <Text style={st.actionBtnTxt}>{i18n.t('statementSaveBtn').replace('{count}', String(saveCount))}</Text>
            </TouchableOpacity>
          </View>
        )}
        </View>
      )}
    </SwipeModal>

    {/* Category picker for editing a "new" row's category */}
    <CategoryPickerModal
      visible={editCatIdx != null}
      onClose={() => setEditCatIdx(null)}
      type={results[editCatIdx]?.extracted.amount < 0 ? 'expense' : 'income'}
      onSelect={(id) => { setRowField(editCatIdx, 'categoryId', id); setEditCatIdx(null); }}
    />
    </>
  );
}

const createSt = () => StyleSheet.create({
  title: { color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 16, textAlign: i18n.textAlign() },
  errCard: { flexDirection: i18n.row(), alignItems: 'center', gap: 8, backgroundColor: colors.redSoft, borderRadius: 10, padding: 10, marginBottom: 14, borderWidth: 1, borderColor: colors.red + '30' },
  errTxt: { color: colors.red, fontSize: 12, fontWeight: '600', flex: 1 },
  pickRow: { flexDirection: i18n.row(), gap: 12, marginBottom: 14 },
  pickBtn: { flex: 1, alignItems: 'center', paddingVertical: 20, borderRadius: 14, backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.cardBorder, gap: 8 },
  pickBtnTxt: { color: colors.text, fontSize: 13, fontWeight: '600' },
  thumbRow: { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  thumbWrap: { position: 'relative' },
  thumb: { width: 70, height: 90, borderRadius: 10, backgroundColor: colors.bg2 },
  thumbX: { position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.red, justifyContent: 'center', alignItems: 'center' },
  actionBtn: { flexDirection: i18n.row(), alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.green, borderRadius: 14, paddingVertical: 14, marginTop: 8 },
  actionBtnTxt: { color: colors.bg, fontSize: 15, fontWeight: '700' },
  center: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  centerTxt: { color: colors.textDim, fontSize: 13 },
  newRow: { flexDirection: i18n.row(), alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 4 },
  catChip: { flexDirection: i18n.row(), alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, maxWidth: 110 },
  catChipTxt: { fontSize: 11, fontWeight: '700' },
  newPayee: { color: colors.text, fontSize: 13, fontWeight: '600', textAlign: i18n.textAlign() },
  srcHint: { color: colors.textMuted, fontSize: 10, fontWeight: '600' },
  newAmount: { fontSize: 13, fontWeight: '700' },
  exactRow: { flexDirection: i18n.row(), alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 4, opacity: 0.6 },
  exactDate: { color: colors.textMuted, fontSize: 11, minWidth: 64 },
  exactPayee: { color: colors.textDim, fontSize: 12, textAlign: i18n.textAlign() },
  exactAmount: { fontSize: 12, color: colors.textDim },
  footer: { paddingVertical: 12 },
});
```

- [ ] **Step 2: Lint check**

Run: `npx eslint src/components/StatementScannerModal.js --no-ignore`
Expected: 0 errors (warnings about unused imports are OK).

- [ ] **Step 3: TypeScript check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/components/StatementScannerModal.js
git commit -m "feat(components): StatementScannerModal — pick → analyze → review → save"
```

---

## Task 9: AccountHistoryScreen integration

**Files:**
- Modify: `src/screens/AccountHistoryScreen.js`

- [ ] **Step 1: Add the import**

Find `import AddTransactionModal from '../components/AddTransactionModal';` and add directly below:

```js
import StatementScannerModal from '../components/StatementScannerModal';
```

- [ ] **Step 2: Add the state**

Find `const [showAdd, setShowAdd] = useState(false);` and add directly below:

```js
const [showStatement, setShowStatement] = useState(false);
```

- [ ] **Step 3: Find where the existing modals are rendered**

Run: `grep -n "AddTransactionModal visible" src/screens/AccountHistoryScreen.js`
Expected: one line (the render of `AddTransactionModal`).

- [ ] **Step 4: Render the new modal alongside the existing ones**

Directly after the existing `<AddTransactionModal ... />` line, add:

```jsx
<StatementScannerModal
  visible={showStatement}
  onClose={() => setShowStatement(false)}
  accountId={account.id}
  accountCurrency={account.currency}
  onSaved={() => loadData()}
/>
```

- [ ] **Step 5: Add the entry-point button next to the header**

Find the header rendering — locate the line near `account.accountNumber ? ${account.accountNumber} · : ''` (around line 315). The header is a row already; add a small icon button next to the title:

Search for the closing of the header `</View>` or the right-side icon group. Inside the header `<View>` (after the title text and any existing right-side controls), add:

```jsx
<TouchableOpacity onPress={() => setShowStatement(true)} style={{ padding: 8, marginStart: 8 }} activeOpacity={0.7}>
  <Feather name="file-text" size={20} color={colors.green} />
</TouchableOpacity>
```

If you cannot locate a clean spot in the header row, instead render the button as a floating action below the chart, before the transaction list, like this — find the chart render (`BalanceLineChart`) and immediately after its closing tag, add:

```jsx
<TouchableOpacity
  onPress={() => setShowStatement(true)}
  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.bg2, paddingVertical: 12, marginHorizontal: 16, marginBottom: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.cardBorder }}
  activeOpacity={0.7}
>
  <Feather name="file-text" size={16} color={colors.green} />
  <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>{i18n.t('importStatement')}</Text>
</TouchableOpacity>
```

- [ ] **Step 6: Lint + tsc**

Run: `npx eslint src/screens/AccountHistoryScreen.js --no-ignore`
Expected: 0 errors.

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 7: Run the full test suite**

Run: `npm test`
Expected: all tests pass (the new utils' tests now total +30; nothing else changes).

- [ ] **Step 8: Commit**

```bash
git add src/screens/AccountHistoryScreen.js
git commit -m "feat(accounts): wire StatementScannerModal into AccountHistoryScreen"
```

---

## Task 10: Manual verification + push

- [ ] **Step 1: Push the branch**

```bash
git push origin main
```

- [ ] **Step 2: Manual smoke checklist**

After the next preview APK build that includes these commits, verify on a real device:

1. Open an account → tap **"Import statement"** → modal opens on **pick** step.
2. Pick a screenshot of a bank or card statement from gallery → tap **Scan (1)**.
3. Wait for **analyzing** step → review screen renders three sections.
4. **New** section: rows have categories pre-filled (history hint visible for matched ones), checkboxes default ON; uncheck-able; category chip tap → CategoryPickerModal opens; category changes after pick.
5. **Similar** section: card shows extracted + candidate; tapping **"Same — skip"** does NOT increment the save counter; tapping **"It's new — add"** DOES.
6. **Recurring** card: tapping **"Confirm as recurring"** vs **"Add as separate"** both increment the counter.
7. **Already in account** section: collapsed by default; expanding shows the exact-match rows.
8. Save button label updates with the live count; tap → bulk-add runs → modal closes → AccountHistory list refreshes with the new transactions.
9. Check that recurring confirmed via this flow advanced its `nextDate` on the Recurring screen.

- [ ] **Step 3: If any step fails, file a bug + add a follow-up task**

Capture screenshots, paste error text from Metro (in dev) or from the on-screen error (in release), and update this plan with a new task to fix.

---

## Spec coverage check

| Spec section | Implemented in |
|---|---|
| §3 User flow (entry → pick → analyze → review → save) | Task 8, Task 9 |
| §4 Reconciliation rules (exact / similar / recurring / new) | Task 2 |
| §4 Recurring uses `confirmRecurring` overrides | Task 8 (`save()` branch `recurring + confirm`) |
| §5 Smart categorisation (history > recurring > AI > fallback) | Task 3 |
| §6 Review UI (3 sections, similar card, low-confidence default off) | Task 6, Task 7, Task 8 |
| §6.1 Tap-category opens CategoryPickerModal | Task 8 |
| §6.3 Already-in-account collapsed by default | Task 7, Task 8 |
| §7 Architecture (file map matches plan tasks) | Tasks 1-3, 6-8 |
| §7.3 Type contracts (ExtractedTx, ReconcileResult, CategoryGuess) | Task 4, Task 2, Task 3 |
| §8 Gemini prompt | Task 4 |
| §9 Error handling (`_lastAIError` plumbing, toast on empty) | Task 4, Task 8 |
| §10 Testing (unit tests for the two pure utils, manual e2e for UI) | Tasks 1-3, Task 10 |
| §11 Out of scope (no CSV / no auto-account / no bulk atomic / no FX) | Honoured: no CSV import, no atomic batch, no FX lookup |
| §12 Open question: bulk atomic | Iterative loop in Task 8 (followup possible) |
