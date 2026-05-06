// src/utils/productMatcher.js
// Group receipt-line items that name the same physical product despite
// being written slightly differently across stores or scans.
//
// Strategy (cheap, deterministic — no AI calls):
//  1. Normalize names: lowercase, strip punctuation, expand unit synonyms,
//     extract size and brand tokens.
//  2. Compute a canonical key + a set of "match tokens".
//  3. Compare two products with Jaccard similarity on tokens.
//     Same brand + same kind + same size = high confidence match.
//
// Threshold tuning is conservative: better to leave two listings separate
// than merge milk + cream by accident. Users can manually merge via UI.

// Common Hebrew/English/Russian unit synonyms — collapsed to a single token.
const UNIT_SYNONYMS = [
  // Liter
  { tokens: ['l', 'liter', 'litre', 'ליטר', 'литр', 'литра'], canon: 'l' },
  // Milliliter
  { tokens: ['ml', 'mll', 'מ"ל', 'מל', 'мл'], canon: 'ml' },
  // Kilogram
  { tokens: ['kg', 'kilogram', 'ק"ג', 'קג', 'кг'], canon: 'kg' },
  // Gram
  { tokens: ['g', 'gr', 'gram', 'גרם', 'г', 'гр'], canon: 'g' },
  // Percent
  { tokens: ['%', 'percent', 'אחוז', 'אחוזים', '%', 'процент', 'процентов'], canon: '%' },
  // Pack/Pkg
  { tokens: ['pkg', 'pack', 'אריזה', 'упак'], canon: 'pkg' },
  // Pieces
  { tokens: ['pcs', 'pc', 'יחידות', 'יח', 'шт'], canon: 'pcs' },
];

// Stop words that don't help identify a product — common across many lines.
const STOP_WORDS = new Set([
  // Hebrew
  'של', 'את', 'עם', 'ל', 'ב', 'ה', 'מ', 'כ',
  // Russian
  'и', 'в', 'на', 'с', 'из', 'от', 'для', 'по',
  // English
  'of', 'and', 'with', 'in', 'on', 'for', 'the', 'a', 'an',
]);

// Common brand names — when we see one, treat it as a strong identifier.
const KNOWN_BRANDS = [
  // Israeli dairy/food
  'תנובה', 'טרה', 'יטבתה', 'שטראוס', 'אסם', 'אחלה', 'יוטבתה',
  'tnuva', 'tara', 'strauss', 'osem',
  // Soft drinks
  'coca', 'cola', 'pepsi', 'nestle',
  // Brands relevant to receipts
  'שופרסל', 'רמי לוי', 'יוחננוף',
];

function expandSynonym(token) {
  for (const syn of UNIT_SYNONYMS) {
    if (syn.tokens.includes(token)) return syn.canon;
  }
  return token;
}

function isNumeric(s) {
  return /^[\d.,]+$/.test(s);
}

// Strip Hebrew prefixes (ל, ב, מ, כ, ה, ש) for matching purposes only.
function stripHebrewPrefix(token) {
  if (!token) return token;
  // Only strip if the remaining token still has 2+ chars (avoid eating
  // single-letter words). Match the Hebrew letter-prefix pattern from
  // the i18n module.
  if (token.length >= 3 && /^[להבכמש]/.test(token)) return token.slice(1);
  return token;
}

/**
 * Normalize a raw product name into a sorted list of canonical tokens.
 */
export function tokenizeProduct(name) {
  if (!name) return { tokens: [], canonical: '', brand: null, size: null };
  const lower = String(name).toLowerCase().trim();
  // Replace common decoration with spaces
  const cleaned = lower
    .replace(/[(){}[\]"'`*\-–—]/g, ' ')
    .replace(/[.,;:!?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // Split into tokens, expand synonyms, strip stop words and Hebrew prefixes
  const rawTokens = cleaned.split(/\s+/).filter(Boolean);
  const tokens = [];
  let brand = null;
  let size = null;
  for (const raw of rawTokens) {
    let t = expandSynonym(raw);
    t = stripHebrewPrefix(t);
    if (!t) continue;
    if (STOP_WORDS.has(t)) continue;
    // Detect brand
    if (!brand && KNOWN_BRANDS.includes(t)) brand = t;
    // Detect size like "1l", "500ml", "3%", "250g"
    if (/^\d/.test(t)) {
      // Pure number — try to merge with next unit token in a later pass
      tokens.push(t);
    } else {
      tokens.push(t);
    }
  }
  // Second pass: merge "1" + "l" → "1l"; "500" + "ml" → "500ml"
  const merged = [];
  for (let i = 0; i < tokens.length; i++) {
    const cur = tokens[i];
    const next = tokens[i + 1];
    if (isNumeric(cur) && next && ['l', 'ml', 'kg', 'g', '%', 'pkg', 'pcs'].includes(next)) {
      const combo = `${cur}${next}`.replace(/,/g, '.');
      merged.push(combo);
      // Detect size
      if (!size && /^[\d.]+(l|ml|kg|g|%)$/.test(combo)) size = combo;
      i++; // skip next
    } else {
      merged.push(cur);
    }
  }
  // Collect a stable canonical representation: sorted unique tokens
  const unique = [...new Set(merged)];
  unique.sort();
  return {
    tokens: unique,
    canonical: unique.join(' '),
    brand,
    size,
  };
}

/**
 * Token-set Jaccard similarity (0..1) — symmetric.
 */
export function jaccard(tokensA, tokensB) {
  if (!tokensA?.length || !tokensB?.length) return 0;
  const a = new Set(tokensA);
  const b = new Set(tokensB);
  let intersect = 0;
  for (const t of a) if (b.has(t)) intersect++;
  const union = a.size + b.size - intersect;
  return union > 0 ? intersect / union : 0;
}

/**
 * Decide whether two named products are the same physical product.
 *  - Same brand + same size + 1+ shared kind token → strong yes.
 *  - Different sizes (any) → strong no.
 *  - Otherwise rely on Jaccard threshold (sameStore=0.6, crossStore=0.75).
 */
export function isSameProduct(a, b, opts = {}) {
  const sameStore = !!opts.sameStore;
  const ta = tokenizeProduct(a);
  const tb = tokenizeProduct(b);

  // Hard veto: explicit different sizes mean different products
  if (ta.size && tb.size && ta.size !== tb.size) return false;

  // Hard veto: explicit different brands mean different products
  if (ta.brand && tb.brand && ta.brand !== tb.brand) return false;

  // Strong yes: same brand + same size and any shared token
  if (ta.brand && tb.brand && ta.brand === tb.brand && ta.size && tb.size && ta.size === tb.size) {
    const shared = ta.tokens.filter(t => tb.tokens.includes(t)).length;
    if (shared >= 2) return true;
  }

  const sim = jaccard(ta.tokens, tb.tokens);
  const threshold = sameStore ? 0.6 : 0.75;
  return sim >= threshold;
}

/**
 * Find a matching product in the catalog for a candidate name. Returns the
 * matched item or null. `catalogItems` is an array of objects with at least
 * a `name` property (and optional `lastStore` to enable same-store matching).
 */
export function findMatch(candidateName, candidateStore, catalogItems) {
  if (!candidateName || !catalogItems?.length) return null;
  let best = null;
  let bestScore = 0;
  const ta = tokenizeProduct(candidateName);
  for (const item of catalogItems) {
    if (!item.name) continue;
    const sameStore = !!candidateStore && !!item.lastStore && item.lastStore === candidateStore;
    if (isSameProduct(candidateName, item.name, { sameStore })) {
      const tb = tokenizeProduct(item.name);
      const score = jaccard(ta.tokens, tb.tokens);
      if (score > bestScore) {
        bestScore = score;
        best = item;
      }
    }
  }
  return best;
}

export default { tokenizeProduct, jaccard, isSameProduct, findMatch };
