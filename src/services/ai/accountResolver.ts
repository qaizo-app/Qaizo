// src/services/ai/accountResolver.ts
// Account selection cascade for smart transaction parsing

// Brand keywords for credit card brand detection (used for both AI selection and UI chip filtering)
export const CARD_BRAND_KEYWORDS: Record<string, string[]> = {
  visa: ['visa', 'ויזה', 'виза'],
  mastercard: ['mastercard', 'master card', 'מאסטרקארד', 'מסטרקארד', 'мастеркард', 'мастер кард'],
  amex: ['amex', 'american express', 'אמקס', 'американ экспресс'],
};

export function detectCardBrand(text: string): string | null {
  const lc = (text || '').toLowerCase();
  for (const [brand, kws] of Object.entries(CARD_BRAND_KEYWORDS)) {
    if (kws.some((kw: string) => lc.includes(kw))) return brand;
  }
  return null;
}

export type AccountReason = 'explicit' | 'brand' | 'type' | 'habit' | 'recent' | 'none';

const tsOf = (t: any) => new Date(t?.date || t?.createdAt || 0).getTime();

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

  // 4. Category habit: ≥3 txs of this category+type on LIVE accounts,
  //    one account holding ≥60% of them.
  if (categoryId) {
    const catTxs = (transactions || []).filter((t: any) =>
      t?.categoryId === categoryId && (!txType || t.type === txType) && t.account && accIds.has(t.account));
    if (catTxs.length >= 3) {
      const perAcc: Record<string, number> = {};
      for (const t of catTxs) perAcc[t.account] = (perAcc[t.account] || 0) + 1;
      const [topAcc, topN] = Object.entries(perAcc).sort((a, b) => b[1] - a[1])[0];
      if (topN / catTxs.length >= 0.6) return { account: topAcc, reason: 'habit' };
    }
  }

  // 5. Overall most recent transaction on a live account.
  const recent = lastUsedAmong(accIds, transactions);
  if (recent) return { account: recent, reason: 'recent' };

  return { account: null, reason: 'none' };
}
