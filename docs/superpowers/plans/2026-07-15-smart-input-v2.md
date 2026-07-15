# Smart Input v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 3-layer Smart Input pipeline — instant repeat dictionary → Gemini prompt personalized with the user's own categories and history → local fallback — plus a habit-based account cascade, extracted into focused `src/services/ai/` modules behind the existing aiService facade.

**Architecture:** Pure, unit-tested modules (`localDictionary`, `accountResolver`, `promptBuilder`, `localParser`) orchestrated by `smartParse.ts`; `client.ts` owns the Gemini transport. `aiService.ts` keeps its public surface via imports + re-exports so none of its ~15 importers change (same facade trick as the categories catalog).

**Tech Stack:** React Native (Expo SDK 53), TypeScript, Jest, Gemini API.

**Spec:** `docs/superpowers/specs/2026-07-15-smart-input-v2-design.md`

## Global Constraints

- aiService's default-export surface must not change: every key listed in its current `export default {...}` keeps working (existing `__tests__/aiService.test.js` green throughout is the guard).
- No amounts, dates or balances in anything sent to Gemini beyond today's payload; history examples are note/recipient text + categoryId only, capped at 30 (user privacy decision).
- All debug logging behind `__DEV__` (privacy rule from 10.07).
- RU/HE/EN parity: every new pure module gets test cases in all three languages.
- All user-facing strings via i18n × 11 languages (`node scripts/check-i18n.js` must stay green).
- Jest on this machine: `npx jest <pattern> --runInBand`.
- `npx tsc --noEmit` and `npx eslint <changed files> --quiet` clean before each commit.
- Commits end with:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

## File map

```
src/services/ai/client.ts           (new — moved transport)
src/services/ai/localParser.ts      (new — moved keyword parser + extractAmount)
src/services/ai/localDictionary.ts  (new)
src/services/ai/accountResolver.ts  (new)
src/services/ai/promptBuilder.ts    (new)
src/services/ai/smartParse.ts       (new — orchestrator, moved matchProjectInText)
src/services/aiService.ts           (shrinks; facade re-exports)
src/components/SmartInputModal.js   (source badge only)
src/i18n/*.ts                       (1 key × 11)
__tests__/aiLocalDictionary.test.js (new)
__tests__/aiAccountResolver.test.js (new)
__tests__/aiPromptBuilder.test.js   (new)
__tests__/aiSmartParse.test.js      (new)
```

---

### Task 1: Extract the Gemini transport into `ai/client.ts`

**Files:**
- Create: `src/services/ai/client.ts`
- Modify: `src/services/aiService.ts` (delete moved blocks; import from client)

**Interfaces:**
- Consumes: nothing new.
- Produces (used by Tasks 5–6 and by aiService internals):

```ts
// src/services/ai/client.ts
export interface AIError { code: string; status?: number; message?: string; }
export const GEMINI_MODEL_PRIMARY: string;   // 'gemini-2.5-flash'
export const GEMINI_MODEL_FALLBACK: string;  // 'gemini-flash-latest'
export const GEMINI_MODEL_STATEMENT: string; // 'gemini-2.5-pro'
export function geminiUrl(model: string): string;
export function callGeminiOnce(model, prompt, { maxTokens, temperature }): Promise<Response>;
export function callGemini(prompt: string, opts?: { maxTokens?: number; temperature?: number }): Promise<string | null>;
export function getLastAIError(): AIError | null;
export function setLastAIError(err: AIError | null): void; // scanners write it today
```

- [ ] **Step 1: Create `src/services/ai/client.ts`**

Move VERBATIM from `src/services/aiService.ts` into the new file (locate by symbol, not line number):
- the `GeminiResponse` interface;
- the `AIError` interface (export it);
- `GEMINI_API_KEY`, `GEMINI_MODEL_PRIMARY`, `GEMINI_MODEL_FALLBACK`, `GEMINI_MODEL_STATEMENT`, `geminiUrl` (export the models + geminiUrl);
- the module-load `__DEV__ && !GEMINI_API_KEY` console.warn block (verbatim, including its comment);
- the `_lastAIError` module variable and every function that defines it: `callGeminiOnce`, `callGemini`, and the existing `getLastAIError` (find it near callGemini in aiService).

Add at the bottom of client.ts:

```ts
// Scanners (receipt/statement) record their own failures so the modal can
// show the reason on screen; they live in aiService for now, so expose a
// setter until they migrate.
export function setLastAIError(err: AIError | null): void { _lastAIError = err; }
```

- [ ] **Step 2: Rewire aiService.ts**

a) Remove the moved blocks from aiService.ts.
b) Add at the top (keep the existing type re-export surface intact):

```ts
import {
  callGemini, callGeminiOnce, getLastAIError, setLastAIError,
  GEMINI_MODEL_PRIMARY, GEMINI_MODEL_FALLBACK, GEMINI_MODEL_STATEMENT, geminiUrl,
} from './ai/client';
export type { AIError } from './ai/client';
```

(The old `export interface AIError` in aiService.ts is deleted with the move; the type re-export keeps existing `import type { AIError } from '../services/aiService'` callers working — grep confirms StatementScannerModal/ReceiptScannerModal use it.)

c) Everywhere aiService.ts assigned `_lastAIError = ...` (the receipt/statement scanners do), replace the assignment with `setLastAIError(...)` — same value expression.

d) The default export keeps `callGemini` and `getLastAIError` entries (now the imported ones) — no key changes.

- [ ] **Step 3: Verify — existing suite is the gate**

```bash
npx tsc --noEmit
npx eslint src/services/ai/client.ts src/services/aiService.ts --quiet
npx jest aiService --runInBand
```
Expected: all green (aiService.test.js exercises callGemini paths through the facade).

- [ ] **Step 4: Commit**

```bash
git add src/services/ai/client.ts src/services/aiService.ts
git commit -m "refactor(ai): extract Gemini transport into ai/client.ts (facade unchanged)"
```

---

### Task 2: Extract the local parser into `ai/localParser.ts` + `extractAmount`

**Files:**
- Create: `src/services/ai/localParser.ts`
- Modify: `src/services/aiService.ts`
- Test: `__tests__/aiSmartParse.test.js` — NOT yet; extractAmount gets its tests inside `__tests__/aiLocalDictionary.test.js`? No — create `__tests__/aiLocalParser.test.js` here.

**Interfaces:**
- Produces:

```ts
export const CATEGORY_KEYWORDS: Record<string, string[]>; // moved verbatim
export interface ParsedTransaction { amount: number; type: 'income'|'expense'; categoryId: string; recipient: string; note: string; }
export function parseTransaction(text: any): ParsedTransaction | null;  // moved verbatim
export function extractAmount(text: string): number | null;             // NEW — factored out of parseTransaction
```

- [ ] **Step 1: Write the failing test**

Create `__tests__/aiLocalParser.test.js`:

```js
// extractAmount — the shared amount extractor (used by the repeat dictionary
// path so a history hit still parses "кофе 28" → 28 without AI).
const { extractAmount, parseTransaction } = require('../src/services/ai/localParser');

jest.mock('../src/i18n', () => ({ __esModule: true, default: { t: (k) => k, getLanguage: () => 'ru' } }));

describe('extractAmount', () => {
  test.each([
    ['кофе 28', 28],
    ['кофе с круассаном 28.50', 28.5],
    ['דלק פז 280 שח', 280],
    ['taxi 45₪', 45],
    ['1,250 аренда', 1250],
    ['без суммы вообще', null],
  ])('%s → %s', (input, expected) => {
    expect(extractAmount(input)).toBe(expected);
  });
});

describe('parseTransaction (moved, still works)', () => {
  test('RU keyword hit', () => {
    const r = parseTransaction('такси домой 45');
    expect(r).toMatchObject({ amount: 45, type: 'expense', categoryId: 'transport' });
  });
  test('HE keyword hit', () => {
    const r = parseTransaction('דלק 280');
    expect(r).toMatchObject({ amount: 280, categoryId: 'fuel' });
  });
  test('EN keyword hit', () => {
    const r = parseTransaction('pizza 60');
    expect(r).toMatchObject({ amount: 60, categoryId: 'restaurant' });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest aiLocalParser --runInBand`
Expected: FAIL — cannot find module `../src/services/ai/localParser`

- [ ] **Step 3: Create the module**

`src/services/ai/localParser.ts`:
- Move VERBATIM from aiService.ts: the `ParsedTransaction` interface (export), the full `CATEGORY_KEYWORDS` object (export), and the whole `parseTransaction` function (export). They are self-contained except `i18n` — check the moved body; if `parseTransaction` references i18n, keep the import `import i18n from '../../i18n';`.
- Factor the amount regex OUT of parseTransaction into the new export, and make parseTransaction call it (behavior identical — the two regex alternatives and the parse/cleanup of `,`/`'` separators move as one unit):

```ts
// Shared amount extractor: first number in the text, tolerant of ₪/шек/שח
// suffixes and prefixes and of thousands separators (1,250 / 1'250).
export function extractAmount(text: string): number | null {
  if (!text) return null;
  const input = String(text).toLowerCase();
  const m = input.match(/(\d[\d,.']*(?:\.\d+)?)\s*(?:₪|шекел|שקל|שקלים|шек|ш|ils|nis)?/i)
    || input.match(/(?:₪|шекел|שקל|שקלים|шек|ш|ils|nis)\s*(\d[\d,.']*(?:\.\d+)?)/i);
  if (!m) return null;
  const raw = m[1].replace(/[,']/g, (ch, off, s) => {
    // "28,50" is a decimal comma only when no dot follows; "1,250" is a separator
    return /\d{3}(\D|$)/.test(s.slice(off + 1)) ? '' : (ch === ',' ? '.' : '');
  });
  const n = parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}
```

IMPORTANT: the exact existing behavior of parseTransaction's amount handling WINS over the snippet above — if the moved parseTransaction body already normalizes separators differently, extract THAT logic verbatim into extractAmount instead, and adjust the two decimal tests to the actual observed values. The contract is: extractAmount(text) returns exactly what parseTransaction would have used as the amount, or null.

- [ ] **Step 4: Rewire aiService.ts**

```ts
import { parseTransaction, CATEGORY_KEYWORDS, extractAmount } from './ai/localParser';
export type { ParsedTransaction } from './ai/localParser';
```
Delete the moved blocks; the default export keeps its `parseTransaction` key. The dead `const categories = Object.keys(CATEGORY_KEYWORDS).join(', ')` line inside `parseTransactionSmart` (never interpolated into the prompt) — delete it.

- [ ] **Step 5: Verify + commit**

```bash
npx jest aiLocalParser aiService --runInBand
npx tsc --noEmit
npx eslint src/services/ai/localParser.ts src/services/aiService.ts --quiet
git add src/services/ai/localParser.ts src/services/aiService.ts __tests__/aiLocalParser.test.js
git commit -m "refactor(ai): extract local keyword parser + shared extractAmount"
```

---

### Task 3: `ai/localDictionary.ts` — repeat dictionary (layer 1)

**Files:**
- Create: `src/services/ai/localDictionary.ts`
- Test: `__tests__/aiLocalDictionary.test.js`

**Interfaces:**
- Consumes: nothing (pure).
- Produces (used by Tasks 5–6):

```ts
export function normalizeInput(text: string): string;
export interface DictEntry { categoryId: string; type: 'income' | 'expense'; count: number; }
export function buildDictionary(transactions: any[], opts?: { months?: number; now?: Date }): Map<string, DictEntry>;
export function lookupRepeat(text: string, dict: Map<string, DictEntry>): DictEntry | null;
```

- [ ] **Step 1: Write the failing tests**

Create `__tests__/aiLocalDictionary.test.js`:

```js
const { normalizeInput, buildDictionary, lookupRepeat } = require('../src/services/ai/localDictionary');

const now = new Date(2026, 6, 15);
const tx = (note, categoryId, type = 'expense', date = '2026-06-01', recipient = '') =>
  ({ note, recipient, categoryId, type, date });

describe('normalizeInput', () => {
  test.each([
    ['Кофе с круассаном 28₪', 'кофе с круассаном'],
    ['דלק פז 280 שח', 'דלק פז'],
    ['Taxi home 45 NIS', 'taxi home'],
    ['  двойные   пробелы 12 ', 'двойные пробелы'],
    ['1,250', ''],
  ])('%s → "%s"', (input, expected) => {
    expect(normalizeInput(input)).toBe(expected);
  });
});

describe('buildDictionary', () => {
  test('key needs ≥2 occurrences with ≥80% category agreement', () => {
    const d = buildDictionary([
      tx('кофе 25', 'restaurant'),
      tx('кофе 30', 'restaurant'),
      tx('такси 45', 'transport'),           // only once → no entry
      tx('пицца 60', 'restaurant'),
      tx('пицца 55', 'food'),                // 1/2 = 50% → conflict → no entry
    ], { now });
    expect(d.get('кофе')).toMatchObject({ categoryId: 'restaurant', count: 2 });
    expect(d.get('такси')).toBeUndefined();
    expect(d.get('пицца')).toBeUndefined();
  });

  test('4 of 5 = 80% agreement wins', () => {
    const txs = [1, 2, 3, 4].map(() => tx('обед 40', 'restaurant'));
    txs.push(tx('обед 40', 'food'));
    const d = buildDictionary(txs, { now });
    expect(d.get('обед')).toMatchObject({ categoryId: 'restaurant', count: 5 });
  });

  test('transactions older than 12 months are ignored', () => {
    const d = buildDictionary([
      tx('кофе 25', 'restaurant', 'expense', '2025-05-01'),
      tx('кофе 30', 'restaurant', 'expense', '2025-06-01'),
    ], { now });
    expect(d.size).toBe(0);
  });

  test('recipient counts as a key too (HE)', () => {
    const d = buildDictionary([
      tx('', 'food', 'expense', '2026-06-01', 'רמי לוי'),
      tx('', 'food', 'expense', '2026-06-20', 'רמי לוי'),
    ], { now });
    expect(d.get('רמי לוי')).toMatchObject({ categoryId: 'food' });
  });

  test('income repeats carry their type', () => {
    const d = buildDictionary([
      tx('зарплата 12000', 'salary_me', 'income'),
      tx('зарплата 13000', 'salary_me', 'income'),
    ], { now });
    expect(d.get('зарплата')).toMatchObject({ categoryId: 'salary_me', type: 'income' });
  });
});

describe('lookupRepeat', () => {
  const dict = buildDictionary([tx('кофе 25', 'restaurant'), tx('кофе 30', 'restaurant')], { now });
  test('hit strips the amount before matching', () => {
    expect(lookupRepeat('Кофе 32₪', dict)).toMatchObject({ categoryId: 'restaurant' });
  });
  test('miss returns null', () => {
    expect(lookupRepeat('суши 90', dict)).toBeNull();
  });
  test('empty normalized text returns null', () => {
    expect(lookupRepeat('450', dict)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify RED**

Run: `npx jest aiLocalDictionary --runInBand` → FAIL (module not found)

- [ ] **Step 3: Implement**

`src/services/ai/localDictionary.ts`:

```ts
// src/services/ai/localDictionary.ts
// Layer 1 of Smart Input: exact repeats of the user's own phrasing resolve
// instantly on-device — no network, no ambiguity. Built on the fly from the
// transactions the caller already has; nothing persisted, nothing stale.

export interface DictEntry { categoryId: string; type: 'income' | 'expense'; count: number; }

// Lowercase, strip digits + currency tokens + punctuation, collapse spaces.
// «Кофе с круассаном 28₪» → 'кофе с круассаном'.
export function normalizeInput(text: string): string {
  return String(text || '')
    .toLowerCase()
    .replace(/[0-9]+([.,'][0-9]+)*/g, ' ')
    .replace(/₪|шекел\w*|שקל(ים)?|שח|ils|nis/g, ' ')
    .replace(/[.,!?;:()"'`+\-–—/\\]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const MS_MONTH = 30 * 24 * 60 * 60 * 1000;

export function buildDictionary(
  transactions: any[],
  opts: { months?: number; now?: Date } = {},
): Map<string, DictEntry> {
  const months = opts.months ?? 12;
  const now = opts.now ?? new Date();
  const cutoff = now.getTime() - months * MS_MONTH;

  // key → categoryId → count (note and recipient are independent keys)
  const counts = new Map<string, Map<string, { n: number; type: 'income' | 'expense' }>>();
  for (const t of transactions || []) {
    if (!t || (t.type !== 'expense' && t.type !== 'income') || !t.categoryId) continue;
    const ts = new Date(t.date || t.createdAt || 0).getTime();
    if (!Number.isFinite(ts) || ts < cutoff) continue;
    for (const source of [t.note, t.recipient]) {
      const key = normalizeInput(source);
      if (!key) continue;
      let perCat = counts.get(key);
      if (!perCat) { perCat = new Map(); counts.set(key, perCat); }
      const cur = perCat.get(t.categoryId) || { n: 0, type: t.type };
      cur.n += 1;
      perCat.set(t.categoryId, cur);
    }
  }

  const dict = new Map<string, DictEntry>();
  for (const [key, perCat] of counts) {
    let total = 0; let bestCat = ''; let bestN = 0; let bestType: 'income' | 'expense' = 'expense';
    for (const [cat, { n, type }] of perCat) {
      total += n;
      if (n > bestN) { bestN = n; bestCat = cat; bestType = type; }
    }
    if (total >= 2 && bestN / total >= 0.8) {
      dict.set(key, { categoryId: bestCat, type: bestType, count: total });
    }
  }
  return dict;
}

export function lookupRepeat(text: string, dict: Map<string, DictEntry>): DictEntry | null {
  const key = normalizeInput(text);
  if (!key) return null;
  return dict.get(key) || null;
}
```

- [ ] **Step 4: GREEN + commit**

```bash
npx jest aiLocalDictionary --runInBand
npx tsc --noEmit
npx eslint src/services/ai/localDictionary.ts --quiet
git add src/services/ai/localDictionary.ts __tests__/aiLocalDictionary.test.js
git commit -m "feat(ai): repeat dictionary — instant on-device category for known phrasings"
```

---

### Task 4: `ai/accountResolver.ts` — the account cascade

**Files:**
- Create: `src/services/ai/accountResolver.ts`
- Test: `__tests__/aiAccountResolver.test.js`

**Interfaces:**
- Consumes: `CARD_BRAND_KEYWORDS`/`detectCardBrand` semantics (the keyword table MOVES here; aiService re-imports — see Step 3).
- Produces:

```ts
export const CARD_BRAND_KEYWORDS: Record<string, string[]>; // moved verbatim from aiService
export function detectCardBrand(text: string): string | null; // moved verbatim
export type AccountReason = 'explicit' | 'brand' | 'type' | 'habit' | 'recent' | 'none';
export function resolveAccount(args: {
  text: string;
  aiAccountId?: string | null;
  aiAccountType?: string | null;
  categoryId?: string | null;
  txType?: 'income' | 'expense';
  accounts: any[];        // caller passes ACTIVE accounts
  transactions: any[];    // full list, newest anywhere (resolver sorts)
}): { account: string | null; reason: AccountReason };
```

- [ ] **Step 1: Write the failing tests**

Create `__tests__/aiAccountResolver.test.js`:

```js
const { resolveAccount, detectCardBrand } = require('../src/services/ai/accountResolver');

const accounts = [
  { id: 'visa1', name: 'Visa Hapoalim', type: 'credit' },
  { id: 'visa2', name: 'Виза Леуми', type: 'credit' },
  { id: 'mc1', name: 'Mastercard Max', type: 'credit' },
  { id: 'cash1', name: 'Наличные', type: 'cash' },
  { id: 'bank1', name: 'Банк Апоалим', type: 'bank' },
];
const tx = (account, categoryId, date, type = 'expense') => ({ account, categoryId, type, date });

describe('cascade order', () => {
  test('1: explicit ai accountId wins over everything', () => {
    const r = resolveAccount({ text: 'кофе визой 20', aiAccountId: 'cash1', accounts, transactions: [] });
    expect(r).toEqual({ account: 'cash1', reason: 'explicit' });
  });

  test('2: brand keyword, single match', () => {
    const r = resolveAccount({ text: 'кофе мастеркард 20', accounts, transactions: [] });
    expect(r).toEqual({ account: 'mc1', reason: 'brand' });
  });

  test('2: brand with two matches → most recently used of them', () => {
    const transactions = [
      tx('visa2', 'food', '2026-07-10'),
      tx('visa1', 'food', '2026-07-01'),
    ];
    const r = resolveAccount({ text: 'продукты визой 100', accounts, transactions });
    expect(r).toEqual({ account: 'visa2', reason: 'brand' });
  });

  test('3: generic type from AI → last used of that type', () => {
    const transactions = [
      tx('mc1', 'food', '2026-07-11'),
      tx('visa1', 'food', '2026-07-12'),
    ];
    const r = resolveAccount({ text: 'кофе кредиткой 20', aiAccountType: 'credit', accounts, transactions });
    expect(r).toEqual({ account: 'visa1', reason: 'type' });
  });

  test('4: nothing said → category habit (≥3 tx, ≥60% one account)', () => {
    const transactions = [
      tx('visa1', 'restaurant', '2026-07-01'),
      tx('visa1', 'restaurant', '2026-06-20'),
      tx('visa1', 'restaurant', '2026-06-10'),
      tx('cash1', 'restaurant', '2026-05-10'),
      tx('bank1', 'food', '2026-07-12'),
    ];
    const r = resolveAccount({ text: 'кофе 20', categoryId: 'restaurant', txType: 'expense', accounts, transactions });
    expect(r).toEqual({ account: 'visa1', reason: 'habit' });
  });

  test('4→5: habit below 60% falls to overall most recent', () => {
    const transactions = [
      tx('visa1', 'restaurant', '2026-07-01'),
      tx('cash1', 'restaurant', '2026-06-20'),
      tx('visa1', 'restaurant', '2026-06-10'),
      tx('cash1', 'restaurant', '2026-05-10'),   // 2/4 = 50% → no habit
      tx('bank1', 'food', '2026-07-12'),          // most recent overall
    ];
    const r = resolveAccount({ text: 'кофе 20', categoryId: 'restaurant', txType: 'expense', accounts, transactions });
    expect(r).toEqual({ account: 'bank1', reason: 'recent' });
  });

  test('4: habit needs ≥3 transactions (2 of 2 is not enough)', () => {
    const transactions = [
      tx('visa1', 'restaurant', '2026-07-01'),
      tx('visa1', 'restaurant', '2026-06-20'),
      tx('bank1', 'food', '2026-07-12'),
    ];
    const r = resolveAccount({ text: 'кофе 20', categoryId: 'restaurant', txType: 'expense', accounts, transactions });
    expect(r).toEqual({ account: 'bank1', reason: 'recent' });
  });

  test('5: fresh install → none', () => {
    const r = resolveAccount({ text: 'кофе 20', accounts, transactions: [] });
    expect(r).toEqual({ account: null, reason: 'none' });
  });

  test('habit ignores transactions on deleted accounts', () => {
    const transactions = [
      tx('ghost', 'restaurant', '2026-07-01'),
      tx('ghost', 'restaurant', '2026-06-25'),
      tx('ghost', 'restaurant', '2026-06-20'),
    ];
    const r = resolveAccount({ text: 'кофе 20', categoryId: 'restaurant', txType: 'expense', accounts, transactions });
    expect(r).toEqual({ account: null, reason: 'none' });
  });

  test('HE brand keyword', () => {
    expect(detectCardBrand('קניתי בויזה 50')).toBe('visa');
  });
});
```

- [ ] **Step 2: RED**

`npx jest aiAccountResolver --runInBand` → module not found.

- [ ] **Step 3: Implement**

`src/services/ai/accountResolver.ts` — move `CARD_BRAND_KEYWORDS` + `detectCardBrand` VERBATIM from aiService.ts (export both), then add:

```ts
export type AccountReason = 'explicit' | 'brand' | 'type' | 'habit' | 'recent' | 'none';

const tsOf = (t: any) => new Date(t?.date || t?.createdAt || 0).getTime();

function lastUsedAmong(ids: Set<string>, transactions: any[]): string | null {
  let best: string | null = null; let bestTs = -1;
  for (const t of transactions || []) {
    if (!t?.account || !ids.has(t.account)) continue;
    const ts = tsOf(t);
    if (ts > bestTs) { bestTs = ts; best = t.account; }
  }
  return best;
}

// Single ordered cascade for "which account pays this transaction".
// Spec: explicit > brand > type+last-used > category habit (≥3 tx, ≥60%)
// > overall most recent > none.
export function resolveAccount(args: {
  text: string;
  aiAccountId?: string | null;
  aiAccountType?: string | null;
  categoryId?: string | null;
  txType?: 'income' | 'expense';
  accounts: any[];
  transactions: any[];
}): { account: string | null; reason: AccountReason } {
  const { text, aiAccountId, aiAccountType, categoryId, txType, accounts, transactions } = args;
  const accIds = new Set((accounts || []).map((a: any) => a.id));

  // 1. Explicit id from the model, validated.
  if (aiAccountId && accIds.has(aiAccountId)) return { account: aiAccountId, reason: 'explicit' };

  // 2. Brand keyword in the raw text.
  const brand = detectCardBrand(text);
  if (brand) {
    const kws = CARD_BRAND_KEYWORDS[brand];
    const matches = (accounts || []).filter((a: any) => kws.some((kw: string) => (a.name || '').toLowerCase().includes(kw)));
    if (matches.length === 1) return { account: matches[0].id, reason: 'brand' };
    if (matches.length > 1) {
      const ids = new Set(matches.map((a: any) => a.id));
      return { account: lastUsedAmong(ids, transactions) || matches[0].id, reason: 'brand' };
    }
  }

  // 3. Generic type from the model.
  if (aiAccountType) {
    const matches = (accounts || []).filter((a: any) => a.type === aiAccountType);
    if (matches.length === 1) return { account: matches[0].id, reason: 'type' };
    if (matches.length > 1) {
      const ids = new Set(matches.map((a: any) => a.id));
      const last = lastUsedAmong(ids, transactions);
      if (last) return { account: last, reason: 'type' };
    }
  }

  // 4. Category habit: ≥3 txs of this category+type on LIVE accounts,
  //    one account holding ≥60% of them.
  if (categoryId) {
    const catTxs = (transactions || []).filter((t: any) =>
      t?.categoryId === categoryId && (!txType || t.type === txType) && t.account && accIds.has(t.account));
    if (catTxs.length >= 3) {
      const perAcc: Record<string, number> = {};
      for (const t of catTxs) perAcc[t.account] = (perAcc[t.account] || 0) + 1;
      const [topAcc, topN] = Object.entries(perAcc).sort((a, b) => b[1] - a[1])[0];
      if (topN / catTxs.length >= 0.6) return { account: topAcc, reason: 'habit' };
    }
  }

  // 5. Overall most recent transaction on a live account.
  const recent = lastUsedAmong(accIds, transactions);
  if (recent) return { account: recent, reason: 'recent' };

  return { account: null, reason: 'none' };
}
```

- [ ] **Step 4: Rewire aiService.ts**

Replace the moved blocks with:

```ts
import { CARD_BRAND_KEYWORDS, detectCardBrand } from './ai/accountResolver';
```
The existing `export { detectCardBrand, CARD_BRAND_KEYWORDS };` line and the default-export keys stay (now re-exporting the imported ones). SmartInputModal imports `CARD_BRAND_KEYWORDS` from aiService for its chip filtering — unchanged by design.

- [ ] **Step 5: GREEN + full guard + commit**

```bash
npx jest aiAccountResolver aiService --runInBand
npx tsc --noEmit
npx eslint src/services/ai/accountResolver.ts src/services/aiService.ts --quiet
git add src/services/ai/accountResolver.ts src/services/aiService.ts __tests__/aiAccountResolver.test.js
git commit -m "feat(ai): unified account cascade with category-habit tier"
```

---

### Task 5: `ai/promptBuilder.ts` — personalized prompt

**Files:**
- Create: `src/services/ai/promptBuilder.ts`
- Test: `__tests__/aiPromptBuilder.test.js`

**Interfaces:**
- Produces:

```ts
export interface PromptCategory { id: string; name: string; kind: 'expense' | 'income'; }
export interface PromptExample { text: string; categoryId: string; }
export function buildSmartPrompt(args: {
  text: string;
  lang: string;
  currency: string;
  customCategories: PromptCategory[];   // user categories NOT in the built-in lists
  examples: PromptExample[];            // capped at 30 by the builder
  accounts: any[];                      // active only
  projects: any[];
}): string;
```

- [ ] **Step 1: Write the failing tests**

Create `__tests__/aiPromptBuilder.test.js`:

```js
const { buildSmartPrompt } = require('../src/services/ai/promptBuilder');

const base = {
  text: 'кофе 28', lang: 'ru', currency: 'ILS',
  customCategories: [], examples: [], accounts: [], projects: [],
};

describe('buildSmartPrompt', () => {
  test('contains the input, built-in category anchors and output contract', () => {
    const p = buildSmartPrompt(base);
    expect(p).toContain('"кофе 28"');
    expect(p).toContain('food');
    expect(p).toContain('restaurant');
    expect(p).toContain('OUTPUT FORMAT');
  });

  test('custom categories are listed with their names and kinds', () => {
    const p = buildSmartPrompt({ ...base, customCategories: [
      { id: 'cat_abc', name: 'Детское пособие', kind: 'income' },
      { id: 'cat_def', name: 'חוגים לילדים', kind: 'expense' },
    ]});
    expect(p).toContain('cat_abc');
    expect(p).toContain('Детское пособие');
    expect(p).toContain('cat_def');
    expect(p).toContain('חוגים לילדים');
  });

  test('examples section appears, is capped at 30 and carries no digits', () => {
    const examples = Array.from({ length: 40 }, (_, i) => ({ text: `пример номер ${i}`, categoryId: 'food' }));
    const p = buildSmartPrompt({ ...base, examples });
    const section = p.slice(p.indexOf('USER HISTORY EXAMPLES'));
    const lines = section.split('\n').filter(l => l.trim().startsWith('"'));
    expect(lines.length).toBe(30);
    for (const l of lines) expect(l).not.toMatch(/\d/);
  });

  test('no examples → no history section', () => {
    expect(buildSmartPrompt(base)).not.toContain('USER HISTORY EXAMPLES');
  });

  test('accounts and projects sections appear only when provided', () => {
    const p = buildSmartPrompt({ ...base,
      accounts: [{ id: 'a1', name: 'Visa', type: 'credit' }],
      projects: [{ id: 'p1', name: 'Ремонт' }],
    });
    expect(p).toContain('USER ACCOUNTS');
    expect(p).toContain('USER PROJECTS');
    expect(buildSmartPrompt(base)).not.toContain('USER ACCOUNTS');
  });

  test('HE input flows through untouched', () => {
    const p = buildSmartPrompt({ ...base, text: 'דלק פז 280', lang: 'he' });
    expect(p).toContain('"דלק פז 280"');
    expect(p).toContain('User language: he');
  });
});
```

- [ ] **Step 2: RED**

`npx jest aiPromptBuilder --runInBand` → module not found.

- [ ] **Step 3: Implement**

`src/services/ai/promptBuilder.ts` — move the ENTIRE prompt template out of `parseTransactionSmart` (the big backtick string with EXPENSE CATEGORIES / INCOME CATEGORIES / income-vs-expense triggers / EXAMPLES / WORD-FORM NUMBERS / RULES — verbatim), converting it into a pure function. Changes to the template, exactly these:

1. After the built-in INCOME CATEGORIES block insert a dynamic section:

```ts
const customSection = customCategories.length > 0
  ? `\nUSER CUSTOM CATEGORIES (id → name; PREFER these when the input matches the name or its meaning; they are valid categoryId values):\n${customCategories.map(c => `  ${c.id} → "${c.name}" (${c.kind})`).join('\n')}\n`
  : '';
```

2. Before the accounts section insert the history few-shot:

```ts
const strip = (s: string) => String(s || '').replace(/[0-9]+([.,'][0-9]+)*/g, '').replace(/\s+/g, ' ').trim();
const exampleLines = (examples || [])
  .map(e => ({ text: strip(e.text), categoryId: e.categoryId }))
  .filter(e => e.text)
  .slice(0, 30);
const historySection = exampleLines.length > 0
  ? `\nUSER HISTORY EXAMPLES (this user's own past phrasings → the category THEY chose; follow their personal convention when the input resembles one of these):\n${exampleLines.map(e => `  "${e.text}" → ${e.categoryId}`).join('\n')}\n`
  : '';
```

3. The accounts/projects sections move verbatim (they already render conditionally).
4. The RULES line about categoryId changes from `id from list above` to `id from the category lists above (built-in OR user custom)`.

The function returns the assembled template string; NOTHING else (no i18n import — lang/currency come as args).

- [ ] **Step 4: GREEN + commit**

```bash
npx jest aiPromptBuilder --runInBand
npx tsc --noEmit
npx eslint src/services/ai/promptBuilder.ts --quiet
git add src/services/ai/promptBuilder.ts __tests__/aiPromptBuilder.test.js
git commit -m "feat(ai): pure prompt builder with user categories + history few-shot"
```

---

### Task 6: `ai/smartParse.ts` — the orchestrator + facade switch

**Files:**
- Create: `src/services/ai/smartParse.ts`
- Modify: `src/services/aiService.ts` (parseTransactionSmart delegates; matchProjectInText moves)
- Test: `__tests__/aiSmartParse.test.js`

**Interfaces:**
- Consumes: everything from Tasks 1–5, `getCachedGroups`/`ensureCachedGroups` from `../../utils/categoryCache`, `dataService.getTransactions`.
- Produces: `parseTransactionSmart(text, accounts, projects)` — same signature and result shape as today PLUS `source: 'history' | 'ai' | 'fallback'` and `accountReason` fields.

- [ ] **Step 1: Write the failing tests**

Create `__tests__/aiSmartParse.test.js`:

```js
// The orchestrator: dictionary hit → no network; AI path accepts custom ids;
// garbage AI → local fallback. client + dataService are mocked; the pure
// modules underneath are REAL.
const mockCallGemini = jest.fn();
jest.mock('../src/services/ai/client', () => ({
  callGemini: (...a) => mockCallGemini(...a),
  getLastAIError: () => null,
}));

const mockTxs = [];
jest.mock('../src/services/dataService', () => ({
  __esModule: true,
  default: { getTransactions: jest.fn(() => Promise.resolve(mockTxs)) },
}));

jest.mock('../src/utils/categoryCache', () => ({
  getCachedGroups: () => [
    { id: 'g1', name: { ru: 'Пособия' }, subs: [{ id: 'cat_abc', name: { ru: 'Детское пособие' } }] },
  ],
  ensureCachedGroups: () => Promise.resolve([]),
}));

jest.mock('../src/i18n', () => ({ __esModule: true, default: { t: (k) => k, getLanguage: () => 'ru' } }));

const { parseTransactionSmart } = require('../src/services/ai/smartParse');

const accounts = [
  { id: 'visa1', name: 'Visa', type: 'credit', isActive: true },
  { id: 'cash1', name: 'Наличные', type: 'cash', isActive: true },
];

beforeEach(() => { mockCallGemini.mockReset(); mockTxs.length = 0; });

describe('layer 1: repeat dictionary', () => {
  test('known phrasing skips the network entirely', async () => {
    mockTxs.push(
      { note: 'кофе 25', categoryId: 'restaurant', type: 'expense', date: '2026-07-01', account: 'visa1' },
      { note: 'кофе 30', categoryId: 'restaurant', type: 'expense', date: '2026-07-05', account: 'visa1' },
      { note: 'кофе 27', categoryId: 'restaurant', type: 'expense', date: '2026-07-08', account: 'visa1' },
    );
    const r = await parseTransactionSmart('кофе 32', accounts, []);
    expect(mockCallGemini).not.toHaveBeenCalled();
    expect(r).toMatchObject({ amount: 32, categoryId: 'restaurant', type: 'expense', source: 'history', account: 'visa1' });
  });

  test('repeat with no extractable amount still goes to AI', async () => {
    mockTxs.push(
      { note: 'кофе 25', categoryId: 'restaurant', type: 'expense', date: '2026-07-01' },
      { note: 'кофе 30', categoryId: 'restaurant', type: 'expense', date: '2026-07-05' },
    );
    mockCallGemini.mockResolvedValue(JSON.stringify({ amount: 30, type: 'expense', categoryId: 'restaurant', recipient: '', note: 'кофе' }));
    const r = await parseTransactionSmart('кофе', accounts, []);
    expect(mockCallGemini).toHaveBeenCalled();
    expect(r.source).toBe('ai');
  });
});

describe('layer 2: AI path', () => {
  test('custom category id from the cached groups is ACCEPTED', async () => {
    mockCallGemini.mockResolvedValue(JSON.stringify({ amount: 115, type: 'income', categoryId: 'cat_abc', recipient: '', note: 'детское пособие 115' }));
    const r = await parseTransactionSmart('детское пособие 115', accounts, []);
    expect(r).toMatchObject({ categoryId: 'cat_abc', source: 'ai' });
  });

  test('prompt contains custom category and history examples', async () => {
    mockTxs.push(
      { note: 'уборщица 200', categoryId: 'household', type: 'expense', date: '2026-07-01' },
      { note: 'уборщица 200', categoryId: 'household', type: 'expense', date: '2026-06-01' },
    );
    mockCallGemini.mockResolvedValue(JSON.stringify({ amount: 50, type: 'expense', categoryId: 'other', recipient: '', note: 'x 50' }));
    await parseTransactionSmart('что-то новое 50', accounts, []);
    const prompt = mockCallGemini.mock.calls[0][0];
    expect(prompt).toContain('cat_abc');
    expect(prompt).toContain('Детское пособие');
    expect(prompt).toContain('уборщица');
  });

  test('account resolution: nothing said → habit account, reason surfaced', async () => {
    mockTxs.push(
      { note: 'x', categoryId: 'food', type: 'expense', date: '2026-07-01', account: 'cash1' },
      { note: 'y', categoryId: 'food', type: 'expense', date: '2026-07-02', account: 'cash1' },
      { note: 'z', categoryId: 'food', type: 'expense', date: '2026-07-03', account: 'cash1' },
    );
    mockCallGemini.mockResolvedValue(JSON.stringify({ amount: 90, type: 'expense', categoryId: 'food', recipient: '', note: 'продукты 90', accountId: null, accountType: null }));
    const r = await parseTransactionSmart('продукты 90', accounts, []);
    expect(r.account).toBe('cash1');
    expect(r.accountReason).toBe('habit');
  });
});

describe('layer 3: fallback', () => {
  test('AI unreachable → local keyword parser', async () => {
    mockCallGemini.mockResolvedValue(null);
    const r = await parseTransactionSmart('такси 45', accounts, []);
    expect(r).toMatchObject({ amount: 45, categoryId: 'transport', source: 'fallback' });
  });
});
```

- [ ] **Step 2: RED**

`npx jest aiSmartParse --runInBand` → module not found.

- [ ] **Step 3: Implement `src/services/ai/smartParse.ts`**

Structure (move `matchProjectInText` VERBATIM from aiService.ts into this file; move the income-category hard-guarantee list and the project/category history auto-suggest blocks verbatim from the current `parseTransactionSmart` — they run in the AI path only, after parse):

```ts
// src/services/ai/smartParse.ts
// Smart Input pipeline: repeat dictionary → personalized Gemini prompt →
// local keyword fallback. See docs/superpowers/specs/2026-07-15-smart-input-v2-design.md
import i18n from '../../i18n';
import { code as curCode } from '../../utils/currency';
import { getCachedGroups } from '../../utils/categoryCache';
import { callGemini } from './client';
import { buildSmartPrompt, PromptCategory, PromptExample } from './promptBuilder';
import { buildDictionary, lookupRepeat } from './localDictionary';
import { resolveAccount } from './accountResolver';
import { parseTransaction, extractAmount } from './localParser';
import dataService from '../dataService';

// (matchProjectInText moved verbatim here)

// User categories that are NOT built-ins: walk cached groups, collect
// custom groups and subs as {id, name, kind}. Built-in ids resolve через
// the static prompt lists, so they are excluded here.
function collectCustomCategories(builtinsIds: Set<string>): PromptCategory[] {
  const out: PromptCategory[] = [];
  const nameOf = (n: any) => typeof n === 'string' ? n : (n?.[i18n.getLanguage()] || n?.en || n?.ru || n?.he || '');
  for (const g of getCachedGroups() || []) {
    const kind = g.id === 'income_group' || /income/i.test(g.id) ? 'income' : 'expense';
    if (g.id && !builtinsIds.has(g.id) && nameOf(g.name)) out.push({ id: g.id, name: nameOf(g.name), kind });
    for (const s of g.subs || []) {
      if (s.id && !builtinsIds.has(s.id) && nameOf(s.name)) out.push({ id: s.id, name: nameOf(s.name), kind });
    }
  }
  return out;
}

function collectExamples(transactions: any[]): PromptExample[] {
  // frequency+recency: newest first, dedupe by normalized text via Map insert order
  const seen = new Map<string, PromptExample>();
  const sorted = [...(transactions || [])].sort((a, b) =>
    new Date(b.date || b.createdAt || 0).getTime() - new Date(a.date || a.createdAt || 0).getTime());
  for (const t of sorted) {
    const text = String(t.note || t.recipient || '').trim();
    if (!text || !t.categoryId) continue;
    const key = text.toLowerCase();
    if (!seen.has(key)) seen.set(key, { text, categoryId: t.categoryId });
    if (seen.size >= 30) break;
  }
  return [...seen.values()];
}

export async function parseTransactionSmart(text: string, accounts: any[] = [], projects: any[] = []) {
  const activeAccounts = (accounts || []).filter((a: any) => a.isActive !== false);
  const transactions = await dataService.getTransactions().catch(() => []);

  // ── Layer 1: exact repeat of the user's own phrasing ──
  const dict = buildDictionary(transactions);
  const hit = lookupRepeat(text, dict);
  const amount = extractAmount(text);
  if (hit && amount) {
    const { account, reason } = resolveAccount({
      text, categoryId: hit.categoryId, txType: hit.type,
      accounts: activeAccounts, transactions,
    });
    return {
      amount, type: hit.type, categoryId: hit.categoryId,
      recipient: '', note: text,
      account, accountReason: reason, source: 'history',
      projectId: matchProjectInText(text, projects || []),
    };
  }

  // ── Layer 2: Gemini with the personalized prompt ──
  const BUILTIN_PROMPT_IDS = new Set(['food','restaurant','transport','fuel','health','phone','utilities','clothing','household','kids','entertainment','education','cosmetics','electronics','insurance','pension','rent','arnona','vaad','other','salary_me','salary_spouse','handyman','rental_income','other_income','home','income_group','personal','travel']);
  const customCategories = collectCustomCategories(BUILTIN_PROMPT_IDS);
  const prompt = buildSmartPrompt({
    text, lang: i18n.getLanguage(), currency: curCode(),
    customCategories, examples: collectExamples(transactions),
    accounts: activeAccounts, projects: projects || [],
  });
  const raw = await callGemini(prompt);

  let parsed: any = null;
  if (raw) {
    try { parsed = JSON.parse(raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim()); }
    catch (e) {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch (e2) { /* fallthrough */ } }
    }
  }

  if (parsed && parsed.amount && parsed.type && parsed.categoryId) {
    // Category id must exist: built-in prompt ids OR the user's custom ones.
    const validIds = new Set([...BUILTIN_PROMPT_IDS, ...customCategories.map(c => c.id)]);
    if (!validIds.has(parsed.categoryId)) parsed.categoryId = 'other';

    // (moved verbatim: income-category hard guarantee → parsed.type='income')
    // (moved verbatim: projectId validation + matchProjectInText fallback)
    // (moved verbatim: category auto-suggest from project history)
    // (moved verbatim: project auto-suggest from category history)

    const { account, reason } = resolveAccount({
      text, aiAccountId: parsed.accountId, aiAccountType: parsed.accountType,
      categoryId: parsed.categoryId, txType: parsed.type,
      accounts: activeAccounts, transactions,
    });
    parsed.account = account;
    parsed.accountReason = reason;
    parsed.source = 'ai';
    if (__DEV__) console.log('[Smart] final result:', JSON.stringify(parsed));
    return parsed;
  }

  // ── Layer 3: local keyword fallback ──
  const fallback: any = parseTransaction(text);
  if (fallback) {
    const { account, reason } = resolveAccount({
      text, categoryId: fallback.categoryId, txType: fallback.type,
      accounts: activeAccounts, transactions,
    });
    fallback.account = account;
    fallback.accountReason = reason;
    fallback.source = 'fallback';
  }
  return fallback;
}
```

NOTE to implementer: the four "(moved verbatim)" markers are real blocks in today's `parseTransactionSmart` — move their exact code (they reference `parsed`, `projectsList`→use `projects || []`, and `require('./dataService')` calls which become the already-loaded `transactions` where the block only needs transactions; keep the logic identical otherwise). Delete the old brand/type account-selection code — the resolver replaces it.

- [ ] **Step 4: Switch the facade**

In aiService.ts: delete the old `parseTransactionSmart` and `matchProjectInText`; add

```ts
import { parseTransactionSmart } from './ai/smartParse';
```
Default export keeps the `parseTransactionSmart` key.

- [ ] **Step 5: GREEN + full guard + commit**

```bash
npx jest aiSmartParse aiService aiLocalParser --runInBand
npx tsc --noEmit
npx eslint src/services/ai/smartParse.ts src/services/aiService.ts --quiet
git add src/services/ai/smartParse.ts src/services/aiService.ts __tests__/aiSmartParse.test.js
git commit -m "feat(ai): 3-layer Smart Input pipeline behind unchanged facade"
```

Known harness edge: if pre-existing `__tests__/aiService.test.js` cases call
`parseTransactionSmart` and now fail on the pipeline's
`dataService.getTransactions()` load, extend that test file's EXISTING
dataService mock with `getTransactions: jest.fn(() => Promise.resolve([]))` —
a behavior-preserving test-harness fix, include it in this commit.

---

### Task 7: Source badge in SmartInputModal + i18n

**Files:**
- Modify: `src/components/SmartInputModal.js` (result card header area)
- Modify: `src/i18n/*.ts` × 11 (one key)

**Interfaces:**
- Consumes: `result.source === 'history'` from Task 6.

- [ ] **Step 1: i18n key ×11**

Append before the closing `};` of each language file:

- en: `siFromHistory: 'From your history',`
- ru: `siFromHistory: 'Из твоей истории',`
- he: `siFromHistory: 'מההיסטוריה שלך',`
- es: `siFromHistory: 'De tu historial',`
- fr: `siFromHistory: 'De votre historique',`
- de: `siFromHistory: 'Aus deinem Verlauf',`
- pt: `siFromHistory: 'Do seu histórico',`
- ar: `siFromHistory: 'من سجلّك',`
- zh: `siFromHistory: '来自你的历史',`
- hi: `siFromHistory: 'आपके इतिहास से',`
- ja: `siFromHistory: 'あなたの履歴から',`

- [ ] **Step 2: Badge**

In SmartInputModal.js locate the parsed result card header (where the parsed category/amount render — the component holds the parse result in state, commonly `parsed`/`result`). Add inside the card, right after the card's title row:

```jsx
{parsed?.source === 'history' && (
  <View style={{ flexDirection: i18n.row(), alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: `${colors.green}18`, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginBottom: 6 }}>
    <Feather name="zap" size={11} color={colors.green} />
    <Text style={{ color: colors.green, fontSize: 11, fontWeight: '700' }}>{i18n.t('siFromHistory')}</Text>
  </View>
)}
```

(Adapt the state variable name to the file's actual one; `Feather`, `colors`, `i18n` are already imported there.)

- [ ] **Step 3: Verify + commit**

```bash
node scripts/check-i18n.js
npx tsc --noEmit
npx eslint src/components/SmartInputModal.js src/i18n --quiet
git add src/components/SmartInputModal.js src/i18n
git commit -m "feat(ai): history-source badge on the Smart Input result card"
```

---

### Task 8: Full verification + docs

**Files:**
- Modify: `FEATURES.md` (AI features → Smart Input paragraph)

- [ ] **Step 1: Full suite**

```bash
npm test
npx tsc --noEmit
node scripts/check-i18n.js
```
Expected: all suites green (473 baseline + ~40 new), i18n 11×710.

- [ ] **Step 2: FEATURES.md**

In the `## AI features` section find the Smart Input description and append:

```markdown
Smart Input v2 pipeline: exact repeats of the user's own phrasing are
recognized instantly on-device (⚡ badge, no AI call); novel inputs go
to Gemini with a prompt personalized by the user's real categories
(custom ones included) and up to 30 history examples (never amounts);
account defaults follow the user's per-category habit. Local keyword
parser remains the offline fallback.
```

- [ ] **Step 3: Manual smoke checklist (device — project owner)**

1. Type a phrase you've logged 3+ times → instant result with ⚡ badge, correct category and your usual account.
2. Type a phrase matching a CUSTOM category name → AI picks the custom category (not «другое»).
3. Say «кофе визой 30» with two Visas → the most recently used Visa.
4. New phrase with nothing about payment → your habitual account for that category shows in the card.
5. Airplane mode → fallback parser still returns a result.
6. Hebrew + English versions of 1–4.

- [ ] **Step 4: Commit**

```bash
git add FEATURES.md
git commit -m "docs: Smart Input v2 in FEATURES.md"
```
