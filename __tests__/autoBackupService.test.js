// Pure helpers + runner of the auto backup scheduler.
// I/O mocks are declared BEFORE the module under test is required.
const mockStorage = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(key => Promise.resolve(mockStorage[key] || null)),
  setItem: jest.fn((key, val) => { mockStorage[key] = val; return Promise.resolve(); }),
}));

const mockFs = {
  writtenFiles: {},   // uri -> contents
  dirEntries: [],     // what readDirectoryAsync returns
  deleted: [],
  failCreate: false,
};
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///docs/',
  writeAsStringAsync: jest.fn((uri, contents) => { mockFs.writtenFiles[uri] = contents; return Promise.resolve(); }),
  deleteAsync: jest.fn(uri => { mockFs.deleted.push(uri); return Promise.resolve(); }),
  makeDirectoryAsync: jest.fn(() => Promise.resolve()),
  readDirectoryAsync: jest.fn(() => Promise.resolve(mockFs.dirEntries)),
  StorageAccessFramework: {
    requestDirectoryPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true, directoryUri: 'content://picked' })),
    createFileAsync: jest.fn((dir, name) => {
      if (mockFs.failCreate) return Promise.reject(new Error('EACCES'));
      return Promise.resolve(`${dir}/doc%2F${name}.json`);
    }),
    readDirectoryAsync: jest.fn(() => Promise.resolve(mockFs.dirEntries)),
  },
}));

jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));

const mockExportData = jest.fn();
jest.mock('../src/services/dataService', () => ({
  __esModule: true,
  default: { exportData: (...a) => mockExportData(...a) },
}));

const {
  isDue, filesToPrune, buildBackupFilename, dirDisplayName, DEFAULT_CONFIG,
  getConfig, saveConfig, runAutoBackup, runNow, pickBackupDir,
} = require('../src/services/autoBackupService');

const base = { enabled: true, frequency: 'daily', dirUri: 'content://dir', lastBackupAt: null, lastError: null };
const now = new Date(2026, 6, 9, 8, 15); // local 2026-07-09 08:15

describe('isDue', () => {
  test('disabled → never due', () => {
    expect(isDue({ ...base, enabled: false }, now)).toBe(false);
  });
  test('no folder picked → not due', () => {
    expect(isDue({ ...base, dirUri: null }, now)).toBe(false);
  });
  test('never backed up → due', () => {
    expect(isDue(base, now)).toBe(true);
  });
  test('daily: yesterday → due, today → not due', () => {
    expect(isDue({ ...base, lastBackupAt: new Date(2026, 6, 8, 23, 50).toISOString() }, now)).toBe(true);
    expect(isDue({ ...base, lastBackupAt: new Date(2026, 6, 9, 0, 5).toISOString() }, now)).toBe(false);
  });
  test('weekly: 6 days ago → not due, 7 days ago → due', () => {
    const weekly = { ...base, frequency: 'weekly' };
    expect(isDue({ ...weekly, lastBackupAt: new Date(2026, 6, 3, 12, 0).toISOString() }, now)).toBe(false);
    expect(isDue({ ...weekly, lastBackupAt: new Date(2026, 6, 2, 12, 0).toISOString() }, now)).toBe(true);
  });
});

describe('filesToPrune', () => {
  test('keeps the newest 7 backups, returns the rest (oldest) for deletion', () => {
    const entries = [];
    for (let d = 1; d <= 9; d++) {
      entries.push(`content://tree/doc%2Fqaizo-backup-2026-07-0${d}-0800.json`);
    }
    entries.push('content://tree/doc%2Fsomething-else.txt'); // ignored
    const prune = filesToPrune(entries, 7);
    expect(prune).toEqual([
      'content://tree/doc%2Fqaizo-backup-2026-07-01-0800.json',
      'content://tree/doc%2Fqaizo-backup-2026-07-02-0800.json',
    ]);
  });
  test('fewer than keep → nothing to prune', () => {
    expect(filesToPrune(['a/qaizo-backup-2026-07-01-0800.json'], 7)).toEqual([]);
  });
  test('plain filenames (iOS) work too', () => {
    const names = ['qaizo-backup-2026-07-01-0800.json', 'qaizo-backup-2026-07-02-0800.json'];
    expect(filesToPrune(names, 1)).toEqual(['qaizo-backup-2026-07-01-0800.json']);
  });
  test('a foreign file with a stray % does not abort the scan', () => {
    const names = ['50% done.txt', 'qaizo-backup-2026-07-01-0800.json', 'qaizo-backup-2026-07-02-0800.json'];
    expect(filesToPrune(names, 1)).toEqual(['qaizo-backup-2026-07-01-0800.json']);
  });
  test('a renamed file merely containing the prefix is not prunable', () => {
    const names = ['keep-this-qaizo-backup-2026-01-01-0000.json', 'qaizo-backup-2026-07-01-0800.json'];
    expect(filesToPrune(names, 1)).toEqual([]);
  });
});

describe('buildBackupFilename', () => {
  test('sortable base name without extension', () => {
    expect(buildBackupFilename(now)).toBe('qaizo-backup-2026-07-09-0815');
  });
});

describe('dirDisplayName', () => {
  test('SAF tree URI → decoded tail', () => {
    expect(dirDisplayName('content://com.android.externalstorage.documents/tree/primary%3ADownload%2FQaizo')).toBe('Download/Qaizo');
  });
  test('null → empty string', () => {
    expect(dirDisplayName(null)).toBe('');
  });
});

describe('DEFAULT_CONFIG', () => {
  test('off by default, weekly', () => {
    expect(DEFAULT_CONFIG).toEqual({ enabled: false, frequency: 'weekly', dirUri: null, lastBackupAt: null, lastError: null });
  });
});

describe('runner (mocked I/O, android)', () => {
  const now = new Date(2026, 6, 9, 8, 15);

  beforeEach(async () => {
    Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
    mockFs.writtenFiles = {}; mockFs.dirEntries = []; mockFs.deleted = []; mockFs.failCreate = false;
    mockExportData.mockReset();
    jest.clearAllMocks();
  });

  const enable = () => saveConfig({ enabled: true, frequency: 'daily', dirUri: 'content://dir' });

  test('getConfig returns defaults when nothing stored', async () => {
    expect(await getConfig()).toEqual(DEFAULT_CONFIG);
  });

  test('saveConfig merges patches over stored values', async () => {
    await saveConfig({ enabled: true });
    await saveConfig({ frequency: 'daily' });
    const cfg = await getConfig();
    expect(cfg.enabled).toBe(true);
    expect(cfg.frequency).toBe('daily');
  });

  test('runAutoBackup skips when not due', async () => {
    // default config: disabled
    expect(await runAutoBackup(now)).toBe('skipped');
    expect(mockExportData).not.toHaveBeenCalled();
  });

  test('runAutoBackup writes file, prunes old ones, records lastBackupAt', async () => {
    await enable();
    mockExportData.mockResolvedValue({ transactions: [{ id: 't1' }] });
    mockFs.dirEntries = [];
    for (let d = 1; d <= 8; d++) mockFs.dirEntries.push(`content://dir/doc%2Fqaizo-backup-2026-07-0${d}-0800.json`);

    expect(await runAutoBackup(now)).toBe('ok');
    const written = Object.keys(mockFs.writtenFiles);
    expect(written).toHaveLength(1);
    expect(written[0]).toContain('qaizo-backup-2026-07-09-0815');
    expect(mockFs.deleted).toEqual(['content://dir/doc%2Fqaizo-backup-2026-07-01-0800.json']);
    const cfg = await getConfig();
    expect(cfg.lastBackupAt).toBeTruthy();
    expect(cfg.lastError).toBeNull();
  });

  test('export failure → error, lastError=export, nothing written', async () => {
    await enable();
    mockExportData.mockResolvedValue(null);
    expect(await runAutoBackup(now)).toBe('error');
    expect(Object.keys(mockFs.writtenFiles)).toHaveLength(0);
    expect((await getConfig()).lastError).toBe('export');
  });

  test('folder write failure → error, lastError=dir_unavailable, stays enabled', async () => {
    await enable();
    mockExportData.mockResolvedValue({ transactions: [] });
    mockFs.failCreate = true;
    expect(await runAutoBackup(now)).toBe('error');
    const cfg = await getConfig();
    expect(cfg.lastError).toBe('dir_unavailable');
    expect(cfg.enabled).toBe(true);
  });

  test('runNow ignores schedule but requires a folder', async () => {
    expect(await runNow(now)).toBe('nodir');
    await saveConfig({ dirUri: 'content://dir' }); // note: enabled stays false
    mockExportData.mockResolvedValue({ transactions: [] });
    expect(await runNow(now)).toBe('ok');
  });

  test('pickBackupDir returns the granted SAF uri', async () => {
    expect(await pickBackupDir()).toBe('content://picked');
  });
});
