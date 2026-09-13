// __tests__/currency.test.js
import { CURRENCIES, convert, fmt, fmtSigned, getRate, setCurrency, sym } from '../src/utils/currency';

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

describe('CURRENCIES catalog', () => {
  test('covers the full ISO set served by the FX API, not just the legacy 30', () => {
    expect(CURRENCIES.length).toBeGreaterThanOrEqual(150);
  });

  test('codes are unique and well-formed', () => {
    const codes = CURRENCIES.map(c => c.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const c of CURRENCIES) {
      expect(c.code).toMatch(/^[A-Z]{3}$/);
      expect(c.symbol.length).toBeGreaterThan(0);
      expect(c.name.length).toBeGreaterThan(0);
    }
  });

  test('symbols are unique — accounts are stored keyed by SYMBOL', () => {
    // Two legacy duplicates predate the extended catalog and cannot be changed
    // without breaking stored accounts: ¥ (JPY/CNY) and kr (SEK/NOK/DKK).
    // No NEW duplicate may ever be added.
    const GRANDFATHERED = new Set(['¥', 'kr']);
    const symbols = CURRENCIES.map(c => c.symbol).filter(s => !GRANDFATHERED.has(s));
    const dupes = symbols.filter((s, i) => symbols.indexOf(s) !== i);
    expect(dupes).toEqual([]);
  });

  test('legacy entries are byte-identical — stored account symbols must keep resolving', () => {
    const legacy = {
      ILS: '₪', USD: '$', EUR: '€', GBP: '£', UAH: '₴', CHF: 'CHF', JPY: '¥',
      CNY: '¥', RUB: '₽', INR: '₹', AUD: 'A$', CAD: 'C$', BRL: 'R$', TRY: '₺',
      PLN: 'zł', CZK: 'Kč', SEK: 'kr', NOK: 'kr', DKK: 'kr', ZAR: 'R',
      KRW: '₩', SGD: 'S$', MYR: 'RM', THB: '฿', AED: 'د.إ', SAR: '﷼',
      EGP: 'E£', JOD: 'JD', HUF: 'Ft', RON: 'lei',
    };
    for (const [code, symbol] of Object.entries(legacy)) {
      expect(CURRENCIES.find(c => c.code === code)?.symbol).toBe(symbol);
    }
    // Legacy ordering preserved: popular currencies stay on top of the picker.
    expect(CURRENCIES[0].code).toBe('ILS');
    expect(CURRENCIES[1].code).toBe('USD');
    expect(CURRENCIES[29].code).toBe('RON');
  });

  test('detectCurrency region targets that used to be missing now exist', () => {
    for (const code of ['MXN', 'ARS', 'CLP', 'COP', 'NZD']) {
      expect(CURRENCIES.find(c => c.code === code)).toBeDefined();
    }
  });

  test('popular previously-missing currencies are present with distinct symbols', () => {
    expect(CURRENCIES.find(c => c.code === 'GEL')?.symbol).toBe('₾');
    expect(CURRENCIES.find(c => c.code === 'KZT')?.symbol).toBe('₸');
    expect(CURRENCIES.find(c => c.code === 'MXN')?.symbol).toBe('MX$');
    expect(CURRENCIES.find(c => c.code === 'NZD')?.symbol).toBe('NZ$');
    expect(CURRENCIES.find(c => c.code === 'HKD')?.symbol).toBe('HK$');
  });
});
