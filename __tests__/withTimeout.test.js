// __tests__/withTimeout.test.js
const { withTimeout, TimeoutError } = require('../src/utils/withTimeout');

describe('withTimeout', () => {
  test('resolves with the value when the promise is fast', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 1000)).resolves.toBe('ok');
  });

  test('rejects with TimeoutError when the promise never settles', async () => {
    const neverSettles = new Promise(() => {}); // mimics a stuck Firestore stream
    await expect(withTimeout(neverSettles, 20, 'addTransaction')).rejects.toBeInstanceOf(TimeoutError);
  });

  test('propagates the original rejection when it rejects before the timeout', async () => {
    await expect(withTimeout(Promise.reject(new Error('boom')), 1000)).rejects.toThrow('boom');
  });
});
