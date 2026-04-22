// src/utils/categoryCache.js
// Module-level cache of the user's saved category groups, kept free of any
// UI imports so it's safe to import from services and Jest tests.
// CategoryIcon populates the cache on first render; reads from services go
// through this module instead of reaching into the component.
import dataService from '../services/dataService';

let _cachedGroups = null;
let _loading = null;

export function getCachedGroups() {
  return _cachedGroups || [];
}

export function setCachedGroups(groups) {
  if (Array.isArray(groups)) _cachedGroups = groups;
}

// Lazy loader so background callers (services, notifications) can warm the
// cache without pulling in CategoryIcon. Returns the loaded groups array.
export async function ensureCachedGroups() {
  if (_cachedGroups) return _cachedGroups;
  if (!_loading) {
    _loading = dataService.getCategories().then(saved => {
      if (Array.isArray(saved) && saved.length > 0) _cachedGroups = saved;
      return _cachedGroups || [];
    }).catch(() => []);
  }
  return _loading;
}
