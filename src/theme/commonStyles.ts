// src/theme/commonStyles.ts
// Shared style factories — call inside createStyles() / component body, not at module level.
// Each function reads i18n state at call time so RTL/LTR is always current.
import i18n from '../i18n';
import { colors } from './colors';

type StyleOverrides = Record<string, any>;

export const fieldLabel = (overrides?: StyleOverrides) => ({
  color: colors.textDim,
  fontSize: 12,
  fontWeight: '700',
  letterSpacing: 0.5,
  marginBottom: 6,
  marginTop: 4,
  textAlign: i18n.textAlign(),
  alignSelf: 'stretch',
  ...overrides,
});

export const textInput = (overrides?: StyleOverrides) => ({
  backgroundColor: colors.card,
  borderRadius: 14,
  padding: 14,
  color: colors.text,
  fontSize: 16,
  marginBottom: 12,
  borderWidth: 1,
  borderColor: colors.cardBorder,
  textAlign: i18n.textAlign(),
  ...overrides,
});

export const amountRow = (overrides?: StyleOverrides) => ({
  flexDirection: i18n.row(),
  alignItems: 'center',
  marginBottom: 16,
  ...overrides,
});

export const amountCurrency = (overrides?: StyleOverrides) => ({
  fontSize: 32,
  fontWeight: '700',
  marginEnd: 8,
  ...overrides,
});

export const amountInput = (overrides?: StyleOverrides) => ({
  flex: 1,
  color: colors.text,
  fontSize: 32,
  fontWeight: '700',
  textAlign: i18n.textAlign(),
  ...overrides,
});
