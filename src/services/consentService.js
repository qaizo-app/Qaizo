// src/services/consentService.js
// Tracks user consent for daily-reminder notifications and anonymous crash
// reporting (Sentry). Values are persisted in AsyncStorage by OnboardingScreen
// and read back from App.js on startup.
import AsyncStorage from '@react-native-async-storage/async-storage';

const REMINDER_KEY = 'qaizo_reminders_consent';
const CRASH_KEY = 'qaizo_crash_reports_consent';

// In-memory snapshot for synchronous consumers (e.g. Sentry beforeSend).
// Optimistic defaults: until we read from disk we assume consent is granted,
// which matches the behavior the app had before the consent screen existed.
let _reminderConsent = true;
let _crashReportsConsent = true;

async function load() {
  try {
    const [rem, crash] = await Promise.all([
      AsyncStorage.getItem(REMINDER_KEY),
      AsyncStorage.getItem(CRASH_KEY),
    ]);
    // null (never set) → keep optimistic default
    if (rem != null) _reminderConsent = rem !== 'false';
    if (crash != null) _crashReportsConsent = crash !== 'false';
  } catch (e) {}
}

async function setReminderConsent(value) {
  _reminderConsent = !!value;
  try { await AsyncStorage.setItem(REMINDER_KEY, String(!!value)); } catch (e) {}
}

async function setCrashReportsConsent(value) {
  _crashReportsConsent = !!value;
  try { await AsyncStorage.setItem(CRASH_KEY, String(!!value)); } catch (e) {}
}

function getReminderConsent() { return _reminderConsent; }
function getCrashReportsConsent() { return _crashReportsConsent; }

export default {
  load,
  setReminderConsent,
  setCrashReportsConsent,
  getReminderConsent,
  getCrashReportsConsent,
  REMINDER_KEY,
  CRASH_KEY,
};
