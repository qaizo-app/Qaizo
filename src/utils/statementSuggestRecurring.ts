// src/utils/statementSuggestRecurring.ts
// Pattern detection: after reconcile, scan the 'new' rows for groups that
// look like a recurring payment the user never registered. Two transfers to
// the same payee one month apart, three "Spotify" charges at ~30d intervals,
// a weekly receipt for the same shop — all candidates for offering to create
// a recurring template alongside saving the rows.
//
// Pure (no Firestore / UI / side effects) so it can be unit-tested in isolation.
import type { ExtractedTx, ReconcileResult } from './statementReconcile';
import { fuzzyPayee } from './payeeMatch';

export type RecurringInterval = 'weekly' | 'monthly';

export interface RecurringSuggestion {
  payee: string;             // canonical payee (longest from the cluster)
  intervalDays: number;      // detected interval, ~7 or ~30
  intervalKind: RecurringInterval;
  avgAmount: number;         // absolute average across the cluster
  amountSpreadPct: number;   // (max-min)/avg, 0 = identical
  rowIndices: number[];      // indices into the original ReconcileResult[]
  confidence: 'high' | 'medium';  // high = 3+ rows tight interval; medium = 2 rows or loose
}

const WEEKLY_LOW = 5;
const WEEKLY_HIGH = 10;
const MONTHLY_LOW = 25;
const MONTHLY_HIGH = 35;
const AMOUNT_SPREAD_TOLERANCE = 0.15;   // ≤15% variance keeps the cluster cohesive

function dayDiff(a: string, b: string): number {
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  return Math.abs(da - db) / 86_400_000;
}

function classifyInterval(avgInterval: number): RecurringInterval | null {
  if (avgInterval >= WEEKLY_LOW && avgInterval <= WEEKLY_HIGH) return 'weekly';
  if (avgInterval >= MONTHLY_LOW && avgInterval <= MONTHLY_HIGH) return 'monthly';
  return null;
}

// Cluster fuzzy-matched payees together. We do a greedy O(n²) merge — fine
// for the row counts involved (typically <50 per statement).
function clusterByPayee(items: { idx: number; tx: ExtractedTx }[]): { idx: number; tx: ExtractedTx }[][] {
  const clusters: { idx: number; tx: ExtractedTx }[][] = [];
  for (const item of items) {
    const match = clusters.find(c => fuzzyPayee(c[0].tx.payee, item.tx.payee));
    if (match) match.push(item);
    else clusters.push([item]);
  }
  return clusters;
}

export function suggestRecurring(results: ReconcileResult[]): RecurringSuggestion[] {
  // Only 'new' rows are candidates — anything reconciled is already accounted for.
  const news: { idx: number; tx: ExtractedTx }[] = [];
  results.forEach((r, idx) => { if (r.kind === 'new') news.push({ idx, tx: r.extracted }); });

  const clusters = clusterByPayee(news).filter(c => c.length >= 2);

  const out: RecurringSuggestion[] = [];
  for (const cluster of clusters) {
    // Sort by date ascending so consecutive intervals are meaningful
    const sorted = [...cluster].sort((a, b) => a.tx.date.localeCompare(b.tx.date));
    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      intervals.push(dayDiff(sorted[i - 1].tx.date, sorted[i].tx.date));
    }
    const avgInterval = intervals.reduce((s, x) => s + x, 0) / intervals.length;
    const kind = classifyInterval(avgInterval);
    if (!kind) continue;

    // Amount cohesion — refunds (positive) and charges (negative) shouldn't be
    // mixed into the same cluster, so use absolute values and check spread.
    const amounts = sorted.map(s => Math.abs(s.tx.amount));
    const avgAmount = amounts.reduce((s, x) => s + x, 0) / amounts.length;
    const spread = avgAmount > 0 ? (Math.max(...amounts) - Math.min(...amounts)) / avgAmount : 0;
    if (spread > AMOUNT_SPREAD_TOLERANCE) continue;

    // Pick a canonical payee — the longest text usually has more identifying
    // info than the truncated variants ("Spotify *AB1" beats "Spotify").
    const payee = sorted
      .map(s => s.tx.payee)
      .reduce((longest, p) => p.length > longest.length ? p : longest, '');

    out.push({
      payee,
      intervalDays: Math.round(avgInterval),
      intervalKind: kind,
      avgAmount,
      amountSpreadPct: spread,
      rowIndices: sorted.map(s => s.idx),
      confidence: sorted.length >= 3 ? 'high' : 'medium',
    });
  }

  return out;
}
