// src/utils/currency.js
// Глобальный символ валюты — загружается из settings при старте

let _symbol = '₪';
let _code = 'ILS';

const CURRENCIES = [
  { symbol: '₪', code: 'ILS', name: 'Israeli Shekel' },
  { symbol: '$', code: 'USD', name: 'US Dollar' },
  { symbol: '€', code: 'EUR', name: 'Euro' },
  { symbol: '£', code: 'GBP', name: 'British Pound' },
  { symbol: 'Kč', code: 'CZK', name: 'Czech Koruna' },
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

export function fmt(amount) {
  return `${_symbol}${Math.abs(amount).toLocaleString()}`;
}

export function fmtSigned(amount, type) {
  const sign = type === 'income' ? '+' : type === 'expense' ? '-' : '';
  return `${sign}${_symbol}${Math.abs(amount).toLocaleString()}`;
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
