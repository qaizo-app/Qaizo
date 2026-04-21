// __tests__/exchangeRateService.test.js
jest.mock('@react-native-async-storage/async-storage', () => {
  let store = {};
  return {
    __esModule: true,
    default: {
      getItem: jest.fn((k) => Promise.resolve(store[k] ?? null)),
      setItem: jest.fn((k, v) => { store[k] = v; return Promise.resolve(); }),
      removeItem: jest.fn((k) => { delete store[k]; return Promise.resolve(); }),
      clear: jest.fn(() => { store = {}; return Promise.resolve(); }),
      __reset: () => { store = {}; },
    },
  };
});

const fx = require('../src/services/exchangeRateService').default;
const AsyncStorage = require('@react-native-async-storage/async-storage').default;

beforeEach(() => {
  fx.__reset();
  AsyncStorage.__reset();
  global.fetch = jest.fn();
});

afterAll(() => {
  delete global.fetch;
});

describe('getRate', () => {
  test('same currency returns 1', () => {
    expect(fx.getRate('USD', 'USD')).toBe(1);
    expect(fx.getRate('ILS', 'ILS')).toBe(1);
  });

  test('unknown currency returns 1', () => {
    expect(fx.getRate('USD', 'ZZZ')).toBe(1);
    expect(fx.getRate('ZZZ', 'USD')).toBe(1);
  });

  test('uses fallback rates before any fetch', () => {
    // FALLBACK has USD=1, ILS=3.7 → 1 USD = 3.7 ILS
    expect(fx.getRate('USD', 'ILS')).toBeCloseTo(3.7);
  });

  test('applies live rates after __setRatesForTest', () => {
    fx.__setRatesForTest({ USD: 1, EUR: 0.90, ILS: 3.80 });
    // 1 USD = 3.80 ILS, 1 EUR = 3.80/0.90 ILS
    expect(fx.getRate('USD', 'ILS')).toBeCloseTo(3.80);
    expect(fx.getRate('EUR', 'ILS')).toBeCloseTo(3.80 / 0.90);
    expect(fx.getRate('ILS', 'USD')).toBeCloseTo(1 / 3.80);
  });
});

describe('convert', () => {
  test('zero amount returns 0', () => {
    expect(fx.convert(0, 'USD', 'ILS')).toBe(0);
  });

  test('same currency returns same amount', () => {
    expect(fx.convert(100, 'USD', 'USD')).toBe(100);
  });

  test('converts using live rates and rounds to 2 decimals', () => {
    fx.__setRatesForTest({ USD: 1, ILS: 3.75 });
    expect(fx.convert(10, 'USD', 'ILS')).toBeCloseTo(37.5);
    expect(fx.convert(100, 'ILS', 'USD')).toBeCloseTo(26.67);
  });
});

describe('refresh', () => {
  test('fetches from open.er-api.com and caches', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ result: 'success', rates: { USD: 1, EUR: 0.91, ILS: 3.72 } }),
    });
    const ok = await fx.refresh();
    expect(ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(fx.getRate('USD', 'ILS')).toBeCloseTo(3.72);
    expect(fx.__getFetchedAt()).toBeGreaterThan(0);
  });

  test('persists rates to AsyncStorage', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ result: 'success', rates: { USD: 1, ILS: 3.80 } }),
    });
    await fx.refresh();
    const raw = await AsyncStorage.getItem('qaizo_fx_rates');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw);
    expect(parsed.rates.ILS).toBe(3.80);
  });

  test('returns false on network error and keeps fallback rates', async () => {
    global.fetch.mockRejectedValue(new Error('offline'));
    const ok = await fx.refresh();
    expect(ok).toBe(false);
    // Still works via FALLBACK
    expect(fx.getRate('USD', 'ILS')).toBeCloseTo(3.7);
  });

  test('returns false on bad response shape', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ result: 'error', 'error-type': 'unsupported-code' }),
    });
    const ok = await fx.refresh();
    expect(ok).toBe(false);
  });

  test('skips fetch if recently refreshed (TTL)', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ result: 'success', rates: { USD: 1, ILS: 3.8 } }),
    });
    await fx.refresh();
    await fx.refresh(); // within TTL
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('force=true refetches regardless of TTL', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ result: 'success', rates: { USD: 1, ILS: 3.8 } }),
    });
    await fx.refresh();
    await fx.refresh(true);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});

describe('init', () => {
  test('hydrates from disk when cache exists', async () => {
    await AsyncStorage.setItem('qaizo_fx_rates', JSON.stringify({
      rates: { USD: 1, ILS: 3.99 }, fetchedAt: Date.now(),
    }));
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ result: 'success', rates: { USD: 1, ILS: 3.88 } }),
    });
    await fx.init();
    // After init, disk was loaded → then background refresh kicks in and updates
    // Give microtask a chance to complete
    await new Promise(r => setTimeout(r, 0));
    // Either disk value (3.99) or refreshed (3.88) — both are acceptable
    const rate = fx.getRate('USD', 'ILS');
    expect([3.99, 3.88]).toContain(rate);
  });
});
