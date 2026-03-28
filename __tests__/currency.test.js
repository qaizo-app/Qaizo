// __tests__/currency.test.js
import { convert, fmt, fmtSigned, getRate, setCurrency, sym } from '../src/utils/currency';

describe('currency utility', () => {
  beforeEach(() => {
    setCurrency('₪', 'ILS');
  });

  test('sym() returns current symbol', () => {
    expect(sym()).toBe('₪');
    setCurrency('$', 'USD');
    expect(sym()).toBe('$');
  });

  test('fmt() formats amount with symbol after number', () => {
    expect(fmt(1500)).toBe('1,500.00 ₪');
    expect(fmt(0)).toBe('0.00 ₪');
    expect(fmt(99.5)).toBe('99.50 ₪');
  });

  test('fmtSigned() adds sign by type', () => {
    expect(fmtSigned(100, 'income')).toBe('+100.00 ₪');
    expect(fmtSigned(100, 'expense')).toBe('-100.00 ₪');
    expect(fmtSigned(100, 'transfer')).toBe('100.00 ₪');
  });

  test('convert() between currencies', () => {
    // ILS to ILS = same
    expect(convert(100, 'ILS', 'ILS')).toBe(100);
    // USD to ILS (rate ~3.65)
    const result = convert(100, 'USD', 'ILS');
    expect(result).toBeGreaterThan(300);
    expect(result).toBeLessThan(400);
  });

  test('getRate() returns conversion rate', () => {
    expect(getRate('ILS', 'ILS')).toBe(1);
    expect(getRate('USD', 'ILS')).toBeGreaterThan(3);
  });
});
