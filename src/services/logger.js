// src/services/logger.js
// Thin wrapper around @sentry/react-native so screens can drop breadcrumbs
// and capture exceptions without each one needing its own try/catch around
// the import. Sentry isn't available in Expo Go, so every call is guarded.
let Sentry = null;
try {
  Sentry = require('@sentry/react-native');
} catch (e) {
  // No-op; Sentry not loaded (Expo Go or build without sentry plugin)
}

export function breadcrumb(category, message, data) {
  if (__DEV__) console.log(`[${category}]`, message, data || '');
  if (!Sentry) return;
  try {
    Sentry.addBreadcrumb({ category, message, data, level: 'info' });
  } catch (e) {}
}

export function captureError(err, context) {
  if (__DEV__) console.error('[capture]', context, err);
  if (!Sentry) return;
  try {
    Sentry.captureException(err, context ? { extra: context } : undefined);
  } catch (e) {}
}

export function captureMessage(msg, level = 'warning', extra) {
  if (__DEV__) console.warn('[capture]', msg, extra || '');
  if (!Sentry) return;
  try {
    Sentry.captureMessage(msg, { level, extra });
  } catch (e) {}
}
