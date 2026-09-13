// src/services/ai/client.ts
// Gemini HTTP transport — models, request/response plumbing, and the last-
// failure-reason state. Extracted verbatim from aiService.ts (Task 1 of the
// Smart Input v2 split): pure move, no behavior change. Parsers, insights,
// chat and the receipt/statement scanners stay in aiService.ts for now and
// import this transport back.

import { withTimeout } from '../../utils/withTimeout';

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}

export interface AIError {
  code: string;
  status?: number;
  message?: string;
}

// Not part of the Task 1 "Produces" list, but scanReceipt/scanReceiptItems/
// scanStatement/translateCategoryName (still in aiService.ts) read this key
// directly for their own fetch() calls — exported so aiService can import
// the single source of truth instead of re-declaring it.
export const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
export const GEMINI_MODEL_PRIMARY = 'gemini-2.5-flash';
export const GEMINI_MODEL_FALLBACK = 'gemini-flash-latest';
// Statements are dense tables where row alignment matters; the Pro model is
// markedly better at keeping each payee paired with its own row's amount.
// Falls back to flash on overload/rate-limit (handled in scanStatement).
export const GEMINI_MODEL_STATEMENT = 'gemini-2.5-pro';
export const geminiUrl = (model: string) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

// Loud one-shot warning at module load so a misconfigured dev build is
// visible in the very first Metro log, not only when the user tries to scan.
// Past sessions wasted hours debugging "scanner returns nothing on iOS"
// because the symptom looked like an AI failure when the real cause was a
// missing local .env on the dev machine. See project_ios_gemini_key_missing.
if (__DEV__ && !GEMINI_API_KEY) {
  // eslint-disable-next-line no-console
  if (__DEV__) console.warn(
    '\n[Qaizo aiService] EXPO_PUBLIC_GEMINI_API_KEY is missing in this build.\n' +
    '  → Receipt scan, statement scan, voice input parsing and Smart Input\n' +
    '    will all silently return empty.\n' +
    '  → Fix: copy `.env.example` to `.env` in the repo root, fill in keys,\n' +
    '    then Clean Build Folder + rebuild (Xcode) or `npx expo start --clear`.\n'
  );
}

// ─── Gemini API ─────────────────────────────────────────
// Last AI failure reason — exposed so screens can show a specific message
// ("rate limit" / "no api key" / "network") instead of a generic fallback.
let _lastAIError: AIError | null = null;
export function getLastAIError(): AIError | null { return _lastAIError; }

export async function callGeminiOnce(model: string, prompt: string, { maxTokens, temperature }: { maxTokens: number; temperature: number }) {
  // Bounded: RN fetch has no timeout of its own, and a captive-portal /
  // stuck connection would otherwise hang Smart Input / chat forever.
  const res = await withTimeout(fetch(`${geminiUrl(model)}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature, maxOutputTokens: maxTokens },
    }),
  }), 45000, 'gemini');
  return res;
}

export async function callGemini(prompt: string, { maxTokens = 1024, temperature = 0.3 }: { maxTokens?: number; temperature?: number } = {}): Promise<string | null> {
  if (!GEMINI_API_KEY) {
    _lastAIError = { code: 'no_api_key', message: 'Gemini API key is not configured' };
    if (__DEV__) console.warn('[ai] no GEMINI_API_KEY set');
    return null;
  }
  const tryModel = async (model: string): Promise<any> => {
    try {
      const res = await callGeminiOnce(model, prompt, { maxTokens, temperature });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        const code = res.status === 429 ? 'rate_limit'
                   : res.status === 401 || res.status === 403 ? 'auth'
                   : res.status >= 500 ? 'server'
                   : 'http_error';
        if (__DEV__) console.warn('[ai] gemini', model, 'error', res.status, errText.slice(0, 300));
        return { ok: false, code, status: res.status, message: errText.slice(0, 300) };
      }
      const data = await res.json() as GeminiResponse;
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
      if (!text) return { ok: false, code: 'empty_response', message: 'Gemini returned no text' };
      return { ok: true, text };
    } catch (e: any) {
      if (__DEV__) console.warn('[ai] gemini', model, 'fetch failed', e);
      return { ok: false, code: 'network', message: String(e?.message || e) };
    }
  };

  // Primary model
  let r = await tryModel(GEMINI_MODEL_PRIMARY);
  // Retry on transient overload (503) or empty response with the fallback model
  if (!r.ok && (r.code === 'server' || r.code === 'empty_response')) {
    if (__DEV__) console.warn('[ai] retrying on fallback model', GEMINI_MODEL_FALLBACK);
    r = await tryModel(GEMINI_MODEL_FALLBACK);
  }
  if (r.ok) {
    _lastAIError = null;
    return r.text;
  }
  _lastAIError = { code: r.code, status: r.status, message: r.message };
  return null;
}

// Scanners (receipt/statement) record their own failures so the modal can
// show the reason on screen; they live in aiService for now, so expose a
// setter until they migrate.
export function setLastAIError(err: AIError | null): void { _lastAIError = err; }

// Internal-only type — not part of the public v2 surface (no outside
// consumers imported it from aiService.ts either), but aiService.ts still
// needs it for the scanners' own `res.json() as GeminiResponse` casts.
export type { GeminiResponse };
