// Tests for isValidBackup — the pure guard that decides whether a picked file
// looks like a Qaizo backup bundle before we let the user restore it.
const { isValidBackup } = require('../src/services/backupService');

describe('isValidBackup', () => {
  test('accepts a bundle with core collections', () => {
    expect(isValidBackup({ transactions: [], accounts: [], exportedAt: '2026-07-03' })).toBe(true);
  });

  test('accepts a bundle with just one known store', () => {
    expect(isValidBackup({ settings: { currency: '₪' } })).toBe(true);
  });

  test('rejects null / non-objects', () => {
    expect(isValidBackup(null)).toBe(false);
    expect(isValidBackup(undefined)).toBe(false);
    expect(isValidBackup('not json')).toBe(false);
    expect(isValidBackup(42)).toBe(false);
  });

  test('rejects an object without any known store', () => {
    expect(isValidBackup({})).toBe(false);
    expect(isValidBackup({ foo: 1, bar: 2 })).toBe(false);
  });
});
