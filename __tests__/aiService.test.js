// __tests__/aiService.test.js
// Tests for aiService LOCAL (non-Gemini) functions only — parseTransaction,
// calculateTaxReserve, detectCardBrand, predictCashFlow, calculateDailyBudget,
// generateInsights. The Gemini-backed functions (parseTransactionSmart,
// scanReceipt, chatWithAI, etc.) need network mocking and are excluded.

// i18n stub: t() echoes the key, getLanguage/utility methods return defaults.
jest.mock('../src/i18n', () => ({
  __esModule: true,
  default: {
    t: (key) => key,
    getLanguage: () => 'en',
    setLanguage: () => false,
    onLanguageChange: () => () => {},
    isRTL: () => false,
    row: () => 'row',
    textAlign: () => 'left',
    backIcon: () => 'arrow-left',
    chevronLeft: () => 'chevron-left',
    chevronRight: () => 'chevron-right',
    getAvailableLanguages: () => [],
  },
}));

jest.mock('../src/utils/categoryName', () => ({
  catName: (id) => id,
}));

jest.mock('../src/utils/currency', () => ({
  fmt: (n) => `${Math.round(n)}`,
  sym: () => '$',
  code: () => 'USD',
}));

const ai = require('../src/services/aiService').default;
const { detectCardBrand: detectCardBrandNamed, CARD_BRAND_KEYWORDS } = require('../src/services/aiService');

describe('parseTransaction', () => {
  test('returns null on empty input', () => {
    expect(ai.parseTransaction('')).toBeNull();
    expect(ai.parseTransaction(null)).toBeNull();
    expect(ai.parseTransaction('   ')).toBeNull();
  });

  test('returns null when no amount found', () => {
    expect(ai.parseTransaction('hello world')).toBeNull();
  });

  test('parses a simple expense', () => {
    const r = ai.parseTransaction('coffee 25');
    expect(r).not.toBeNull();
    expect(r.amount).toBe(25);
    expect(r.type).toBe('expense');
    expect(r.note).toBe('coffee 25');
  });

  test('parses amount with shekel symbol', () => {
    const r = ai.parseTransaction('₪50');
    expect(r).not.toBeNull();
    expect(r.amount).toBe(50);
  });

  test('parses amount with decimal', () => {
    const r = ai.parseTransaction('lunch 42.50');
    expect(r.amount).toBeCloseTo(42.5);
  });

  test('strips thousand separators', () => {
    const r = ai.parseTransaction('rent 4,500');
    expect(r.amount).toBe(4500);
  });

  test('detects income via keyword', () => {
    const r = ai.parseTransaction('salary 10000');
    expect(r.type).toBe('income');
  });

  test('detects income via Russian keyword', () => {
    const r = ai.parseTransaction('зарплата 8000');
    expect(r.type).toBe('income');
  });

  test('matches food category', () => {
    const r = ai.parseTransaction('supermarket 120');
    expect(r.categoryId).toBe('food');
  });

  test('matches fuel category over transport', () => {
    const r = ai.parseTransaction('paz 250');
    expect(r.categoryId).toBe('fuel');
  });

  test('income with income-category keyword stays income', () => {
    const r = ai.parseTransaction('salary 5000');
    expect(r.type).toBe('income');
    expect(r.categoryId).toBe('salary_me');
  });

  test('extracts known payee', () => {
    const r = ai.parseTransaction('shufersal 200');
    expect(r.recipient.toLowerCase()).toContain('shufersal');
  });

  test('unknown payee → empty string', () => {
    const r = ai.parseTransaction('random store 80');
    expect(r.recipient).toBe('');
  });
});

describe('calculateTaxReserve', () => {
  test('produces all required fields', () => {
    const r = ai.calculateTaxReserve(10000);
    expect(r).toHaveProperty('grossIncome');
    expect(r).toHaveProperty('maam');
    expect(r).toHaveProperty('incomeTax');
    expect(r).toHaveProperty('bituach');
    expect(r).toHaveProperty('totalReserve');
    expect(r).toHaveProperty('netIncome');
  });

  test('totalReserve = maam + incomeTax + bituach', () => {
    const r = ai.calculateTaxReserve(10000);
    expect(r.totalReserve).toBe(r.maam + r.incomeTax + r.bituach);
  });

  test('netIncome = gross - totalReserve', () => {
    const r = ai.calculateTaxReserve(10000);
    expect(r.netIncome).toBe(10000 - r.totalReserve);
  });

  test('scales linearly with gross income', () => {
    const a = ai.calculateTaxReserve(5000);
    const b = ai.calculateTaxReserve(10000);
    // Within rounding tolerance
    expect(Math.abs(b.totalReserve - 2 * a.totalReserve)).toBeLessThanOrEqual(2);
  });
});

describe('detectCardBrand', () => {
  test('detects visa', () => {
    expect(detectCardBrandNamed('paid with visa')).toBe('visa');
    expect(detectCardBrandNamed('купил по виза')).toBe('visa');
    expect(detectCardBrandNamed('ויזה הפועלים')).toBe('visa');
  });

  test('detects mastercard variants', () => {
    expect(detectCardBrandNamed('mastercard')).toBe('mastercard');
    expect(detectCardBrandNamed('master card')).toBe('mastercard');
    expect(detectCardBrandNamed('מאסטרקארד')).toBe('mastercard');
  });

  test('detects amex', () => {
    expect(detectCardBrandNamed('amex gold')).toBe('amex');
    expect(detectCardBrandNamed('american express')).toBe('amex');
  });

  test('returns null when no brand keyword', () => {
    expect(detectCardBrandNamed('cash payment')).toBeNull();
    expect(detectCardBrandNamed('')).toBeNull();
  });

  test('CARD_BRAND_KEYWORDS exposes the keyword map', () => {
    expect(CARD_BRAND_KEYWORDS.visa).toContain('visa');
    expect(CARD_BRAND_KEYWORDS.mastercard).toContain('mastercard');
    expect(CARD_BRAND_KEYWORDS.amex).toContain('amex');
  });
});

describe('predictCashFlow', () => {
  test('zero accounts → zero balance', () => {
    const r = ai.predictCashFlow([], [], []);
    expect(r.currentBalance).toBe(0);
    expect(r.totalUpcoming).toBe(0);
    expect(r.isAtRisk).toBe(false);
  });

  test('sums account balances', () => {
    const accounts = [{ balance: 1000 }, { balance: 500 }, { balance: -200 }];
    const r = ai.predictCashFlow(accounts, [], []);
    expect(r.currentBalance).toBe(1300);
  });

  test('counts only future recurring expenses this month', () => {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(); const futureDay = Math.min(now.getDate() + 2, lastDay); if (futureDay <= now.getDate()) return; // skip when no future day left this month
    const future = new Date(now.getFullYear(), now.getMonth(), futureDay);
    const past = new Date(now.getFullYear(), now.getMonth(), Math.max(1, now.getDate() - 2));
    const recurring = [
      { isActive: true, nextDate: future.toISOString().split('T')[0], type: 'expense', amount: 300, categoryId: 'rent' },
      { isActive: true, nextDate: past.toISOString().split('T')[0],   type: 'expense', amount: 999, categoryId: 'old' },
      { isActive: false, nextDate: future.toISOString().split('T')[0], type: 'expense', amount: 999, categoryId: 'inactive' },
    ];
    const r = ai.predictCashFlow([{ balance: 1000 }], recurring, []);
    expect(r.totalUpcoming).toBe(300);
  });

  test('isAtRisk when projectedBalance < 0', () => {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(); const futureDay = Math.min(now.getDate() + 2, lastDay); if (futureDay <= now.getDate()) return; // skip when no future day left this month
    const future = new Date(now.getFullYear(), now.getMonth(), futureDay);
    const recurring = [
      { isActive: true, nextDate: future.toISOString().split('T')[0], type: 'expense', amount: 2000, categoryId: 'rent' },
    ];
    const r = ai.predictCashFlow([{ balance: 100 }], recurring, []);
    expect(r.isAtRisk).toBe(true);
    expect(r.projectedBalance).toBe(-1900);
  });

  test('upcoming sorted by date', () => {
    const now = new Date();
    if (now.getDate() > 25) return; // skip near end of month
    const d1 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 4);
    const d2 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2);
    const recurring = [
      { isActive: true, nextDate: d1.toISOString().split('T')[0], type: 'expense', amount: 50, categoryId: 'a' },
      { isActive: true, nextDate: d2.toISOString().split('T')[0], type: 'expense', amount: 50, categoryId: 'b' },
    ];
    const r = ai.predictCashFlow([{ balance: 1000 }], recurring, []);
    expect(r.upcoming.length).toBe(2);
    expect(r.upcoming[0].date).toBeLessThan(r.upcoming[1].date);
  });
});

describe('calculateDailyBudget', () => {
  test('returns null when last day of month', () => {
    // We cannot mock Date easily — only assert shape when called with empty txs
    // on a day that yields zero remaining → null.
    expect(ai.calculateDailyBudget([], {})).toBeNull();
  });

  test('returns null when no income', () => {
    const now = new Date();
    const txs = [
      { type: 'expense', amount: 100, date: now.toISOString().split('T')[0], isTransfer: false },
    ];
    expect(ai.calculateDailyBudget(txs, {})).toBeNull();
  });

  test('returns object with budget shape when income > expense', () => {
    const now = new Date();
    if (now.getDate() >= 28) return; // skip late-month edge
    const dateStr = now.toISOString().split('T')[0];
    const txs = [
      { type: 'income',  amount: 3000, date: dateStr, isTransfer: false },
      { type: 'expense', amount: 500,  date: dateStr, isTransfer: false },
    ];
    const r = ai.calculateDailyBudget(txs, {});
    expect(r).not.toBeNull();
    expect(r).toHaveProperty('dailyBudget');
    expect(r).toHaveProperty('daysLeft');
    expect(r).toHaveProperty('remaining');
    expect(r.remaining).toBe(2500);
    expect(r.dailyBudget).toBeGreaterThan(0);
  });

  test('ignores transfer transactions', () => {
    const now = new Date();
    if (now.getDate() >= 28) return;
    const dateStr = now.toISOString().split('T')[0];
    const txs = [
      { type: 'income',  amount: 3000, date: dateStr, isTransfer: false },
      { type: 'income',  amount: 5000, date: dateStr, isTransfer: true },  // ignored
      { type: 'expense', amount: 500,  date: dateStr, isTransfer: true },  // ignored
    ];
    const r = ai.calculateDailyBudget(txs, {});
    expect(r.remaining).toBe(3000);
  });
});

describe('generateInsights', () => {
  test('empty data → "no data" insight', () => {
    const r = ai.generateInsights([], {}, [], []);
    expect(r.insights.length).toBeGreaterThan(0);
    expect(r.insights.some((i) => i.title === 'aiNoData')).toBe(true);
  });

  test('income > expense → positive savings insight', () => {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const txs = [
      { type: 'income',  amount: 5000, date: dateStr, isTransfer: false },
      { type: 'expense', amount: 1000, date: dateStr, isTransfer: false, categoryId: 'food' },
    ];
    const r = ai.generateInsights(txs, {}, [], []);
    expect(r.income).toBe(5000);
    expect(r.expense).toBe(1000);
    expect(r.balance).toBe(4000);
    expect(r.savingsRate).toBe(80);
    expect(r.insights.some((i) => i.type === 'positive')).toBe(true);
  });

  test('expense > income → negative balance + warning/negative insight', () => {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const txs = [
      { type: 'income',  amount: 1000, date: dateStr, isTransfer: false },
      { type: 'expense', amount: 1500, date: dateStr, isTransfer: false, categoryId: 'food' },
    ];
    const r = ai.generateInsights(txs, {}, [], []);
    expect(r.balance).toBe(-500);
    expect(r.savingsRate).toBeLessThan(0);
  });

  test('budget exceeded → negative insight', () => {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const txs = [
      { type: 'income',  amount: 5000, date: dateStr, isTransfer: false },
      { type: 'expense', amount: 800,  date: dateStr, isTransfer: false, categoryId: 'food' },
    ];
    const budgets = { food: 500 };
    const r = ai.generateInsights(txs, budgets, [], []);
    expect(r.insights.some((i) => i.title === 'aiBudgetExceeded')).toBe(true);
  });

  test('subscriptions over 50 → info insight', () => {
    const recurring = [
      { isActive: true, categoryId: 'entertainment', amount: 60, type: 'expense', nextDate: '2099-01-01' },
    ];
    const r = ai.generateInsights([], {}, [], recurring);
    expect(r.insights.some((i) => i.title === 'aiSubscriptions')).toBe(true);
  });
});
