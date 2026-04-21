// src/theme/colors.js
// Мутируемый объект — applyTheme() меняет все свойства на месте

const darkColors = {
  bg: '#0a0e1a',
  bg2: '#0f1424',
  card: '#151c2f',
  cardBorder: 'rgba(52, 211, 153, 0.15)',
  cardHighlight: 'rgba(52, 211, 153, 0.06)',

  green: '#34d399',
  greenDark: '#059669',
  greenGlow: 'rgba(52, 211, 153, 0.15)',
  greenSoft: 'rgba(52, 211, 153, 0.08)',
  teal: '#2dd4bf',
  emerald: '#10b981',

  red: '#fb7185',
  redDark: '#e11d48',
  redSoft: 'rgba(251, 113, 133, 0.10)',
  orange: '#fb923c',
  yellow: '#fbbf24',
  blue: '#60a5fa',
  blueSoft: 'rgba(96,165,250,0.10)',

  text: '#f1f5f9',
  textSecondary: '#cbd5e1',
  textDim: '#94a3b8',
  textMuted: '#64748b',

  white: '#ffffff',
  black: '#000000',
  divider: 'rgba(255, 255, 255, 0.04)',
  overlay: 'rgba(0, 0, 0, 0.80)',
};

// AMOLED — pure black backgrounds for OLED battery savings.
// Accent palette mirrors dark; only bg/card/divider swap to true black.
const amoledColors = {
  bg: '#000000',
  bg2: '#0a0a0a',
  card: '#101010',
  cardBorder: 'rgba(52, 211, 153, 0.18)',
  cardHighlight: 'rgba(52, 211, 153, 0.06)',

  green: '#34d399',
  greenDark: '#059669',
  greenGlow: 'rgba(52, 211, 153, 0.15)',
  greenSoft: 'rgba(52, 211, 153, 0.08)',
  teal: '#2dd4bf',
  emerald: '#10b981',

  red: '#fb7185',
  redDark: '#e11d48',
  redSoft: 'rgba(251, 113, 133, 0.10)',
  orange: '#fb923c',
  yellow: '#fbbf24',
  blue: '#60a5fa',
  blueSoft: 'rgba(96, 165, 250, 0.10)',

  text: '#f1f5f9',
  textSecondary: '#cbd5e1',
  textDim: '#94a3b8',
  textMuted: '#64748b',

  white: '#ffffff',
  black: '#000000',
  divider: 'rgba(255, 255, 255, 0.05)',
  overlay: 'rgba(0, 0, 0, 0.90)',
};

const lightColors = {
  bg: '#eef0f5',
  bg2: '#e4e7ee',
  card: '#f7f8fb',
  cardBorder: 'rgba(0, 0, 0, 0.07)',
  cardHighlight: 'rgba(5, 150, 105, 0.10)',

  green: '#059669',
  greenDark: '#047857',
  greenGlow: 'rgba(5, 150, 105, 0.15)',
  greenSoft: 'rgba(5, 150, 105, 0.12)',
  teal: '#0d9488',
  emerald: '#059669',

  red: '#dc2626',
  redDark: '#b91c1c',
  redSoft: 'rgba(220, 38, 38, 0.12)',
  orange: '#ea580c',
  yellow: '#ca8a04',
  blue: '#2563eb',
  blueSoft: 'rgba(37, 99, 235, 0.10)',

  text: '#1a1e2e',
  textSecondary: '#3b4055',
  textDim: '#5c6478',
  textMuted: '#8891a5',

  white: '#ffffff',
  black: '#000000',
  divider: 'rgba(0, 0, 0, 0.08)',
  overlay: 'rgba(0, 0, 0, 0.40)',
};

// Мутируемый объект — все экраны импортируют его
export const colors = { ...darkColors };

// Текущая тема
let _currentTheme = 'dark';

export function applyTheme(mode) {
  _currentTheme = mode;
  const palette = mode === 'light' ? lightColors : mode === 'amoled' ? amoledColors : darkColors;
  Object.assign(colors, palette);
}

export function getCurrentTheme() {
  return _currentTheme;
}

// Категории транзакций — Feather icons (не зависят от темы)
export const categoryConfig = {
  food:           { icon: 'shopping-cart', color: '#fb7185' },
  restaurant:     { icon: 'coffee',        color: '#f97316' },
  transport:      { icon: 'navigation',    color: '#fb923c' },
  fuel:           { icon: 'droplet',       color: '#f59e0b' },
  health:         { icon: 'heart',         color: '#f472b6' },
  phone:          { icon: 'smartphone',    color: '#a78bfa' },
  utilities:      { icon: 'zap',           color: '#60a5fa' },
  clothing:       { icon: 'shopping-bag',  color: '#c084fc' },
  household:      { icon: 'home',          color: '#818cf8' },
  kids:           { icon: 'smile',         color: '#fb7185' },
  entertainment:  { icon: 'film',          color: '#22d3ee' },
  education:      { icon: 'book-open',     color: '#2dd4bf' },
  cosmetics:      { icon: 'scissors',      color: '#ec4899' },
  electronics:    { icon: 'cpu',           color: '#3b82f6' },
  insurance:      { icon: 'shield',        color: '#fbbf24' },
  rent:           { icon: 'key',           color: '#f87171' },
  arnona:         { icon: 'map-pin',       color: '#ef4444' },
  vaad:           { icon: 'users',         color: '#dc2626' },
  other:          { icon: 'more-horizontal', color: '#64748b' },
  salary_me:      { icon: 'briefcase',     color: '#34d399' },
  salary_spouse:  { icon: 'briefcase',     color: '#10b981' },
  rental_income:  { icon: 'home',          color: '#059669' },
  handyman:       { icon: 'tool',          color: '#2dd4bf' },
  sales:          { icon: 'package',       color: '#6ee7b7' },
  other_income:   { icon: 'plus-circle',   color: '#a7f3d0' },
  transfer:       { icon: 'repeat',        color: '#60a5fa' },
};

// Типы счетов — MaterialCommunityIcons
export const accountTypeConfig = {
  bank:       { icon: 'bank-outline',          color: '#60a5fa' },
  credit:     { icon: 'credit-card-outline',   color: '#a78bfa' },
  cash:       { icon: 'wallet-outline',        color: '#34d399' },
  mortgage:   { icon: 'home-city-outline',     color: '#ef4444' },
  loan:       { icon: 'hand-coin-outline',     color: '#ec4899' },
  investment: { icon: 'chart-line',            color: '#2dd4bf' },
  debt:       { icon: 'account-arrow-right-outline', color: '#f59e0b' },
  crypto:     { icon: 'bitcoin',               color: '#eab308' },
  asset:      { icon: 'office-building',       color: '#06b6d4' },
};
