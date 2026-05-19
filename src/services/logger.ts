// src/services/logger.ts
// Thin wrapper around @sentry/react-native so screens can drop breadcrumbs
// and capture exceptions without each one needing its own try/catch around
// the import. Sentry isn't available in Expo Go, so every call is guarded.

type SentryLevel = 'fatal' | 'error' | 'warning' | 'info' | 'debug';

interface SentryLike {
  addBreadcrumb: (b: { category?: string; message?: string; data?: unknown; level?: SentryLevel }) => void;
  captureException: (err: unknown, opts?: { extra?: unknown }) => void;
  captureMessage: (msg: string, opts?: { level?: SentryLevel; extra?: unknown }) => void;
}

let Sentry: SentryLike | null = null;
try {
  Sentry = require('@sentry/react-native') as SentryLike;
} catch (e) {
  // No-op; Sentry not loaded (Expo Go or build without sentry plugin).
}

export function breadcrumb(category: string, message: string, data?: unknown): void {
  if (__DEV__) console.log(`[${category}]`, message, data || '');
  if (!Sentry) return;
  try {
    Sentry.addBreadcrumb({ category, message, data, level: 'info' });
  } catch (e) {}
}

export function captureError(err: unknown, context?: Record<string, unknown>): void {
  if (__DEV__) console.error('[capture]', context, err);
  if (!Sentry) return;
  try {
    Sentry.captureException(err, context ? { extra: context } : undefined);
  } catch (e) {}
}

export function captureMessage(msg: string, level: SentryLevel = 'warning', extra?: unknown): void {
  if (__DEV__) console.warn('[capture]', msg, extra || '');
  if (!Sentry) return;
  try {
    Sentry.captureMessage(msg, { level, extra });
  } catch (e) {}
}
