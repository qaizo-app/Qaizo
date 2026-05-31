// __tests__/statementSuggestRecurring.test.js
const { suggestRecurring } = require('../src/utils/statementSuggestRecurring');

function newRow(date, amount, payee) {
  return { kind: 'new', extracted: { date, amount, payee } };
}

describe('suggestRecurring', () => {
  test('detects monthly pattern (3 rows, same payee, ~30d apart, stable amount)', () => {
    const results = [
      newRow('2026-03-05', -42.90, 'Spotify *AB1'),
      newRow('2026-04-05', -42.90, 'Spotify'),
      newRow('2026-05-05', -42.90, 'Spotify *AB1'),
    ];
    const s = suggestRecurring(results);
    expect(s).toHaveLength(1);
    expect(s[0].intervalKind).toBe('monthly');
    expect(s[0].confidence).toBe('high');
    expect(s[0].avgAmount).toBeCloseTo(42.90, 2);
    expect(s[0].rowIndices).toEqual([0, 1, 2]);
  });

  test('detects monthly pattern (2 rows) at medium confidence', () => {
    const results = [
      newRow('2026-04-15', -150, 'MAKEUP'),
      newRow('2026-05-15', -148, 'MAKEUP'),
    ];
    const s = suggestRecurring(results);
    expect(s).toHaveLength(1);
    expect(s[0].confidence).toBe('medium');
    expect(s[0].intervalDays).toBeGreaterThanOrEqual(28);
    expect(s[0].intervalDays).toBeLessThanOrEqual(32);
  });

  test('detects weekly pattern', () => {
    const results = [
      newRow('2026-05-01', -25, 'Supermarket'),
      newRow('2026-05-08', -25, 'Supermarket'),
      newRow('2026-05-15', -25, 'Supermarket'),
    ];
    const s = suggestRecurring(results);
    expect(s).toHaveLength(1);
    expect(s[0].intervalKind).toBe('weekly');
  });

  test('rejects clusters with wildly different amounts', () => {
    // Same payee but amounts vary by 50% — not a stable recurring fee
    const results = [
      newRow('2026-03-05', -10, 'Tobacco'),
      newRow('2026-04-05', -50, 'Tobacco'),
      newRow('2026-05-05', -100, 'Tobacco'),
    ];
    const s = suggestRecurring(results);
    expect(s).toHaveLength(0);
  });

  test('rejects clusters with off-pattern intervals (12 days)', () => {
    const results = [
      newRow('2026-05-01', -50, 'X'),
      newRow('2026-05-13', -50, 'X'),  // 12 days — neither weekly nor monthly
    ];
    const s = suggestRecurring(results);
    expect(s).toHaveLength(0);
  });

  test('singleton row never suggested', () => {
    const results = [newRow('2026-05-01', -42, 'Lonely')];
    const s = suggestRecurring(results);
    expect(s).toHaveLength(0);
  });

  test('non-new rows are ignored', () => {
    // Even with monthly cadence, exact/similar/recurring shouldn't be re-detected
    const results = [
      { kind: 'exact', extracted: { date: '2026-03-05', amount: -42, payee: 'X' }, match: { id: 'a' } },
      { kind: 'exact', extracted: { date: '2026-04-05', amount: -42, payee: 'X' }, match: { id: 'b' } },
    ];
    const s = suggestRecurring(results);
    expect(s).toHaveLength(0);
  });

  test('multiple clusters detected independently', () => {
    const results = [
      newRow('2026-03-05', -42, 'Spotify'),
      newRow('2026-04-05', -42, 'Spotify'),
      newRow('2026-03-10', -200, 'Gym'),
      newRow('2026-04-10', -200, 'Gym'),
      newRow('2026-05-10', -200, 'Gym'),
    ];
    const s = suggestRecurring(results);
    expect(s).toHaveLength(2);
    const payees = s.map(x => x.payee).sort();
    expect(payees).toEqual(['Gym', 'Spotify']);
    const gym = s.find(x => x.payee === 'Gym');
    expect(gym.confidence).toBe('high');
  });

  test('picks the longest payee text as canonical', () => {
    const results = [
      newRow('2026-04-05', -42, 'Spotify'),
      newRow('2026-05-05', -42, 'Spotify *AB1234 PREMIUM'),
    ];
    const s = suggestRecurring(results);
    expect(s).toHaveLength(1);
    expect(s[0].payee).toBe('Spotify *AB1234 PREMIUM');
  });
});
