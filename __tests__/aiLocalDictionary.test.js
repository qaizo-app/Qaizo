const { normalizeInput, buildDictionary, lookupRepeat } = require('../src/services/ai/localDictionary');

const now = new Date(2026, 6, 15);
const tx = (note, categoryId, type = 'expense', date = '2026-06-01', recipient = '') =>
  ({ note, recipient, categoryId, type, date });

describe('normalizeInput', () => {
  test.each([
    ['Кофе с круассаном 28₪', 'кофе с круассаном'],
    ['דלק פז 280 שח', 'דלק פז'],
    ['Taxi home 45 NIS', 'taxi home'],
    ['  двойные   пробелы 12 ', 'двойные пробелы'],
    ['1,250', ''],
  ])('%s → "%s"', (input, expected) => {
    expect(normalizeInput(input)).toBe(expected);
  });
});

describe('buildDictionary', () => {
  test('key needs ≥2 occurrences with ≥80% category agreement', () => {
    const d = buildDictionary([
      tx('кофе 25', 'restaurant'),
      tx('кофе 30', 'restaurant'),
      tx('такси 45', 'transport'),           // only once → no entry
      tx('пицца 60', 'restaurant'),
      tx('пицца 55', 'food'),                // 1/2 = 50% → conflict → no entry
    ], { now });
    expect(d.get('кофе')).toMatchObject({ categoryId: 'restaurant', count: 2 });
    expect(d.get('такси')).toBeUndefined();
    expect(d.get('пицца')).toBeUndefined();
  });

  test('4 of 5 = 80% agreement wins', () => {
    const txs = [1, 2, 3, 4].map(() => tx('обед 40', 'restaurant'));
    txs.push(tx('обед 40', 'food'));
    const d = buildDictionary(txs, { now });
    expect(d.get('обед')).toMatchObject({ categoryId: 'restaurant', count: 5 });
  });

  test('transactions older than 12 months are ignored', () => {
    const d = buildDictionary([
      tx('кофе 25', 'restaurant', 'expense', '2025-05-01'),
      tx('кофе 30', 'restaurant', 'expense', '2025-06-01'),
    ], { now });
    expect(d.size).toBe(0);
  });

  test('recipient counts as a key too (HE)', () => {
    const d = buildDictionary([
      tx('', 'food', 'expense', '2026-06-01', 'רמי לוי'),
      tx('', 'food', 'expense', '2026-06-20', 'רמי לוי'),
    ], { now });
    expect(d.get('רמי לוי')).toMatchObject({ categoryId: 'food' });
  });

  test('income repeats carry their type', () => {
    const d = buildDictionary([
      tx('зарплата 12000', 'salary_me', 'income'),
      tx('зарплата 13000', 'salary_me', 'income'),
    ], { now });
    expect(d.get('зарплата')).toMatchObject({ categoryId: 'salary_me', type: 'income' });
  });
});

describe('lookupRepeat', () => {
  const dict = buildDictionary([tx('кофе 25', 'restaurant'), tx('кофе 30', 'restaurant')], { now });
  test('hit strips the amount before matching', () => {
    expect(lookupRepeat('Кофе 32₪', dict)).toMatchObject({ categoryId: 'restaurant' });
  });
  test('miss returns null', () => {
    expect(lookupRepeat('суши 90', dict)).toBeNull();
  });
  test('empty normalized text returns null', () => {
    expect(lookupRepeat('450', dict)).toBeNull();
  });
});
