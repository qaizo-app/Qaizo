// The orchestrator: dictionary hit → no network; AI path accepts custom ids;
// garbage AI → local fallback. client + dataService are mocked; the pure
// modules underneath are REAL.
const mockCallGemini = jest.fn();
jest.mock('../src/services/ai/client', () => ({
  callGemini: (...a) => mockCallGemini(...a),
  getLastAIError: () => null,
}));

const mockTxs = [];
jest.mock('../src/services/dataService', () => ({
  __esModule: true,
  default: { getTransactions: jest.fn(() => Promise.resolve(mockTxs)) },
}));

jest.mock('../src/utils/categoryCache', () => ({
  getCachedGroups: () => [
    { id: 'g1', name: { ru: 'Пособия' }, subs: [{ id: 'cat_abc', name: { ru: 'Детское пособие' } }] },
  ],
  ensureCachedGroups: () => Promise.resolve([]),
}));

jest.mock('../src/i18n', () => ({ __esModule: true, default: { t: (k) => k, getLanguage: () => 'ru' } }));

const { parseTransactionSmart } = require('../src/services/ai/smartParse');

const accounts = [
  { id: 'visa1', name: 'Visa', type: 'credit', isActive: true },
  { id: 'cash1', name: 'Наличные', type: 'cash', isActive: true },
];

beforeEach(() => {
  mockCallGemini.mockReset();
  mockTxs.length = 0;
  require('../src/services/dataService').default.getTransactions.mockClear();
});

describe('layer 1: repeat dictionary', () => {
  test('known phrasing skips the network entirely', async () => {
    mockTxs.push(
      { note: 'кофе 25', categoryId: 'restaurant', type: 'expense', date: '2026-07-01', account: 'visa1' },
      { note: 'кофе 30', categoryId: 'restaurant', type: 'expense', date: '2026-07-05', account: 'visa1' },
      { note: 'кофе 27', categoryId: 'restaurant', type: 'expense', date: '2026-07-08', account: 'visa1' },
    );
    const r = await parseTransactionSmart('кофе 32', accounts, []);
    expect(mockCallGemini).not.toHaveBeenCalled();
    expect(r).toMatchObject({ amount: 32, categoryId: 'restaurant', type: 'expense', source: 'history', account: 'visa1' });
  });

  test('repeat with no extractable amount still goes to AI', async () => {
    mockTxs.push(
      { note: 'кофе 25', categoryId: 'restaurant', type: 'expense', date: '2026-07-01' },
      { note: 'кофе 30', categoryId: 'restaurant', type: 'expense', date: '2026-07-05' },
    );
    mockCallGemini.mockResolvedValue(JSON.stringify({ amount: 30, type: 'expense', categoryId: 'restaurant', recipient: '', note: 'кофе' }));
    const r = await parseTransactionSmart('кофе', accounts, []);
    expect(mockCallGemini).toHaveBeenCalled();
    expect(r.source).toBe('ai');
  });

  test('word-number amounts ("12 тысяч") never resolve at layer 1 — sent to AI instead', async () => {
    mockTxs.push(
      { note: 'получил зарплату 12 тысяч', categoryId: 'salary_me', type: 'income', date: '2026-07-01' },
      { note: 'получил зарплату 12 тысяч', categoryId: 'salary_me', type: 'income', date: '2026-06-01' },
      { note: 'получил зарплату 12 тысяч', categoryId: 'salary_me', type: 'income', date: '2026-05-01' },
    );
    mockCallGemini.mockResolvedValue(JSON.stringify({ amount: 14000, type: 'income', categoryId: 'salary_me', recipient: '', note: 'получил зарплату 14 тысяч' }));
    const r = await parseTransactionSmart('получил зарплату 14 тысяч', accounts, []);
    expect(mockCallGemini).toHaveBeenCalled();
    expect(r.source).toBe('ai');
  });
});

describe('layer 2: AI path', () => {
  test('custom category id from the cached groups is ACCEPTED', async () => {
    mockCallGemini.mockResolvedValue(JSON.stringify({ amount: 115, type: 'income', categoryId: 'cat_abc', recipient: '', note: 'детское пособие 115' }));
    const r = await parseTransactionSmart('детское пособие 115', accounts, []);
    expect(r).toMatchObject({ categoryId: 'cat_abc', source: 'ai' });
  });

  test('prompt contains custom category and history examples', async () => {
    mockTxs.push(
      { note: 'уборщица 200', categoryId: 'household', type: 'expense', date: '2026-07-01' },
      { note: 'уборщица 200', categoryId: 'household', type: 'expense', date: '2026-06-01' },
    );
    mockCallGemini.mockResolvedValue(JSON.stringify({ amount: 50, type: 'expense', categoryId: 'other', recipient: '', note: 'x 50' }));
    await parseTransactionSmart('что-то новое 50', accounts, []);
    const prompt = mockCallGemini.mock.calls[0][0];
    expect(prompt).toContain('cat_abc');
    expect(prompt).toContain('Детское пособие');
    expect(prompt).toContain('уборщица');
  });

  test('account resolution: nothing said → habit account, reason surfaced', async () => {
    mockTxs.push(
      { note: 'x', categoryId: 'food', type: 'expense', date: '2026-07-01', account: 'cash1' },
      { note: 'y', categoryId: 'food', type: 'expense', date: '2026-07-02', account: 'cash1' },
      { note: 'z', categoryId: 'food', type: 'expense', date: '2026-07-03', account: 'cash1' },
    );
    mockCallGemini.mockResolvedValue(JSON.stringify({ amount: 90, type: 'expense', categoryId: 'food', recipient: '', note: 'продукты 90', accountId: null, accountType: null }));
    const r = await parseTransactionSmart('продукты 90', accounts, []);
    expect(r.account).toBe('cash1');
    expect(r.accountReason).toBe('habit');
  });
});

describe('layer 3: fallback', () => {
  test('AI unreachable → local keyword parser', async () => {
    mockCallGemini.mockResolvedValue(null);
    const r = await parseTransactionSmart('такси 45', accounts, []);
    expect(r).toMatchObject({ amount: 45, categoryId: 'transport', source: 'fallback' });
  });
});

describe('detectedBrand', () => {
  test('is attached to the AI-path result when a brand word is present', async () => {
    mockCallGemini.mockResolvedValue(JSON.stringify({ amount: 50, type: 'expense', categoryId: 'food', recipient: '', note: 'продукты по визе 50' }));
    const r = await parseTransactionSmart('продукты по визе 50', accounts, []);
    expect(r.detectedBrand).toBe('visa');
  });

  test('is attached to the history-path result', async () => {
    mockTxs.push(
      { note: 'виза кофе 25', categoryId: 'restaurant', type: 'expense', date: '2026-07-01' },
      { note: 'виза кофе 30', categoryId: 'restaurant', type: 'expense', date: '2026-07-05' },
    );
    const r = await parseTransactionSmart('виза кофе 32', accounts, []);
    expect(r.source).toBe('history');
    expect(r.detectedBrand).toBe('visa');
  });

  test('is attached to the fallback-path result', async () => {
    mockCallGemini.mockResolvedValue(null);
    const r = await parseTransactionSmart('такси визой 45', accounts, []);
    expect(r.source).toBe('fallback');
    expect(r.detectedBrand).toBe('visa');
  });
});

describe('preloadedTransactions (4th arg)', () => {
  test('when provided, dataService.getTransactions is NOT called', async () => {
    const dataService = require('../src/services/dataService').default;
    mockCallGemini.mockResolvedValue(JSON.stringify({ amount: 45, type: 'expense', categoryId: 'transport', recipient: '', note: 'такси 45' }));
    await parseTransactionSmart('такси 45', accounts, [], []);
    expect(dataService.getTransactions).not.toHaveBeenCalled();
  });
});
