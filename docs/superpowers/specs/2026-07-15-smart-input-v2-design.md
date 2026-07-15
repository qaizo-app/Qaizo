# Smart Input v2 — Design

**Date:** 2026-07-15
**Status:** Approved by user (chat), pending spec review
**Owner:** Sean (services) — UI changes minimal (SmartInputModal source badge)

## Problem

Smart Input is the flagship daily-use feature (free text / voice →
transaction) and the weakest one: it confuses similar categories and
cannot pick the right card among several. Root causes found in code:

1. The prompt lists ONLY built-in categories with hand-written keyword
   guesses — the user's custom categories (a large share of real usage)
   are absent, so the model literally cannot choose them.
2. Nothing learns from the user's own history: the same phrase gets
   re-parsed by the AI every time, sometimes differently.
3. Account defaulting when the phrase says nothing about payment falls
   through to the modal's static default instead of the user's habits.
4. All of this lives in a 1409-line aiService.ts mixing 5 domains.

## Decisions made with the user

1. **Account default when nothing is said: habit-based** — the account
   the user usually pays this category with; falls back to the overall
   last-used account. Always visible and tap-editable in the result card.
2. **Privacy: user history MAY be sent to Gemini** as few-shot examples —
   note/recipient texts + chosen category id only, NEVER amounts, dates
   or balances. Cap ~30 examples.
3. **Architecture: 3-layer pipeline (approach A)** — local repeat
   dictionary → personalized Gemini prompt → local parser fallback.

## Non-goals

- No changes to the voice capture flow or its language toggle (works).
- No changes to the editable result card UX beyond a small source badge
  («⚡ по истории» vs «AI»).
- No on-device ML models.
- Insights / AI chat / cashflow / tax code moves are NOT part of this
  slice except where the facade split requires touching imports.
- No new i18n languages: RU/HE/EN quality parity is the target (the
  other 8 keep working through the same pipeline untouched).

## Architecture — `src/services/ai/`

New directory; `aiService.ts` becomes a facade that re-exports the
public surface (same trick as the categories catalog: zero changes in
the ~15 importers).

```
src/services/ai/
  client.ts           — callGemini + model fallback (moved verbatim)
  smartParse.ts       — parseTransactionSmart pipeline (orchestrator)
  promptBuilder.ts    — PURE: build the prompt string from inputs
  localDictionary.ts  — PURE core: repeat-match over the user's txs
  accountResolver.ts  — PURE: the account cascade
```

Everything else (insights, chat, predictCashFlow, taxes, receipt
scanning) stays in aiService.ts for now.

## Layer 1 — repeat dictionary (`localDictionary.ts`)

- `normalizeInput(text)` — lowercase, strip digits/currency
  symbols/punctuation, collapse whitespace. «Кофе с круассаном 28₪» →
  `кофе с круассаном`.
- `buildDictionary(transactions, { months = 12 })` — walks the user's
  transactions (note + recipient normalized the same way), groups by
  normalized key, keeps keys with ≥2 occurrences where ≥80% share one
  categoryId. Value: `{ categoryId, type, count }`.
- `lookupRepeat(text, dictionary)` — exact normalized-key match or null.
- smartParse consults this FIRST: on hit → returns
  `{ amount (extracted locally), type, categoryId, source: 'history' }`
  without any network call; the account still goes through the same
  accountResolver cascade (the phrase may name a brand/account even
  when the category is a known repeat). Amount extraction reuses the
  existing local parseTransaction's amount logic.
- On miss (or no amount extractable) → layer 2.
- Built on the fly from the transactions the modal already loads —
  nothing persisted, nothing to go stale.

## Layer 2 — personalized prompt (`promptBuilder.ts`)

`buildSmartPrompt({ text, lang, currency, categories, examples,
accounts, projects })` — pure string builder, fully unit-testable.
Changes vs today:

1. **Dynamic category section.** Built-ins keep their static keyword
   lines (they work), PLUS every user category from the cached groups
   (custom groups and subs) rendered as `id → "name"` using all
   available localized names. The output contract stays `categoryId
   from the list`; validation after parse accepts any id present in
   the section (today custom ids would be dropped).
2. **Few-shot from history.** Up to 30 lines `"note/recipient" →
   categoryId`, picked by frequency then recency from the same
   dictionary data (no amounts/dates — user decision #2). Skipped
   entirely when history is empty.
3. Word-number rules, income triggers, account/project sections stay.

## Layer 3 — fallback

Existing local `parseTransaction` keyword parser, unchanged, still the
answer when Gemini is unreachable or returns garbage.

## Account cascade (`accountResolver.ts`)

`resolveAccount({ text, parsed, accounts, transactions })` — pure,
ordered:

1. Explicit account id from AI (`accountId` validated against active
   accounts).
2. Brand keywords (visa/mc/amex) — single match, else last-used among
   the brand matches (existing logic moved in).
3. Generic type (`accountType`) — single match of that type, else
   last-used of that type (existing `getLastUsedAccountByType`).
4. Nothing said → **category habit**: among the user's transactions of
   this category (same type), if ≥3 exist and ≥60% share one account →
   that account; else overall most-recent transaction's account.
5. Still nothing (fresh install) → null; the modal's current default
   behavior remains as the last resort.

The resolver returns `{ account, reason }` where reason ∈
`explicit | brand | type | habit | recent | none` — surfaced in dev
logs (guarded) and useful in tests.

## Result card

The only UI change: a small source badge on the parsed card — «⚡» when
`source === 'history'` (instant, no AI), nothing when AI. i18n key
`siFromHistory` ×11. Everything else (tap-to-edit category/amount/
account/type) already exists and stays.

## Testing

- `promptBuilder`: custom categories present; examples capped at 30 and
  contain no digits; RU/HE/EN inputs produce their language hints;
  empty-history and no-accounts variants.
- `localDictionary`: normalization (RU/HE/EN, currency symbols, ₪/שח);
  ≥2 + ≥80% thresholds; conflicting history → null; 12-month window.
- `accountResolver`: each cascade tier + tie-breakers; two visas;
  habit threshold edges (2 of 3 = 66% → habit; 1 of 2 = 50% → no).
- `smartParse` orchestration with mocked client: dictionary hit skips
  the network; AI path validates custom category ids; fallback path.
- Facade: existing aiService tests keep passing unchanged — the guard
  that the split broke nothing.

## Rollout / safety

- Every layer degrades to the next; the pipeline cannot be worse than
  today by construction (layer 2+3 ARE today's behavior + a richer
  prompt).
- Dev-only logging stays behind `__DEV__` (privacy rule from 10.07).
- Ships in the next preview APK after the Google Play production push
  currently queued behind vc40 QA.
