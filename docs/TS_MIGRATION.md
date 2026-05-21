# TypeScript Migration — Progress Tracker

> Shared notes for everyone working on the gradual JS → TS migration
> (including Claude in VSCode on the local machine and Claude on the web).
> **Update this file in the same commit whenever you migrate something.**

## Why we're doing this
Qaizo moves real money, balances, transactions and AI-generated JSON. TS catches
shape/typo bugs at compile time instead of in production. Main wins:
- string literal unions for `AccountType` / `TransactionType` etc. → no typo'd `'expence'`
- safe refactors: changing a field in `Account`/`Transaction` surfaces every break
- `src/types/index.ts` is the single source of truth for domain shapes
- safer handling of raw Gemini/CoinGecko JSON before it hits Firestore

`tsconfig.json` already has `strict: true` + `allowJs: true` (gradual mode).

## Conventions (follow the already-migrated files)
- Keep the top-of-file header comment.
- Import domain types from `src/types` (`import type { Transaction } from '../types';`).
- Keep the **exact same export shape** (default export object, named exports) so
  no `.js` import sites need changing.
- Add explicit param/return annotations on exported functions.
- Don't change runtime behavior during a migration commit — rename `.js` → `.ts`
  and add types only. Behavior changes go in separate commits.
- Run the matching `__tests__/<name>.test.js` after each file.

## Status

### Utils — ✅ all migrated
currency, categoryCache, categoryName, productMatcher, recurringHistory, transactions

### Services
| Service | Status | Step |
|---|---|---|
| logger | ✅ ts | 3 |
| consentService | ✅ ts | 3 |
| analyticsEvents | ✅ ts | 4 |
| badgeService | ✅ ts | 4 |
| securityService | ✅ ts | 4 |
| stockService | ✅ ts | 5 |
| exchangeRateService | ✅ ts | 5 |
| feedbackService | ✅ ts | 5 |
| streakService | ✅ ts | 6 |
| cryptoService | ✅ ts | 6 |
| notificationService | ✅ ts | 7 |
| analyticsService | ✅ ts | 7 |
| authService | ✅ ts | 8 |
| exportService | ✅ ts | 8 |
| importService | ⬜ js | — |
| dataService | ⬜ js | last (central, ~1044 loc) |
| aiService | ⬜ js | last (largest, ~1321 loc) |

## Suggested order for remaining work
1. ~~**Step 6 (isolated, small):** streakService, cryptoService~~ ✅
2. ~~**Step 7:** notificationService, analyticsService~~ ✅
3. ~~**Step 8:** authService, exportService~~ ✅
4. **Step 9:** importService
5. **Step 10 (do last, highest blast radius):** dataService, then aiService

## Notes / gotchas
- `npm install` is required in fresh web containers before tests run (deps are
  not committed). Run tests via `node_modules/.bin/jest` or `npm test` — NOT
  `npx jest`, which may resolve a global jest missing `babel-preset-expo`.
- New domain types added so far: `StreakData`, `CryptoPrice` (step 6);
  `Insight` exported from analyticsService, and `Recurring.notify` /
  `Recurring.contractEndDate` added (step 7).
- expo-notifications triggers must use `Notifications.SchedulableTriggerInputTypes.*`
  enum (not raw strings) under `strict`. The jest mock in `jest.setup.js` now
  defines that enum — keep it in sync if you touch notification triggers.
- `new Date(a) - new Date(b)` fails `strict` — use `.getTime()` on both sides.
- `t.date || t.createdAt` is `string | undefined` (createdAt is optional) —
  add `|| ''` when passing to `new Date()` / string-typed helpers.
- Under `strict`, `catch (e)` makes `e` `unknown`. Where the code reads
  `e.code` / `e.message` (e.g. authService Firebase errors), annotate
  `catch (e: any)` to preserve behavior (step 8).
- Optional native modules loaded via `require()` in try/catch (GoogleSignin,
  appleAuth) stay typed `any` — they're absent in Expo Go.
