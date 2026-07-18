// src/services/ai/accountResolver.ts
// Account selection cascade for smart transaction parsing

// Brand keywords for credit card brand detection (used for both AI selection and UI chip filtering)
export const CARD_BRAND_KEYWORDS: Record<string, string[]> = {
  // 'визой'/'визу'/'визе' don't contain the stem 'виза' — Russian instrumental/
  // accusative/prepositional case endings replace the final letter, so they
  // need explicit forms rather than relying on substring match.
  visa: ['visa', 'ויזה', 'виза', 'визой', 'визу', 'визе'],
  mastercard: ['mastercard', 'master card', 'מאסטרקארד', 'מסטרקארד', 'мастеркард', 'мастер кард', 'мастеркардом', 'мастеркарду'],
  amex: ['amex', 'american express', 'אמקס', 'американ экспресс', 'амексом'],
};

export function detectCardBrand(text: string): string | null {
  const lc = (text || '').toLowerCase();
  for (const [brand, kws] of Object.entries(CARD_BRAND_KEYWORDS)) {
    if (kws.some((kw: string) => lc.includes(kw))) return brand;
  }
  return null;
}

export type AccountReason = 'explicit' | 'brand' | 'type' | 'habit' | 'recent' | 'none';

// Only these account types show up as chips in the modal (SmartInputModal
// filters to bank|credit|cash). A habit/recent pick that lands on an
// investment/savings account would be invisible to the user — silently
// "selected" but with no chip highlighted and no way to see why.
const PAYABLE_TYPES = new Set(['bank', 'credit', 'cash']);

const tsOf = (t: any) => new Date(t?.date || t?.createdAt || 0).getTime();

// Max-scan, order-independent except EXACT timestamp ties (date-only strings
// collide at midnight): strict `>` keeps the first-seen transaction, which is
// the newest by insertion order when the caller passes a createdAt-desc list
// (dataService.getTransactions does). Callers with unsorted data get an
// arbitrary-but-stable pick between same-instant candidates — acceptable.
function lastUsedAmong(ids: Set<string>, transactions: any[]): string | null {
  let best: string | null = null; let bestTs = -1;
  for (const t of transactions || []) {
    if (!t?.account || !ids.has(t.account)) continue;
    const ts = tsOf(t);
    if (ts > bestTs) { bestTs = ts; best = t.account; }
  }
  return best;
}

// Single ordered cascade for "which account pays this transaction".
// Spec: explicit > brand > type+last-used > category habit (≥3 tx, ≥60%)
// > overall most recent > none.
export function resolveAccount(args: {
  text: string;
  aiAccountId?: string | null;
  aiAccountType?: string | null;
  categoryId?: string | null;
  txType?: 'income' | 'expense';
  accounts: any[];
  transactions: any[];
}): { account: string | null; reason: AccountReason } {
  const { text, aiAccountId, aiAccountType, categoryId, txType, accounts, transactions } = args;
  const accIds = new Set((accounts || []).map((a: any) => a.id));
  const payableIds = new Set((accounts || []).filter((a: any) => PAYABLE_TYPES.has(a.type)).map((a: any) => a.id));

  // 1. Explicit id from the model, validated.
  if (aiAccountId && accIds.has(aiAccountId)) return { account: aiAccountId, reason: 'explicit' };

  // 2. Brand keyword in the raw text.
  const brand = detectCardBrand(text);
  if (brand) {
    const kws = CARD_BRAND_KEYWORDS[brand];
    const matches = (accounts || []).filter((a: any) => kws.some((kw: string) => (a.name || '').toLowerCase().includes(kw)));
    if (matches.length === 1) return { account: matches[0].id, reason: 'brand' };
    if (matches.length > 1) {
      const ids = new Set(matches.map((a: any) => a.id));
      return { account: lastUsedAmong(ids, transactions) || matches[0].id, reason: 'brand' };
    }
  }

  // 3. Generic type from the model.
  if (aiAccountType) {
    const matches = (accounts || []).filter((a: any) => a.type === aiAccountType);
    if (matches.length === 1) return { account: matches[0].id, reason: 'type' };
    if (matches.length > 1) {
      const ids = new Set(matches.map((a: any) => a.id));
      const last = lastUsedAmong(ids, transactions);
      if (last) return { account: last, reason: 'type' };
    }
  }

  // 4. Category habit: ≥3 txs of this category+type on LIVE PAYABLE accounts,
  //    one account holding ≥60% of them. Investment/savings accounts are
  //    excluded — the modal only renders bank|credit|cash chips, so a habit
  //    pick landing there would be invisibly "selected".
  if (categoryId) {
    const catTxs = (transactions || []).filter((t: any) =>
      t?.categoryId === categoryId && (!txType || t.type === txType) && t.account && payableIds.has(t.account));
    if (catTxs.length >= 3) {
      const perAcc: Record<string, number> = {};
      for (const t of catTxs) perAcc[t.account] = (perAcc[t.account] || 0) + 1;
      const [topAcc, topN] = Object.entries(perAcc).sort((a, b) => b[1] - a[1])[0];
      if (topN / catTxs.length >= 0.6) return { account: topAcc, reason: 'habit' };
    }
  }

  // 5. Overall most recent transaction on a live PAYABLE account.
  const recent = lastUsedAmong(payableIds, transactions);
  if (recent) return { account: recent, reason: 'recent' };

  return { account: null, reason: 'none' };
}
