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
  const toPrune = backups.slice(keep);
  toPrune.sort((a, b) => a.tail.localeCompare(b.tail)); // oldest first in result
  return toPrune.map(x => x.entry);
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
