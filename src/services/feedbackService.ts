// src/services/feedbackService.ts
// Tracks the in-app store-review prompt state and submits free-form feedback
// to Formspree.
//
// The store-review prompt is gated on (a) transactions logged and (b) days
// since install, and never re-prompts once dismissed or marked submitted for
// the current app version. The actual prompt is the OS-native one
// (SKStoreReviewController on iOS, In-App Review on Android) — this module
// only decides whether to invoke it.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import appJson from '../../app.json';

const INSTALL_KEY = 'qaizo_install_date';
const STATE_KEY = 'qaizo_rate_state';
const FEEDBACK_ENDPOINT = 'https://formspree.io/f/xvzdkknz';

const MIN_TX = 10;
const MIN_DAYS = 14;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

interface RateState {
  dismissedVersion?: string;
  submittedVersion?: string;
  lastDismissedAt?: string;
  lastSubmittedAt?: string;
}

export interface SubmitFeedbackInput {
  rating: number | string;
  chip?: string;
  text?: string;
  language?: string;
  platform?: string;
  email?: string;
  userId?: string;
}

const appVersion = appJson?.expo?.version || '0.0.0';
const buildNumber = Platform.OS === 'ios'
  ? ((appJson?.expo as { ios?: { buildNumber?: number | string } })?.ios?.buildNumber || 0)
  : ((appJson?.expo as { android?: { versionCode?: number } })?.android?.versionCode || 0);
const versionTag = `${appVersion}+${buildNumber}`;

async function getState(): Promise<RateState> {
  try {
    const raw = await AsyncStorage.getItem(STATE_KEY);
    return raw ? (JSON.parse(raw) as RateState) : {};
  } catch (e) {
    return {};
  }
}

async function setState(next: RateState): Promise<void> {
  try {
    await AsyncStorage.setItem(STATE_KEY, JSON.stringify(next));
  } catch (e) {}
}

async function ensureInstallDate(): Promise<string> {
  let v = await AsyncStorage.getItem(INSTALL_KEY);
  if (!v) {
    v = new Date().toISOString();
    await AsyncStorage.setItem(INSTALL_KEY, v);
  }
  return v;
}

async function getDaysSinceInstall(): Promise<number> {
  const iso = await ensureInstallDate();
  const ms = Date.now() - new Date(iso).getTime();
  return Math.floor(ms / MS_PER_DAY);
}

async function shouldPrompt({ transactionCount = 0 }: { transactionCount?: number } = {}): Promise<boolean> {
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

async function markDismissed(): Promise<void> {
  const st = await getState();
  st.dismissedVersion = versionTag;
  st.lastDismissedAt = new Date().toISOString();
  await setState(st);
}

async function markSubmitted(): Promise<void> {
  const st = await getState();
  st.submittedVersion = versionTag;
  st.lastSubmittedAt = new Date().toISOString();
  await setState(st);
}

async function submitFeedback({ rating, chip, text, language, platform, email, userId }: SubmitFeedbackInput): Promise<boolean> {
  const body = {
    rating: Number(rating) || 0,
    chip: chip || '',
    text: (text || '').slice(0, 2000),
    language: language || '',
    platform: platform || Platform.OS,
    version: versionTag,
    email: (email || '').trim().slice(0, 120),
    userId: userId || '',
    _subject: `Qaizo feedback — ${rating || '?'}★${email ? ` — reply to ${email}` : ''}`,
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

function __reset(): void {
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
