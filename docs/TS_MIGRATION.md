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

### Services — ✅ all migrated
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
| importService | ✅ ts | 9 |
| dataService | ✅ ts | 10a/b (typed public API) |
| aiService | ✅ ts | 11a/b (typed public API) |

### Theme + config — ✅ migrated (step 12)
| File | Status | Notes |
|---|---|---|
| src/theme/colors.ts | ✅ ts | exports `ResolvedTheme` ('dark'\|'light'\|'amoled') |
| src/theme/commonStyles.ts | ✅ ts | style factories take `StyleOverrides?` |
| src/theme/ThemeContext.tsx | ✅ tsx | exports `ThemeMode` ('system'\|'light'\|'dark'\|'amoled'), typed context |
| src/config/firebase.ts | ✅ ts | trivial rename |

### i18n — ✅ migrated (step 13)
| File | Status | Notes |
|---|---|---|
| src/i18n/index.ts | ✅ ts | typed `t(key: string): string`, `LanguageCode` union, typed listeners |
| src/i18n/<lang>.ts × 11 | ✅ ts | dictionaries (treated as `Record<string, string>` in index) |

Step 13 also dedup'd 74 dead duplicate keys across the language packs
(JS last-wins meant they were unreachable). See commit `fix(i18n): remove 74 dead duplicate keys`.

Side-effect after typing `t()`: TS caught 9 `.replace('{key}', someNumber)`
call sites in aiService and notificationService where JS silently coerced
the number to string. Wrapped each with `String(...)`.

### Still .js (not yet migrated)
- `src/navigation/AppNavigator.js`
- `src/screens/*.js` (~30 files)
- `src/components/*.js` (~35 files)
- Root: `App.js`, `index.js`, `jest.setup.js`

These are higher blast radius (RTL/iOS sensitive) — needs a real Expo run to verify after migration.

## Suggested order for remaining work
1. ~~**Step 6 (isolated, small):** streakService, cryptoService~~ ✅
2. ~~**Step 7:** notificationService, analyticsService~~ ✅
3. ~~**Step 8:** authService, exportService~~ ✅
4. ~~**Step 9:** importService~~ ✅
5. ~~**Step 10:** dataService (+ tighten API)~~ ✅
6. ~~**Step 11:** aiService (+ tighten API)~~ ✅
7. ~~**Step 12:** theme + config~~ ✅
8. **Step 13 (optional):** i18n/index.ts + language packs — type the `t()` function and translation key set
9. **Step 14 (high blast radius, needs real Expo run):** screens/components/navigation

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
- importService rows are NOT full `Transaction` — they use a local `ParsedRow`
  type (no id, account resolved later, plus `_rawCategory`/`_accountName`/
  `_accountType` scratch fields). Keep that distinction when touching imports.
- For string→value lookup tables (CATEGORY_MAP, walletCategoryMap, header maps),
  annotate `Record<string, T>` so dynamic `obj[key]` indexing type-checks.

## When you reach step 10 (dataService / aiService)
These are the central modules every other service depends on. Because they were
`.js`, all their call sites currently see `any`. Once typed, expect new errors
to surface in the already-migrated services (callbacks that were silently `any`).
Budget for that. Recommended: type `dataService`'s public methods to return the
domain types from `src/types`, migrate, then run a full `tsc` and fix fallout
service-by-service. Do dataService BEFORE aiService.

**→ Full step-10 plan + verification checklist: see `TS_MIGRATION_STEP10.md`.**
Run that step on the PC (VSCode) where the Expo app can be launched — a module
this central needs a real app run, not just `tsc` + jest.
