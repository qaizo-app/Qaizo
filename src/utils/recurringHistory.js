// src/utils/recurringHistory.js
// Matches transactions back to the recurring item that created them, and
// rolls up summary stats for the detail/overview views.
//
// Matching strategy, strongest first:
//   1. Transfers — paired expense/income with same from→to accounts.
//   2. Recipient match (preferred when recipient is set on the recurring).
//   3. Category + amount fallback — catches old data that lost the link.
//
// The summary intentionally ignores transaction sign: total is an absolute
// sum, since a recurring is naturally all-same-direction.

function matchHistory(rec, transactions) {
  if (!rec || !Array.isArray(transactions)) return [];

  if (rec.isTransfer && rec.toAccount) {
    // Transfers come as linked expense/income pairs — anchor on the expense
    // leg (from → to) so each occurrence counts once, and accept amount
    // drift in case the user tweaked the value at confirm time.
    return transactions
      .filter(t => t.isTransfer && t.type === 'expense' && t.account === rec.account)
      .sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
  }

  const byRecipient = rec.recipient
    ? transactions.filter(t => t.recipient === rec.recipient && !t.isTransfer)
    : [];
  if (byRecipient.length > 0) {
    return byRecipient.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
  }

  return transactions
    .filter(t => !t.isTransfer
      && t.categoryId === rec.categoryId
      && Math.abs((t.amount || 0) - (rec.amount || 0)) < 0.01
    )
    .sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
}

function summarizeHistory(list) {
  const items = Array.isArray(list) ? list : [];
  const count = items.length;
  const total = items.reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);
  const avg = count > 0 ? total / count : 0;

  // Timestamps span the history — useful for "since X" labels.
  let first = null;
  let last = null;
  for (const t of items) {
    const iso = t.date || t.createdAt;
    if (!iso) continue;
    const d = new Date(iso);
    if (!first || d < first) first = d;
    if (!last || d > last) last = d;
  }

  return { count, total, avg, first, last };
}

module.exports = { matchHistory, summarizeHistory };
module.exports.default = { matchHistory, summarizeHistory };
