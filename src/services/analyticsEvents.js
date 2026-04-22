// src/services/analyticsEvents.js
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

let analyticsModule = null;
try {
  analyticsModule = require('@react-native-firebase/analytics').default;
} catch (e) {
  // Expo Go / unit tests: module not available, all calls become no-ops.
}

let _lastConsentApplied = null;

function analytics() {
  return analyticsModule ? analyticsModule() : null;
}

async function syncNativeConsent() {
  const consent = consentService.getAnalyticsConsent();
  if (consent === _lastConsentApplied) return;
  _lastConsentApplied = consent;
  const a = analytics();
  if (!a) return;
  try { await a.setAnalyticsCollectionEnabled(consent); } catch (e) {}
}

async function logEvent(name, params) {
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

async function setUserProperty(key, value) {
  if (!consentService.getAnalyticsConsent()) return;
  const a = analytics();
  if (!a) return;
  try {
    await syncNativeConsent();
    await a.setUserProperty(key, value == null ? null : String(value));
  } catch (e) {}
}

async function logScreenView(screenName, screenClass) {
  if (!consentService.getAnalyticsConsent()) return;
  const a = analytics();
  if (!a) return;
  try {
    await syncNativeConsent();
    await a.logScreenView({ screen_name: screenName, screen_class: screenClass || screenName });
  } catch (e) {}
}

// Bucket amounts so we never ship exact transaction values to analytics.
function amountBucket(amount) {
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
