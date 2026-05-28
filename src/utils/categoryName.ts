// src/utils/categoryName.ts
// One-liner category name resolver used everywhere we show a category to
// the user. Custom categories have ids like "репетитор_v69l" which are
// not valid i18n keys, so i18n.t returns the raw id. We walk the cached
// user groups (populated by CategoryIcon or any service that called
// ensureCachedGroups) as a fallback. A stored categoryName on the
// transaction always wins — it reflects the name at the time it was
// saved, which is what the user expects to see.
import i18n from '../i18n';
import { categoryConfig } from '../theme/colors';
import { getCachedGroups } from './categoryCache';

// Multi-language category name as stored in user-defined groups —
// could carry any subset of locales the user has touched.
type LocalizedName = Record<string, string | undefined>;

interface GroupCategory {
  id: string;
  name?: LocalizedName | string;
  subs?: GroupCategory[];
}

function anyName(nameObj: LocalizedName | string | undefined, lang: string): string | null {
  if (!nameObj) return null;
  if (typeof nameObj === 'string') return nameObj;
  return nameObj[lang] || nameObj.en || nameObj.ru || nameObj.he ||
    Object.values(nameObj).find(v => typeof v === 'string') as string | undefined ||
    null;
}

function resolveFromGroups(id: string, lang: string): string | null {
  const groups: GroupCategory[] = getCachedGroups() || [];
  for (const g of groups) {
    if (g.id === id && g.name) return anyName(g.name, lang) || null;
    for (const s of (g.subs || [])) {
      if (s.id === id && s.name) return anyName(s.name, lang) || null;
    }
  }
  return null;
}

export function catName(id: string | undefined, storedName?: string): string {
  if (!id) return storedName || '';
  // 1. Built-in i18n key wins — this is the current UI language, so
  //    switching language re-renders old transactions in the new locale.
  const translated = i18n.t(id);
  if (translated !== id) return translated;
  // 2. Custom category in the user's saved groups: pick the entry for
  //    the current language (or any available fallback inside the entry).
  const fromGroups = resolveFromGroups(id, i18n.getLanguage());
  if (fromGroups) return fromGroups;
  // 3. Snapshot from save time. Used to render rows for ids that are no
  //    longer in i18n or in the user's groups (e.g. category deleted).
  if (storedName) return storedName;
  return id;
}

// Stable fallback palette for categories that have no explicit color set.
// Picked deterministically from the id so a category keeps the same color
// across sessions and devices.
const FALLBACK_COLORS = [
  '#fb7185', '#fb923c', '#fbbf24', '#22d3ee', '#34d399',
  '#a78bfa', '#60a5fa', '#ec4899', '#10b981', '#f472b6',
  '#06b6d4', '#8b5cf6',
];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h * 31) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// Resolve a colour for a category id: built-in palette → cached user groups
// (top-level or sub) → deterministic hash-based palette pick. Never returns
// the generic gray, so custom categories no longer all look the same.
export function catColor(id: string | undefined): string {
  if (!id) return FALLBACK_COLORS[0];
  const builtIn = (categoryConfig as Record<string, { color?: string }>)[id]?.color;
  if (builtIn) return builtIn;
  const groups = getCachedGroups() || [];
  for (const g of groups) {
    if (g.id === id && (g as any).color) return (g as any).color;
    for (const s of (g.subs || [])) {
      if (s.id === id && (s as any).color) return (s as any).color;
    }
  }
  return FALLBACK_COLORS[hashStr(id) % FALLBACK_COLORS.length];
}
