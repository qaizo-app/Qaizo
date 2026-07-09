# Automatic Backup — Design

**Date:** 2026-07-09
**Status:** Approved by user (chat), pending spec review
**Owner:** Sean (service) + Alex (Settings UI)

## Problem

Qaizo has a manual backup (Settings → Данные → export JSON via share
sheet), but it only helps users who remember to run it. The user wants a
scheduled backup — daily or weekly, their choice — that runs without any
interaction. Data already lives in Firestore for signed-in users; this is
the redundant off-cloud copy for account loss, cloud corruption, and
guest-mode users.

## Decisions made with the user

1. **Destination: a user-picked folder** (Android Storage Access
   Framework). On enabling, the user picks a folder once; the persisted
   SAF permission lets the app write there silently afterwards. Files
   survive app uninstall and are visible in any file manager.
   (Rejected: app-internal folder — dies with uninstall; share-sheet
   reminders — not automatic.)
2. **Retention: keep the newest 7** `qaizo-backup-*.json` files in the
   folder; older ones are deleted after each successful backup.
3. **Trigger: check at app open** (like `autoExecuteRecurring`), not a
   background task. If the app wasn't opened, no data changed — the
   existing backup is still current. No new native dependencies.
4. **Frequency: daily or weekly**, user choice, default weekly. Feature
   default OFF (it cannot work until the user picks a folder anyway).

## Non-goals

- No cloud upload (Google Drive has no SAF write target; the manual
  share-sheet export remains the way to push a copy to Drive/email).
- No background/killed-app scheduling (expo-background-fetch rejected:
  native module + OEM battery killers + adds nothing given trigger
  reasoning above).
- No encryption of the backup file (matches the existing manual export).
- No separate restore flow — the existing "Восстановить из файла" picker
  already reads these JSON files.

## Config (device-local)

AsyncStorage key `auto_backup_config` (NOT Firestore settings — `dirUri`
is a per-device SAF URI and means nothing on another phone):

```ts
interface AutoBackupConfig {
  enabled: boolean;          // default false
  frequency: 'daily' | 'weekly';  // default 'weekly'
  dirUri: string | null;     // SAF tree URI (Android) / documents subdir (iOS)
  lastBackupAt: string | null; // ISO datetime of last successful auto backup
  lastError: string | null;  // short status code for the Settings row, e.g. 'dir_unavailable'
}
```

## Service — `src/services/autoBackupService.ts`

Pure helpers (unit-tested, no I/O):

```ts
isDue(config, now)      // enabled && dirUri && date-string day-diff >= (daily?1:7)
                        // day diff computed on 'YYYY-MM-DD' slices via Date.UTC —
                        // timezone-free (lesson from pension avgMonthlyDeposit)
filesToPrune(names, keep = 7)  // filter qaizo-backup-*.json, sort desc by name
                               // (names embed sortable timestamps), return the tail
buildBackupFilename(now)       // 'qaizo-backup-YYYY-MM-DD-HHmm.json'
```

I/O functions (tested with mocked FileSystem/SAF):

```ts
getConfig() / saveConfig(patch)   // AsyncStorage JSON
pickBackupDir()                   // Android: StorageAccessFramework.requestDirectoryPermissionsAsync
                                  // iOS: ensure documentDirectory + 'backups/' exists, return it
runAutoBackup(now = new Date())   // main entry:
  // 1. getConfig → isDue? else return 'skipped'
  // 2. dataService.exportData() → isValidBackup guard (reuse from backupService)
  // 3. write JSON via SAF createFileAsync + writeAsStringAsync
  //    (iOS: FileSystem.writeAsStringAsync into the backups subdir)
  // 4. prune: SAF readDirectoryAsync → filesToPrune → deleteAsync each
  // 5. saveConfig({ lastBackupAt: now.toISOString(), lastError: null }) → 'ok'
  // Any failure: saveConfig({ lastError: code }), never throw → 'error'
runNow()                          // manual "Сделать сейчас": same as runAutoBackup but skips isDue
```

Wire-up: `App.js` startup calls `autoBackupService.runAutoBackup()`
fire-and-forget after the existing startup work (alongside
`autoExecuteRecurring`), guarded to run once per app session. A failed
or skipped run never blocks or delays startup.

Error policy: if the folder became unavailable (revoked permission,
deleted folder), keep `enabled: true`, record `lastError:
'dir_unavailable'`, surface it in Settings; retry on every app open.
Never silently disable.

## Settings UI (SettingsScreen → Данные section)

New block under the existing manual backup rows:

1. **Toggle «Автобэкап»** — turning ON opens the folder picker when
   `dirUri` is null (first enable) or marked unavailable; if the user
   cancels the picker, the toggle reverts to off. Turning OFF keeps
   `dirUri`, so re-enabling reuses the folder without re-picking
   (Android persisted permission allowing).
2. **Frequency chips** «Ежедневно | Еженедельно» (visible when enabled).
3. **Status row** (muted): last backup date + folder display name, or
   «⚠ Папка недоступна — выбери заново» when `lastError ===
   'dir_unavailable'` (tapping it reopens the picker).
4. **Button «Сделать сейчас»** — calls `runNow()`, shows a toast/inline
   result. Useful for QA and for building trust in the feature.

RTL/i18n: standard project rules (createSt factory, i18n.row(), RowText,
~10 new keys × 11 languages).

## iOS specifics

No SAF on iOS. `pickBackupDir()` returns
`FileSystem.documentDirectory + 'backups/'` without a picker. To make
those files user-visible in the Files app, add to app.json ios.infoPlist:
`UIFileSharingEnabled: true`, `LSSupportsOpeningDocumentsInPlace: true`
(config-only change; takes effect on the next iOS build). The Settings
folder row shows «Files → Qaizo → backups».

## Edge cases

- Picker cancelled on enable → toggle stays off, no config change.
- `exportData()` returns null/empty → 'error', `lastError: 'export'`,
  no file written, no prune.
- Prune failures are non-fatal: backup counts as successful if the file
  was written (prune retried next run).
- Duplicate run in one day (manual + auto): `runNow` always writes;
  filenames include HHmm so same-day files don't collide.
- Restoring from an auto file: existing pickBackupFile flow — no change.
- Guest and signed-in users both supported (exportData already handles
  both backends).

## Testing

- `__tests__/autoBackupService.test.js`: isDue (daily/weekly, boundary
  day, disabled, no dir, never-backed-up), filesToPrune (mixed names,
  fewer than 7, non-backup files ignored), buildBackupFilename; and
  runAutoBackup against mocked AsyncStorage + FileSystem/SAF: writes and
  updates lastBackupAt; skips when not due; records lastError and stays
  enabled on SAF failure; prunes to 7.
- Settings UI: no tests (project convention).

## Rollout

Ships in the next preview APK (vc39 build was paused for this feature —
resumes after implementation). No migration; absent config = feature off.
