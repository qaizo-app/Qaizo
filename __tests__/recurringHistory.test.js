// __tests__/recurringHistory.test.js
const { matchHistory, summarizeHistory } = require('../src/utils/recurringHistory');

describe('matchHistory', () => {
  test('returns empty for missing inputs', () => {
    expect(matchHistory(null, [])).toEqual([]);
    expect(matchHistory({}, null)).toEqual([]);
  });

  test('matches by recipient when set, ignoring amount drift', () => {
    const rec = { recipient: 'Netflix', categoryId: 'entertainment', amount: 50 };
    const txs = [
      { id: '1', recipient: 'Netflix', amount: 50, categoryId: 'entertainment', date: '2026-03-01' },
      { id: '2', recipient: 'Netflix', amount: 55, categoryId: 'entertainment', date: '2026-02-01' }, // adjusted
      { id: '3', recipient: 'Spotify', amount: 50, categoryId: 'entertainment', date: '2026-01-01' },
    ];
    const out = matchHistory(rec, txs);
    expect(out.map(t => t.id)).toEqual(['1', '2']);
  });

  test('falls back to category + amount when recipient missing', () => {
    const rec = { recipient: '', categoryId: 'rent', amount: 3000 };
    const txs = [
      { id: '1', categoryId: 'rent', amount: 3000, date: '2026-03-01' },
      { id: '2', categoryId: 'rent', amount: 3100, date: '2026-02-01' }, // different amount
      { id: '3', categoryId: 'food', amount: 3000, date: '2026-01-01' },
    ];
    const out = matchHistory(rec, txs);
    expect(out.map(t => t.id)).toEqual(['1']);
  });

  test('sorts newest first', () => {
    const rec = { recipient: 'Gym', amount: 200 };
    const txs = [
      { id: 'old', recipient: 'Gym', amount: 200, date: '2025-01-01' },
      { id: 'new', recipient: 'Gym', amount: 200, date: '2026-04-01' },
      { id: 'mid', recipient: 'Gym', amount: 200, date: '2026-01-01' },
    ];
    expect(matchHistory(rec, txs).map(t => t.id)).toEqual(['new', 'mid', 'old']);
  });

  test('transfer recurring matches expense leg on the source account', () => {
    const rec = { isTransfer: true, account: 'acc-a', toAccount: 'acc-b', amount: 500 };
    const txs = [
      { id: '1', isTransfer: true, type: 'expense', account: 'acc-a', amount: 500, date: '2026-03-01' },
      { id: '2', isTransfer: true, type: 'income', account: 'acc-b', amount: 500, date: '2026-03-01' }, // paired, skip
      { id: '3', isTransfer: false, amount: 500, categoryId: 'food', date: '2026-02-01' },
    ];
    expect(matchHistory(rec, txs).map(t => t.id)).toEqual(['1']);
  });

  test('two transfers from same source to different destinations do not cross-match', () => {
    const recToSavings = { isTransfer: true, account: 'bank', toAccount: 'savings', amount: 500 };
    const recToBroker = { isTransfer: true, account: 'bank', toAccount: 'broker', amount: 800 };
    const txs = [
      // Bank -> Savings occurrence
      { id: 's-exp', isTransfer: true, type: 'expense', account: 'bank', amount: 500, transferPairId: 'p1', date: '2026-03-01' },
      { id: 's-inc', isTransfer: true, type: 'income', account: 'savings', amount: 500, transferPairId: 'p1', date: '2026-03-01' },
      // Bank -> Broker occurrence
      { id: 'b-exp', isTransfer: true, type: 'expense', account: 'bank', amount: 800, transferPairId: 'p2', date: '2026-03-02' },
      { id: 'b-inc', isTransfer: true, type: 'income', account: 'broker', amount: 800, transferPairId: 'p2', date: '2026-03-02' },
    ];
    expect(matchHistory(recToSavings, txs).map(t => t.id)).toEqual(['s-exp']);
    expect(matchHistory(recToBroker, txs).map(t => t.id)).toEqual(['b-exp']);
  });

  test('legacy transfer expense leg without transferPairId is still returned', () => {
    const rec = { isTransfer: true, account: 'bank', toAccount: 'savings', amount: 500 };
    const txs = [
      { id: 'legacy', isTransfer: true, type: 'expense', account: 'bank', amount: 500, date: '2026-03-01' },
    ];
    expect(matchHistory(rec, txs).map(t => t.id)).toEqual(['legacy']);
  });

  test('transfer expense leg whose income pair is absent is still returned', () => {
    const rec = { isTransfer: true, account: 'bank', toAccount: 'savings', amount: 500 };
    const txs = [
      { id: 'orphan', isTransfer: true, type: 'expense', account: 'bank', amount: 500, transferPairId: 'missing', date: '2026-03-01' },
    ];
    expect(matchHistory(rec, txs).map(t => t.id)).toEqual(['orphan']);
  });

  test('non-transfer recurring excludes transfer transactions', () => {
    const rec = { recipient: 'Anon', categoryId: 'food', amount: 100 };
    const txs = [
      { id: '1', recipient: 'Anon', categoryId: 'food', amount: 100, date: '2026-03-01' },
      { id: '2', recipient: 'Anon', isTransfer: true, categoryId: 'transfer', amount: 100, date: '2026-02-01' },
    ];
    expect(matchHistory(rec, txs).map(t => t.id)).toEqual(['1']);
  });
});

describe('summarizeHistory', () => {
  test('empty list', () => {
    expect(summarizeHistory([])).toEqual({
      count: 0, total: 0, avg: 0, first: null, last: null,
    });
  });

  test('sums absolute amounts regardless of sign', () => {
    const s = summarizeHistory([
      { amount: 100, date: '2026-01-01' },
      { amount: -200, date: '2026-02-01' },
      { amount: 50, date: '2026-03-01' },
    ]);
    expect(s.count).toBe(3);
    expect(s.total).toBe(350);
    expect(s.avg).toBeCloseTo(350 / 3);
  });

  test('first / last track the full span', () => {
    const s = summarizeHistory([
      { amount: 1, date: '2026-03-01' },
      { amount: 1, date: '2026-01-01' },
      { amount: 1, date: '2026-02-15' },
    ]);
    expect(s.first?.toISOString().slice(0, 10)).toBe('2026-01-01');
    expect(s.last?.toISOString().slice(0, 10)).toBe('2026-03-01');
  });

  test('handles missing dates without crashing', () => {
    const s = summarizeHistory([
      { amount: 100 },
      { amount: 50, date: '2026-03-01' },
    ]);
    expect(s.total).toBe(150);
    expect(s.first?.toISOString().slice(0, 10)).toBe('2026-03-01');
    expect(s.last?.toISOString().slice(0, 10)).toBe('2026-03-01');
  });
});
