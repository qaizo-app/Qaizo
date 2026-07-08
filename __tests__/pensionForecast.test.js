// Tests for the pure pension forecast math.
const {
  monthlyRate, projectSavings,
} = require('../src/utils/pensionForecast');

describe('monthlyRate', () => {
  test('4% annual → ~0.327% monthly (compound)', () => {
    expect(monthlyRate(4)).toBeCloseTo(0.0032737, 6);
  });
  test('0% → 0', () => {
    expect(monthlyRate(0)).toBe(0);
  });
});

describe('projectSavings', () => {
  test('zero return: balance + deposits linearly', () => {
    expect(projectSavings(100000, 0, 12, 0)).toBe(100000);
    expect(projectSavings(100000, 1000, 12, 0)).toBe(112000);
  });

  test('balance-only growth at 4% over 10 years ≈ ×1.4802', () => {
    expect(projectSavings(100000, 0, 120, 4)).toBe(148024);
  });

  test('deposits-only at 4% over 12 months ≈ 12 218', () => {
    expect(projectSavings(0, 1000, 12, 4)).toBe(12218);
  });

  test('zero months → balance as is', () => {
    expect(projectSavings(55555, 9999, 0, 4)).toBe(55555);
  });

  test('garbage inputs treated as zeros', () => {
    expect(projectSavings(NaN, NaN, 12, 0)).toBe(0);
  });
});
