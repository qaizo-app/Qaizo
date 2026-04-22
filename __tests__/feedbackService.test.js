// __tests__/feedbackService.test.js
jest.mock('@react-native-async-storage/async-storage', () => {
  let store = {};
  return {
    __esModule: true,
    default: {
      getItem: jest.fn((k) => Promise.resolve(store[k] ?? null)),
      setItem: jest.fn((k, v) => { store[k] = v; return Promise.resolve(); }),
      removeItem: jest.fn((k) => { delete store[k]; return Promise.resolve(); }),
      clear: jest.fn(() => { store = {}; return Promise.resolve(); }),
      __reset: () => { store = {}; },
    },
  };
});

const AsyncStorage = require('@react-native-async-storage/async-storage').default;
const feedback = require('../src/services/feedbackService').default;

const DAY = 24 * 60 * 60 * 1000;

beforeEach(() => {
  AsyncStorage.__reset();
  global.fetch = jest.fn();
});

afterAll(() => {
  delete global.fetch;
});

describe('shouldPrompt', () => {
  test('returns false when transaction count is below threshold', async () => {
    await AsyncStorage.setItem('qaizo_install_date', new Date(Date.now() - 30 * DAY).toISOString());
    expect(await feedback.shouldPrompt({ transactionCount: 5 })).toBe(false);
  });

  test('returns false when install age is below threshold', async () => {
    await AsyncStorage.setItem('qaizo_install_date', new Date(Date.now() - 2 * DAY).toISOString());
    expect(await feedback.shouldPrompt({ transactionCount: 50 })).toBe(false);
  });

  test('returns true when both gates pass', async () => {
    await AsyncStorage.setItem('qaizo_install_date', new Date(Date.now() - 30 * DAY).toISOString());
    expect(await feedback.shouldPrompt({ transactionCount: 20 })).toBe(true);
  });

  test('respects markDismissed for the current version', async () => {
    await AsyncStorage.setItem('qaizo_install_date', new Date(Date.now() - 30 * DAY).toISOString());
    await feedback.markDismissed();
    expect(await feedback.shouldPrompt({ transactionCount: 20 })).toBe(false);
  });

  test('respects markSubmitted for the current version', async () => {
    await AsyncStorage.setItem('qaizo_install_date', new Date(Date.now() - 30 * DAY).toISOString());
    await feedback.markSubmitted();
    expect(await feedback.shouldPrompt({ transactionCount: 20 })).toBe(false);
  });

  test('stamps install date on first call', async () => {
    expect(await AsyncStorage.getItem('qaizo_install_date')).toBeNull();
    await feedback.shouldPrompt({ transactionCount: 0 });
    expect(await AsyncStorage.getItem('qaizo_install_date')).not.toBeNull();
  });
});

describe('submitFeedback', () => {
  test('posts JSON body and marks submitted on success', async () => {
    global.fetch.mockResolvedValue({ ok: true, status: 200 });
    await feedback.submitFeedback({
      rating: 2,
      chip: 'rateChipBug',
      text: 'something broke',
      language: 'ru',
      platform: 'android',
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toMatch(/formspree\.io/);
    expect(opts.method).toBe('POST');
    const body = JSON.parse(opts.body);
    expect(body).toMatchObject({
      rating: 2,
      chip: 'rateChipBug',
      text: 'something broke',
      language: 'ru',
      platform: 'android',
    });
    expect(body.version).toBeDefined();
    // Submitted state should now block future prompts for this version.
    await AsyncStorage.setItem('qaizo_install_date', new Date(Date.now() - 30 * DAY).toISOString());
    expect(await feedback.shouldPrompt({ transactionCount: 20 })).toBe(false);
  });

  test('throws on non-ok response and does not mark submitted', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 500 });
    await expect(feedback.submitFeedback({ rating: 1 })).rejects.toThrow();
    await AsyncStorage.setItem('qaizo_install_date', new Date(Date.now() - 30 * DAY).toISOString());
    expect(await feedback.shouldPrompt({ transactionCount: 20 })).toBe(true);
  });

  test('truncates text to 2000 chars', async () => {
    global.fetch.mockResolvedValue({ ok: true, status: 200 });
    const long = 'x'.repeat(5000);
    await feedback.submitFeedback({ rating: 1, text: long });
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.text.length).toBe(2000);
  });
});
