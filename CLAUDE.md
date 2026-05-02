# Qaizo - AI-Powered Finance Management

## Project Overview
Qaizo is a React Native (Expo) personal finance app for the Israeli market. Multi-language (HE/RU/EN), RTL support, Firebase backend, Gemini AI integration.

**Tech stack:** React Native, Expo SDK 53, Firebase Auth + Firestore, Gemini 2.0 Flash API, Jest

**Website:** https://qaizo.app

---

## Team

| Name | Role | Focus Areas |
|------|------|-------------|
| **Alex** | Frontend / UI | Screens, components, navigation, styling, animations, UX |
| **Sean** | Backend / Services | Data services, AI/Gemini, Firebase, tests, infrastructure |

---

## Project Structure

```
src/
  components/     # Reusable UI components (modals, cards, inputs)
  screens/        # App screens (Dashboard, Transactions, Settings, etc.)
  services/       # Business logic (dataService, aiService, authService, etc.)
  theme/          # Colors, ThemeContext
  i18n/           # Translations (en.js, ru.js, he.js)
  navigation/     # AppNavigator (tab + stack navigation)
  utils/          # Currency utilities
  config/         # Firebase config
docs/             # GitHub Pages website (qaizo.app)
__tests__/        # Jest test files
scripts/          # Build/task scripts
```

---

## Development Workflow

### Daily Flow
1. **Morning:** Pull from `main`, run `npm run assign-tasks` to get your daily tasks
2. **Work:** Each developer works on their assigned tasks in a feature branch
3. **End of day:** Push branch, create PR, merge to `main`
4. **After merge:** Run `npm run check-tasks` to mark completed tasks

### Branch Naming
- `alex/feature-name` or `alex/fix-name`
- `sean/feature-name` or `sean/fix-name`

### Commands
```bash
npm install              # Install dependencies
npm start                # Start Expo dev server
npm test                 # Run all tests
npm run assign-tasks     # Generate daily task files for Alex & Sean
npm run check-tasks      # Check and update task completion
```

---

## Sprint Backlog

### Priority 1 - Critical (Must Do)
- [ ] Dev build via EAS (replace Expo Go)
- [ ] Fix autofill highlight on Android (needs dev build)
- [ ] Voice input (speech-to-text) for SmartInputModal
- [ ] Receipt scanner (camera + Gemini Vision)
- [ ] End-to-end testing on physical device

### Priority 2 - Important
- [ ] Improve chart visualizations (pie chart interaction, bar chart labels)
- [ ] Transaction search and filters on TransactionsScreen
- [ ] Account balance history chart on AccountHistoryScreen
- [ ] Recurring payment auto-execution (cron-like)
- [ ] Data import from CSV/Excel
- [ ] Investments screen - real portfolio tracking
- [ ] Monthly report PDF improvements

### Priority 3 - Nice to Have
- [ ] Home screen widget (daily budget)
- [ ] Biometric auth (fingerprint/face)
- [ ] Multi-currency live exchange rates API
- [ ] Shared family budgets (multi-user)
- [ ] Dark/light theme polish and animations
- [ ] Onboarding tutorial improvements
- [ ] App Store / Google Play assets (screenshots, descriptions)

### Priority 4 - Future
- [ ] Bank API integration (Open Banking Israel)
- [ ] Credit card statement import
- [ ] Pension/insurance optimization advisor
- [ ] Web dashboard version
- [ ] Apple Watch / Wear OS widget

---

## Coding Standards
- All strings must be in i18n (en.js, ru.js, he.js) - never hardcode text
- Use `colors` from theme - never hardcode colors
- Every service function must have a test
- Use `ConfirmModal` instead of native `Alert` for destructive actions
- Firebase config via env vars only (.env)
- Commit messages: `feat:`, `fix:`, `test:`, `chore:`, `docs:`

---

## iOS RTL Rules (MANDATORY — violations cause Hebrew text misalignment on iOS)

### Rule 1: Never use `flex:1` on `<Text>` inside a row container
iOS ignores `textAlign` when `<Text>` has `flex:1` inside `flexDirection:'row'`. Use `<RowText>` instead.

```jsx
// WRONG — works on Android, broken on iOS Hebrew:
<View style={{flexDirection:'row'}}>
  <Text style={{flex:1, textAlign:'right'}}>label</Text>
</View>

// CORRECT — use RowText from src/components/RowText.js:
import RowText from '../components/RowText';
<View style={{flexDirection:'row'}}>
  <RowText style={{textAlign:'right'}}>label</RowText>
</View>
```

`<TextInput>` and `textAlign:'center'` are NOT affected — do not wrap those.

### Rule 2: Never call i18n functions inside module-level StyleSheet.create()
`StyleSheet.create()` at module level is evaluated once at import time, before the language is loaded from AsyncStorage. All `i18n.row()`, `i18n.textAlign()`, `i18n.isRTL()` calls inside it get frozen with wrong values.

```jsx
// WRONG — frozen at import time:
const st = StyleSheet.create({
  row: { flexDirection: i18n.row() },
  title: { textAlign: i18n.textAlign() },
});

// CORRECT — factory function called inside the component:
const createSt = () => StyleSheet.create({
  row: { flexDirection: i18n.row() },
  title: { textAlign: i18n.textAlign() },
});
export default function MyScreen() {
  const st = createSt(); // re-evaluated on every render
  ...
}
```

### Summary checklist for every new component/screen:
- [ ] `StyleSheet.create()` is inside a `createSt()` factory, called inside the component
- [ ] No `<Text style={{flex:1}}>` inside row containers — use `<RowText>` instead
- [ ] `flexDirection` in row containers uses `i18n.row()` (not hardcoded `'row'`)
- [ ] Header icon groups use `flexDirection: i18n.row()` so order flips in RTL

---

## Environment Setup
1. Copy `.env.example` to `.env` and fill in API keys
2. `npm install`
3. `npx expo start` for Expo Go, or `npx expo run:android` for dev build
