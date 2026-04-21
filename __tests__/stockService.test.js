// __tests__/stockService.test.js
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

const stockService = require('../src/services/stockService').default;
const AsyncStorage = require('@react-native-async-storage/async-storage').default;

beforeEach(() => {
  stockService.clearCache();
  AsyncStorage.__reset();
  global.fetch = jest.fn();
});

afterAll(() => { delete global.fetch; });

describe('normalizeTicker', () => {
  test('uppercases and trims', () => {
    expect(stockService.normalizeTicker('aapl')).toBe('AAPL');
    expect(stockService.normalizeTicker('  msft  ')).toBe('MSFT');
  });
  test('returns empty for falsy', () => {
    expect(stockService.normalizeTicker('')).toBe('');
    expect(stockService.normalizeTicker(null)).toBe('');
    expect(stockService.normalizeTicker(undefined)).toBe('');
  });
});

describe('portfolioStats', () => {
  test('computes value, cost, pl for gainers', () => {
    const holdings = [
      { ticker: 'AAPL', shares: 10, avgCost: 150 },
      { ticker: 'MSFT', shares: 5, avgCost: 300 },
    ];
    const quotes = { AAPL: { price: 180 }, MSFT: { price: 350 } };
    const s = stockService.portfolioStats(holdings, quotes);
    // value = 10*180 + 5*350 = 1800 + 1750 = 3550
    // cost  = 10*150 + 5*300 = 1500 + 1500 = 3000
    // pl    = 550, plPercent = 18.33
    expect(s.value).toBe(3550);
    expect(s.cost).toBe(3000);
    expect(s.pl).toBe(550);
    expect(s.plPercent).toBeCloseTo(18.33, 1);
  });

  test('handles losers with negative pl', () => {
    const holdings = [{ ticker: 'TSLA', shares: 2, avgCost: 300 }];
    const quotes = { TSLA: { price: 200 } };
    const s = stockService.portfolioStats(holdings, quotes);
    expect(s.value).toBe(400);
    expect(s.cost).toBe(600);
    expect(s.pl).toBe(-200);
    expect(s.plPercent).toBeCloseTo(-33.33, 1);
  });

  test('missing price treated as 0', () => {
    const holdings = [{ ticker: 'XYZ', shares: 10, avgCost: 100 }];
    const s = stockService.portfolioStats(holdings, {});
    expect(s.value).toBe(0);
    expect(s.cost).toBe(1000);
    expect(s.pl).toBe(-1000);
  });

  test('returns zeros for non-array input', () => {
    const s = stockService.portfolioStats(null, {});
    expect(s.value).toBe(0);
    expect(s.cost).toBe(0);
    expect(s.pl).toBe(0);
    expect(s.plPercent).toBe(0);
  });

  test('zero cost basis avoids division by zero in plPercent', () => {
    const holdings = [{ ticker: 'AAPL', shares: 10, avgCost: 0 }];
    const quotes = { AAPL: { price: 180 } };
    const s = stockService.portfolioStats(holdings, quotes);
    expect(s.value).toBe(1800);
    expect(s.cost).toBe(0);
    expect(s.plPercent).toBe(0); // guarded, not NaN/Infinity
  });
});

describe('fetchQuotes', () => {
  test('hits Yahoo v7 quote endpoint and parses result', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        quoteResponse: {
          result: [
            { symbol: 'AAPL', regularMarketPrice: 180.5, regularMarketChangePercent: 1.2, currency: 'USD', shortName: 'Apple Inc.' },
            { symbol: 'MSFT', regularMarketPrice: 350, regularMarketChangePercent: -0.5, currency: 'USD', longName: 'Microsoft Corporation' },
          ],
        },
      }),
    });
    const q = await stockService.fetchQuotes(['aapl', 'MSFT']);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const url = global.fetch.mock.calls[0][0];
    expect(url).toContain('query1.finance.yahoo.com');
    expect(url).toContain('symbols=AAPL,MSFT');
    expect(q.AAPL.price).toBe(180.5);
    expect(q.AAPL.change24h).toBeCloseTo(1.2);
    expect(q.AAPL.name).toBe('Apple Inc.');
    expect(q.MSFT.price).toBe(350);
    expect(q.MSFT.name).toBe('Microsoft Corporation');
  });

  test('returns empty for empty tickers input', async () => {
    const q = await stockService.fetchQuotes([]);
    expect(q).toEqual({});
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('dedupes and normalizes tickers', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ quoteResponse: { result: [] } }),
    });
    await stockService.fetchQuotes(['aapl', 'AAPL', '  aapl  ']);
    const url = global.fetch.mock.calls[0][0];
    expect(url).toContain('symbols=AAPL');
    expect(url.match(/AAPL/g).length).toBe(1); // only once
  });

  test('uses memory cache within TTL', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ quoteResponse: { result: [{ symbol: 'AAPL', regularMarketPrice: 180 }] } }),
    });
    await stockService.fetchQuotes(['AAPL']);
    await stockService.fetchQuotes(['AAPL']);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('falls back to disk cache on network error', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ quoteResponse: { result: [{ symbol: 'AAPL', regularMarketPrice: 180, currency: 'USD' }] } }),
    });
    await stockService.fetchQuotes(['AAPL']);
    stockService.clearCache();
    global.fetch.mockRejectedValueOnce(new Error('offline'));
    const q = await stockService.fetchQuotes(['AAPL']);
    expect(q.AAPL.price).toBe(180);
    expect(q.AAPL.stale).toBe(true);
  });

  test('returns empty on non-OK response without disk cache', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    const q = await stockService.fetchQuotes(['AAPL']);
    expect(q).toEqual({});
  });
});
