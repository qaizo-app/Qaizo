// src/utils/categoryName.js
// One-liner category name resolver used everywhere we show a category to
// the user. Custom categories have ids like "репетитор_v69l" which are
// not valid i18n keys, so i18n.t returns the raw id. We walk the cached
// user groups (populated by CategoryIcon or any service that called
// ensureCachedGroups) as a fallback. A stored categoryName on the
// transaction always wins — it reflects the name at the time it was
// saved, which is what the user expects to see.
import i18n from '../i18n';
import { getCachedGroups } from './categoryCache';

function anyName(nameObj, lang) {
  if (!nameObj) return null;
  return nameObj[lang] || nameObj.en || nameObj.ru || nameObj.he || Object.values(nameObj)[0] || null;
}

function resolveFromGroups(id, lang) {
  const groups = getCachedGroups();
  for (const g of groups) {
    if (g.id === id && g.name) return anyName(g.name, lang) || null;
    for (const s of (g.subs || [])) {
      if (s.id === id && s.name) return anyName(s.name, lang) || null;
    }
  }
  return null;
}

export function catName(id, storedName) {
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
