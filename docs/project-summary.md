# Qaizo — Project Summary

## What is Qaizo
AI-powered personal finance app for Android. Built with React Native (Expo SDK 53/54), Firebase Auth + Firestore, Gemini 2.0 Flash AI. Supports 3 languages: English, Russian, Hebrew (with full RTL support).

**Website:** https://qaizo.app  
**Play Store:** Closed beta testing (20 testers, 2-week cycle)  
**Version:** 1.0.0, versionCode 4  
**Total commits:** 246+  
**Codebase:** 19 screens, 40 components, 10 services

---

## Completed Features

### Core Finance
- Manual transaction entry (income/expense/transfer)
- Multiple accounts (bank, cash, credit card, investment)
- Categories with icons and colors
- Recurring payments with auto-confirm on due date
- Split transaction into multiple categories
- Transaction search & filters (date range, amount, category, account)
- Manual account reordering (up/down)
- Swipe months in calendar view
- CSV/Excel import (smart format detection: Wallet, Bluecoins, bank, generic)
- CSV/Excel/PDF export

### AI Features (Gemini 2.0 Flash)
- **AI Chat Advisor** — ask about spending, get savings tips, inline charts
- **Voice Input** — say "coffee 5 dollars", AI parses amount + category + account
- **Smart Input** — type naturally, AI understands
- **Receipt Scanner** — camera capture, Gemini Vision reads amount/store/date/items, multi-photo, auto-retry, duplicate protection

### Budgeting & Goals
- Budget per category with progress bars
- "Free Money Today" calculator on dashboard
- Savings goals with target amount/date, deposit tracking

### Analytics
- Interactive SVG donut pie chart
- 6-month bar chart
- Daily expenses chart
- Balance history, cash flow, expense breakdown
- Period selector (7D, 1M, 3M, 6M, 1Y)
- Three tabs: Overview, Expenses, Trends

### Dashboard
- 8 customizable blocks (reorder/show/hide via DashboardLayoutModal)
- Progressive unlock — widgets appear as you use the app
- Achievements & streaks (6 levels, 30-day activity calendar)
- Quick add templates (categories + user-created)

### Auth & Security
- Firebase Email/Password auth
- Google Sign-In (native)
- Forgot password flow
- Biometric auth (fingerprint/face)
- Session persistence with AsyncStorage

### Shopping List
- Price history from scanned receipts
- Overdue item alerts
- Share via WhatsApp

### i18n & RTL
- Full interface in EN, RU, HE — natively written, not machine translated
- RTL support: text alignment, layout direction, currency symbol placement
- Dynamic style helpers: i18n.row(), i18n.textAlign()

### Infrastructure
- EAS Build (development/preview/production profiles)
- Firebase Auth + Firestore backend
- 182 passing tests (Jest)
- Standardized fonts across 44 files
- Keyboard dismiss on scroll (7 screens)
- Comma decimal separator support (8 files)
- Edge-to-edge (Android 15) + resizeableActivity (Android 16)

### Website (qaizo.app)
- Landing page with phone mockup, feature cards, demo section
- FAQ accordion, newsletter signup
- 3-language switcher (EN/RU/HE)
- SEO: 100/100, Best Practices: 100/100, Performance: 87/100
- Google Analytics 4
- Privacy Policy + Terms of Service

---

## External Tests Results
- **Firebase Test Lab (Robo)** — passed, no crashes
- **PageSpeed Insights** — 87 performance, 100 SEO, 100 best practices
- **MobSF Security** — 56/100, no real issues (all findings are standard Expo/Firebase components)
- **Google Play Pre-launch report** — 2 warnings (edge-to-edge + resizeableActivity), already fixed in code

---

## Current Status (2026-04-11)
- **Phase:** Closed beta testing (2 weeks, ~20 testers)
- **Code:** Frozen until further notice
- **Next:** Prepare for public release (content, marketing, Product Hunt)
- **Known issues:** 44 console.log to remove before production, Sentry removed (was crashing app), dataService test coverage 24%

---

## Tech Stack
- React Native + Expo SDK 53/54
- Firebase Auth + Firestore
- Gemini 2.0 Flash API (AI features)
- @jamsch/expo-speech-recognition (voice input)
- expo-camera (receipt scanner)
- expo-local-authentication (biometrics)
- react-native-edge-to-edge
- Jest (182 tests)

---

## Team
- **Alex** — Frontend/UI (screens, components, navigation, styling)
- **Sean** — Backend/Services (data services, AI/Gemini, Firebase, tests)
