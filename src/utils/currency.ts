// src/utils/currency.ts
// Global currency symbol — loaded from settings at app start.

export interface CurrencyDef {
  symbol: string;
  code: string;
  name: string;
}

type TransactionTypeForSign = 'income' | 'expense' | string | undefined;

let _symbol = '₪';
let _code = 'ILS';

export const CURRENCIES: readonly CurrencyDef[] = [
  { symbol: '₪', code: 'ILS', name: 'Israeli Shekel' },
  { symbol: '$', code: 'USD', name: 'US Dollar' },
  { symbol: '€', code: 'EUR', name: 'Euro' },
  { symbol: '£', code: 'GBP', name: 'British Pound' },
  { symbol: '₴', code: 'UAH', name: 'Ukrainian Hryvnia' },
  { symbol: 'CHF', code: 'CHF', name: 'Swiss Franc' },
  { symbol: '¥', code: 'JPY', name: 'Japanese Yen' },
  { symbol: '¥', code: 'CNY', name: 'Chinese Yuan' },
  { symbol: '₽', code: 'RUB', name: 'Russian Ruble' },
  { symbol: '₹', code: 'INR', name: 'Indian Rupee' },
  { symbol: 'A$', code: 'AUD', name: 'Australian Dollar' },
  { symbol: 'C$', code: 'CAD', name: 'Canadian Dollar' },
  { symbol: 'R$', code: 'BRL', name: 'Brazilian Real' },
  { symbol: '₺', code: 'TRY', name: 'Turkish Lira' },
  { symbol: 'zł', code: 'PLN', name: 'Polish Zloty' },
  { symbol: 'Kč', code: 'CZK', name: 'Czech Koruna' },
  { symbol: 'kr', code: 'SEK', name: 'Swedish Krona' },
  { symbol: 'kr', code: 'NOK', name: 'Norwegian Krone' },
  { symbol: 'kr', code: 'DKK', name: 'Danish Krone' },
  { symbol: 'R', code: 'ZAR', name: 'South African Rand' },
  { symbol: '₩', code: 'KRW', name: 'South Korean Won' },
  { symbol: 'S$', code: 'SGD', name: 'Singapore Dollar' },
  { symbol: 'RM', code: 'MYR', name: 'Malaysian Ringgit' },
  { symbol: '฿', code: 'THB', name: 'Thai Baht' },
  { symbol: 'د.إ', code: 'AED', name: 'UAE Dirham' },
  { symbol: '﷼', code: 'SAR', name: 'Saudi Riyal' },
  { symbol: 'E£', code: 'EGP', name: 'Egyptian Pound' },
  { symbol: 'JD', code: 'JOD', name: 'Jordanian Dinar' },
  { symbol: 'Ft', code: 'HUF', name: 'Hungarian Forint' },
  { symbol: 'lei', code: 'RON', name: 'Romanian Leu' },
];

// Kept for backwards compatibility; live rates come from exchangeRateService.
// Only used as a static sanity fallback when the service has not been
// initialised (e.g. some unit tests).
export const RATES_TO_ILS: Readonly<Record<string, number>> = {
  ILS: 1,
  USD: 3.65,
  EUR: 4.05,
  GBP: 4.65,
  CZK: 0.16,
};

// Auto-detect currency from system locale (language + region).
export function detectCurrency(): CurrencyDef | null {
  try {
    const { getLocales } = require('expo-localization');
    const locales = getLocales();
    if (!locales || !locales.length) return null;
    const { languageCode, regionCode } = locales[0];
    const region = (regionCode || '').toUpperCase();
    const lang = (languageCode || '').toLowerCase();

    // By region first (most accurate)
    const regionMap: Record<string, string> = {
      US: 'USD', CA: 'CAD', GB: 'GBP', AU: 'AUD', NZ: 'NZD',
      IL: 'ILS', RU: 'RUB', UA: 'UAH', JP: 'JPY', CN: 'CNY',
      KR: 'KRW', IN: 'INR', BR: 'BRL', TR: 'TRY', PL: 'PLN',
      CZ: 'CZK', SE: 'SEK', NO: 'NOK', DK: 'DKK', ZA: 'ZAR',
      SG: 'SGD', MY: 'MYR', TH: 'THB', AE: 'AED', SA: 'SAR',
      EG: 'EGP', JO: 'JOD', HU: 'HUF', RO: 'RON', CH: 'CHF',
      MX: 'MXN', AR: 'ARS', CL: 'CLP', CO: 'COP',
      DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR', PT: 'EUR',
      NL: 'EUR', BE: 'EUR', AT: 'EUR', IE: 'EUR', FI: 'EUR',
      GR: 'EUR', SK: 'EUR', SI: 'EUR', EE: 'EUR', LV: 'EUR',
      LT: 'EUR', LU: 'EUR', MT: 'EUR', CY: 'EUR',
    };
    if (region && regionMap[region]) {
      const code = regionMap[region];
      const cur = CURRENCIES.find(c => c.code === code);
      if (cur) return cur;
    }

    // Fallback by language (less accurate but better than nothing).
    const langMap: Record<string, string> = {
      he: 'ILS', iw: 'ILS', ru: 'RUB', uk: 'UAH', ja: 'JPY',
      zh: 'CNY', ko: 'KRW', hi: 'INR', pt: 'BRL', tr: 'TRY',
      pl: 'PLN', cs: 'CZK', sv: 'SEK', da: 'DKK', hu: 'HUF',
      ro: 'RON', th: 'THB', ar: 'AED',
      de: 'EUR', fr: 'EUR', it: 'EUR', es: 'EUR', nl: 'EUR',
      el: 'EUR', fi: 'EUR', et: 'EUR',
      en: 'USD',
    };
    if (lang && langMap[lang]) {
      const code = langMap[lang];
      const cur = CURRENCIES.find(c => c.code === code);
      if (cur) return cur;
    }
  } catch (e) {}
  return null;
}

export function setCurrency(symbol: string, code?: string): void {
  _symbol = symbol;
  _code = code || CURRENCIES.find(c => c.symbol === symbol)?.code || 'ILS';
}

export function sym(): string {
  return _symbol;
}

export function code(): string {
  return _code;
}

export function fmtNum(amount: number): string {
  return Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmt(amount: number): string {
  return `${fmtNum(amount)} ${_symbol}`;
}

export function fmtSigned(amount: number, type: TransactionTypeForSign): string {
  const sign = type === 'income' ? '+' : type === 'expense' ? '-' : '';
  return `${sign}${fmtNum(amount)} ${_symbol}`;
}

// Conversion between currencies — uses live rates via exchangeRateService.
// Falls back to static RATES_TO_ILS only when codes aren't known to the service.
function liveGetRate(fromCode: string, toCode: string): number {
  try {
    // Lazy require to avoid circular import issues at module init time.
    const fx = require('../services/exchangeRateService').default;
    const rate = fx.getRate(fromCode, toCode);
    if (rate && rate !== 1) return rate;
    if (fromCode === toCode) return 1;
    // Service does not know both codes → static fallback.
    const fromRate = RATES_TO_ILS[fromCode];
    const toRate = RATES_TO_ILS[toCode];
    if (fromRate && toRate) return fromRate / toRate;
    return rate; // 1 — sensible default when everything else fails
  } catch (e) {
    if (fromCode === toCode) return 1;
    const fromRate = RATES_TO_ILS[fromCode] || 1;
    const toRate = RATES_TO_ILS[toCode] || 1;
    return fromRate / toRate;
  }
}

export function convert(amount: number, fromCode: string, toCode: string): number {
  if (!amount || fromCode === toCode) return amount || 0;
  const rate = liveGetRate(fromCode, toCode);
  return Math.round(amount * rate * 100) / 100;
}

export function getRate(fromCode: string, toCode: string): number {
  return liveGetRate(fromCode, toCode);
}
