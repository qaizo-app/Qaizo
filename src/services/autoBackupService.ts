// src/services/autoBackupService.ts
// Scheduled off-cloud backup: on app open, when the configured interval has
// elapsed, silently write the full data bundle as JSON into a user-picked
// folder (Android SAF; on iOS the app's Files-visible backups/ dir) and keep
// only the newest 7 files. Manual export/share lives in backupService.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import dataService from './dataService';
import { isValidBackup } from './backupService';

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

const BACKUP_RE = /^qaizo-backup-/;
// A foreign file with a stray '%' (e.g. '50% done.txt') must not throw and
// abort the whole prune scan — fall back to the raw string.
const safeDecode = (s: string) => { try { return decodeURIComponent(s); } catch (e) { return s; } };
const entryTail = (entry: string) => {
  const decoded = safeDecode(entry);
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
  const decoded = safeDecode(uri).replace(/\/+$/, '');
  const afterColon = decoded.slice(decoded.lastIndexOf(':') + 1);
  const parts = afterColon.split('/').filter(Boolean);
  return parts.slice(-2).join('/') || afterColon;
}

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
