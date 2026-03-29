// src/utils/currency.js
// Глобальный символ валюты — загружается из settings при старте

let _symbol = '₪';
let _code = 'ILS';

const CURRENCIES = [
  { symbol: '₪', code: 'ILS', name: 'Israeli Shekel' },
  { symbol: '$', code: 'USD', name: 'US Dollar' },
  { symbol: '€', code: 'EUR', name: 'Euro' },
  { symbol: '£', code: 'GBP', name: 'British Pound' },
  { symbol: '₽', code: 'RUB', name: 'Russian Ruble' },
  { symbol: '₴', code: 'UAH', name: 'Ukrainian Hryvnia' },
  { symbol: 'CHF', code: 'CHF', name: 'Swiss Franc' },
  { symbol: '¥', code: 'JPY', name: 'Japanese Yen' },
  { symbol: '¥', code: 'CNY', name: 'Chinese Yuan' },
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

// Примерные курсы к ILS (обновлять вручную или через API)
const RATES_TO_ILS = {
  ILS: 1,
  USD: 3.65,
  EUR: 4.05,
  GBP: 4.65,
  CZK: 0.16,
};

export function setCurrency(symbol, code) {
  _symbol = symbol;
  _code = code || CURRENCIES.find(c => c.symbol === symbol)?.code || 'ILS';
}

export function sym() {
  return _symbol;
}

export function code() {
  return _code;
}

export function fmtNum(amount) {
  return Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmt(amount) {
  return `${fmtNum(amount)} ${_symbol}`;
}

export function fmtSigned(amount, type) {
  const sign = type === 'income' ? '+' : type === 'expense' ? '-' : '';
  return `${sign}${fmtNum(amount)} ${_symbol}`;
}

// Конвертация между валютами
export function convert(amount, fromCode, toCode) {
  if (fromCode === toCode) return amount;
  const fromRate = RATES_TO_ILS[fromCode] || 1;
  const toRate = RATES_TO_ILS[toCode] || 1;
  return Math.round((amount * fromRate / toRate) * 100) / 100;
}

export function getRate(fromCode, toCode) {
  const fromRate = RATES_TO_ILS[fromCode] || 1;
  const toRate = RATES_TO_ILS[toCode] || 1;
  return fromRate / toRate;
}

export { CURRENCIES, RATES_TO_ILS };
