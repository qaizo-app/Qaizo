// src/services/analyticsEvents.ts
// Thin wrapper around @react-native-firebase/analytics.
//
// All calls are fire-and-forget: analytics must never throw into product
// code. We honor the user's analytics consent at call time (consentService
// keeps a synchronous mirror) and also sync the native toggle so Firebase
// stops buffering when opted out.
//
// Keep event names and parameter keys STABLE once shipped — Firebase does
// not rename past events. Use snake_case per Firebase convention, and pass
// only low-cardinality anonymous params (never email, names, exact amounts,
// or document contents).
import consentService from './consentService';

// Minimal surface we actually use from @react-native-firebase/analytics.
interface FirebaseAnalytics {
  setAnalyticsCollectionEnabled: (enabled: boolean) => Promise<void>;
  logEvent: (name: string, params?: Record<string, unknown>) => Promise<void>;
  setUserProperty: (key: string, value: string | null) => Promise<void>;
  logScreenView: (params: { screen_name: string; screen_class?: string }) => Promise<void>;
}

type AnalyticsModule = () => FirebaseAnalytics;

let analyticsModule: AnalyticsModule | null = null;
try {
  analyticsModule = require('@react-native-firebase/analytics').default as AnalyticsModule;
} catch (e) {
  // Expo Go / unit tests: module not available, all calls become no-ops.
}

let _lastConsentApplied: boolean | null = null;

function analytics(): FirebaseAnalytics | null {
  return analyticsModule ? analyticsModule() : null;
}

async function syncNativeConsent(): Promise<void> {
  const consent = consentService.getAnalyticsConsent();
  if (consent === _lastConsentApplied) return;
  _lastConsentApplied = consent;
  const a = analytics();
  if (!a) return;
  try { await a.setAnalyticsCollectionEnabled(consent); } catch (e) {}
}

async function logEvent(name: string, params?: Record<string, unknown>): Promise<void> {
  if (!consentService.getAnalyticsConsent()) return;
  const a = analytics();
  if (!a) return;
  try {
    await syncNativeConsent();
    await a.logEvent(name, params);
  } catch (e) {
    if (__DEV__) console.warn('[analytics] logEvent failed', name, e);
  }
}

async function setUserProperty(key: string, value: unknown): Promise<void> {
  if (!consentService.getAnalyticsConsent()) return;
  const a = analytics();
  if (!a) return;
  try {
    await syncNativeConsent();
    await a.setUserProperty(key, value == null ? null : String(value));
  } catch (e) {}
}

async function logScreenView(screenName: string, screenClass?: string): Promise<void> {
  if (!consentService.getAnalyticsConsent()) return;
  const a = analytics();
  if (!a) return;
  try {
    await syncNativeConsent();
    await a.logScreenView({ screen_name: screenName, screen_class: screenClass || screenName });
  } catch (e) {}
}

// Bucket amounts so we never ship exact transaction values to analytics.
function amountBucket(amount: number | string | null | undefined): '<10' | '10-100' | '100-1000' | '1000+' {
  const n = Math.abs(Number(amount) || 0);
  if (n < 10) return '<10';
  if (n < 100) return '10-100';
  if (n < 1000) return '100-1000';
  return '1000+';
}

export default {
  logEvent,
  setUserProperty,
  logScreenView,
  syncNativeConsent,
  amountBucket,
};
