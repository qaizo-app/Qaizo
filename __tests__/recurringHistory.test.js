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
