// src/services/stockService.js
// Live stock quotes via Yahoo Finance v7 quote endpoint (free, no API key).
// Same caching pattern as cryptoService: in-memory 60s + AsyncStorage fallback.
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY = 'qaizo_stock_quote_cache';
const CACHE_TTL_MS = 60 * 1000;

// In-memory cache: { [key]: { ts, data } }, key = `${tickers-sorted}`
const memCache = new Map();

function normalizeTicker(t) {
  return (t || '').toUpperCase().trim();
}

async function loadDiskCache() {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) { return {}; }
}
async function saveDiskCache(c) {
  try { await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch (e) {}
}

// Fetch quotes for a list of tickers.
// Returns { [ticker]: { price, change24h, currency, name, stale? } }.
// Unknown tickers are silently omitted. Pass force=true to bypass cache.
async function fetchQuotes(tickers, force = false) {
  const clean = [...new Set((tickers || []).map(normalizeTicker).filter(Boolean))];
  if (!clean.length) return {};

  const cacheKey = clean.sort().join(',');
  const now = Date.now();
  const mem = memCache.get(cacheKey);
  if (!force && mem && now - mem.ts < CACHE_TTL_MS) return mem.data;

  try {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${clean.join(',')}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Qaizo/1.0)',
        'Accept': 'application/json',
      },
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const json = await res.json();
    const list = json?.quoteResponse?.result || [];
    const out = {};
    for (const q of list) {
      const sym = normalizeTicker(q.symbol);
      if (!sym) continue;
      out[sym] = {
        price: q.regularMarketPrice ?? 0,
        change24h: q.regularMarketChangePercent ?? 0,
        currency: q.currency || 'USD',
        name: q.shortName || q.longName || sym,
      };
    }
    memCache.set(cacheKey, { ts: now, data: out });
    const disk = await loadDiskCache();
    for (const sym of Object.keys(out)) {
      disk[sym] = { ts: now, ...out[sym] };
    }
    await saveDiskCache(disk);
    return out;
  } catch (e) {
    // Offline / blocked → disk cache fallback
    const disk = await loadDiskCache();
    const out = {};
    for (const t of clean) {
      const row = disk[t];
      if (row) out[t] = { ...row, stale: true };
    }
    return out;
  }
}

// holdings: [{ ticker, shares, avgCost }], quotes: from fetchQuotes()
// Returns {
//   value,      // current market value (sum shares × price)
//   cost,       // total cost basis (sum shares × avgCost)
//   pl,         // value - cost
//   plPercent,  // pl / cost × 100
// }
function portfolioStats(holdings, quotes) {
  const stats = { value: 0, cost: 0, pl: 0, plPercent: 0 };
  if (!Array.isArray(holdings)) return stats;
  for (const h of holdings) {
    const sym = normalizeTicker(h.ticker);
    const shares = parseFloat(h.shares) || 0;
    const avgCost = parseFloat(h.avgCost) || 0;
    const price = quotes?.[sym]?.price || 0;
    stats.value += shares * price;
    stats.cost += shares * avgCost;
  }
  stats.pl = stats.value - stats.cost;
  stats.plPercent = stats.cost > 0 ? (stats.pl / stats.cost) * 100 : 0;
  stats.value = Math.round(stats.value * 100) / 100;
  stats.cost = Math.round(stats.cost * 100) / 100;
  stats.pl = Math.round(stats.pl * 100) / 100;
  stats.plPercent = Math.round(stats.plPercent * 100) / 100;
  return stats;
}

function clearCache() {
  memCache.clear();
}

export default {
  fetchQuotes,
  portfolioStats,
  normalizeTicker,
  clearCache,
};
