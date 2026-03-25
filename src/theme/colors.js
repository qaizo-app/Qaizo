// src/theme/colors.js
// Исправлены иконки — используем MaterialCommunityIcons для счетов

export const colors = {
  bg: '#0a0e1a',
  bg2: '#0f1424',
  card: '#151c2f',
  cardBorder: 'rgba(52, 211, 153, 0.10)',
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

// Категории транзакций — Feather icons (все проверены)
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

// Типы счетов — MaterialCommunityIcons (все проверены, нет знаков вопроса)
export const accountTypeConfig = {
  bank:       { icon: 'bank-outline',          color: '#60a5fa' },
  credit:     { icon: 'credit-card-outline',   color: '#a78bfa' },
  cash:       { icon: 'wallet-outline',        color: '#34d399' },
  mortgage:   { icon: 'home-city-outline',     color: '#f87171' },
  loan:       { icon: 'hand-coin-outline',     color: '#fb923c' },
  investment: { icon: 'chart-line',            color: '#2dd4bf' },
  debt:       { icon: 'account-arrow-right-outline', color: '#f59e0b' },
  crypto:     { icon: 'bitcoin',               color: '#f59e0b' },
};