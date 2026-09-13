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
  // ── Extended ISO catalog (2026-09) ──────────────────────────────────
  // Everything below is served live by open.er-api.com, so conversion works
  // automatically. Entries above are the legacy 30 and must NEVER change:
  // accounts store the SYMBOL, so every symbol here must be unique across the
  // whole catalog (currency.test.js enforces it; ¥ and kr are grandfathered).
  // Where the native sign is shared ($, £, Rs …) we use a prefixed or
  // code-style symbol, same as the existing A$/C$/S$/CHF entries.
  { symbol: '؋', code: 'AFN', name: 'Afghan Afghani' },
  { symbol: 'Lek', code: 'ALL', name: 'Albanian Lek' },
  { symbol: '֏', code: 'AMD', name: 'Armenian Dram' },
  { symbol: 'NAƒ', code: 'ANG', name: 'Netherlands Antillean Guilder' },
  { symbol: 'Kz', code: 'AOA', name: 'Angolan Kwanza' },
  { symbol: 'AR$', code: 'ARS', name: 'Argentine Peso' },
  { symbol: 'Aƒ', code: 'AWG', name: 'Aruban Florin' },
  { symbol: '₼', code: 'AZN', name: 'Azerbaijani Manat' },
  { symbol: 'KM', code: 'BAM', name: 'Bosnian Convertible Mark' },
  { symbol: 'Bds$', code: 'BBD', name: 'Barbadian Dollar' },
  { symbol: '৳', code: 'BDT', name: 'Bangladeshi Taka' },
  { symbol: 'лв', code: 'BGN', name: 'Bulgarian Lev' },
  { symbol: 'BD', code: 'BHD', name: 'Bahraini Dinar' },
  { symbol: 'FBu', code: 'BIF', name: 'Burundian Franc' },
  { symbol: 'BD$', code: 'BMD', name: 'Bermudian Dollar' },
  { symbol: 'BN$', code: 'BND', name: 'Brunei Dollar' },
  { symbol: 'Bs', code: 'BOB', name: 'Bolivian Boliviano' },
  { symbol: 'B$', code: 'BSD', name: 'Bahamian Dollar' },
  { symbol: 'Nu.', code: 'BTN', name: 'Bhutanese Ngultrum' },
  { symbol: 'P', code: 'BWP', name: 'Botswana Pula' },
  { symbol: 'Br', code: 'BYN', name: 'Belarusian Ruble' },
  { symbol: 'BZ$', code: 'BZD', name: 'Belize Dollar' },
  { symbol: 'FC', code: 'CDF', name: 'Congolese Franc' },
  { symbol: 'CL$', code: 'CLP', name: 'Chilean Peso' },
  { symbol: 'CO$', code: 'COP', name: 'Colombian Peso' },
  { symbol: '₡', code: 'CRC', name: 'Costa Rican Colon' },
  { symbol: 'CU$', code: 'CUP', name: 'Cuban Peso' },
  { symbol: 'Esc', code: 'CVE', name: 'Cape Verdean Escudo' },
  { symbol: 'Fdj', code: 'DJF', name: 'Djiboutian Franc' },
  { symbol: 'RD$', code: 'DOP', name: 'Dominican Peso' },
  { symbol: 'DA', code: 'DZD', name: 'Algerian Dinar' },
  { symbol: 'Nfk', code: 'ERN', name: 'Eritrean Nakfa' },
  { symbol: 'Birr', code: 'ETB', name: 'Ethiopian Birr' },
  { symbol: 'FJ$', code: 'FJD', name: 'Fijian Dollar' },
  { symbol: 'FK£', code: 'FKP', name: 'Falkland Islands Pound' },
  { symbol: 'fkr', code: 'FOK', name: 'Faroese Krona' },
  { symbol: '₾', code: 'GEL', name: 'Georgian Lari' },
  { symbol: 'GG£', code: 'GGP', name: 'Guernsey Pound' },
  { symbol: 'GH₵', code: 'GHS', name: 'Ghanaian Cedi' },
  { symbol: 'GI£', code: 'GIP', name: 'Gibraltar Pound' },
  { symbol: 'D', code: 'GMD', name: 'Gambian Dalasi' },
  { symbol: 'FG', code: 'GNF', name: 'Guinean Franc' },
  { symbol: 'Q', code: 'GTQ', name: 'Guatemalan Quetzal' },
  { symbol: 'GY$', code: 'GYD', name: 'Guyanese Dollar' },
  { symbol: 'HK$', code: 'HKD', name: 'Hong Kong Dollar' },
  { symbol: 'L', code: 'HNL', name: 'Honduran Lempira' },
  { symbol: 'G', code: 'HTG', name: 'Haitian Gourde' },
  { symbol: 'Rp', code: 'IDR', name: 'Indonesian Rupiah' },
  { symbol: 'IM£', code: 'IMP', name: 'Isle of Man Pound' },
  { symbol: 'ع.د', code: 'IQD', name: 'Iraqi Dinar' },
  { symbol: 'IRR', code: 'IRR', name: 'Iranian Rial' },
  { symbol: 'Ikr', code: 'ISK', name: 'Icelandic Krona' },
  { symbol: 'JE£', code: 'JEP', name: 'Jersey Pound' },
  { symbol: 'J$', code: 'JMD', name: 'Jamaican Dollar' },
  { symbol: 'KSh', code: 'KES', name: 'Kenyan Shilling' },
  { symbol: 'KGS', code: 'KGS', name: 'Kyrgyzstani Som' },
  { symbol: '៛', code: 'KHR', name: 'Cambodian Riel' },
  { symbol: 'KI$', code: 'KID', name: 'Kiribati Dollar' },
  { symbol: 'CF', code: 'KMF', name: 'Comorian Franc' },
  { symbol: 'KD', code: 'KWD', name: 'Kuwaiti Dinar' },
  { symbol: 'CI$', code: 'KYD', name: 'Cayman Islands Dollar' },
  { symbol: '₸', code: 'KZT', name: 'Kazakhstani Tenge' },
  { symbol: '₭', code: 'LAK', name: 'Lao Kip' },
  { symbol: 'LL', code: 'LBP', name: 'Lebanese Pound' },
  { symbol: 'Rs', code: 'LKR', name: 'Sri Lankan Rupee' },
  { symbol: 'L$', code: 'LRD', name: 'Liberian Dollar' },
  { symbol: 'M', code: 'LSL', name: 'Lesotho Loti' },
  { symbol: 'LD', code: 'LYD', name: 'Libyan Dinar' },
  { symbol: 'DH', code: 'MAD', name: 'Moroccan Dirham' },
  { symbol: 'MDL', code: 'MDL', name: 'Moldovan Leu' },
  { symbol: 'Ar', code: 'MGA', name: 'Malagasy Ariary' },
  { symbol: 'ден', code: 'MKD', name: 'Macedonian Denar' },
  { symbol: 'Ks', code: 'MMK', name: 'Myanmar Kyat' },
  { symbol: '₮', code: 'MNT', name: 'Mongolian Tugrik' },
  { symbol: 'MOP$', code: 'MOP', name: 'Macanese Pataca' },
  { symbol: 'UM', code: 'MRU', name: 'Mauritanian Ouguiya' },
  { symbol: 'MRs', code: 'MUR', name: 'Mauritian Rupee' },
  { symbol: 'Rf', code: 'MVR', name: 'Maldivian Rufiyaa' },
  { symbol: 'MK', code: 'MWK', name: 'Malawian Kwacha' },
  { symbol: 'MX$', code: 'MXN', name: 'Mexican Peso' },
  { symbol: 'MT', code: 'MZN', name: 'Mozambican Metical' },
  { symbol: 'N$', code: 'NAD', name: 'Namibian Dollar' },
  { symbol: '₦', code: 'NGN', name: 'Nigerian Naira' },
  { symbol: 'NIO', code: 'NIO', name: 'Nicaraguan Cordoba' },
  { symbol: 'रू', code: 'NPR', name: 'Nepalese Rupee' },
  { symbol: 'NZ$', code: 'NZD', name: 'New Zealand Dollar' },
  { symbol: 'RO', code: 'OMR', name: 'Omani Rial' },
  { symbol: 'B/.', code: 'PAB', name: 'Panamanian Balboa' },
  { symbol: 'S/', code: 'PEN', name: 'Peruvian Sol' },
  { symbol: 'K', code: 'PGK', name: 'Papua New Guinean Kina' },
  { symbol: '₱', code: 'PHP', name: 'Philippine Peso' },
  { symbol: '₨', code: 'PKR', name: 'Pakistani Rupee' },
  { symbol: '₲', code: 'PYG', name: 'Paraguayan Guarani' },
  { symbol: 'QR', code: 'QAR', name: 'Qatari Riyal' },
  { symbol: 'дин', code: 'RSD', name: 'Serbian Dinar' },
  { symbol: 'FRw', code: 'RWF', name: 'Rwandan Franc' },
  { symbol: 'SI$', code: 'SBD', name: 'Solomon Islands Dollar' },
  { symbol: 'SRs', code: 'SCR', name: 'Seychellois Rupee' },
  { symbol: 'SDG', code: 'SDG', name: 'Sudanese Pound' },
  { symbol: 'SH£', code: 'SHP', name: 'Saint Helena Pound' },
  { symbol: 'Le', code: 'SLE', name: 'Sierra Leonean Leone' },
  { symbol: 'Sh.So.', code: 'SOS', name: 'Somali Shilling' },
  { symbol: 'Sr$', code: 'SRD', name: 'Surinamese Dollar' },
  { symbol: 'SS£', code: 'SSP', name: 'South Sudanese Pound' },
  { symbol: 'Db', code: 'STN', name: 'Sao Tome and Principe Dobra' },
  { symbol: '£S', code: 'SYP', name: 'Syrian Pound' },
  { symbol: 'E', code: 'SZL', name: 'Eswatini Lilangeni' },
  { symbol: 'SM', code: 'TJS', name: 'Tajikistani Somoni' },
  { symbol: 'TMT', code: 'TMT', name: 'Turkmenistani Manat' },
  { symbol: 'DT', code: 'TND', name: 'Tunisian Dinar' },
  { symbol: 'T$', code: 'TOP', name: 'Tongan Paanga' },
  { symbol: 'TT$', code: 'TTD', name: 'Trinidad and Tobago Dollar' },
  { symbol: 'TV$', code: 'TVD', name: 'Tuvaluan Dollar' },
  { symbol: 'NT$', code: 'TWD', name: 'New Taiwan Dollar' },
  { symbol: 'TSh', code: 'TZS', name: 'Tanzanian Shilling' },
  { symbol: 'USh', code: 'UGX', name: 'Ugandan Shilling' },
  { symbol: '$U', code: 'UYU', name: 'Uruguayan Peso' },
  { symbol: "so'm", code: 'UZS', name: 'Uzbekistani Som' },
  { symbol: 'Bs.S', code: 'VES', name: 'Venezuelan Bolivar' },
  { symbol: '₫', code: 'VND', name: 'Vietnamese Dong' },
  { symbol: 'VT', code: 'VUV', name: 'Vanuatu Vatu' },
  { symbol: 'WS$', code: 'WST', name: 'Samoan Tala' },
  { symbol: 'FCFA', code: 'XAF', name: 'Central African CFA Franc' },
  { symbol: 'EC$', code: 'XCD', name: 'East Caribbean Dollar' },
  { symbol: 'Cg', code: 'XCG', name: 'Caribbean Guilder' },
  { symbol: 'CFA', code: 'XOF', name: 'West African CFA Franc' },
  { symbol: '₣', code: 'XPF', name: 'CFP Franc' },
  { symbol: 'YR', code: 'YER', name: 'Yemeni Rial' },
  { symbol: 'ZK', code: 'ZMW', name: 'Zambian Kwacha' },
  { symbol: 'ZiG', code: 'ZWG', name: 'Zimbabwe Gold' },
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
