# Qaizo — Personal Finance Manager

> AI-powered personal finance app for the Israeli market.
> Multi-language, RTL-aware, privacy-first, with offline persistence.

**Website:** https://qaizo.app
**Platform:** Android (iOS planned), built with React Native + Expo SDK 53
**Version:** 1.0.0 (build 20)

---

## Table of contents

1. [Vision & target user](#vision--target-user)
2. [Tech stack](#tech-stack)
3. [Authentication & account modes](#authentication--account-modes)
4. [Accounts](#accounts)
5. [Transactions](#transactions)
6. [Categories](#categories)
7. [Scheduled / recurring payments](#scheduled--recurring-payments)
8. [Budgets](#budgets)
9. [Goals](#goals)
10. [Calendar view](#calendar-view)
11. [Analytics & charts](#analytics--charts)
12. [AI features](#ai-features)
13. [Investments](#investments)
14. [Crypto](#crypto)
15. [Multi-currency & live FX](#multi-currency--live-fx)
16. [Shopping list](#shopping-list)
17. [Projects](#projects)
18. [Reports & exports](#reports--exports)
19. [Notifications](#notifications)
20. [Themes & UI](#themes--ui)
21. [Internationalization](#internationalization)
22. [Privacy & security](#privacy--security)
23. [Onboarding](#onboarding)
24. [Settings](#settings)
25. [Streaks & gamification](#streaks--gamification)
26. [Quality & telemetry](#quality--telemetry)

---

## Vision & target user

Qaizo helps Israeli households (and anyone with a similar fund-style banking
landscape) track every shekel across multiple accounts — checking, credit,
cash, mortgages, investment funds, crypto wallets, even physical assets —
without the data ever leaving their own Firebase project. The AI does the
boring parts: parses free-text input, scans receipts, answers natural-language
questions about your spending, and proactively flags subscription bloat.

**Primary persona:** working Israeli adult with at least one bank account, one
credit card, monthly recurring bills (rent, utilities, insurance, subscriptions),
employer-paid Keren Hishtalmut and pension fund, and a desire to budget
without spreadsheets.

---

## Tech stack

- **Frontend:** React Native, Expo SDK 53
- **Backend:** Firebase Auth + Firestore (`@react-native-firebase`, native SDK
  with offline persistence)
- **AI:** Google Gemini 2.5 Flash (with `gemini-flash-latest` fallback on 503)
- **State:** React hooks (`useState`, `useMemo`, `useFocusEffect`)
- **Navigation:** React Navigation (tabs + stack)
- **Charts:** Custom `BalanceLineChart`, `BarChartCard`, `PieChartCard`,
  `InteractiveBarChart`, `CashFlowChart`
- **Build:** EAS Build, EAS Update channels (development/preview/production)
- **Crash reporting:** Sentry (`@sentry/react-native`) with consent gating
- **Analytics:** Firebase Analytics (`@react-native-firebase/analytics`) with
  consent gating, low-cardinality events, no PII
- **Test runner:** Jest, **261 passing tests** at the time of writing

---

## Authentication & account modes

Three ways to use the app:

1. **Sign-in (Email/password or Google Sign-In)** — full Firestore sync across
   devices. Email verification required after registration.
2. **Guest mode** — "Continue without registration" on the auth screen. Data
   lives only in `AsyncStorage` on the device. Can be migrated to Firestore
   later by signing in.
3. **Migration** — when a guest signs in for the first time, local data is
   uploaded to Firestore via `dataService.migrateToFirestore`.

**Re-auth state:** if the user is logged in but email isn't verified, the app
returns to `AuthScreen` with the unverified state.

---

## Accounts

Manage any number of accounts, grouped by type. Each account has its own
currency, balance, and ordering.

**Account types:**

- **Bank** — checking / savings, with optional account number
- **Credit card** — has billing day, may set credit limit (overdraft field
  used as the cap)
- **Cash** — wallet, no statement
- **Investment** — covers Keren Hishtalmut, pension fund, brokerage; supports
  individual stock holdings with live Yahoo Finance prices and P/L
- **Crypto** — supports multi-asset holdings with live CoinGecko prices and
  24h change %
- **Asset** — physical assets (apartment, car) for net worth tracking
- **Mortgage / Loan / Debt** — liabilities, balance counted negative in totals

**Per-account features:**

- Custom name, account number, currency, balance, billing day, overdraft / limit
- Activate / deactivate (archive without deleting)
- Reorder within a type group AND reorder whole groups (Settings → Reorder mode →
  group up/down arrows)
- Status indicators: **overdraft** (red), **warning** (orange) when projected
  balance after recurring payments dips below limit by month-end
- Multi-currency total: every balance converted to the user's global currency
  via live FX rates

**Account history screen:**

- Header with name, type, account number
- **Balance history line chart** — tap period (30d / 3m / 6m / 1y); the chart
  back-computes daily balance from current balance using transaction deltas
- **Upcoming scheduled payments** for this account (next 30 days):
  - Top 5 in a rounded card (name, amount with sign, days-to-due)
  - Includes **transfers** where this account is either source or destination
    — sign flips depending on direction
  - "Show more" button opens full searchable modal with per-recipient history
- **Transactions list** — sorted newest first, with running balance per row,
  swipe-to-delete / edit / duplicate
- The whole screen scrolls as one (chart + upcoming + tx list inside FlatList
  ListHeaderComponent)

---

## Transactions

Every money movement lives as a transaction. The atomic event of the app.

**Fields:**

- `type` — income / expense / transfer
- `amount` (positive number; sign comes from type)
- `categoryId` + cached `categoryName` (snapshot at save time, **but UI always
  re-translates to the current language** when an i18n / cached-groups match
  exists — this is why switching the app language re-renders old transactions
  in the new locale)
- `recipient` (free-text payee)
- `note`
- `date` (ISO)
- `account`
- `tags` (multi-select chips)
- `projectId` (optional, see Projects)
- `isTransfer` + `transferPairId` — for paired expense/income transfer rows
- `iconColor` (per-category color override, set when picking)

**How transactions are created:**

1. **Manual** — `AddTransactionModal` from the dashboard `+` FAB
2. **Smart input** — natural-language parse, see [AI features](#ai-features)
3. **Receipt scanner** — camera + Gemini vision OCR, see [AI features](#ai-features)
4. **Voice input** — speech-to-text on `SmartInputModal`
5. **Quick templates** — saved tap-to-add presets (e.g., "Coffee 12 ₪")
6. **Auto-execution of recurring payments** — `confirmRecurring` materializes
   the transaction on its due date when `autoConfirm` is enabled
7. **Import** — CSV / Excel via `ImportModal`, with review step that maps
   unknown accounts and categories
8. **Quick add** modal — pre-selects category + account, focuses amount input

**Transfers** are stored as **two linked transactions** (one expense on the
source account, one income on the destination) sharing a `transferPairId`.
The Calendar / Account-history screens detect these pairs and render them as a
single "From → To" row to avoid double-counting.

**Editing a transfer** keeps both legs in sync (account, recipient, amount,
date, tags) — you can edit either side and the partner updates atomically.

---

## Categories

Two-level tree: **groups** (top-level, e.g. "Home", "Food") with **subs**
(e.g. "Electricity", "Water" under "Home").

**Default tree includes 9 expense groups + Income group.**

Income subs:
- Salary (self / spouse)
- Rental income
- Side job
- Sales
- **Keren Hishtalmut** (Israeli study fund)
- **Pension**
- Other income

Each group has its own color and icon. Subs inherit group color, choose own icon.

**Category management:**

- Settings → Categories — full editor (rename, change icon/color, add/delete
  groups and subs, drag to reorder)
- AI auto-translates new category names into all 11 languages on save
- **Inline create** — every category-picker (in `AddTransactionModal`,
  `AddRecurringModal`) has a "+ Add" row at the end of every group; tap to
  inline-edit a name, confirm, and the new sub is appended to that group via
  `dataService.saveCategories` and immediately selected. No round-trip to
  settings needed.
- Custom category names are stored as `{ ru, en, he, ... }` so they
  re-translate when the user switches the app language
- Category icons render through a 4-level fallback chain in scheduled-payment
  views: saved icon → cached groups → `categoryConfig` → generic placeholder

---

## Scheduled / recurring payments

A first-class feature in Qaizo. Anything that repeats — rent, salary,
subscriptions, transfers to Keren Hishtalmut — lives as a recurring item with
its own due-date schedule.

**Three types of recurring:**

- **Expense** — money out (rent, Netflix, ChatGPT subscription, insurance)
- **Income** — money in (salary, Bituach Leumi child allowance, Keren
  Hishtalmut employer contribution)
- **Transfer** — between two accounts of the user (savings deposit, pension
  fund top-up). Materialized at confirm time as the linked
  expense/income pair the same way one-off transfers work.

**Per-payment fields:**

- Amount, currency
- Source account (+ destination account for transfers)
- Category + payee + note
- **Schedule:** start date, interval (every month / 2 / 3 / 6 / 12 months
  or custom)
- **End condition:** none / after N occurrences / until specific date
- **Contract end date** (separate flag, for "your contract ends 2026-08-15"
  style reminders)
- **Notify before payment** — local notification day before
- **Auto-confirm** — silently materialize the transaction at due date with
  no prompt
- **Tags** — same picker as transactions

**Where they appear:**

- **Dashboard "Upcoming payments" block** — the next 5 due in the next 30 days,
  with per-row swipe (edit / delete) and quick-action buttons (✓ confirm,
  ⏩ skip)
- **"Show more" modal** — full searchable list, expand row to see per-recipient
  history
- **Account history screen** — only the recurring items hitting that specific
  account (including transfers where it's the destination)
- **Calendar** — dotted day badges, tap to see what's due
- **Recurring detail modal** — full payment overview:
  - Stats card (total paid · average · since first match)
  - Full history list with notes (no row limit)
  - Edit, delete, confirm, skip actions

**Confirm/skip sheet:** tapping the ✓ icon opens an editable confirmation
sheet where amount, date, and account can be tweaked before committing. The
⏩ icon performs an immediate silent skip (shifts `nextDate` by one interval
or to the user's overridden date).

---

## Budgets

Set a monthly cap per category (e.g., "Food: 2000 ₪/month"). Qaizo tracks
spend-to-date and shows percentage filled.

- Sorted on the dashboard with progress bars
- Overspend turns red; warning at 80%
- Set / edit via `BudgetModal` from the dashboard budgets block
- Each budget independent, no global cap

---

## Goals

Set a savings target with a date — Qaizo tracks progress and projects when
you'll reach it given your monthly free-money flow.

- Goal name, target amount, target date, optional emoji/icon
- Block on the dashboard shows progress bar + ETA
- Editable / deletable via the goals screen (long-press to edit)

---

## Calendar view

Month view with daily transaction badges (one dot per income, one per
expense). Tap a day to see the transactions for that date in a list below.

- Period swipe (prev/next month via header arrows)
- Day-detail list shows merged transfer pairs ("From → To")
- Localized week start (Sunday vs Monday) per user setting
- Localized month names

---

## Analytics & charts

**Dashboard widgets** (re-orderable via `DashboardLayoutModal`):

- **Total balance** — sum across all active accounts in user's global currency
- **Monthly income / expense / net flow** — for the current month
- **End-of-month forecast** — projects balance after pending recurring
  payments
- **Free money today** — what you can spend today without breaking budget
- **Pie chart by category** — current month, top 6 categories, others bucketed
- **6-month bar chart** — income vs expense per month, tap a bar to drill down
- **Recent transactions** — last 5
- **Upcoming payments** — see [Recurring](#scheduled--recurring-payments)
- **Goals**
- **Budgets**
- **Streaks** — see [Streaks & gamification](#streaks--gamification)
- **AI advisor hint**

**Auto-reveal:** widgets appear when the relevant data exists (10+
transactions reveals the pie, 2+ months reveal the bar chart, 3+ day streak
reveals the streak block).

**Analytics screen** (separate, accessible from the menu):

- Detailed period selector, monthly drill-down, category trends

---

## AI features

All AI runs through `aiService.js`, gated by user consent on onboarding,
sample-rate-throttled, with `__DEV__` guards on console output.

**Smart input** — `SmartInputModal`:
- Free-text or voice input ("Supermarket 800", "Got salary 12000")
- Gemini parses → category guess + amount + recipient + type
- One-tap save with editable preview
- Voice auto-parse: hold-to-record → speech-to-text → auto-fires Gemini

**Receipt scanner** — `ReceiptScannerModal`:
- Camera capture or gallery pick
- Gemini Vision OCR → extracts merchant, total, items, date
- One-tap save

**AI Chat** — `AIChatScreen`:
- Conversational interface to your data ("How much did I spend on food in
  February?", "Will I have enough next month?")
- Pulls user's last N transactions / accounts / budgets as context
- Gemini answers in the user's language
- Voice input supported

**AI Advisor** — `AIAdvisorScreen`:
- Proactive insights cards (top expense category, subscription bloat,
  unusual spending)
- Each card explainable: tap → see which transactions triggered it
- Localized in 11 languages

**Category auto-translate:**
- When a user creates a custom category, Gemini fills in the missing
  language entries for the multilingual `name` object

**Failure handling:**
- Specific error reasons (`rate_limit`, `network`, `auth`, `server`,
  `no_api_key`) bubble up to UI
- Auto-fallback to `gemini-flash-latest` on 503 from primary model

---

## Investments

For accounts of `type: 'investment'` with stock holdings:

- Live quotes from **Yahoo Finance v7** (`/v7/finance/quote`)
- Per-holding rows: ticker, share count, current price, total value, P/L %
- Account-level totals roll up to the dashboard
- 60s in-memory cache + AsyncStorage offline fallback
- Pull-to-refresh forces a live re-fetch

---

## Crypto

For accounts of `type: 'crypto'` with multi-asset holdings:

- Live prices from **CoinGecko** (`/simple/price`), 35 top coins (BTC, ETH,
  USDT, SOL, XRP, DOGE, TON, TRX, ADA, AVAX, etc.)
- 29 vs-currencies supported
- Holdings list inside the account-edit modal: add coin (uppercased),
  amount, remove
- Live balance + 24h change %
- 60s cache + AsyncStorage fallback

---

## Multi-currency & live FX

- 30+ supported display currencies
- User picks a global currency in settings; per-account currency may differ
- **Live exchange rates** from `open.er-api.com` (free, no key)
- 6h TTL cache, persisted to AsyncStorage so offline opens still convert
- All cross-currency totals (account total, dashboard balance, monthly
  income/expense) use live rates
- Initial currency auto-detected from device locale on first run

---

## Shopping list

A grocery-list screen separate from transactions, useful for planning
before a supermarket run.

- Manual entries: name, optional price + quantity + note
- Three filter tabs: **Frequent** (auto-built from recurring purchases),
  **My list** (manually added), **All**
- Search box across the list
- Receipt scanner here too — adds scanned items as a batch
- Share button — copies the list to a friend
- Persists across sessions via the new `SHOPPING_LIST` key in `dataService`

---

## Projects

Group transactions into a "project" (vacation, renovation, wedding) for
ad-hoc cost tracking outside the normal category system.

- Per-project name, icon, target budget
- Tag transactions with `projectId` from the add modal
- Project screen shows total spent, remaining vs budget, transaction list

---

## Reports & exports

**Monthly PDF report** (`MonthlyReportScreen`):

- Branded header (Q badge + gradient)
- Summary cards (income / expense / net) + quick-stats tiles
- Category breakdown — top 10 expense + top 5 income with bar visualizations
- Account breakdown — per-account income / expense / count
- RTL-aware (he, ar) — direction, alignment, flipped borders
- A4 page margins, page-break-inside: avoid
- All user-controlled text HTML-escaped

**Exports:**

- **CSV** — flat file
- **Excel (XLSX)** — multi-sheet via `xlsx`
- **PDF** — uses the same Monthly Report template

**Imports:**

- CSV / Excel via `ImportModal`
- Heuristic format detection (Israeli bank exports recognized)
- **Review step**: detected accounts and unknown categories are presented
  with fuzzy-match suggestions; user picks `{id}` (link to existing),
  `{create}` (auto-create), or `{skip}` per row
- Skipped rows reported back

---

## Notifications

Local notifications (no push server, no FCM token):

- **Recurring payment reminder** — day before due date, opens the confirm/skip
  sheet via deep link action button
- **Contract ending soon** — 30 days before `contractEndDate` for any
  recurring item
- **Streak reminder** — 19:00 if the user hasn't logged anything today
- **Weekly summary** — Sunday morning, "this week you spent X, that's Y vs
  last week"
- **Notification action buttons** — "Add income" / "Add expense" right from
  the notification, opens the matching add modal

All gated by `consentService.getReminderConsent()` set during onboarding.

---

## Themes & UI

**4 themes:**

- **System** — follows OS dark/light setting
- **Light**
- **Dark**
- **AMOLED** — pure black background (`bg = #000`), saves 20–30% battery on
  OLED phones

**RTL** support — Hebrew and Arabic flip layout via `I18nManager.forceRTL`,
arrow icons reverse, calendar week-start adjusted, every chevron / back
button mirrors automatically.

**System font scaling** disabled globally to prevent layout breaks on
accessibility-sized fonts.

---

## Internationalization

**11 languages:**

| code | language |
|------|----------|
| ru | Русский |
| he | עברית |
| en | English |
| ar | العربية |
| es | Español |
| fr | Français |
| de | Deutsch |
| pt | Português |
| zh | 中文 |
| hi | हिन्दी |
| ja | 日本語 |

- Auto-detected from device locale on first run
- Manual override in Settings
- Every string in `i18n/<lang>.js` files — never hardcoded
- Custom-category names stored multilingually so they render in the
  current UI language regardless of when they were created
- Settings flag pickers shows actual flags + native language name

---

## Privacy & security

**Privacy by design:**

- All data lives in **the user's own Firebase project** — Qaizo doesn't have
  a central database
- Guest mode keeps everything in `AsyncStorage` only
- Firebase config via env vars (never hardcoded)
- Three independent consents collected at onboarding:
  1. **Reminders** — local notifications
  2. **Crash reports** — Sentry
  3. **Analytics** — Firebase Analytics
- Each consent honored at call time; analytics native SDK is told to stop
  buffering when revoked

**Security:**

- **PIN lock** — 4-digit PIN with attempt cooldown
- **Biometric** — fingerprint / face unlock when available
- **Background re-lock** — locks immediately when app goes to background;
  3-minute grace window if returning right after leaving
- **Sentry** — release-tagged with `com.qaizo.app@1.0.0+13` for per-build
  error grouping; `beforeSend` hook drops events when consent is off
- **Sentry hidden test button** — 5 taps on the version label in Settings
  fires a test crash to verify the pipeline (not visible in normal flow)

---

## Onboarding

5-slide animated walkthrough on first run:

1. Welcome — slogan, brand
2. Smart input + voice
3. AI assistant + receipt scanner
4. Privacy & consents — three toggles (reminders / crashes / analytics)
5. Get started — sign-in or guest

After onboarding: optional **setup wizard** to add the first account, set
weekly budget, and (optionally) log the first transaction. Skippable.

---

## Settings

- **Account** — switch user, sign out, "Continue without registration",
  delete account (full Firestore wipe)
- **Currency** — global currency picker (with live FX info)
- **Language** — manual override, 11-flag picker
- **Theme** — System / Light / Dark / AMOLED
- **Week start** — Sunday / Monday
- **Categories** — full editor
- **Notifications** — toggle each consent
- **PIN / Biometric** — set up, change, remove
- **Export / Import** — CSV / Excel / PDF
- **Share Qaizo** — system share with Play Store URL
- **Rate Qaizo** — opens smart rate prompt (5★ → Play Store, 1-3★ → in-app
  feedback form via Formspree)
- **About** — version (5-tap secret crash-test), links to privacy policy /
  terms / help, contact email + WhatsApp

---

## Streaks & gamification

Tracks consecutive days where the user logged at least one transaction.

- Current streak
- Best streak record
- Milestones at 3 / 7 / 14 / 30 / 60 / 100 / 365 days — celebratory toast
  + stored badge
- "At-risk" reminder after 20:00 if today has no transactions
- Streak block on the dashboard auto-reveals at 3+ days

Designed to be encouraging, never pressuring — easy to ignore.

---

## Quality & telemetry

- **Tests:** 261 Jest tests covering services + utils (analytics,
  categories, currency, exchange rate, crypto, stock, exports, imports,
  recurring history, feedback, streak, etc.)
- **Sentry:** release-tagged crashes, dropped when consent is off
- **Firebase Analytics:** low-cardinality events (`app_opened`,
  `user_registered`, `transaction_added`, `receipt_scanned`,
  `smart_input_used`, `ai_chat_message_sent`), no PII, amount buckets
  instead of exact values
- **Smart rate prompt:** triggers only when user has logged 10+ transactions
  AND been on the app 14+ days AND hasn't dismissed for the current
  version — keeps low-rating UX private (in-app form), routes 4-5★ users to
  the Play Store listing
- **Feedback form** posts to a Formspree endpoint with `chip + free text +
  language + version` — same dashboard the website newsletter uses

---

*Last updated: 2026-04-25 — version 1.0.0 build 13*
