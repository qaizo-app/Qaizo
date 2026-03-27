// __tests__/exportService.test.js
// Тесты экспорта — все внешние зависимости замоканы

jest.mock('../src/i18n', () => ({
  __esModule: true,
  default: { t: (key) => key },
}));

jest.mock('../src/utils/currency', () => ({
  sym: () => '₪',
}));

jest.mock('../src/services/dataService', () => {
  const mock = {
    getTransactions: jest.fn(() => Promise.resolve([])),
    getAccounts: jest.fn(() => Promise.resolve([])),
  };
  return { __esModule: true, default: mock };
});

jest.mock('expo-file-system', () => ({
  cacheDirectory: '/tmp/cache/',
  EncodingType: { UTF8: 'utf8' },
  writeAsStringAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
  shareAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('expo-print', () => ({
  printToFileAsync: jest.fn(() => Promise.resolve({ uri: '/tmp/out.pdf' })),
}));

jest.mock('react-native', () => ({
  Alert: { alert: jest.fn() },
  Platform: { OS: 'android' },
}));

const FileSystem = require('expo-file-system');
const Sharing = require('expo-sharing');
const Print = require('expo-print');
const { default: dataService } = require('../src/services/dataService');
const { default: exportService } = require('../src/services/exportService');

const SAMPLE_TXS = [
  {
    id: 'tx1', type: 'expense', amount: 100, categoryId: 'food',
    date: '2026-01-15T10:00:00.000Z', account: 'acc1', note: 'Lunch', tags: ['eating'],
  },
  {
    id: 'tx2', type: 'income', amount: 5000, categoryId: 'salary_me',
    date: '2026-01-01T09:00:00.000Z', account: 'acc2',
  },
];

const SAMPLE_ACCOUNTS = [
  { id: 'acc1', name: 'Cash' },
  { id: 'acc2', name: 'Bank' },
];

describe('exportService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    dataService.getTransactions.mockResolvedValue([]);
    dataService.getAccounts.mockResolvedValue([]);
  });

  function seedData() {
    dataService.getTransactions.mockResolvedValue(SAMPLE_TXS);
    dataService.getAccounts.mockResolvedValue(SAMPLE_ACCOUNTS);
  }

  // ─── CSV ───────────────────────────────────────
  test('exportCSV creates file and shares it', async () => {
    seedData();
    await exportService.exportCSV();

    expect(FileSystem.writeAsStringAsync).toHaveBeenCalledTimes(1);
    const [path, content] = FileSystem.writeAsStringAsync.mock.calls[0];
    expect(path).toMatch(/\.csv$/);
    expect(content).toContain('\uFEFF'); // BOM
    expect(content).toContain('date');
    expect(content).toContain('100');
    expect(content).toContain('5000');

    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      path,
      expect.objectContaining({ mimeType: 'text/csv' }),
    );
  });

  test('exportCSV throws NO_DATA when empty', async () => {
    await expect(exportService.exportCSV()).rejects.toThrow('NO_DATA');
  });

  test('exportCSV filters by date range', async () => {
    seedData();
    await exportService.exportCSV('2026-01-10', '2026-01-20');

    const [, content] = FileSystem.writeAsStringAsync.mock.calls[0];
    expect(content).toContain('100');
    expect(content).not.toContain('5000');
  });

  test('exportCSV escapes commas and quotes', async () => {
    dataService.getTransactions.mockResolvedValue([{
      id: 'tx3', type: 'expense', amount: 50, categoryId: 'food',
      date: '2026-02-01T00:00:00.000Z', account: null,
      note: 'Food, "good" stuff', recipient: 'Shop',
    }]);
    dataService.getAccounts.mockResolvedValue([]);

    await exportService.exportCSV();
    const [, content] = FileSystem.writeAsStringAsync.mock.calls[0];
    expect(content).toContain('"Food, ""good"" stuff"');
  });

  test('exportCSV maps account names', async () => {
    seedData();
    await exportService.exportCSV();

    const [, content] = FileSystem.writeAsStringAsync.mock.calls[0];
    expect(content).toContain('Cash');
    expect(content).toContain('Bank');
  });

  // ─── XLS ───────────────────────────────────────
  test('exportXLS creates TSV file and shares it', async () => {
    seedData();
    await exportService.exportXLS();

    expect(FileSystem.writeAsStringAsync).toHaveBeenCalledTimes(1);
    const [path, content] = FileSystem.writeAsStringAsync.mock.calls[0];
    expect(path).toMatch(/\.xls$/);
    expect(content).toContain('\t');

    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      path,
      expect.objectContaining({ mimeType: 'application/vnd.ms-excel' }),
    );
  });

  test('exportXLS throws NO_DATA when empty', async () => {
    await expect(exportService.exportXLS()).rejects.toThrow('NO_DATA');
  });

  // ─── PDF ───────────────────────────────────────
  test('exportPDF generates HTML and shares PDF', async () => {
    seedData();
    await exportService.exportPDF();

    expect(Print.printToFileAsync).toHaveBeenCalledTimes(1);
    const { html } = Print.printToFileAsync.mock.calls[0][0];
    expect(html).toContain('Qaizo');
    expect(html).toContain('100');
    expect(html).toContain('5,000');
    expect(html).toContain('#22c55e'); // income color
    expect(html).toContain('#ef4444'); // expense color

    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      '/tmp/out.pdf',
      expect.objectContaining({ mimeType: 'application/pdf' }),
    );
  });

  test('exportPDF throws NO_DATA when empty', async () => {
    await expect(exportService.exportPDF()).rejects.toThrow('NO_DATA');
  });
});
