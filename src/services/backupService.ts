// src/services/backupService.ts
// Full off-Firebase backup: export the entire data bundle to a JSON file the
// user can save/share (Drive, email, …), and restore it back via a file pick.
// Data already lives in Firestore; this is a manual redundant copy in case the
// account itself is lost.
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import dataService from './dataService';

const KNOWN_STORES = ['transactions', 'accounts', 'investments', 'categories', 'settings', 'budgets', 'recurring', 'tags', 'projects', 'goals'];

// A picked file is a Qaizo backup if it's an object carrying at least one of
// the stores we know how to restore. Pure — guards the restore flow.
export function isValidBackup(data: any): boolean {
  if (!data || typeof data !== 'object') return false;
  return KNOWN_STORES.some(k => k in data);
}

// Export the full bundle as a JSON file and open the share sheet.
export async function exportBackup(): Promise<'ok' | 'empty' | 'error'> {
  try {
    const data = await dataService.exportData();
    if (!data) return 'error';
    if (!isValidBackup(data)) return 'empty';
    const json = JSON.stringify(data, null, 2);
    const date = new Date().toISOString().slice(0, 10);
    const path = FileSystem.cacheDirectory + `qaizo-backup-${date}.json`;
    await FileSystem.writeAsStringAsync(path, json, {});
    if (!(await Sharing.isAvailableAsync())) return 'error';
    await Sharing.shareAsync(path, { mimeType: 'application/json', dialogTitle: 'Qaizo Backup' });
    return 'ok';
  } catch (e) {
    if (__DEV__) console.error('exportBackup:', e);
    return 'error';
  }
}

type PickResult = { ok: true; data: any } | { ok: false; reason: 'cancelled' | 'invalid' | 'error' };

// Pick a JSON backup file, parse and validate it. Does NOT restore — the caller
// confirms first (restore overwrites existing settings/categories/budgets).
export async function pickBackupFile(): Promise<PickResult> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/json', 'text/plain', '*/*'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return { ok: false, reason: 'cancelled' };
    const content = await FileSystem.readAsStringAsync(result.assets[0].uri);
    let data: any;
    try { data = JSON.parse(content.replace(/^﻿/, '')); }
    catch { return { ok: false, reason: 'invalid' }; }
    if (!isValidBackup(data)) return { ok: false, reason: 'invalid' };
    return { ok: true, data };
  } catch (e) {
    if (__DEV__) console.error('pickBackupFile:', e);
    return { ok: false, reason: 'error' };
  }
}

export default { exportBackup, pickBackupFile, isValidBackup };
