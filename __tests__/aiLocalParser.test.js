// extractAmount — the shared amount extractor (used by the repeat dictionary
// path so a history hit still parses "кофе 28" → 28 without AI).
const { extractAmount, parseTransaction } = require('../src/services/ai/localParser');

jest.mock('../src/i18n', () => ({ __esModule: true, default: { t: (k) => k, getLanguage: () => 'ru' } }));

describe('extractAmount', () => {
  test.each([
    ['кофе 28', 28],
    ['кофе с круассаном 28.50', 28.5],
    ['דלק פז 280 שח', 280],
    ['taxi 45₪', 45],
    ['1,250 аренда', 1250],
    ['без суммы вообще', null],
  ])('%s → %s', (input, expected) => {
    expect(extractAmount(input)).toBe(expected);
  });
});

describe('parseTransaction (moved, still works)', () => {
  test('RU keyword hit', () => {
    const r = parseTransaction('такси домой 45');
    expect(r).toMatchObject({ amount: 45, type: 'expense', categoryId: 'transport' });
  });
  test('HE keyword hit', () => {
    const r = parseTransaction('דלק 280');
    expect(r).toMatchObject({ amount: 280, categoryId: 'fuel' });
  });
  test('EN keyword hit', () => {
    const r = parseTransaction('pizza 60');
    expect(r).toMatchObject({ amount: 60, categoryId: 'restaurant' });
  });
});
