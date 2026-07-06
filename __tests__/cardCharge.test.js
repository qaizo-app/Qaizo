// Tests for the credit-card funding helpers: how much a card deducts each month
// and whether a funding account will fall short covering its linked cards.
const { cardMonthlyCharge, fundingShortfall } = require('../src/utils/cardCharge');

describe('cardMonthlyCharge', () => {
  test('uses the fixed amount when set (revolving credit)', () => {
    expect(cardMonthlyCharge({ fixedCharge: 500, balance: -100 })).toBe(500);
  });

  test('uses the full debt when no fixed amount', () => {
    expect(cardMonthlyCharge({ balance: -1200 })).toBe(1200);
    expect(cardMonthlyCharge({ fixedCharge: 0, balance: -300 })).toBe(300);
  });

  test('nothing to charge when balance is non-negative', () => {
    expect(cardMonthlyCharge({ balance: 0 })).toBe(0);
    expect(cardMonthlyCharge({ balance: 250 })).toBe(0);
    expect(cardMonthlyCharge({})).toBe(0);
  });
});

describe('fundingShortfall', () => {
  const now = new Date('2026-07-06T00:00:00'); // day 6 of a 31-day month
  const bankA = { id: 'A', type: 'bank', balance: 500, overdraft: 0 };

  test('no linked cards → no shortfall', () => {
    expect(fundingShortfall(bankA, [bankA], [], now)).toBe(0);
  });

  test('linked card charge ahead this month causes a shortfall', () => {
    const card = { id: 'C', type: 'credit', fundingAccountId: 'A', billingDay: 10, balance: -800 };
    // 500 balance − 800 charge = −300 → shortfall 300
    expect(fundingShortfall(bankA, [bankA, card], [], now)).toBe(300);
  });

  test('card already charged earlier this month is excluded', () => {
    const card = { id: 'C', type: 'credit', fundingAccountId: 'A', billingDay: 2, balance: -800 };
    expect(fundingShortfall(bankA, [bankA, card], [], now)).toBe(0);
  });

  test('cards linked to a different account are ignored', () => {
    const card = { id: 'C', type: 'credit', fundingAccountId: 'OTHER', billingDay: 10, balance: -800 };
    expect(fundingShortfall(bankA, [bankA, card], [], now)).toBe(0);
  });

  test('fixed-charge card uses the fixed amount, not the debt', () => {
    const card = { id: 'C', type: 'credit', fundingAccountId: 'A', billingDay: 10, balance: -900, fixedCharge: 200 };
    // 500 − 200 = 300, ≥ 0 → no shortfall
    expect(fundingShortfall(bankA, [bankA, card], [], now)).toBe(0);
  });

  test('upcoming recurring on the account is included', () => {
    const rec = [{ isActive: true, account: 'A', type: 'expense', amount: 600, nextDate: '2026-07-20' }];
    // 500 − 600 recurring = −100 → shortfall 100
    expect(fundingShortfall(bankA, [bankA], rec, now)).toBe(100);
  });

  test('overdraft limit raises the allowed floor', () => {
    const bank = { id: 'A', type: 'bank', balance: 500, overdraft: 1000 };
    const card = { id: 'C', type: 'credit', fundingAccountId: 'A', billingDay: 10, balance: -800 };
    // projected −300, minAllowed −1000 → still covered → 0
    expect(fundingShortfall(bank, [bank, card], [], now)).toBe(0);
  });
});
