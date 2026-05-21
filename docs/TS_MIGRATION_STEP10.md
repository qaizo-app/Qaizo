# Step 10 — Migrate `dataService` + `aiService` to TypeScript

> **Handoff doc.** Run this on the PC (VSCode) where you can launch the Expo app.
> This is the final step of the gradual JS→TS migration. See `TS_MIGRATION.md`
> for the full progress tracker, conventions, and gotchas from steps 1–9.
> Branch: `claude/qaizo-code-optimization-fXNtk`.

## Why this is its own step
`dataService` is imported by **31 files** and is the single source of all
persisted data (dual backend: Firestore when logged in, AsyncStorage otherwise).
While it's `.js`, every call site sees `any` — so the types added in steps 1–9
are working "in the dark". Typing it unlocks the real payoff. `aiService`
depends on `dataService`, so do **dataService first, aiService second**.

## Current state (before step 10)
- 13/17 services migrated. Remaining: `dataService.js` (~1044 loc),
  `aiService.js` (~1321 loc).
- `tsc --noEmit` is clean (0 errors). Full jest suite green: **261 tests**.

---

## Plan — two commits per service

### Commit A — mechanical migration (no return-type tightening)
1. `git mv src/services/dataService.js src/services/dataService.ts`
2. Fix the header comment (`.js`→`.ts`).
3. Add param + internal annotations so `tsc` passes under `strict`:
   - `catch (e)` → `catch (e: any)` where `e.code` / `e.message` is read.
   - Type the `KEYS` map, `_changeListeners` set, accumulator objects
     (`Record<string, number>` etc.), and callback params.
   - Keep `this`-based method calls — TS infers `this` for object-literal
     method shorthand fine.
4. `npx tsc --noEmit` → fix until clean. `npm test` → green.
5. Commit: `refactor(ts): step 10a — migrate dataService (mechanical)`.

### Commit B — tighten public method return types to domain types
Annotate the exported methods with the `src/types` domain types (table below).
This is where **new errors surface in the already-migrated `.ts` services**
that call dataService. Fix them one by one. Screens/components are still
`.js`/`.jsx`, so they stay `any` — fallout is bounded to:
- `streakService.ts` (getStreaks/saveStreaks)
- `notificationService.ts` (getRecurring/getTransactions/getProjects)
- `exportService.ts` (getTransactions/getAccounts)
- `importService.ts` (getTransactions/getAccounts/saveAccounts/addTransaction)

Commit: `refactor(ts): step 10b — type dataService public API`.

Repeat A→B for `aiService` as **step 11**.

### Suggested return types for dataService public methods
| Method | Suggested signature |
|---|---|
| `getTransactions()` | `Promise<Transaction[]>` |
| `addTransaction(tx)` | `(tx: Partial<Transaction>) => Promise<boolean \| string>` * |
| `updateTransaction(id, changes)` | `(id: string, changes: Partial<Transaction>) => Promise<boolean>` |
| `deleteTransaction(id)` | `(id: string) => Promise<boolean>` |
| `getAccounts()` | `Promise<Account[]>` |
| `getLastUsedAccountByType(type)` | `(type: AccountType) => Promise<Account \| null>` |
| `saveAccounts(accounts)` | `(accounts: Account[]) => Promise<boolean>` |
| `addAccount` / `updateAccount` / `deleteAccount` | mirror transactions |
| `getInvestments()` / `saveInvestments(x)` | `Promise<Investment[]>` / `Promise<boolean>` |
| `getCategories()` / `saveCategories(x)` | `Promise<Category[]>` / `Promise<boolean>` |
| `getBudgets()` / `saveBudgets(x)` / `setBudget` / `deleteBudget` | budgets are a `Record<string, number>` map (categoryId→limit) — confirm against current shape |
| `getProjects()` … | `Promise<Project[]>` + add/update/delete |
| `getGoals()` … `addGoalDeposit(goalId, amount, note)` | `Promise<Goal[]>` + mutators |
| `getRecurring()` … `confirmRecurring` / `autoExecuteRecurring` / `skipRecurring` | `Promise<Recurring[]>` + mutators |
| `getTags()` / `saveTags` / `addTag` / `deleteTag` | `Promise<string[]>` |
| `getQuickTemplates()` / `saveQuickTemplates` | `Promise<QuickTemplate[]>` |
| `getShoppingList()` / `saveShoppingList` | `Promise<ShoppingItem[]>` (confirm) |
| `getStreaks()` / `saveStreaks(x)` | `Promise<StreakData>` / `Promise<boolean>` |
| `getSettings()` / `saveSettings(x)` | `Promise<Settings>` / `Promise<boolean>` |
| `exportData()` / `importData(data)` | define an `ExportBundle` type or use `any` for now |
| `clearAllData` / `migrateToFirestore` / `recalculateBalances` | `Promise<boolean>` |

\* Check the real return of `addTransaction` before locking it — it may return
the created id, the object, or a boolean. **Match the actual code, don't guess.**

If a precise type fights you, leave that one method `any` and move on — a typed
90% beats a stalled migration. Note any you skipped at the bottom of this file.

---

## Conventions (same as steps 1–9)
- Import domain types: `import type { Transaction, Account } from '../types';`
- **Keep the exact export shape** (`export default dataService`) so no importer
  changes.
- Migration commits change types only — **no runtime behavior changes**.
- `t.date || t.createdAt` is `string | undefined` → add `|| ''` for `new Date()`.
- `new Date(a) - new Date(b)` fails strict → use `.getTime()`.
- Lookup tables → `Record<string, T>`.

## ⚠️ Verification checklist (DO NOT skip the app run)
Type-check and unit tests are necessary but **not sufficient** for a module
this central — they verify code correctness, not feature correctness.

- [ ] `npx tsc --noEmit` → 0 errors
- [ ] `npm test` → all green (261+ tests)
- [ ] `npx expo start` and exercise the real app:
  - [ ] Add an expense and an income → balances update instantly
  - [ ] Add / edit / delete an account → balances recalc correctly
  - [ ] Smart input (AI / Gemini) parses a sentence into a transaction
  - [ ] CSV/Excel import → accounts + categories resolve, no crash
  - [ ] Export to PDF/CSV opens the share sheet with correct totals
  - [ ] A recurring payment confirms / auto-executes
  - [ ] Log out → log in → data syncs (Firestore path) and AsyncStorage path
        works offline
  - [ ] Hebrew (RTL) screen still renders correctly (smoke check)
- [ ] Only after the app run passes → push and merge to `main`

## Notes / skipped types
_(record here any method you left as `any` and why, so the next person knows)_
- …
