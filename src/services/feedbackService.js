// src/services/feedbackService.js
// Tracks the rate-app prompt state and submits user feedback to Formspree.
//
// The prompt should only show when the user has had enough time with the app
// to form a real opinion — we gate on (a) transactions logged and (b) days
// since install, and never prompt again once dismissed or submitted for the
// current app version.
//
// Low ratings (1-3★) route to the in-app feedback form; high ratings (4-5★)
// send the user to the Play Store. Formspree is the cheapest drop-off — it is
// already configured for newsletter sign-ups on the website.

import AsyncStorage from '@react-native-async-storage/async-storage';
import appJson from '../../app.json';

const INSTALL_KEY = 'qaizo_install_date';
const STATE_KEY = 'qaizo_rate_state';
const FEEDBACK_ENDPOINT = 'https://formspree.io/f/xvzdkknz';

const MIN_TX = 10;
const MIN_DAYS = 14;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const appVersion = appJson?.expo?.version || '0.0.0';
const buildNumber = appJson?.expo?.android?.versionCode || 0;
const versionTag = `${appVersion}+${buildNumber}`;

async function getState() {
  try {
    const raw = await AsyncStorage.getItem(STATE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

async function setState(next) {
  try {
    await AsyncStorage.setItem(STATE_KEY, JSON.stringify(next));
  } catch (e) {}
}

async function ensureInstallDate() {
  let v = await AsyncStorage.getItem(INSTALL_KEY);
  if (!v) {
    v = new Date().toISOString();
    await AsyncStorage.setItem(INSTALL_KEY, v);
  }
  return v;
}

async function getDaysSinceInstall() {
  const iso = await ensureInstallDate();
  const ms = Date.now() - new Date(iso).getTime();
  return Math.floor(ms / MS_PER_DAY);
}

async function shouldPrompt({ transactionCount = 0 } = {}) {
  // Stamp install date even if gates fail — the first call establishes
  // the "days since install" anchor for future checks.
  const days = await getDaysSinceInstall();
  const st = await getState();
  if (st.dismissedVersion === versionTag) return false;
  if (st.submittedVersion === versionTag) return false;
  if ((transactionCount || 0) < MIN_TX) return false;
  if (days < MIN_DAYS) return false;
  return true;
}

async function markDismissed() {
  const st = await getState();
  st.dismissedVersion = versionTag;
  st.lastDismissedAt = new Date().toISOString();
  await setState(st);
}

async function markSubmitted() {
  const st = await getState();
  st.submittedVersion = versionTag;
  st.lastSubmittedAt = new Date().toISOString();
  await setState(st);
}

async function submitFeedback({ rating, chip, text, language, platform }) {
  const body = {
    rating: Number(rating) || 0,
    chip: chip || '',
    text: (text || '').slice(0, 2000),
    language: language || '',
    platform: platform || 'android',
    version: versionTag,
    _subject: `Qaizo feedback — ${rating || '?'}★`,
  };
  const res = await fetch(FEEDBACK_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`feedback http ${res.status}`);
  await markSubmitted();
  return true;
}

function __reset() {
  // Test-only helper to reset the module-level state bag.
}

export default {
  shouldPrompt,
  markDismissed,
  markSubmitted,
  submitFeedback,
  getDaysSinceInstall,
  ensureInstallDate,
  MIN_TX,
  MIN_DAYS,
  versionTag,
  __reset,
};
