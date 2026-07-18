const { resolveAccount, detectCardBrand } = require('../src/services/ai/accountResolver');

const accounts = [
  { id: 'visa1', name: 'Visa Hapoalim', type: 'credit' },
  { id: 'visa2', name: 'Виза Леуми', type: 'credit' },
  { id: 'mc1', name: 'Mastercard Max', type: 'credit' },
  { id: 'cash1', name: 'Наличные', type: 'cash' },
  { id: 'bank1', name: 'Банк Апоалим', type: 'bank' },
];
const tx = (account, categoryId, date, type = 'expense') => ({ account, categoryId, type, date });

describe('cascade order', () => {
  test('1: explicit ai accountId wins over everything', () => {
    const r = resolveAccount({ text: 'кофе визой 20', aiAccountId: 'cash1', accounts, transactions: [] });
    expect(r).toEqual({ account: 'cash1', reason: 'explicit' });
  });

  test('2: brand keyword, single match', () => {
    const r = resolveAccount({ text: 'кофе мастеркард 20', accounts, transactions: [] });
    expect(r).toEqual({ account: 'mc1', reason: 'brand' });
  });

  test('2: brand with two matches → most recently used of them', () => {
    const transactions = [
      tx('visa2', 'food', '2026-07-10'),
      tx('visa1', 'food', '2026-07-01'),
    ];
    const r = resolveAccount({ text: 'продукты виза 100', accounts, transactions });
    expect(r).toEqual({ account: 'visa2', reason: 'brand' });
  });

  test('3: generic type from AI → last used of that type', () => {
    const transactions = [
      tx('mc1', 'food', '2026-07-11'),
      tx('visa1', 'food', '2026-07-12'),
    ];
    const r = resolveAccount({ text: 'кофе кредиткой 20', aiAccountType: 'credit', accounts, transactions });
    expect(r).toEqual({ account: 'visa1', reason: 'type' });
  });

  test('4: nothing said → category habit (≥3 tx, ≥60% one account)', () => {
    const transactions = [
      tx('visa1', 'restaurant', '2026-07-01'),
      tx('visa1', 'restaurant', '2026-06-20'),
      tx('visa1', 'restaurant', '2026-06-10'),
      tx('cash1', 'restaurant', '2026-05-10'),
      tx('bank1', 'food', '2026-07-12'),
    ];
    const r = resolveAccount({ text: 'кофе 20', categoryId: 'restaurant', txType: 'expense', accounts, transactions });
    expect(r).toEqual({ account: 'visa1', reason: 'habit' });
  });

  test('4→5: habit below 60% falls to overall most recent', () => {
    const transactions = [
      tx('visa1', 'restaurant', '2026-07-01'),
      tx('cash1', 'restaurant', '2026-06-20'),
      tx('visa1', 'restaurant', '2026-06-10'),
      tx('cash1', 'restaurant', '2026-05-10'),   // 2/4 = 50% → no habit
      tx('bank1', 'food', '2026-07-12'),          // most recent overall
    ];
    const r = resolveAccount({ text: 'кофе 20', categoryId: 'restaurant', txType: 'expense', accounts, transactions });
    expect(r).toEqual({ account: 'bank1', reason: 'recent' });
  });

  test('4: habit needs ≥3 transactions (2 of 2 is not enough)', () => {
    const transactions = [
      tx('visa1', 'restaurant', '2026-07-01'),
      tx('visa1', 'restaurant', '2026-06-20'),
      tx('bank1', 'food', '2026-07-12'),
    ];
    const r = resolveAccount({ text: 'кофе 20', categoryId: 'restaurant', txType: 'expense', accounts, transactions });
    expect(r).toEqual({ account: 'bank1', reason: 'recent' });
  });

  test('5: fresh install → none', () => {
    const r = resolveAccount({ text: 'кофе 20', accounts, transactions: [] });
    expect(r).toEqual({ account: null, reason: 'none' });
  });

  test('habit ignores transactions on deleted accounts', () => {
    const transactions = [
      tx('ghost', 'restaurant', '2026-07-01'),
      tx('ghost', 'restaurant', '2026-06-25'),
      tx('ghost', 'restaurant', '2026-06-20'),
    ];
    const r = resolveAccount({ text: 'кофе 20', categoryId: 'restaurant', txType: 'expense', accounts, transactions });
    expect(r).toEqual({ account: null, reason: 'none' });
  });

  test('HE brand keyword', () => {
    expect(detectCardBrand('קניתי בויזה 50')).toBe('visa');
  });

  test('RU brand declensions (визой/визу/визе, мастеркардом/мастеркарду, амексом)', () => {
    expect(detectCardBrand('оплатил визой 50')).toBe('visa');
    expect(detectCardBrand('положил на визу 50')).toBe('visa');
    expect(detectCardBrand('расплатился по визе 50')).toBe('visa');
    expect(detectCardBrand('оплатил мастеркардом 50')).toBe('mastercard');
    expect(detectCardBrand('привязан к мастеркарду 50')).toBe('mastercard');
    expect(detectCardBrand('оплатил амексом 50')).toBe('amex');
  });

  test('4-5: habit/recent tiers ignore non-payable accounts (e.g. investment/pension)', () => {
    const accountsWithInvestment = [...accounts, { id: 'inv1', name: 'Пенсия', type: 'investment' }];

    // Habit attempt: most transactions on the investment account for this category.
    const habitTxs = [
      tx('inv1', 'food', '2026-07-01'),
      tx('inv1', 'food', '2026-06-20'),
      tx('inv1', 'food', '2026-06-10'),
      tx('cash1', 'food', '2026-05-10'),
    ];
    const habitResult = resolveAccount({ text: 'продукты 20', categoryId: 'food', txType: 'expense', accounts: accountsWithInvestment, transactions: habitTxs });
    expect(habitResult.account).not.toBe('inv1');
    expect(habitResult).toEqual({ account: 'cash1', reason: 'recent' });

    // Recent attempt: most recent transaction overall is on the investment account,
    // but a payable account also has history → must pick the payable one.
    const recentTxs = [
      tx('inv1', 'other', '2026-07-15'),
      tx('cash1', 'other', '2026-07-01'),
    ];
    const recentResult = resolveAccount({ text: 'что-то 20', accounts: accountsWithInvestment, transactions: recentTxs });
    expect(recentResult).toEqual({ account: 'cash1', reason: 'recent' });

    // Only investment-account history exists → no payable candidate → none.
    const onlyInvestmentTxs = [
      tx('inv1', 'food', '2026-07-01'),
      tx('inv1', 'food', '2026-06-20'),
      tx('inv1', 'food', '2026-06-10'),
    ];
    const noneResult = resolveAccount({ text: 'продукты 20', categoryId: 'food', txType: 'expense', accounts: accountsWithInvestment, transactions: onlyInvestmentTxs });
    expect(noneResult).toEqual({ account: null, reason: 'none' });
  });
});
