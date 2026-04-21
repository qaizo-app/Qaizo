// src/services/cryptoService.js
// Live crypto prices via CoinGecko (free, no API key). In-memory cache 60s +
// AsyncStorage fallback for offline mode.
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY = 'qaizo_crypto_price_cache';
const CACHE_TTL_MS = 60 * 1000;

// Top coins: symbol (uppercase) → CoinGecko id
const SYMBOL_TO_ID = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  USDT: 'tether',
  USDC: 'usd-coin',
  BNB: 'binancecoin',
  SOL: 'solana',
  XRP: 'ripple',
  DOGE: 'dogecoin',
  TON: 'the-open-network',
  TRX: 'tron',
  ADA: 'cardano',
  AVAX: 'avalanche-2',
  SHIB: 'shiba-inu',
  DOT: 'polkadot',
  BCH: 'bitcoin-cash',
  LINK: 'chainlink',
  DAI: 'dai',
  LTC: 'litecoin',
  MATIC: 'matic-network',
  XLM: 'stellar',
  NEAR: 'near',
  UNI: 'uniswap',
  ATOM: 'cosmos',
  XMR: 'monero',
  ETC: 'ethereum-classic',
  APT: 'aptos',
  FIL: 'filecoin',
  ICP: 'internet-computer',
  ARB: 'arbitrum',
  OP: 'optimism',
  VET: 'vechain',
  HBAR: 'hedera-hashgraph',
  ALGO: 'algorand',
  AAVE: 'aave',
  SUI: 'sui',
};

// CoinGecko supported vs_currencies we care about (lowercase)
const SUPPORTED_VS = new Set([
  'usd', 'eur', 'gbp', 'ils', 'rub', 'uah', 'jpy', 'cny', 'krw', 'inr',
  'brl', 'try', 'pln', 'czk', 'sek', 'nok', 'dkk', 'huf', 'ron', 'thb',
  'aed', 'sar', 'myr', 'sgd', 'zar', 'hkd', 'chf', 'cad', 'aud',
]);

// In-memory cache: { [key]: { ts, data } }  where key = `${ids}|${vs}`
const memCache = new Map();

function getSupportedSymbols() {
  return Object.keys(SYMBOL_TO_ID);
}

function symbolToId(symbol) {
  return SYMBOL_TO_ID[(symbol || '').toUpperCase()] || null;
}

async function loadDiskCache() {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) { return {}; }
}

async function saveDiskCache(cache) {
  try { await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch (e) {}
}

// Fetch prices for a list of symbols in a single vs currency.
// Returns { [symbol]: { price, change24h } }. Always returns entries for valid symbols,
// falling back to disk cache when network fails.
async function fetchPrices(symbols, vsCurrencyCode) {
  const vs = (vsCurrencyCode || 'USD').toLowerCase();
  const vsSafe = SUPPORTED_VS.has(vs) ? vs : 'usd';

  const ids = [];
  const idToSymbol = {};
  for (const s of symbols || []) {
    const id = symbolToId(s);
    if (!id || idToSymbol[id]) continue;
    ids.push(id);
    idToSymbol[id] = s.toUpperCase();
  }
  if (!ids.length) return {};

  const cacheKey = `${ids.sort().join(',')}|${vsSafe}`;
  const now = Date.now();
  const mem = memCache.get(cacheKey);
  if (mem && now - mem.ts < CACHE_TTL_MS) return mem.data;

  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=${vsSafe}&include_24hr_change=true`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`status ${res.status}`);
    const json = await res.json();
    const out = {};
    for (const id of ids) {
      const row = json[id];
      if (!row) continue;
      const sym = idToSymbol[id];
      out[sym] = {
        price: row[vsSafe] || 0,
        change24h: row[`${vsSafe}_24h_change`] || 0,
      };
    }
    memCache.set(cacheKey, { ts: now, data: out });
    // Merge into disk cache under a per-symbol key so fallback works with any future query
    const disk = await loadDiskCache();
    for (const sym of Object.keys(out)) {
      disk[`${sym}|${vsSafe}`] = { ts: now, ...out[sym] };
    }
    await saveDiskCache(disk);
    return out;
  } catch (e) {
    // Offline / rate-limited → fallback to disk cache
    const disk = await loadDiskCache();
    const out = {};
    for (const id of ids) {
      const sym = idToSymbol[id];
      const row = disk[`${sym}|${vsSafe}`];
      if (row) out[sym] = { price: row.price || 0, change24h: row.change24h || 0, stale: true };
    }
    return out;
  }
}

// Compute total value of holdings in target currency.
// holdings: [{ symbol, amount }], prices: { [symbol]: { price } }
function holdingsValue(holdings, prices) {
  if (!Array.isArray(holdings)) return 0;
  return holdings.reduce((sum, h) => {
    const p = prices?.[(h.symbol || '').toUpperCase()]?.price || 0;
    return sum + (parseFloat(h.amount) || 0) * p;
  }, 0);
}

function clearCache() {
  memCache.clear();
}

export default {
  fetchPrices,
  holdingsValue,
  getSupportedSymbols,
  symbolToId,
  clearCache,
};
export { SYMBOL_TO_ID, SUPPORTED_VS };
