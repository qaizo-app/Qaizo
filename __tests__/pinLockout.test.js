// Tests for lockoutMsForAttempts — the pure escalating-lockout policy that
// throttles PIN brute-forcing after repeated failures.
const { lockoutMsForAttempts } = require('../src/utils/pinLockout');

describe('lockoutMsForAttempts', () => {
  test('no lockout for the first few attempts', () => {
    expect(lockoutMsForAttempts(0)).toBe(0);
    expect(lockoutMsForAttempts(1)).toBe(0);
    expect(lockoutMsForAttempts(4)).toBe(0);
  });

  test('30s lockout after 5–6 failures', () => {
    expect(lockoutMsForAttempts(5)).toBe(30 * 1000);
    expect(lockoutMsForAttempts(6)).toBe(30 * 1000);
  });

  test('2min lockout after 7–9 failures', () => {
    expect(lockoutMsForAttempts(7)).toBe(2 * 60 * 1000);
    expect(lockoutMsForAttempts(9)).toBe(2 * 60 * 1000);
  });

  test('15min lockout from 10 failures onward', () => {
    expect(lockoutMsForAttempts(10)).toBe(15 * 60 * 1000);
    expect(lockoutMsForAttempts(50)).toBe(15 * 60 * 1000);
  });

  test('handles junk input as zero', () => {
    expect(lockoutMsForAttempts(-3)).toBe(0);
    expect(lockoutMsForAttempts(NaN)).toBe(0);
  });
});
