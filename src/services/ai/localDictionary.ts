// src/services/ai/localDictionary.ts
// Layer 1 of Smart Input: exact repeats of the user's own phrasing resolve
// instantly on-device — no network, no ambiguity. Built on the fly from the
// transactions the caller already has; nothing persisted, nothing stale.

export interface DictEntry { categoryId: string; type: 'income' | 'expense'; count: number; }

// Lowercase, strip digits + currency tokens + punctuation, collapse spaces.
// «Кофе с круассаном 28₪» → 'кофе с круассаном'.
// Currency tokens are matched as STANDALONE words only ((^|\s)…(\s|$)):
// an unbounded regex mangled words merely containing them ("Nissan" → "san").
// Cyrillic declensions need an explicit class — \w never matches Cyrillic,
// so шекел\w* left "шекелей" half-stripped.
export function normalizeInput(text: string): string {
  return String(text || '')
    .toLowerCase()
    .replace(/[0-9]+([.,'][0-9]+)*/g, ' ')
    .replace(/(^|\s)(₪|шекел[а-яё]*|שקל(ים)?|שח|ils|nis)(?=\s|$)/g, ' ')
    .replace(/[.,!?;:()"'`+\-–—/\\]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const MS_MONTH = 30 * 24 * 60 * 60 * 1000;

export function buildDictionary(
  transactions: any[],
  opts: { months?: number; now?: Date } = {},
): Map<string, DictEntry> {
  const months = opts.months ?? 12;
  const now = opts.now ?? new Date();
  const cutoff = now.getTime() - months * MS_MONTH;

  // key → categoryId → count (note and recipient are independent keys)
  const counts = new Map<string, Map<string, { n: number; type: 'income' | 'expense' }>>();
  for (const t of transactions || []) {
    if (!t || (t.type !== 'expense' && t.type !== 'income') || !t.categoryId) continue;
    const ts = new Date(t.date || t.createdAt || 0).getTime();
    if (!Number.isFinite(ts) || ts < cutoff) continue;
    // Note and recipient are independent keys, but ONE transaction must never
    // count twice toward the same key (note === recipient would let a single
    // real occurrence pass the ≥2 repeat threshold).
    const keys = new Set([t.note, t.recipient].map(normalizeInput).filter(Boolean));
    for (const key of keys) {
      let perCat = counts.get(key);
      if (!perCat) { perCat = new Map(); counts.set(key, perCat); }
      const cur = perCat.get(t.categoryId) || { n: 0, type: t.type };
      cur.n += 1;
      perCat.set(t.categoryId, cur);
    }
  }

  const dict = new Map<string, DictEntry>();
  for (const [key, perCat] of counts) {
    let total = 0; let bestCat = ''; let bestN = 0; let bestType: 'income' | 'expense' = 'expense';
    for (const [cat, { n, type }] of perCat) {
      total += n;
      if (n > bestN) { bestN = n; bestCat = cat; bestType = type; }
    }
    if (total >= 2 && bestN / total >= 0.8) {
      dict.set(key, { categoryId: bestCat, type: bestType, count: total });
    }
  }
  return dict;
}

export function lookupRepeat(text: string, dict: Map<string, DictEntry>): DictEntry | null {
  const key = normalizeInput(text);
  if (!key) return null;
  return dict.get(key) || null;
}
