// src/utils/categoryCache.ts
// Module-level cache of the user's saved category groups, kept free of any
// UI imports so it's safe to import from services and Jest tests.
// CategoryIcon populates the cache on first render; reads from services go
// through this module instead of reaching into the component.
import dataService from '../services/dataService';

// CategoryGroup mirrors the user-editable group shape — a parent category
// with optional sub-categories. Both can carry a localized name object.
type LocalizedName = Record<string, string | undefined>;

export interface CategoryGroup {
  id: string;
  name?: LocalizedName | string;
  icon?: string;
  color?: string;
  subs?: CategoryGroup[];
}

let _cachedGroups: CategoryGroup[] | null = null;
let _loading: Promise<CategoryGroup[]> | null = null;

export function getCachedGroups(): CategoryGroup[] {
  return _cachedGroups || [];
}

export function setCachedGroups(groups: CategoryGroup[] | undefined | null): void {
  if (Array.isArray(groups)) _cachedGroups = groups;
}

export function invalidateCachedGroups(): void {
  _cachedGroups = null;
  _loading = null;
}

// Lazy loader so background callers (services, notifications) can warm the
// cache without pulling in CategoryIcon. Returns the loaded groups array.
export async function ensureCachedGroups(): Promise<CategoryGroup[]> {
  if (_cachedGroups) return _cachedGroups;
  if (!_loading) {
    _loading = dataService.getCategories().then((saved: unknown) => {
      if (Array.isArray(saved) && saved.length > 0) {
        _cachedGroups = saved as CategoryGroup[];
      } else {
        // No real data yet — e.g. called before auth resolved, so getCategories
        // read empty guest storage. Don't lock the cache to an empty result;
        // clear _loading so a later call (post-login) re-fetches and populates.
        _loading = null;
      }
      return _cachedGroups || [];
    }).catch(() => { _loading = null; return []; });
  }
  return _loading;
}
