# Qaizo - Session Summary (2026-03-28)

## What was done today

### 1. CSV/Excel Import (importService.js + ImportModal.js)
- Smart format detection: Wallet/Bluecoins, bank statements, generic CSV
- Delimiter auto-detection (semicolon vs comma vs tab) - critical for EU-style CSVs
- 3-level category matching: exact match → substring → regex keywords
- Income categories (salary, rental, handyman, sales) auto-set type=income regardless of CSV type column
- Account auto-creation with correct types: cash/credit/bank/investment
- Investment accounts preserved (קרן השתלמות, קופת גמל, פנסיה) - not skipped as transfers
- Duplicate prevention on re-import (key: date+amount+category+type)
- Column mapping UI for unknown formats
- 5-step UI: pick → mapping → preview → importing → done

### 2. Transaction Search & Filters (TransactionsScreen.js)
- Date range filter with calendar picker (DatePickerModal)
- Amount range filter (min/max)
- Category multi-select chips
- Account multi-select chips
- Filter badge showing active filter count
- Clear all filters button

### 3. Export Fix (exportService.js)
- Fixed `expo-file-system` → `expo-file-system/legacy` (deprecated API crash)
- Removed `EncodingType.UTF8` parameter that was undefined

### 4. RTL Hebrew Support - Additional Fixes
- InteractivePieChart: legendRow flexDirection, removed manual element reordering
- InteractiveBarChart: tooltip month textAlign
- AddTransactionModal: title, label, input textAlign
- AddRecurringModal: title, label, input, scheduleTxt textAlign
- SmartInputModal: resultAmount, resultType textAlign
- CategoriesScreen: modalTitle, fieldLabel, input textAlign

### 5. Recurring Payments - Swipe to Delete/Edit
- Added Swipeable wrapper on recurring payment items in DashboardScreen
- Swipe reveals edit (yellow) and delete (red) buttons

### 6. UI Fixes
- AIAdvisorScreen: summary values font size reduced, numberOfLines={1} adjustsFontSizeToFit
- StreakCard: "Start your streak" text overflow fix (flex: 1, flexShrink: 1)

### 7. EAS Dev Build Setup
- Installed eas-cli, expo-dev-client
- Created eas.json with development/preview/production profiles
- Fixed dependency versions (jest 29.7.0, jest-expo 54.0.17 for SDK 54)
- Fixed splash screen image in app.json (was causing Gradle build failure)
- Project linked to Expo: @qaizo/qaizo
- Build currently running: https://expo.dev/accounts/qaizo/projects/qaizo

### 8. Tests
- All 71 tests passing
- Fixed exportService test mocks for expo-file-system/legacy

---

## Current State

### What works
- Full app running in Expo Go on Android
- Dashboard with customizable blocks (reorder/hide)
- Interactive charts (pie, bar, daily expenses)
- RTL Hebrew support across all screens
- CSV import from Wallet/Bluecoins with smart matching
- Transaction filters with calendar date picker
- Recurring payments with swipe actions
- AI advisor with Gemini
- Smart input (text → transaction)
- Multi-language (RU/HE/EN)
- Export CSV/XLS/PDF
- Streak system

### EAS Build Status
- Building Android development APK
- Previous failures: dependency version mismatch (fixed), missing splash image (fixed)
- When build succeeds → download APK → install on phone → use `npx expo start --dev-client`

---

## What needs to be done next

### After EAS build succeeds
1. **Install APK on phone** and test with `npx expo start --dev-client`
2. **Voice input** - install `@jamsch/expo-speech-recognition`, add mic button to SmartInputModal
3. **Receipt scanner** - camera + Gemini Vision API to parse receipts
4. **Google Sign-In** - configure Google Cloud Console OAuth, test full flow

### Other tasks (no dev build needed)
5. **Test everything** - go through all screens, find bugs
6. **Monthly PDF report** improvements
7. **Account balance history chart** on AccountHistoryScreen
8. **Recurring payment auto-execution** (cron-like)
9. **App Store / Google Play assets** - screenshots, descriptions, icon

---

## Key Files Changed
- `src/services/importService.js` - CSV import engine
- `src/components/ImportModal.js` - Import UI
- `src/services/exportService.js` - Export fix
- `src/screens/TransactionsScreen.js` - Filters
- `src/screens/DashboardScreen.js` - Recurring swipe
- `src/screens/AIAdvisorScreen.js` - Summary fix
- `src/components/StreakCard.js` - Text overflow
- `src/components/InteractivePieChart.js` - RTL
- `src/components/InteractiveBarChart.js` - RTL
- `src/components/AddTransactionModal.js` - RTL
- `src/components/AddRecurringModal.js` - RTL
- `src/components/SmartInputModal.js` - RTL
- `src/screens/CategoriesScreen.js` - RTL
- `src/i18n/en.js, ru.js, he.js` - New filter/import strings
- `app.json` - EAS config, splash image
- `eas.json` - Build profiles
- `jest.setup.js` - Test mocks

## Important Notes
- User prefers Russian language for communication
- `npx expo start --offline` to avoid "Body already been read" bug
- expo-file-system must use `/legacy` import path
- Wallet CSV uses semicolons, not commas - delimiter detection is critical
- Investment account transfers should NOT be skipped during import
