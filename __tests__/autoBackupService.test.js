// Pure helpers of the auto backup scheduler.
const {
  isDue, filesToPrune, buildBackupFilename, dirDisplayName, DEFAULT_CONFIG,
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
