// __tests__/statementCategorize.test.js
const { categorize } = require('../src/utils/statementCategorize');

const tx = (overrides) => ({
  id: 't',
  type: 'expense',
  amount: 100,
  date: '2026-05-20',
  account: 'acc1',
  categoryId: 'food',
  recipient: 'Generic',
  ...overrides,
});

const rec = (overrides) => ({
  id: 'r',
  type: 'expense',
  amount: 100,
  account: 'acc1',
  categoryId: 'phone',
  recipient: 'Cellcom',
  nextDate: '2026-05-28',
  isActive: true,
  ...overrides,
});

describe('categorize', () => {
  test('history hit takes precedence', () => {
    const r = categorize(
      'Cellcom *123',
      [tx({ recipient: 'Cellcom', categoryId: 'phone', date: '2026-04-01' })],
      [],
    );
    expect(r).toEqual({ categoryId: 'phone', source: 'history' });
  });

  test('most recent history entry wins when multiple match', () => {
    const r = categorize(
      'Cellcom',
      [
        tx({ recipient: 'Cellcom', categoryId: 'other', date: '2026-01-01' }),
        tx({ recipient: 'Cellcom', categoryId: 'phone', date: '2026-04-01' }),
      ],
      [],
    );
    expect(r.categoryId).toBe('phone');
  });

  test('recurring used when no history match', () => {
    const r = categorize(
      'Cellcom *123',
      [],
      [rec({ recipient: 'Cellcom', categoryId: 'phone' })],
    );
    expect(r).toEqual({ categoryId: 'phone', source: 'recurring' });
  });

  test('AI hint used when no history or recurring match', () => {
    const r = categorize('SomeRandomShop', [], [], 'restaurant');
    expect(r).toEqual({ categoryId: 'restaurant', source: 'ai' });
  });

  test('fallback to "other" when nothing matches', () => {
    const r = categorize('Unknown', [], []);
    expect(r).toEqual({ categoryId: 'other', source: 'fallback' });
  });

  test('history > recurring > ai > fallback (priority test)', () => {
    const r = categorize(
      'Cellcom',
      [tx({ recipient: 'Cellcom', categoryId: 'historyCat', date: '2026-04-01' })],
      [rec({ recipient: 'Cellcom', categoryId: 'recurringCat' })],
      'aiCat',
    );
    expect(r.source).toBe('history');
    expect(r.categoryId).toBe('historyCat');
  });

  test('empty payee → fallback', () => {
    expect(categorize('', [], [])).toEqual({ categoryId: 'other', source: 'fallback' });
  });

  test('does not match history rows without a recipient', () => {
    const r = categorize('Cellcom', [tx({ recipient: undefined, categoryId: 'phone' })], []);
    expect(r.source).not.toBe('history');
  });
});
