// src/utils/withTimeout.ts
// Bounds a promise so it ALWAYS settles. Firestore (@react-native-firebase)
// read/write promises can hang forever when the internal gRPC stream is stuck
// (after a network switch / backgrounding / weak signal) — they neither resolve
// nor reject, which froze our save spinner until an app restart. Racing every
// risky Firestore call against a timeout guarantees the UI recovers.

export class TimeoutError extends Error {
  constructor(label?: string) {
    super(label ? `Operation timed out: ${label}` : 'Operation timed out');
    this.name = 'TimeoutError';
  }
}

export function withTimeout<T>(promise: Promise<T>, ms = 8000, label?: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(label)), ms);
  });
  // If the timeout wins the race, the original promise may still reject later;
  // swallow that here so it doesn't surface as an unhandled rejection.
  promise.catch(() => {});
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer)) as Promise<T>;
}

export default withTimeout;
