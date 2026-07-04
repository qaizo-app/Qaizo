// src/utils/pinLockout.ts
// Escalating lockout policy for wrong-PIN attempts — throttles brute-forcing
// of the 4-digit app lock. Pure so the thresholds are easy to test/tune.

export function lockoutMsForAttempts(attempts: number): number {
  if (!Number.isFinite(attempts) || attempts < 5) return 0;
  if (attempts < 7) return 30 * 1000;        // 5–6  → 30s
  if (attempts < 10) return 2 * 60 * 1000;   // 7–9  → 2min
  return 15 * 60 * 1000;                      // 10+  → 15min
}

export default lockoutMsForAttempts;
