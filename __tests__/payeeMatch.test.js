// __tests__/payeeMatch.test.js
const { fuzzyPayee } = require('../src/utils/payeeMatch');

describe('fuzzyPayee', () => {
  test('exact match (case-insensitive)', () => {
    expect(fuzzyPayee('Cellcom', 'cellcom')).toBe(true);
  });

  test('one side contains the other', () => {
    expect(fuzzyPayee('Cellcom *123', 'Cellcom')).toBe(true);
    expect(fuzzyPayee('Cellcom', 'Cellcom *123')).toBe(true);
  });

  test('case-insensitive substring', () => {
    expect(fuzzyPayee('CELLCOM SERVICES', 'cellcom')).toBe(true);
  });

  test('trims whitespace', () => {
    expect(fuzzyPayee('  Cellcom  ', 'Cellcom')).toBe(true);
  });

  test('collapses runs of non-alphanumerics to a space', () => {
    expect(fuzzyPayee('Cellcom—Mobile', 'cellcom mobile')).toBe(true);
    expect(fuzzyPayee('Hapoalim/Bank/Fee', 'hapoalim bank fee')).toBe(true);
  });

  test('Hebrew payees', () => {
    expect(fuzzyPayee('שופרסל דיל', 'שופרסל')).toBe(true);
  });

  test('no match returns false', () => {
    expect(fuzzyPayee('Cellcom', 'Hot Mobile')).toBe(false);
  });

  test('empty inputs return false', () => {
    expect(fuzzyPayee('', 'Cellcom')).toBe(false);
    expect(fuzzyPayee('Cellcom', '')).toBe(false);
    expect(fuzzyPayee('', '')).toBe(false);
  });

  test('null/undefined safe', () => {
    expect(fuzzyPayee(undefined, 'Cellcom')).toBe(false);
    expect(fuzzyPayee('Cellcom', null)).toBe(false);
  });
});
