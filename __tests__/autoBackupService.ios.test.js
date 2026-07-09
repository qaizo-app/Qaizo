// iOS branch of the auto backup runner: no SAF — writes into the app's
// Files-visible documents backups/ dir with a '.json' suffix and prunes
// bare filenames. Platform is pinned to ios for this whole file (the module
// reads Platform at call time, but jest module mocks are per-file static).
const mockStorage = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(key => Promise.resolve(mockStorage[key] || null)),
  setItem: jest.fn((key, val) => { mockStorage[key] = val; return Promise.resolve(); }),
}));

const mockFs = {
  writtenFiles: {},
  dirEntries: [],
  deleted: [],
  madeDirs: [],
};
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///docs/',
  writeAsStringAsync: jest.fn((uri, contents) => { mockFs.writtenFiles[uri] = contents; return Promise.resolve(); }),
  deleteAsync: jest.fn(uri => { mockFs.deleted.push(uri); return Promise.resolve(); }),
  makeDirectoryAsync: jest.fn(dir => { mockFs.madeDirs.push(dir); return Promise.resolve(); }),
  readDirectoryAsync: jest.fn(() => Promise.resolve(mockFs.dirEntries)),
  StorageAccessFramework: {
    requestDirectoryPermissionsAsync: jest.fn(),
    createFileAsync: jest.fn(),
    readDirectoryAsync: jest.fn(),
  },
}));

jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

const mockExportData = jest.fn();
jest.mock('../src/services/dataService', () => ({
  __esModule: true,
  default: { exportData: (...a) => mockExportData(...a) },
}));

const { pickBackupDir, runNow, saveConfig } = require('../src/services/autoBackupService');

describe('runner (mocked I/O, ios)', () => {
  const now = new Date(2026, 6, 9, 8, 15);

  beforeEach(() => {
    Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
    mockFs.writtenFiles = {}; mockFs.dirEntries = []; mockFs.deleted = []; mockFs.madeDirs = [];
    mockExportData.mockReset();
    jest.clearAllMocks();
  });

  test('pickBackupDir returns the app backups dir without any picker', async () => {
    const dir = await pickBackupDir();
    expect(dir).toBe('file:///docs/backups/');
    expect(mockFs.madeDirs).toContain('file:///docs/backups/');
  });

  test('runNow writes <dir><base>.json and prunes bare filenames with the dir prefix', async () => {
    await saveConfig({ dirUri: 'file:///docs/backups/' });
    mockExportData.mockResolvedValue({ transactions: [{ id: 't1' }] });
    mockFs.dirEntries = [];
    for (let d = 1; d <= 8; d++) mockFs.dirEntries.push(`qaizo-backup-2026-07-0${d}-0800.json`);

    expect(await runNow(now)).toBe('ok');
    expect(Object.keys(mockFs.writtenFiles)).toEqual(['file:///docs/backups/qaizo-backup-2026-07-09-0815.json']);
    expect(mockFs.deleted).toEqual(['file:///docs/backups/qaizo-backup-2026-07-01-0800.json']);
  });
});
