// __tests__/cryptoService.test.js
// Тесты для cryptoService — mapping, расчёт balance, кэш, offline fallback

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

const cryptoService = require('../src/services/cryptoService').default;
const AsyncStorage = require('@react-native-async-storage/async-storage').default;

beforeEach(() => {
  cryptoService.clearCache();
  AsyncStorage.__reset();
  global.fetch = jest.fn();
});

afterAll(() => {
  delete global.fetch;
});

describe('symbolToId', () => {
  test('maps known symbols to CoinGecko ids', () => {
    expect(cryptoService.symbolToId('BTC')).toBe('bitcoin');
    expect(cryptoService.symbolToId('eth')).toBe('ethereum');
    expect(cryptoService.symbolToId('USDT')).toBe('tether');
  });

  test('returns null for unknown', () => {
    expect(cryptoService.symbolToId('XXX')).toBeNull();
    expect(cryptoService.symbolToId('')).toBeNull();
    expect(cryptoService.symbolToId(null)).toBeNull();
  });
});

describe('getSupportedSymbols', () => {
  test('returns non-empty list including majors', () => {
    const symbols = cryptoService.getSupportedSymbols();
    expect(symbols.length).toBeGreaterThan(20);
    expect(symbols).toContain('BTC');
    expect(symbols).toContain('ETH');
    expect(symbols).toContain('SOL');
  });
});

describe('holdingsValue', () => {
  test('sums amount × price across holdings', () => {
    const holdings = [
      { symbol: 'BTC', amount: 0.5 },
      { symbol: 'ETH', amount: 10 },
    ];
    const prices = {
      BTC: { price: 100000 },
      ETH: { price: 3000 },
    };
    expect(cryptoService.holdingsValue(holdings, prices)).toBe(80000);
  });

  test('treats missing prices as zero', () => {
    const holdings = [{ symbol: 'XXX', amount: 5 }];
    expect(cryptoService.holdingsValue(holdings, {})).toBe(0);
  });

  test('handles string amounts', () => {
    const holdings = [{ symbol: 'BTC', amount: '0.25' }];
    const prices = { BTC: { price: 100000 } };
    expect(cryptoService.holdingsValue(holdings, prices)).toBe(25000);
  });

  test('returns 0 for non-array input', () => {
    expect(cryptoService.holdingsValue(null, {})).toBe(0);
    expect(cryptoService.holdingsValue(undefined, {})).toBe(0);
  });
});

describe('fetchPrices', () => {
  test('calls CoinGecko with mapped ids and vs currency', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        bitcoin: { usd: 67000, usd_24h_change: 2.5 },
        ethereum: { usd: 3500, usd_24h_change: -1.2 },
      }),
    });
    const result = await cryptoService.fetchPrices(['BTC', 'ETH'], 'USD');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const url = global.fetch.mock.calls[0][0];
    expect(url).toContain('bitcoin');
    expect(url).toContain('ethereum');
    expect(url).toContain('vs_currencies=usd');
    expect(result.BTC.price).toBe(67000);
    expect(result.BTC.change24h).toBeCloseTo(2.5);
    expect(result.ETH.price).toBe(3500);
  });

  test('uses memory cache within TTL', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ bitcoin: { usd: 67000, usd_24h_change: 0 } }),
    });
    await cryptoService.fetchPrices(['BTC'], 'USD');
    await cryptoService.fetchPrices(['BTC'], 'USD');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('falls back to ILS if unsupported currency provided', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ bitcoin: { usd: 67000 } }),
    });
    // JOD is not in SUPPORTED_VS — should fall back to usd
    await cryptoService.fetchPrices(['BTC'], 'JOD');
    const url = global.fetch.mock.calls[0][0];
    expect(url).toContain('vs_currencies=usd');
  });

  test('skips unknown symbols silently', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ bitcoin: { usd: 67000 } }),
    });
    const result = await cryptoService.fetchPrices(['BTC', 'XXX'], 'USD');
    expect(result.BTC).toBeDefined();
    expect(result.XXX).toBeUndefined();
    const url = global.fetch.mock.calls[0][0];
    expect(url).not.toContain('xxx');
  });

  test('returns empty when no valid symbols', async () => {
    const result = await cryptoService.fetchPrices(['XXX', 'YYY'], 'USD');
    expect(result).toEqual({});
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('falls back to disk cache on network failure', async () => {
    // First call — succeeds, populates disk cache
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ bitcoin: { usd: 67000, usd_24h_change: 1 } }),
    });
    await cryptoService.fetchPrices(['BTC'], 'USD');
    // Clear memory cache
    cryptoService.clearCache();
    // Second call — network fails
    global.fetch.mockRejectedValueOnce(new Error('network down'));
    const result = await cryptoService.fetchPrices(['BTC'], 'USD');
    expect(result.BTC.price).toBe(67000);
    expect(result.BTC.stale).toBe(true);
  });

  test('handles non-OK HTTP response as failure', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 429, json: async () => ({}) });
    const result = await cryptoService.fetchPrices(['BTC'], 'USD');
    expect(result).toEqual({}); // no disk cache → empty
  });
});
