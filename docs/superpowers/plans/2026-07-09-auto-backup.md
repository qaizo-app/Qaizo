# Auto Backup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scheduled (daily/weekly) silent JSON backup into a user-picked folder, checked on app open, keeping the newest 7 files.

**Architecture:** New `src/services/autoBackupService.ts` — pure schedule/prune helpers (unit-tested) + SAF/file I/O + AsyncStorage config; one fire-and-forget call from App.js startup; a Settings block (toggle → folder picker, frequency chips, status row, "backup now"). Reuses `dataService.exportData()` and `isValidBackup` from the existing manual backupService.

**Tech Stack:** React Native (Expo SDK 53), `expo-file-system/legacy` (incl. StorageAccessFramework), AsyncStorage, Jest.

**Spec:** `docs/superpowers/specs/2026-07-09-auto-backup-design.md`

## Global Constraints

- All user-facing strings via i18n, added to ALL 11 language files (`en ru he es fr de pt ar zh hi ja`).
- iOS RTL rules (CLAUDE.md): styles with `i18n.row()` for rows; `RowText` for flex text in rows; `textAlign: i18n.textAlign()` where applicable. SettingsScreen's existing rows already follow its local pattern — match it.
- Colors only from `colors` theme.
- Every service function gets a test; Settings UI gets none (project convention).
- Date comparisons must be timezone-safe: compare LOCAL date components of both datetimes (never mix `Date(y,m,d)` locals with UTC-parsed date-only strings).
- Jest on this machine: `npx jest <pattern> --runInBand`.
- `npx tsc --noEmit` and `npx eslint <changed src files> --quiet` clean before each commit (linting `__tests__` files directly reports pre-existing repo-wide jest-globals no-undef — out of scope).
- Commits: `feat:`/`test:`/`chore:` prefixes; end every commit message body with:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

---

### Task 1: Pure schedule/prune helpers

**Files:**
- Create: `src/services/autoBackupService.ts`
- Test: `__tests__/autoBackupService.test.js` (new)

**Interfaces:**
- Consumes: nothing (pure).
- Produces (used by Tasks 2/5):

```ts
export interface AutoBackupConfig {
  enabled: boolean;
  frequency: 'daily' | 'weekly';
  dirUri: string | null;
  lastBackupAt: string | null; // ISO datetime
  lastError: string | null;    // 'export' | 'dir_unavailable' | null
}
export const DEFAULT_CONFIG: AutoBackupConfig;
export function isDue(config: AutoBackupConfig, now?: Date): boolean;
export function filesToPrune(entries: string[], keep?: number): string[];
export function buildBackupFilename(now?: Date): string; // base name, no extension
export function dirDisplayName(uri: string | null): string;
```

- [ ] **Step 1: Write the failing tests**

Create `__tests__/autoBackupService.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest autoBackupService --runInBand`
Expected: FAIL — cannot find module `../src/services/autoBackupService`

- [ ] **Step 3: Write the implementation**

Create `src/services/autoBackupService.ts`:

```ts
// src/services/autoBackupService.ts
// Scheduled off-cloud backup: on app open, when the configured interval has
// elapsed, silently write the full data bundle as JSON into a user-picked
// folder (Android SAF; on iOS the app's Files-visible backups/ dir) and keep
// only the newest 7 files. Manual export/share lives in backupService.

export interface AutoBackupConfig {
  enabled: boolean;
  frequency: 'daily' | 'weekly';
  dirUri: string | null;       // SAF tree URI (Android) / documents subdir (iOS)
  lastBackupAt: string | null; // ISO datetime of last successful backup
  lastError: string | null;    // 'export' | 'dir_unavailable' | null
}

export const DEFAULT_CONFIG: AutoBackupConfig = {
  enabled: false,
  frequency: 'weekly',
  dirUri: null,
  lastBackupAt: null,
  lastError: null,
};

const pad = (n: number) => String(n).padStart(2, '0');

// Local calendar date of a datetime, as UTC-midnight millis — both sides go
// through the SAME local-components path, so timezones can't skew the diff.
const localDayMs = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());

export function isDue(config: AutoBackupConfig, now: Date = new Date()): boolean {
  if (!config.enabled || !config.dirUri) return false;
  if (!config.lastBackupAt) return true;
  const last = new Date(config.lastBackupAt);
  if (isNaN(last.getTime())) return true;
  const days = Math.floor((localDayMs(now) - localDayMs(last)) / 86400000);
  return days >= (config.frequency === 'daily' ? 1 : 7);
}

const BACKUP_RE = /qaizo-backup-.*/;
const entryTail = (entry: string) => {
  const decoded = decodeURIComponent(entry);
  const cut = Math.max(decoded.lastIndexOf('/'), decoded.lastIndexOf(':'));
  return cut >= 0 ? decoded.slice(cut + 1) : decoded;
};

// Given directory entries (SAF content URIs or plain filenames), return the
// entries to DELETE: everything beyond the newest `keep` backup files.
// Backup names embed a sortable timestamp, so string-sorting the tails works.
export function filesToPrune(entries: string[], keep: number = 7): string[] {
  const backups = (entries || [])
    .map(e => ({ entry: e, tail: entryTail(e) }))
    .filter(x => BACKUP_RE.test(x.tail));
  backups.sort((a, b) => b.tail.localeCompare(a.tail)); // newest first
  return backups.slice(keep).map(x => x.entry);
}

export function buildBackupFilename(now: Date = new Date()): string {
  return `qaizo-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}

// Human-readable folder label for the Settings status row. SAF tree URIs
// carry the user path after the volume colon ('primary:Download/Qaizo');
// show the last two path segments so the label stays short but recognizable.
export function dirDisplayName(uri: string | null): string {
  if (!uri) return '';
  const decoded = decodeURIComponent(uri).replace(/\/+$/, '');
  const afterColon = decoded.slice(decoded.lastIndexOf(':') + 1);
  const parts = afterColon.split('/').filter(Boolean);
  return parts.slice(-2).join('/') || afterColon;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest autoBackupService --runInBand`
Expected: PASS (12 tests)

- [ ] **Step 5: Commit**

```bash
npx tsc --noEmit
npx eslint src/services/autoBackupService.ts --quiet
git add src/services/autoBackupService.ts __tests__/autoBackupService.test.js
git commit -m "feat(backup): auto-backup schedule/prune helpers with tests"
```

---

### Task 2: Config storage + backup runner (I/O)

**Files:**
- Modify: `src/services/autoBackupService.ts`
- Test: `__tests__/autoBackupService.test.js` (append)

**Interfaces:**
- Consumes: Task 1 helpers; `dataService.exportData()`; `isValidBackup` from `./backupService`; `expo-file-system/legacy` (`StorageAccessFramework`, `writeAsStringAsync`, `deleteAsync`, `documentDirectory`, `makeDirectoryAsync`, `readDirectoryAsync`); `@react-native-async-storage/async-storage`; `Platform` from react-native.
- Produces (used by Tasks 3/5):

```ts
getConfig(): Promise<AutoBackupConfig>
saveConfig(patch: Partial<AutoBackupConfig>): Promise<AutoBackupConfig>
pickBackupDir(): Promise<string | null>   // Android SAF picker / iOS backups dir
runAutoBackup(now?: Date): Promise<'ok' | 'skipped' | 'error'>
runNow(now?: Date): Promise<'ok' | 'nodir' | 'error'>
export default { ...all of the above, isDue, filesToPrune, buildBackupFilename, dirDisplayName, DEFAULT_CONFIG }
```

- [ ] **Step 1: Write the failing tests**

Append to `__tests__/autoBackupService.test.js` — REPLACE the top require with the mocked-module version below and add the new describe block. Final file top becomes:

```js
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
```

(The existing pure-helper describe blocks stay unchanged below this.)

Then append:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest autoBackupService --runInBand`
Expected: FAIL — `getConfig is not a function` (pure-helper tests keep passing)

- [ ] **Step 3: Write the implementation**

In `src/services/autoBackupService.ts`, add imports at the top:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import dataService from './dataService';
import { isValidBackup } from './backupService';
```

Append after the pure helpers:

```ts
const CONFIG_KEY = 'auto_backup_config';

export async function getConfig(): Promise<AutoBackupConfig> {
  try {
    const raw = await AsyncStorage.getItem(CONFIG_KEY);
    return raw ? { ...DEFAULT_CONFIG, ...JSON.parse(raw) } : { ...DEFAULT_CONFIG };
  } catch (e) { return { ...DEFAULT_CONFIG }; }
}

export async function saveConfig(patch: Partial<AutoBackupConfig>): Promise<AutoBackupConfig> {
  const next = { ...(await getConfig()), ...patch };
  try { await AsyncStorage.setItem(CONFIG_KEY, JSON.stringify(next)); } catch (e) { /* noop */ }
  return next;
}

// Android: system folder picker (persisted SAF permission). iOS: the app's
// Files-visible backups/ dir — no picker to show.
export async function pickBackupDir(): Promise<string | null> {
  if (Platform.OS === 'android') {
    try {
      const res = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      return res.granted ? res.directoryUri : null;
    } catch (e) { return null; }
  }
  const dir = FileSystem.documentDirectory + 'backups/';
  try { await FileSystem.makeDirectoryAsync(dir, { intermediates: true }); } catch (e) { /* exists */ }
  return dir;
}

// Write the JSON bundle + prune, shared by the scheduled and manual paths.
// Prune failures are non-fatal: the backup counts once the file is written.
async function writeBackup(dirUri: string, json: string, now: Date): Promise<'ok' | 'error'> {
  const base = buildBackupFilename(now);
  try {
    if (Platform.OS === 'android') {
      const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(dirUri, base, 'application/json');
      await FileSystem.writeAsStringAsync(fileUri, json);
      try {
        const entries = await FileSystem.StorageAccessFramework.readDirectoryAsync(dirUri);
        for (const uri of filesToPrune(entries)) await FileSystem.deleteAsync(uri, { idempotent: true });
      } catch (e) { /* best-effort */ }
    } else {
      try { await FileSystem.makeDirectoryAsync(dirUri, { intermediates: true }); } catch (e) { /* exists */ }
      await FileSystem.writeAsStringAsync(dirUri + base + '.json', json);
      try {
        const names = await FileSystem.readDirectoryAsync(dirUri);
        for (const name of filesToPrune(names)) await FileSystem.deleteAsync(dirUri + name, { idempotent: true });
      } catch (e) { /* best-effort */ }
    }
    await saveConfig({ lastBackupAt: new Date(now).toISOString(), lastError: null });
    return 'ok';
  } catch (e) {
    if (__DEV__) console.error('autoBackup write:', e);
    await saveConfig({ lastError: 'dir_unavailable' });
    return 'error';
  }
}

async function exportJson(): Promise<string | null> {
  const data = await dataService.exportData();
  if (!data || !isValidBackup(data)) return null;
  return JSON.stringify(data);
}

// Called fire-and-forget on app startup. Never throws.
export async function runAutoBackup(now: Date = new Date()): Promise<'ok' | 'skipped' | 'error'> {
  try {
    const config = await getConfig();
    if (!isDue(config, now)) return 'skipped';
    const json = await exportJson();
    if (!json) { await saveConfig({ lastError: 'export' }); return 'error'; }
    return await writeBackup(config.dirUri as string, json, now);
  } catch (e) {
    if (__DEV__) console.error('runAutoBackup:', e);
    return 'error';
  }
}

// Manual "Сделать сейчас" from Settings: ignores enabled/schedule, needs a folder.
export async function runNow(now: Date = new Date()): Promise<'ok' | 'nodir' | 'error'> {
  try {
    const config = await getConfig();
    if (!config.dirUri) return 'nodir';
    const json = await exportJson();
    if (!json) { await saveConfig({ lastError: 'export' }); return 'error'; }
    return (await writeBackup(config.dirUri, json, now)) === 'ok' ? 'ok' : 'error';
  } catch (e) {
    if (__DEV__) console.error('runNow:', e);
    return 'error';
  }
}

export default {
  DEFAULT_CONFIG, isDue, filesToPrune, buildBackupFilename, dirDisplayName,
  getConfig, saveConfig, pickBackupDir, runAutoBackup, runNow,
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest autoBackupService --runInBand`
Expected: PASS (20 tests)

- [ ] **Step 5: Verify no regressions in suites that import dataService/backupService**

Run: `npx jest backupService dataService --runInBand`
Expected: PASS (if there is no backupService suite, dataService suites pass)

- [ ] **Step 6: Commit**

```bash
npx tsc --noEmit
npx eslint src/services/autoBackupService.ts --quiet
git add src/services/autoBackupService.ts __tests__/autoBackupService.test.js
git commit -m "feat(backup): auto-backup config + runner (SAF write, prune, error states)"
```

---

### Task 3: App startup wire-up

**Files:**
- Modify: `App.js` (import block; the startup effect right after the `autoExecuteRecurring` call at ~line 271)

**Interfaces:**
- Consumes: `autoBackupService.runAutoBackup()` (Task 2).

- [ ] **Step 1: Add the import**

In `App.js`, next to the other service imports add:

```js
import autoBackupService from './src/services/autoBackupService';
```

(Match the existing import style/path prefix used for other `src/services/*` imports in App.js.)

- [ ] **Step 2: Call it on startup**

Directly AFTER this existing block:

```js
      // Auto-execute any recurring payments marked autoConfirm whose nextDate
      // has passed. Catches up missed months too. Runs once on every app
      // startup so the user gets fresh transactions without thinking about it.
      try { await dataService.autoExecuteRecurring(); } catch (e) {}
```

insert:

```js
      // Scheduled off-cloud backup (Settings → Данные → Автобэкап). Checks the
      // configured interval and silently writes a JSON bundle to the user's
      // folder. Fire-and-forget: a slow/failed backup must not delay startup.
      try { autoBackupService.runAutoBackup(); } catch (e) {}
```

(No `await` — deliberate.)

- [ ] **Step 3: Verify + commit**

```bash
npx tsc --noEmit
npx eslint App.js --quiet
git add App.js
git commit -m "feat(backup): run scheduled auto-backup on app startup"
```

---

### Task 4: i18n keys × 11 languages

**Files:**
- Modify: `src/i18n/en.ts`, `ru.ts`, `he.ts`, `es.ts`, `fr.ts`, `de.ts`, `pt.ts`, `ar.ts`, `zh.ts`, `hi.ts`, `ja.ts` — append each block at the end of the file's object, before the closing `};`.

**Interfaces:**
- Produces 8 keys used by Task 5: `autoBackupTitle, abDaily, abWeekly, abLast, abNever, abDirUnavailable, abBackupNow, abDone`. `{date}` placeholder replaced via `.replace()`.

- [ ] **Step 1: Append per-language blocks**

`en.ts`:
```ts
  // Auto backup
  autoBackupTitle: 'Auto backup',
  abDaily: 'Daily',
  abWeekly: 'Weekly',
  abLast: 'Last: {date}',
  abNever: 'No backups yet',
  abDirUnavailable: 'Folder unavailable — pick it again',
  abBackupNow: 'Back up now',
  abDone: 'Backup saved',
```

`ru.ts`:
```ts
  // Автобэкап
  autoBackupTitle: 'Автобэкап',
  abDaily: 'Ежедневно',
  abWeekly: 'Еженедельно',
  abLast: 'Последний: {date}',
  abNever: 'Бэкапов ещё не было',
  abDirUnavailable: 'Папка недоступна — выбери заново',
  abBackupNow: 'Сделать сейчас',
  abDone: 'Бэкап сохранён',
```

`he.ts`:
```ts
  // גיבוי אוטומטי
  autoBackupTitle: 'גיבוי אוטומטי',
  abDaily: 'יומי',
  abWeekly: 'שבועי',
  abLast: 'אחרון: {date}',
  abNever: 'אין גיבויים עדיין',
  abDirUnavailable: 'התיקייה לא זמינה — בחר שוב',
  abBackupNow: 'גבה עכשיו',
  abDone: 'הגיבוי נשמר',
```

`es.ts`:
```ts
  // Copia automática
  autoBackupTitle: 'Copia automática',
  abDaily: 'Diaria',
  abWeekly: 'Semanal',
  abLast: 'Última: {date}',
  abNever: 'Aún no hay copias',
  abDirUnavailable: 'Carpeta no disponible — elígela de nuevo',
  abBackupNow: 'Copiar ahora',
  abDone: 'Copia guardada',
```

`fr.ts`:
```ts
  // Sauvegarde automatique
  autoBackupTitle: 'Sauvegarde auto',
  abDaily: 'Quotidienne',
  abWeekly: 'Hebdomadaire',
  abLast: 'Dernière : {date}',
  abNever: 'Aucune sauvegarde pour l’instant',
  abDirUnavailable: 'Dossier indisponible — choisissez-le à nouveau',
  abBackupNow: 'Sauvegarder maintenant',
  abDone: 'Sauvegarde enregistrée',
```

`de.ts`:
```ts
  // Automatisches Backup
  autoBackupTitle: 'Auto-Backup',
  abDaily: 'Täglich',
  abWeekly: 'Wöchentlich',
  abLast: 'Zuletzt: {date}',
  abNever: 'Noch keine Backups',
  abDirUnavailable: 'Ordner nicht verfügbar — bitte neu wählen',
  abBackupNow: 'Jetzt sichern',
  abDone: 'Backup gespeichert',
```

`pt.ts`:
```ts
  // Backup automático
  autoBackupTitle: 'Backup automático',
  abDaily: 'Diário',
  abWeekly: 'Semanal',
  abLast: 'Último: {date}',
  abNever: 'Ainda sem backups',
  abDirUnavailable: 'Pasta indisponível — escolha novamente',
  abBackupNow: 'Fazer backup agora',
  abDone: 'Backup guardado',
```

`ar.ts`:
```ts
  // نسخ احتياطي تلقائي
  autoBackupTitle: 'نسخ احتياطي تلقائي',
  abDaily: 'يومي',
  abWeekly: 'أسبوعي',
  abLast: 'الأخير: {date}',
  abNever: 'لا توجد نسخ بعد',
  abDirUnavailable: 'المجلد غير متاح — اختره مجدداً',
  abBackupNow: 'انسخ الآن',
  abDone: 'تم حفظ النسخة',
```

`zh.ts`:
```ts
  // 自动备份
  autoBackupTitle: '自动备份',
  abDaily: '每天',
  abWeekly: '每周',
  abLast: '上次：{date}',
  abNever: '还没有备份',
  abDirUnavailable: '文件夹不可用 — 请重新选择',
  abBackupNow: '立即备份',
  abDone: '备份已保存',
```

`hi.ts`:
```ts
  // स्वचालित बैकअप
  autoBackupTitle: 'ऑटो बैकअप',
  abDaily: 'दैनिक',
  abWeekly: 'साप्ताहिक',
  abLast: 'पिछला: {date}',
  abNever: 'अभी तक कोई बैकअप नहीं',
  abDirUnavailable: 'फ़ोल्डर उपलब्ध नहीं — फिर से चुनें',
  abBackupNow: 'अभी बैकअप करें',
  abDone: 'बैकअप सहेजा गया',
```

`ja.ts`:
```ts
  // 自動バックアップ
  autoBackupTitle: '自動バックアップ',
  abDaily: '毎日',
  abWeekly: '毎週',
  abLast: '前回: {date}',
  abNever: 'まだバックアップがありません',
  abDirUnavailable: 'フォルダが利用できません — 再選択してください',
  abBackupNow: '今すぐバックアップ',
  abDone: 'バックアップを保存しました',
```

- [ ] **Step 2: Duplicate-key check + lint**

```bash
npx tsc --noEmit
npx eslint src/i18n --quiet
```
Expected: both clean (a duplicate key would be a TS compile error).

- [ ] **Step 3: Commit**

```bash
git add src/i18n
git commit -m "feat(backup): auto-backup i18n keys x 11 languages"
```

---

### Task 5: Settings UI block

**Files:**
- Modify: `src/screens/SettingsScreen.js` (imports; state; handlers near `handleRestorePick` ~line 94-101; JSX right after the restoreBackup row that ends at ~line 509; styles if needed)

**Interfaces:**
- Consumes: `autoBackupService` default export (Task 2), i18n keys (Task 4). SettingsScreen already imports `backupService`, `toast`, `Feather`, `colors`, `i18n`; it already renders a `Switch` for the expense-reminder toggle — reuse that exact pattern (if `Switch` is missing from the react-native import line, add it).

- [ ] **Step 1: Import + state + load**

Add import next to the backupService import:

```js
import autoBackupService from '../services/autoBackupService';
```

Add state near the other useState hooks:

```js
  const [abCfg, setAbCfg] = useState(null); // AutoBackupConfig | null until loaded
```

Load it where the screen loads its other settings (there is a `useEffect` that reads settings on mount — extend it, or add):

```js
  useEffect(() => { autoBackupService.getConfig().then(setAbCfg); }, []);
```

- [ ] **Step 2: Handlers**

Add after `handleRestoreConfirm`:

```js
  // Auto backup: toggling ON needs a folder (Android SAF picker; iOS silent
  // app dir). Cancelling the picker keeps the feature off. dirUri is kept on
  // toggle-off so re-enabling reuses the folder without re-picking.
  const handleAutoBackupToggle = async (value) => {
    if (!abCfg) return;
    if (value && (!abCfg.dirUri || abCfg.lastError === 'dir_unavailable')) {
      const dir = await autoBackupService.pickBackupDir();
      if (!dir) return; // cancelled → stays off
      setAbCfg(await autoBackupService.saveConfig({ enabled: true, dirUri: dir, lastError: null }));
      return;
    }
    setAbCfg(await autoBackupService.saveConfig({ enabled: value }));
  };

  const handleAutoBackupFreq = async (frequency) => {
    setAbCfg(await autoBackupService.saveConfig({ frequency }));
  };

  const handleAutoBackupRepick = async () => {
    const dir = await autoBackupService.pickBackupDir();
    if (!dir) return;
    setAbCfg(await autoBackupService.saveConfig({ dirUri: dir, lastError: null }));
  };

  const handleBackupNow = async () => {
    const r = await autoBackupService.runNow();
    if (r === 'ok') toast.show(i18n.t('abDone'), 'success');
    else toast.show(i18n.t('error'), 'error');
    setAbCfg(await autoBackupService.getConfig());
  };
```

- [ ] **Step 3: JSX**

Insert directly AFTER the restore row's closing `</TouchableOpacity>` (the row with `i18n.t('restoreBackup')`, before the `handleRecalc` row):

```jsx
            {/* Auto backup */}
            <View style={[styles.optRow, styles.optBorder]}>
              <Feather name="hard-drive" size={18} color={colors.teal} style={{ }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.optText}>{i18n.t('autoBackupTitle')}</Text>
              </View>
              <Switch
                value={!!abCfg?.enabled}
                onValueChange={handleAutoBackupToggle}
                trackColor={{ false: colors.card, true: `${colors.green}40` }}
                thumbColor={abCfg?.enabled ? colors.green : colors.textMuted}
              />
            </View>
            {abCfg?.enabled && (
              <>
                <View style={[styles.optRow, styles.optBorder]}>
                  <View style={{ width: 18 }} />
                  <View style={{ flex: 1, flexDirection: i18n.row(), gap: 8 }}>
                    {[['daily', 'abDaily'], ['weekly', 'abWeekly']].map(([freq, key]) => (
                      <TouchableOpacity key={freq}
                        style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10, backgroundColor: abCfg.frequency === freq ? `${colors.green}22` : colors.card, borderWidth: 1, borderColor: abCfg.frequency === freq ? colors.green : colors.cardBorder }}
                        onPress={() => handleAutoBackupFreq(freq)}>
                        <Text style={{ color: abCfg.frequency === freq ? colors.green : colors.textDim, fontSize: 12, fontWeight: '700' }}>{i18n.t(key)}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <TouchableOpacity style={[styles.optRow, styles.optBorder]}
                  onPress={abCfg.lastError === 'dir_unavailable' ? handleAutoBackupRepick : handleBackupNow}>
                  <Feather name={abCfg.lastError === 'dir_unavailable' ? 'alert-triangle' : 'save'} size={18}
                    color={abCfg.lastError === 'dir_unavailable' ? colors.orange : colors.green} style={{ }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optText}>
                      {abCfg.lastError === 'dir_unavailable' ? i18n.t('abDirUnavailable') : i18n.t('abBackupNow')}
                    </Text>
                    <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>
                      {abCfg.lastBackupAt
                        ? i18n.t('abLast').replace('{date}', new Date(abCfg.lastBackupAt).toLocaleDateString())
                        : i18n.t('abNever')}
                      {autoBackupService.dirDisplayName(abCfg.dirUri) ? ` · ${autoBackupService.dirDisplayName(abCfg.dirUri)}` : ''}
                    </Text>
                  </View>
                </TouchableOpacity>
              </>
            )}
```

- [ ] **Step 4: Verify + commit**

```bash
npx tsc --noEmit
npx eslint src/screens/SettingsScreen.js --quiet
git add src/screens/SettingsScreen.js
git commit -m "feat(backup): auto-backup settings block (toggle, frequency, status, run now)"
```

---

### Task 6: iOS Files keys, docs, full verification

**Files:**
- Modify: `app.json` (`expo.ios.infoPlist`)
- Modify: `FEATURES.md` (Reports & exports section — backup paragraph)

- [ ] **Step 1: app.json iOS keys**

In `expo.ios.infoPlist` (after `"ITSAppUsesNonExemptEncryption": false` add a comma to that line and append):

```json
        "UIFileSharingEnabled": true,
        "LSSupportsOpeningDocumentsInPlace": true
```

- [ ] **Step 2: FEATURES.md**

In the `## Reports & exports` section, after the paragraph describing the manual full backup (search for "backup"), append:

```markdown
**Auto backup** — optional scheduled copy: daily or weekly, written
silently on app open into a user-picked folder (Android SAF; on iOS the
app's Files-visible `backups/` dir). Keeps the newest 7
`qaizo-backup-*.json` files; restorable via the normal restore flow.
```

(If the manual-backup paragraph is elsewhere, place this right after it.)

- [ ] **Step 3: Full verification**

```bash
npm test
npx tsc --noEmit
npx eslint src/services/autoBackupService.ts src/screens/SettingsScreen.js App.js src/i18n --quiet
```
Expected: all suites pass (baseline 445 + ~20 new), tsc and eslint clean.

- [ ] **Step 4: Manual smoke checklist (device — project owner, not the agent)**

1. Settings → Данные → Автобэкап ON → folder picker → pick Downloads.
2. «Сделать сейчас» → toast «Бэкап сохранён» → file visible in file manager.
3. Status row shows date + folder.
4. Восстановить из файла → pick the auto file → data restores.
5. Hebrew UI: rows RTL-correct.

- [ ] **Step 5: Commit**

```bash
git add app.json FEATURES.md
git commit -m "chore(backup): iOS Files visibility keys + FEATURES.md"
```
