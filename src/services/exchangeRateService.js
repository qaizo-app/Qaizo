// src/services/exchangeRateService.js
// Live fiat exchange rates via open.er-api.com (free, no API key).
// In-memory rates + AsyncStorage persistence. refresh() runs in background;
// getRate()/convert() stay synchronous for existing call sites.
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY = 'qaizo_fx_rates';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const BASE = 'USD';

// Safe starting rates (used when nothing is cached yet — prevents 0 conversions
// on first install before network responds). Values relative to USD (USD = 1).
// Intentionally approximate — live data overwrites within seconds of app start.
const FALLBACK_RATES_USD = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  ILS: 3.7,
  RUB: 92,
  UAH: 41,
  JPY: 155,
  CNY: 7.2,
  KRW: 1380,
  INR: 83.5,
  BRL: 5.1,
  TRY: 32.5,
  PLN: 4,
  CZK: 23,
  SEK: 10.5,
  NOK: 10.8,
  DKK: 6.85,
  CHF: 0.9,
  CAD: 1.35,
  AUD: 1.52,
  HUF: 355,
  RON: 4.55,
  THB: 36,
  AED: 3.67,
  SAR: 3.75,
  MYR: 4.75,
  SGD: 1.34,
  ZAR: 18.5,
  HKD: 7.8,
  EGP: 48,
  JOD: 0.71,
};

let _rates = { ...FALLBACK_RATES_USD };
let _fetchedAt = 0;

function setRates(rates, fetchedAt) {
  if (rates && typeof rates === 'object') {
    _rates = { ...FALLBACK_RATES_USD, ...rates };
    _fetchedAt = fetchedAt || Date.now();
  }
}

// Load persisted rates synchronously-ish at app start.
async function loadPersisted() {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return false;
    const { rates, fetchedAt } = JSON.parse(raw);
    setRates(rates, fetchedAt);
    return true;
  } catch (e) { return false; }
}

async function savePersisted(rates, fetchedAt) {
  try { await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ rates, fetchedAt })); } catch (e) {}
}

// Fetch fresh rates. Returns true on success.
async function refresh(force = false) {
  if (!force && _fetchedAt && Date.now() - _fetchedAt < CACHE_TTL_MS) return true;
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${BASE}`);
    if (!res.ok) throw new Error(`status ${res.status}`);
    const json = await res.json();
    if (json?.result !== 'success' || !json?.rates) throw new Error('invalid response');
    setRates(json.rates, Date.now());
    await savePersisted(_rates, _fetchedAt);
    return true;
  } catch (e) {
    return false;
  }
}

// Hydrate state from disk, then kick off a background refresh.
async function init() {
  await loadPersisted();
  // Non-blocking refresh — results available for subsequent conversions.
  refresh().catch(() => {});
}

// rate(from, to) = how many `to` in 1 `from`. All math goes via USD.
function getRate(fromCode, toCode) {
  if (!fromCode || !toCode || fromCode === toCode) return 1;
  const fromUsd = _rates[fromCode];
  const toUsd = _rates[toCode];
  if (!fromUsd || !toUsd) return 1;
  // _rates is "how many X in 1 USD". So 1 fromCode = 1/fromUsd USD = toUsd/fromUsd toCode.
  return toUsd / fromUsd;
}

function convert(amount, fromCode, toCode) {
  if (!amount || fromCode === toCode) return amount || 0;
  const rate = getRate(fromCode, toCode);
  return Math.round(amount * rate * 100) / 100;
}

// Test-only helpers
function __setRatesForTest(rates) { setRates(rates, Date.now()); }
function __reset() { _rates = { ...FALLBACK_RATES_USD }; _fetchedAt = 0; }
function __getFetchedAt() { return _fetchedAt; }

export default { init, refresh, getRate, convert, __setRatesForTest, __reset, __getFetchedAt };
export { FALLBACK_RATES_USD };
