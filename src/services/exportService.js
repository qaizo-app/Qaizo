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
    category: tx.categoryName || i18n.t(tx.categoryId) || tx.categoryId,
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

// ─── HTML helpers for PDF ─────────────────────────────────
function escapeHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function fmtMoney(n) {
  const abs = Math.abs(n || 0);
  return `${sym()}${abs.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

// Group transactions by categoryId and return sorted totals with labels.
function buildCategoryBreakdown(transactions, type) {
  const totals = {};
  transactions.filter(t => t.type === type).forEach(t => {
    const key = t.categoryId || 'other';
    if (!totals[key]) totals[key] = { amount: 0, label: t.categoryName || i18n.t(t.categoryId) || t.categoryId };
    totals[key].amount += t.amount;
  });
  return Object.entries(totals).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.amount - a.amount);
}

// Group by account for account breakdown table.
function buildAccountBreakdown(transactions, accMap) {
  const totals = {};
  transactions.forEach(t => {
    const name = accMap[t.account] || '—';
    if (!totals[name]) totals[name] = { name, income: 0, expense: 0, count: 0 };
    if (t.type === 'income') totals[name].income += t.amount;
    else if (t.type === 'expense') totals[name].expense += t.amount;
    totals[name].count += 1;
  });
  return Object.values(totals).sort((a, b) => (b.income + b.expense) - (a.income + a.expense));
}

// Daily totals across the period: returns [{date:'YYYY-MM-DD', income, expense}].
function buildDailySeries(transactions) {
  const totals = {};
  transactions.forEach(t => {
    const d = formatDate(t.date || t.createdAt);
    if (!totals[d]) totals[d] = { date: d, income: 0, expense: 0 };
    if (t.type === 'income') totals[d].income += t.amount;
    else if (t.type === 'expense') totals[d].expense += t.amount;
  });
  return Object.values(totals).sort((a, b) => a.date.localeCompare(b.date));
}

// ─── PDF ──────────────────────────────────────────────────
async function exportPDF(dateFrom, dateTo) {
  const { transactions, accMap } = await getExportData(dateFrom, dateTo);
  if (transactions.length === 0) throw new Error('NO_DATA');
  const rows = buildRows(transactions, accMap);

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const net = totalIncome - totalExpense;

  const period = dateFrom && dateTo ? `${dateFrom} — ${dateTo}` : new Date().toLocaleDateString();
  const generatedAt = new Date().toLocaleString();

  const lang = i18n.getLanguage();
  const isRTL = lang === 'he' || lang === 'ar';
  const dir = isRTL ? 'rtl' : 'ltr';
  const textAlign = isRTL ? 'right' : 'left';

  // Category breakdown (expenses and income)
  const expenseCats = buildCategoryBreakdown(transactions, 'expense').slice(0, 10);
  const incomeCats = buildCategoryBreakdown(transactions, 'income').slice(0, 5);
  const maxExpCat = expenseCats[0]?.amount || 1;
  const maxIncCat = incomeCats[0]?.amount || 1;

  // Account breakdown
  const accountRows = buildAccountBreakdown(transactions, accMap);

  // Daily series + average per day
  const daily = buildDailySeries(transactions);
  const days = daily.length || 1;
  const avgPerDay = days > 0 ? (totalExpense / days) : 0;

  const rtlFlip = (s) => isRTL ? s.split('').reverse().join('') : s;

  const catBar = (amount, max, color) => `
    <div style="display:flex;align-items:center;gap:8px;">
      <div style="flex:1;background:#f1f5f9;height:6px;border-radius:3px;overflow:hidden;">
        <div style="width:${Math.max(1, Math.round((amount / max) * 100))}%;height:100%;background:${color};"></div>
      </div>
    </div>`;

  const catRow = (c, max, color) => `
    <tr>
      <td style="width:30%;">${escapeHtml(c.label)}</td>
      <td style="width:45%;">${catBar(c.amount, max, color)}</td>
      <td style="width:25%;text-align:${isRTL ? 'left' : 'right'};font-weight:600;color:${color};">${fmtMoney(c.amount)}</td>
    </tr>`;

  const tableRows = rows.map(r => `
    <tr>
      <td>${escapeHtml(r.date)}</td>
      <td>${escapeHtml(r.category)}</td>
      <td style="text-align:${isRTL ? 'left' : 'right'};color:${r.type === 'income' ? '#16a34a' : '#dc2626'};font-weight:600;white-space:nowrap;">
        ${r.type === 'income' ? '+' : '−'}${fmtMoney(r.amount)}
      </td>
      <td>${escapeHtml(r.account)}</td>
      <td>${escapeHtml(r.payee)}</td>
      <td>${escapeHtml(r.note)}</td>
    </tr>
  `).join('');

  const html = `
    <html dir="${dir}" lang="${lang}">
    <head>
      <meta charset="utf-8">
      <style>
        @page { margin: 20mm 14mm; size: A4; }
        * { box-sizing: border-box; }
        body { font-family: -apple-system, 'Helvetica Neue', 'Segoe UI', Arial, sans-serif; padding: 0; margin: 0; color: #0f172a; font-size: 11px; direction: ${dir}; text-align: ${textAlign}; }
        .brand { display: flex; align-items: center; justify-content: space-between; padding-bottom: 10px; border-bottom: 2px solid #10b981; margin-bottom: 14px; }
        .brand-logo { display: flex; align-items: center; gap: 10px; }
        .brand-badge { width: 32px; height: 32px; border-radius: 9px; background: linear-gradient(135deg,#10b981,#06b6d4); display: inline-flex; align-items: center; justify-content: center; color: white; font-weight: 800; font-size: 18px; }
        .brand-name { font-size: 20px; font-weight: 800; color: #0f172a; }
        .brand-right { text-align: ${isRTL ? 'left' : 'right'}; color: #64748b; font-size: 10px; }
        h1 { font-size: 20px; margin: 0 0 4px 0; font-weight: 700; }
        .subtitle { color: #64748b; margin-bottom: 16px; font-size: 12px; }
        .summary { display: flex; gap: 10px; margin-bottom: 18px; }
        .sum-card { flex: 1; background: #f8fafc; border-radius: 10px; padding: 12px; border: 1px solid #e2e8f0; }
        .sum-label { color: #64748b; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; margin-bottom: 4px; }
        .sum-value { font-size: 18px; font-weight: 800; }
        .green { color: #16a34a; }
        .red { color: #dc2626; }
        .section { margin-bottom: 20px; page-break-inside: avoid; }
        .section-title { font-size: 13px; font-weight: 700; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; color: #475569; border-${isRTL ? 'right' : 'left'}: 3px solid #10b981; padding-${isRTL ? 'right' : 'left'}: 8px; }
        table { width: 100%; border-collapse: collapse; font-size: 10px; }
        .brkdn { width: 100%; }
        .brkdn td { padding: 6px 4px; border-bottom: 1px solid #f1f5f9; }
        th { background: #f1f5f9; padding: 8px 6px; text-align: ${textAlign}; font-size: 10px; font-weight: 600; border-bottom: 2px solid #cbd5e1; color: #475569; }
        .tx-table td { padding: 5px 6px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
        .tx-table tr:nth-child(even) td { background: #fafbfc; }
        .two-col { display: flex; gap: 18px; }
        .two-col > .col { flex: 1; min-width: 0; }
        .mini-stats { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
        .mini-stat { flex: 1; padding: 8px 10px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; min-width: 110px; }
        .mini-label { color: #64748b; font-size: 9px; text-transform: uppercase; font-weight: 600; }
        .mini-value { font-size: 13px; font-weight: 700; margin-top: 2px; }
        .footer { margin-top: 24px; padding-top: 10px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 9px; text-align: center; }
      </style>
    </head>
    <body>
      <div class="brand">
        <div class="brand-logo">
          <div class="brand-badge">Q</div>
          <div class="brand-name">Qaizo</div>
        </div>
        <div class="brand-right">
          ${escapeHtml(i18n.t('exportData'))}<br>
          ${escapeHtml(generatedAt)}
        </div>
      </div>

      <h1>${escapeHtml(i18n.t('report') || i18n.t('exportData'))}</h1>
      <div class="subtitle">${escapeHtml(period)} · ${rows.length} ${escapeHtml(i18n.t('transactions').toLowerCase())}</div>

      <div class="summary">
        <div class="sum-card">
          <div class="sum-label">${escapeHtml(i18n.t('income'))}</div>
          <div class="sum-value green">${fmtMoney(totalIncome)}</div>
        </div>
        <div class="sum-card">
          <div class="sum-label">${escapeHtml(i18n.t('expenses'))}</div>
          <div class="sum-value red">${fmtMoney(totalExpense)}</div>
        </div>
        <div class="sum-card">
          <div class="sum-label">${escapeHtml(i18n.t('netFlow') || 'Net')}</div>
          <div class="sum-value ${net >= 0 ? 'green' : 'red'}">${net >= 0 ? '+' : '−'}${fmtMoney(net)}</div>
        </div>
      </div>

      <div class="mini-stats">
        <div class="mini-stat">
          <div class="mini-label">${escapeHtml(i18n.t('avgPerDay') || 'Avg / day')}</div>
          <div class="mini-value red">${fmtMoney(avgPerDay)}</div>
        </div>
        <div class="mini-stat">
          <div class="mini-label">${escapeHtml(i18n.t('totalTransactions') || 'Total txs')}</div>
          <div class="mini-value">${transactions.length}</div>
        </div>
        <div class="mini-stat">
          <div class="mini-label">${escapeHtml(i18n.t('days') || 'Days')}</div>
          <div class="mini-value">${days}</div>
        </div>
        <div class="mini-stat">
          <div class="mini-label">${escapeHtml(i18n.t('accounts') || 'Accounts')}</div>
          <div class="mini-value">${accountRows.length}</div>
        </div>
      </div>

      ${expenseCats.length > 0 ? `
      <div class="section">
        <div class="section-title">${escapeHtml(i18n.t('expensesByCategory') || i18n.t('expenses'))}</div>
        <table class="brkdn">
          ${expenseCats.map(c => catRow(c, maxExpCat, '#dc2626')).join('')}
        </table>
      </div>` : ''}

      ${incomeCats.length > 0 ? `
      <div class="section">
        <div class="section-title">${escapeHtml(i18n.t('incomeByCategory') || i18n.t('income'))}</div>
        <table class="brkdn">
          ${incomeCats.map(c => catRow(c, maxIncCat, '#16a34a')).join('')}
        </table>
      </div>` : ''}

      ${accountRows.length > 0 ? `
      <div class="section">
        <div class="section-title">${escapeHtml(i18n.t('accounts'))}</div>
        <table>
          <thead>
            <tr>
              <th>${escapeHtml(i18n.t('name') || 'Name')}</th>
              <th style="text-align:${isRTL ? 'left' : 'right'}">${escapeHtml(i18n.t('income'))}</th>
              <th style="text-align:${isRTL ? 'left' : 'right'}">${escapeHtml(i18n.t('expenses'))}</th>
              <th style="text-align:${isRTL ? 'left' : 'right'}">${escapeHtml(i18n.t('transactions'))}</th>
            </tr>
          </thead>
          <tbody>
            ${accountRows.map(a => `
              <tr>
                <td>${escapeHtml(a.name)}</td>
                <td style="text-align:${isRTL ? 'left' : 'right'};color:#16a34a;font-weight:600;">${fmtMoney(a.income)}</td>
                <td style="text-align:${isRTL ? 'left' : 'right'};color:#dc2626;font-weight:600;">${fmtMoney(a.expense)}</td>
                <td style="text-align:${isRTL ? 'left' : 'right'};">${a.count}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>` : ''}

      <div class="section" style="page-break-before: auto;">
        <div class="section-title">${escapeHtml(i18n.t('transactions'))}</div>
        <table class="tx-table">
          <thead>
            <tr>
              <th style="width:14%">${escapeHtml(i18n.t('date'))}</th>
              <th style="width:18%">${escapeHtml(i18n.t('category'))}</th>
              <th style="width:14%;text-align:${isRTL ? 'left' : 'right'}">${escapeHtml(i18n.t('amount'))}</th>
              <th style="width:18%">${escapeHtml(i18n.t('account'))}</th>
              <th style="width:16%">${escapeHtml(i18n.t('payee'))}</th>
              <th style="width:20%">${escapeHtml(i18n.t('note'))}</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>

      <div class="footer">
        Qaizo · qaizo.app · ${escapeHtml(generatedAt)}
      </div>
    </body>
    </html>
  `;

  const { uri } = await Print.printToFileAsync({ html });
  await shareFile(uri, 'application/pdf');
}

export default { exportCSV, exportXLS, exportPDF, _internal: { buildCategoryBreakdown, buildAccountBreakdown, buildDailySeries, escapeHtml } };
