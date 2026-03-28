// src/services/exportService.js
// Экспорт транзакций в CSV, XLS (TSV), PDF с фильтром по датам
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Alert, Platform } from 'react-native';
import i18n from '../i18n';
import { sym } from '../utils/currency';
import dataService from './dataService';

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function escapeCSV(val) {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function getExportData(dateFrom, dateTo) {
  const [transactions, accounts] = await Promise.all([
    dataService.getTransactions(),
    dataService.getAccounts(),
  ]);
  const accMap = {};
  accounts.forEach(a => { accMap[a.id] = a.name; });

  // Фильтр по датам
  let filtered = transactions;
  if (dateFrom || dateTo) {
    filtered = transactions.filter(tx => {
      const d = formatDate(tx.date || tx.createdAt);
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      return true;
    });
  }

  return { transactions: filtered, accMap };
}

function buildRows(transactions, accMap) {
  return transactions.map(tx => ({
    date: formatDate(tx.date || tx.createdAt),
    type: tx.type,
    category: i18n.t(tx.categoryId) || tx.categoryId,
    amount: tx.amount,
    account: accMap[tx.account] || '',
    payee: tx.recipient || '',
    note: tx.note || '',
    tags: (tx.tags || []).join(', '),
  }));
}

const HEADERS = () => [
  i18n.t('date'), i18n.t('type'), i18n.t('category'), i18n.t('amount'),
  i18n.t('account'), i18n.t('payee'), i18n.t('note'), i18n.t('tags') || 'Tags',
];

async function shareFile(path, mimeType) {
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    Alert.alert('', 'Sharing is not available on this device');
    return;
  }
  await Sharing.shareAsync(path, { mimeType, dialogTitle: 'Qaizo Export' });
}

// ─── CSV ──────────────────────────────────────────────────
async function exportCSV(dateFrom, dateTo) {
  const { transactions, accMap } = await getExportData(dateFrom, dateTo);
  if (transactions.length === 0) throw new Error('NO_DATA');
  const rows = buildRows(transactions, accMap);
  const headers = HEADERS();

  let csv = headers.map(escapeCSV).join(',') + '\n';
  rows.forEach(r => {
    csv += [r.date, r.type, r.category, r.amount, r.account, r.payee, r.note, r.tags]
      .map(escapeCSV).join(',') + '\n';
  });

  const bom = '\uFEFF';
  const path = FileSystem.cacheDirectory + `qaizo_${Date.now()}.csv`;
  await FileSystem.writeAsStringAsync(path, bom + csv, {});
  await shareFile(path, 'text/csv');
}

// ─── XLS (TSV) ────────────────────────────────────────────
async function exportXLS(dateFrom, dateTo) {
  const { transactions, accMap } = await getExportData(dateFrom, dateTo);
  if (transactions.length === 0) throw new Error('NO_DATA');
  const rows = buildRows(transactions, accMap);
  const headers = HEADERS();

  let tsv = headers.join('\t') + '\n';
  rows.forEach(r => {
    tsv += [r.date, r.type, r.category, r.amount, r.account, r.payee, r.note, r.tags].join('\t') + '\n';
  });

  const bom = '\uFEFF';
  const path = FileSystem.cacheDirectory + `qaizo_${Date.now()}.xls`;
  await FileSystem.writeAsStringAsync(path, bom + tsv, {});
  await shareFile(path, 'application/vnd.ms-excel');
}

// ─── PDF ──────────────────────────────────────────────────
async function exportPDF(dateFrom, dateTo) {
  const { transactions, accMap } = await getExportData(dateFrom, dateTo);
  if (transactions.length === 0) throw new Error('NO_DATA');
  const rows = buildRows(transactions, accMap);

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const period = dateFrom && dateTo ? `${dateFrom} — ${dateTo}` : new Date().toLocaleDateString();

  const tableRows = rows.map(r => `
    <tr>
      <td>${r.date}</td>
      <td>${r.type}</td>
      <td>${r.category}</td>
      <td style="text-align:right;color:${r.type === 'income' ? '#22c55e' : '#ef4444'}">${sym()}${r.amount.toLocaleString()}</td>
      <td>${r.account}</td>
      <td>${r.payee}</td>
    </tr>
  `).join('');

  const html = `
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, sans-serif; padding: 20px; font-size: 12px; }
        h1 { font-size: 22px; margin-bottom: 4px; }
        .subtitle { color: #666; margin-bottom: 20px; }
        .summary { display: flex; gap: 30px; margin-bottom: 20px; }
        .summary-label { color: #666; font-size: 11px; }
        .summary-value { font-size: 18px; font-weight: 700; }
        .green { color: #22c55e; }
        .red { color: #ef4444; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #f1f5f9; padding: 8px; text-align: left; font-size: 11px; font-weight: 600; border-bottom: 2px solid #e2e8f0; }
        td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; }
        tr:nth-child(even) { background: #f8fafc; }
      </style>
    </head>
    <body>
      <h1>Qaizo — ${i18n.t('exportData')}</h1>
      <div class="subtitle">${period} · ${rows.length} ${i18n.t('transactions').toLowerCase()}</div>
      <div class="summary">
        <div class="summary-item">
          <div class="summary-label">${i18n.t('income')}</div>
          <div class="summary-value green">${sym()}${totalIncome.toLocaleString()}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">${i18n.t('expenses')}</div>
          <div class="summary-value red">${sym()}${totalExpense.toLocaleString()}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">${i18n.t('totalBalance')}</div>
          <div class="summary-value">${sym()}${(totalIncome - totalExpense).toLocaleString()}</div>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>${i18n.t('date')}</th>
            <th>${i18n.t('type')}</th>
            <th>${i18n.t('category')}</th>
            <th style="text-align:right">${i18n.t('amount')}</th>
            <th>${i18n.t('account')}</th>
            <th>${i18n.t('payee')}</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    </body>
    </html>
  `;

  const { uri } = await Print.printToFileAsync({ html });
  await shareFile(uri, 'application/pdf');
}

export default { exportCSV, exportXLS, exportPDF };
