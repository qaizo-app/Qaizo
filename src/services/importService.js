// src/services/importService.js
// Import transactions from CSV/TSV/Excel files
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import dataService from './dataService';
import { sym } from '../utils/currency';

// Known category mappings (multilingual)
const CATEGORY_MAP = {
  // English
  'food': 'food', 'grocery': 'food', 'supermarket': 'food',
  'restaurant': 'restaurant', 'cafe': 'restaurant', 'coffee': 'restaurant',
  'transport': 'transport', 'taxi': 'transport', 'bus': 'transport',
  'fuel': 'fuel', 'gas': 'fuel', 'petrol': 'fuel',
  'health': 'health', 'pharmacy': 'health', 'doctor': 'health',
  'phone': 'phone', 'mobile': 'phone', 'cellular': 'phone',
  'utilities': 'utilities', 'electricity': 'utilities', 'water': 'utilities',
  'clothing': 'clothing', 'clothes': 'clothing',
  'household': 'household', 'home': 'household',
  'kids': 'kids', 'children': 'kids', 'school': 'kids',
  'entertainment': 'entertainment', 'cinema': 'entertainment', 'netflix': 'entertainment',
  'education': 'education', 'course': 'education', 'book': 'education',
  'cosmetics': 'cosmetics', 'beauty': 'cosmetics',
  'electronics': 'electronics', 'computer': 'electronics',
  'insurance': 'insurance',
  'rent': 'rent', 'apartment': 'rent',
  'salary': 'salary_me', 'income': 'other_income',
  // Russian
  'еда': 'food', 'продукты': 'food', 'супермаркет': 'food',
  'ресторан': 'restaurant', 'кафе': 'restaurant',
  'транспорт': 'transport', 'такси': 'transport',
  'топливо': 'fuel', 'бензин': 'fuel',
  'здоровье': 'health', 'аптека': 'health',
  'связь': 'phone', 'телефон': 'phone',
  'коммунальные': 'utilities',
  'одежда': 'clothing', 'обувь': 'clothing',
  'дом и быт': 'household',
  'дети': 'kids',
  'развлечения': 'entertainment',
  'образование': 'education',
  'косметика': 'cosmetics',
  'электроника': 'electronics',
  'страховка': 'insurance',
  'аренда жилья': 'rent', 'аренда': 'rent',
  'зарплата': 'salary_me', 'доход': 'other_income',
  // Hebrew
  'אוכל': 'food', 'מזון': 'food',
  'מסעדה': 'restaurant', 'קפה': 'restaurant',
  'תחבורה': 'transport', 'מונית': 'transport',
  'דלק': 'fuel',
  'בריאות': 'health',
  'סלולר': 'phone',
  'חשבונות': 'utilities',
  'ביגוד': 'clothing',
  'בית ומשק': 'household',
  'ילדים': 'kids',
  'בילויים': 'entertainment',
  'חינוך': 'education',
  'קוסמטיקה': 'cosmetics',
  'אלקטרוניקה': 'electronics',
  'ביטוח': 'insurance',
  'שכר דירה': 'rent',
  'משכורת': 'salary_me', 'הכנסה': 'other_income',
};

function resolveCategory(name) {
  if (!name) return 'other';
  const lower = name.toLowerCase().trim();
  return CATEGORY_MAP[lower] || 'other';
}

function detectDelimiter(line) {
  // Count occurrences outside quotes
  let counts = { ';': 0, ',': 0, '\t': 0 };
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && counts[ch] !== undefined) counts[ch]++;
  }
  // Prefer semicolon if present (common in EU exports), then tab, then comma
  if (counts[';'] >= 3) return ';';
  if (counts['\t'] >= 3) return '\t';
  return ',';
}

let _delimiter = null;

function parseCSVLine(line) {
  if (!_delimiter) _delimiter = detectDelimiter(line);
  const delim = _delimiter;
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else current += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === delim) { result.push(current.trim()); current = ''; }
      else current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function detectFormat(headers) {
  const h = headers.map(s => s.toLowerCase().replace(/["\uFEFF]/g, '').trim());

  // Wallet/Bluecoins format: account;category;currency;amount;...;type;payment_type;...
  if (h.includes('account') && h.includes('category') && h.includes('payment_type')) return 'wallet';
  if (h.includes('payment_type_local') || h.includes('ref_currency_amount')) return 'wallet';

  // Qaizo own format: Date, Type, Category, Amount, Account, Payee, Note, Tags
  if (h.includes('type') && h.includes('amount') && h.includes('category')) return 'qaizo';
  if (h.includes('тип') || h.includes('סוג')) return 'qaizo';

  // Bank format: Date, Description, Amount (or Debit/Credit)
  if (h.some(x => x.includes('date') || x.includes('дата') || x.includes('תאריך'))) {
    if (h.some(x => x.includes('amount') || x.includes('сумма') || x.includes('סכום') || x.includes('debit') || x.includes('credit'))) {
      return 'bank';
    }
  }

  return 'generic';
}

function parseDate(val) {
  if (!val) return new Date().toISOString();
  const v = val.trim();

  // ISO: 2024-03-28 or 2024-03-28 14:30:00
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) {
    const d = new Date(v.replace(' ', 'T'));
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  }

  // DD/MM/YYYY or DD.MM.YYYY (with optional time suffix)
  const dmyMatch = v.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    const mi = parseInt(m) - 1;
    if (mi >= 0 && mi <= 11 && parseInt(d) >= 1 && parseInt(d) <= 31) {
      return new Date(parseInt(y), mi, parseInt(d)).toISOString();
    }
  }

  // MM/DD/YYYY (American format) — try if month > 12 failed above
  const mdyMatch = v.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})/);
  if (mdyMatch) {
    const [, m, d, y] = mdyMatch;
    const dt = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    if (!isNaN(dt.getTime())) return dt.toISOString();
  }

  // Fallback
  const d = new Date(v);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function parseAmount(val) {
  if (!val) return 0;
  let s = String(val).replace(/[₪$€£\s]/g, '').replace(/[()]/g, '');
  // Handle comma as decimal separator: "231,80" → "231.80"
  // If there's a comma and no dot, or comma is after dot, treat comma as decimal
  if (s.includes(',') && !s.includes('.')) {
    // "1 234,56" or "231,80" → replace last comma with dot
    s = s.replace(/,(?=\d{1,2}$)/, '.');
    s = s.replace(/,/g, ''); // remove remaining commas (thousands)
  } else {
    s = s.replace(/,/g, ''); // standard: comma = thousands separator
  }
  return Math.abs(parseFloat(s) || 0);
}

function parseQaizoRow(cols, headerMap) {
  const get = (key) => cols[headerMap[key]] || '';
  const amount = parseAmount(get('amount'));
  if (amount === 0) return null;

  const type = (get('type') || '').toLowerCase();
  const isIncome = type.includes('income') || type.includes('доход') || type.includes('הכנסה');

  return {
    date: parseDate(get('date')),
    type: isIncome ? 'income' : 'expense',
    amount,
    categoryId: resolveCategory(get('category')),
    recipient: get('payee') || get('recipient') || '',
    note: get('note') || '',
    tags: get('tags') ? get('tags').split(',').map(s => s.trim()).filter(Boolean) : [],
    currency: sym(),
  };
}

function parseBankRow(cols, headerMap) {
  const get = (key) => cols[headerMap[key]] || '';

  // Try amount column first — negative = expense, positive = income
  let amount = 0;
  let type = 'expense';
  const rawAmount = get('amount') || get('sum') || '';

  if (rawAmount) {
    const cleaned = String(rawAmount).replace(/[₪$€£\s]/g, '');
    const isNeg = cleaned.startsWith('-') || cleaned.includes('(');
    amount = parseAmount(rawAmount);
    type = isNeg ? 'expense' : 'income';
  }

  // Try separate debit/credit columns
  if (amount === 0) {
    const debit = parseAmount(get('debit'));
    const credit = parseAmount(get('credit'));
    if (credit > 0) { amount = credit; type = 'income'; }
    else if (debit > 0) { amount = debit; type = 'expense'; }
  }

  // Last resort: find any numeric column
  if (amount === 0) {
    for (const col of cols) {
      const n = parseAmount(col);
      if (n > 0) { amount = n; break; }
    }
  }
  if (amount === 0) return null;

  const description = get('description') || get('desc') || get('memo') || get('details') || get('payee') || '';

  return {
    date: parseDate(get('date')),
    type,
    amount,
    categoryId: resolveCategory(description) || 'other',
    recipient: description,
    note: '',
    tags: [],
    currency: sym(),
  };
}

function parseWalletRow(cols, headerMap) {
  const get = (key) => cols[headerMap[key]] || '';
  const amount = parseAmount(get('amount'));
  if (amount === 0) return null;

  // Skip transfers between regular accounts (keep investment/pension transfers)
  const rawType = get('type').toLowerCase();
  const rawCatRaw = get('category');
  const transferCol = get('transfer').toLowerCase();
  const isTransfer = transferCol === 'true' ||
    rawCatRaw.toUpperCase() === 'TRANSFER' ||
    rawType.includes('перевод') || rawType.includes('transfer');
  const accName = get('account').toLowerCase();
  const isInvestmentAcc = /השתלמות|קרן|גמל|פנסי|השקע|invest|пенси|pension|накопит|крипто|crypto|фонд|kupat|gemel|keren/i.test(accName);
  if (isTransfer && !isInvestmentAcc) return null;

  // Type: Расходы/Доходы or expense/income
  const isIncome = rawType.includes('доход') || rawType.includes('income') || rawType.includes('הכנסה');

  // Category mapping from wallet apps
  const walletCategoryMap = {
    'еда': 'food', 'еда и напитки': 'food', 'фрукты и овощи': 'food',
    'алкогольные напитки': 'food', 'безалкогольные напитки': 'food',
    'ресторан, фастфуд': 'restaurant', 'ресторан': 'restaurant',
    'транспорт': 'transport', 'общественный транспорт': 'transport',
    'топливо': 'fuel', 'парковка': 'transport',
    'здравоохранение, врач': 'health', 'здравоохранение': 'health',
    'аптека, магазин бытовой химии': 'health', 'аптека': 'health',
    'телефон': 'phone', 'сотовая связь': 'phone',
    'электричество дом': 'utilities', 'электричество салон': 'utilities',
    'электричество': 'utilities',
    'вода салон': 'utilities', 'вода дом': 'utilities', 'вода': 'utilities',
    'газ': 'utilities',
    'одежда и обувь': 'clothing', 'одежда': 'clothing',
    'товары для дома': 'household', 'умный дом': 'household',
    'дети': 'kids',
    'интернет и тв': 'entertainment', 'интернет салон': 'entertainment',
    'интернет': 'entertainment',
    'книги, аудио, подписки': 'entertainment', 'подписки': 'entertainment',
    'образование': 'education',
    'косметика': 'cosmetics', 'тралерика': 'cosmetics',
    'электроника, аксессуары': 'electronics', 'электроника': 'electronics',
    'страхование автомобиля': 'insurance', 'страхование жизни': 'insurance',
    'страхование жилья': 'insurance', 'медицинское страхование': 'insurance',
    'социальное страхование': 'insurance', 'страхование': 'insurance', 'страховка': 'insurance',
    'аренда': 'rent', 'аренда склада': 'rent',
    'арнона': 'arnona', 'муниципальный налог дом': 'arnona', 'муниципальный налог салон': 'arnona',
    'ваад байт': 'vaad',
    'зарплата': 'salary_me', 'зарплата алекс': 'salary_me', 'зарплата алекса': 'salary_me',
    'зарплата александра': 'salary_spouse',
    'доход от аренды': 'rental_income',
    'подработка': 'handyman', 'handyman': 'handyman', 'продажа': 'sales',
    'комиссия банка': 'other', 'комиссия за карту': 'other',
    'процент за минус на карте': 'other', 'процент за овердрафт': 'other',
    'юридические услуги': 'other', 'сервисы': 'other',
    'реклама': 'other', 'обслуживание, ремонт': 'household',
    'благотворительность, подарки': 'other', 'подарки и пожертвования': 'other',
    'собачий корм': 'other', 'алкоголь, табак': 'food',
    'налоги': 'other', 'тест': 'other',
    // Income categories
    'работодатель инвестиции': 'other_income',
    'пособие на детей': 'other_income',
    'возвраты (налоги, покупки)': 'other_income',
    'процент от вложений': 'other_income',
    'доход': 'other_income',
  };

  // Use custom_category first, then category
  const customCat = get('custom_category').toLowerCase().trim();
  const rawCat = rawCatRaw.toLowerCase().trim();
  let categoryId = (customCat && walletCategoryMap[customCat]) ||
    walletCategoryMap[rawCat] || resolveCategory(rawCat);

  // Fuzzy match: try partial matching if exact match failed
  if (!categoryId || categoryId === 'other') {
    const catToMatch = customCat || rawCat;
    // First try exact substring in map keys
    for (const [key, val] of Object.entries(walletCategoryMap)) {
      if (val !== 'other' && (catToMatch.includes(key) || key.includes(catToMatch))) {
        categoryId = val;
        break;
      }
    }
  }
  // Keyword-based fallback for unmapped categories
  if (!categoryId || categoryId === 'other') {
    const cat = (customCat || rawCat);
    const kwMap = [
      [/еда|продукт|напит|алкогол|фрукт|овощ/, 'food'],
      [/рестора|фастфуд|кафе/, 'restaurant'],
      [/одежд|обувь/, 'clothing'],
      [/транспорт|такси|парков|автобус/, 'transport'],
      [/топлив|бензин|делек/, 'fuel'],
      [/здоров|врач|аптек|медиц|стомат|доктор/, 'health'],
      [/телефон|сотов|связ|голан/, 'phone'],
      [/электрич|вода|газ|коммунал|безек/, 'utilities'],
      [/интернет|netflix|подпис|книг|аудио/, 'entertainment'],
      [/страхов|ביטוח/, 'insurance'],
      [/аренд|склад/, 'rent'],
      [/арнон|муниципал|налог.*дом|налог.*салон/, 'arnona'],
      [/ваад|байт/, 'vaad'],
      [/косметик|тралерик/, 'cosmetics'],
      [/электрон|аксессуар/, 'electronics'],
      [/дом|быт|ремонт|обслужив|умный/, 'household'],
      [/дети|ребен|школ|садик/, 'kids'],
      [/образован|курс|учеб/, 'education'],
      [/зарплат.*алекс|зарплат.*я/, 'salary_me'],
      [/зарплат.*александр|зарплат.*супруг/, 'salary_spouse'],
      [/подработ|handyman/, 'handyman'],
      [/продаж/, 'sales'],
      [/аренд.*доход|доход.*аренд/, 'rental_income'],
      [/пособ|возврат|инвестиц.*работод|процент.*вложен/, 'other_income'],
      [/реклам|юридич|сервис|комисс|процент.*минус|процент.*овердрафт|налог/, 'other'],
    ];
    for (const [re, val] of kwMap) {
      if (re.test(cat)) { categoryId = val; break; }
    }
  }
  if (!categoryId) categoryId = isIncome ? 'other_income' : 'other';

  // Force income type for income categories regardless of CSV type column
  const INCOME_CATEGORIES = ['salary_me', 'salary_spouse', 'rental_income', 'handyman', 'sales', 'other_income'];
  const finalType = INCOME_CATEGORIES.includes(categoryId) ? 'income' : (isIncome ? 'income' : 'expense');

  // Account name and payment type from CSV
  const accountName = get('account').trim();
  const paymentType = get('payment_type').toLowerCase().trim();

  // Determine account type from payment_type column and account name
  const accLower = accountName.toLowerCase();
  let accountType = 'bank';
  if (paymentType.includes('cash') || paymentType.includes('налич') || paymentType.includes('מזומן') ||
      accLower.includes('кошел') || accLower.includes('cash')) {
    accountType = 'cash';
  } else if (paymentType.includes('credit') || paymentType.includes('кредит') || paymentType.includes('אשראי') ||
      /visa|mastercard|master\s?card|amex|american express|max|cal|isracard|diners/i.test(accountName)) {
    accountType = 'credit';
  } else if (/инвестиц|השקע|invest|брокер|broker|тинькофф инвест|interactive brokers/i.test(accLower) ||
      /крипто|crypto|bitcoin|биткоин/i.test(accLower)) {
    accountType = /крипто|crypto|bitcoin|биткоин/i.test(accLower) ? 'crypto' : 'investment';
  } else if (/השתלמות|קרן|גמל|פנסי|пенси|pension|накопит|hishtalmut|gemel|kupat/i.test(accLower) ||
      /קופת|keren|фонд/i.test(accLower)) {
    accountType = 'investment';
  }

  return {
    date: parseDate(get('date')),
    type: finalType,
    amount,
    categoryId,
    recipient: get('payee') || get('note') || '',
    note: get('note') || '',
    tags: get('labels') ? get('labels').split(',').map(s => s.trim()).filter(Boolean) : [],
    currency: sym(),
    _accountName: accountName,
    _accountType: accountType,
  };
}

function parseGenericRow(cols) {
  // Best effort: find date-like and number columns
  let date = new Date().toISOString();
  let amount = 0;
  let description = '';

  for (const col of cols) {
    if (!col) continue;
    const n = parseAmount(col);
    if (n > 0 && amount === 0) { amount = n; continue; }
    if (/\d{4}[-/]\d{2}[-/]\d{2}/.test(col) || /\d{1,2}[/.]\d{1,2}[/.]\d{4}/.test(col)) {
      date = parseDate(col); continue;
    }
    if (col.length > 2 && !description) description = col;
  }

  if (amount === 0) return null;
  return { date, type: 'expense', amount, categoryId: 'other', recipient: description, note: '', tags: [], currency: sym() };
}

// ─── Parse with custom column mapping ─────────────────────
function parseWithMapping(lines, mapping) {
  const parsed = [];
  const errors = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < 2) continue;

    const get = (field) => mapping[field] !== undefined && mapping[field] !== -1 ? (cols[mapping[field]] || '') : '';
    const amount = parseAmount(get('amount'));
    if (amount === 0) { errors.push(i + 1); continue; }

    const rawType = get('type').toLowerCase();
    const rawAmount = get('amount');
    const isNeg = rawAmount.includes('-') || rawAmount.includes('(');
    const isIncome = rawType.includes('income') || rawType.includes('доход') || rawType.includes('הכנסה') || (!rawType && !isNeg);

    parsed.push({
      date: parseDate(get('date')),
      type: isIncome ? 'income' : 'expense',
      amount,
      categoryId: resolveCategory(get('category')) || 'other',
      recipient: get('payee') || '',
      note: get('note') || '',
      tags: [],
      currency: sym(),
    });
  }
  return { transactions: parsed, errorLines: errors };
}

// ─── Main import function ────────────────────────────────
async function pickAndParseFile() {
  try {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['text/csv', 'text/plain', 'text/tab-separated-values', 'application/vnd.ms-excel',
           'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '*/*'],
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets?.[0]) return { success: false, error: 'cancelled' };

  const file = result.assets[0];
  _delimiter = null; // Reset delimiter detection for new file
  let content;
  try {
    content = await FileSystem.readAsStringAsync(file.uri);
  } catch (readErr) {
    if (__DEV__) console.error('File read error:', readErr);
    return { success: false, error: 'read_error' };
  }

  // Remove BOM
  const text = content.replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { success: false, error: 'empty' };

  // Parse headers
  const headers = parseCSVLine(lines[0]);
  const format = detectFormat(headers);

  // Build header map (lowercase key → index)
  const headerMap = {};
  headers.forEach((h, i) => {
    const key = h.toLowerCase().replace(/["\uFEFF]/g, '').trim();
    headerMap[key] = i;
    // Common aliases
    if (key.includes('date') || key === 'дата' || key === 'תאריך') headerMap['date'] = i;
    if (key.includes('amount') || key === 'сумма' || key === 'סכום') headerMap['amount'] = i;
    if (key.includes('type') || key === 'тип' || key === 'סוג') headerMap['type'] = i;
    if ((key.includes('categ') && !key.includes('custom')) || key === 'категория' || key === 'קטגוריה') headerMap['category'] = i;
    if (key.includes('payee') || key === 'получатель' || key === 'מוטב') headerMap['payee'] = i;
    if (key.includes('note') || key === 'заметка' || key === 'הערה') headerMap['note'] = i;
    if (key.includes('tag') || key === 'теги' || key === 'תגיות') headerMap['tags'] = i;
    if (key.includes('account') || key === 'счёт' || key === 'חשבון') headerMap['account'] = i;
    if (key.includes('desc') || key.includes('memo') || key.includes('detail')) headerMap['description'] = i;
    if (key.includes('debit') || key === 'дебет') headerMap['debit'] = i;
    if (key.includes('credit') || key === 'кредит') headerMap['credit'] = i;
    if (key.includes('recipient')) headerMap['recipient'] = i;
    if (key === 'transfer') headerMap['transfer'] = i;
    if (key === 'labels') headerMap['labels'] = i;
    if (key === 'payment_type') headerMap['payment_type'] = i;
    if (key === 'custom_category') headerMap['custom_category'] = i;
  });

  // Parse rows
  const parsed = [];
  const errors = [];
  let skippedTransfers = 0, skippedZero = 0, skippedShort = 0;
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < 2) { skippedShort++; continue; }

    // For wallet format, pre-check transfer to count separately
    if (format === 'wallet') {
      const get = (key) => cols[headerMap[key]] || '';
      const rt = get('type').toLowerCase();
      const tc = get('transfer').toLowerCase();
      const cat = get('category');
      const isTransferRow = tc === 'true' || cat.toUpperCase() === 'TRANSFER' || rt.includes('перевод') || rt.includes('transfer');
      if (isTransferRow) {
        // Keep transfers to/from investment/pension accounts
        const acc = get('account').toLowerCase();
        const isInvestmentAcc = /השתלמות|קרן|גמל|פנסי|השקע|invest|пенси|pension|накопит|крипто|crypto|фонд|kupat|gemel|keren/i.test(acc);
        if (!isInvestmentAcc) {
          skippedTransfers++;
          errors.push(i + 1);
          continue;
        }
        // Investment transfers will be parsed as regular transactions below
      }
    }

    let tx = null;
    if (format === 'wallet') tx = parseWalletRow(cols, headerMap);
    else if (format === 'qaizo') tx = parseQaizoRow(cols, headerMap);
    else if (format === 'bank') tx = parseBankRow(cols, headerMap);
    else tx = parseGenericRow(cols);

    if (tx) parsed.push(tx);
    else { skippedZero++; errors.push(i + 1); }
  }
  // Log category and account stats
  const catCounts = {};
  const acctCounts = {};
  for (const tx of parsed) {
    catCounts[tx.categoryId] = (catCounts[tx.categoryId] || 0) + 1;
    if (tx._accountName) acctCounts[tx._accountName] = (acctCounts[tx._accountName] || 0) + 1;
  }
  // Collect raw category values that mapped to 'other'
  const rawOtherCats = {};
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < 2) continue;
    const rawCat = (cols[headerMap['category']] || '').trim();
    const customCat = (cols[headerMap['custom_category']] || '').trim();
    const cat = customCat || rawCat;
    if (cat) rawOtherCats[cat] = (rawOtherCats[cat] || 0) + 1;
  }

  // Sample rows for preview
  const sampleRows = [];
  for (let i = 1; i <= Math.min(3, lines.length - 1); i++) {
    sampleRows.push(parseCSVLine(lines[i]));
  }

  // Auto-detected mapping for manual adjustment
  const autoMapping = {};
  ['date', 'amount', 'type', 'category', 'payee', 'note'].forEach(field => {
    autoMapping[field] = headerMap[field] !== undefined ? headerMap[field] : -1;
  });

  return {
    success: true,
    transactions: parsed,
    format,
    fileName: file.name,
    totalLines: lines.length - 1,
    errorLines: errors,
    headers,
    lines,
    sampleRows,
    autoMapping,
  };
  } catch (e) {
    if (__DEV__) console.error('Import parse error:', e);
    return { success: false, error: e.message || 'parse_error' };
  }
}

async function importTransactions(transactions) {
  let imported = 0;
  let failed = 0;
  let skippedDuplicates = 0;

  // Build duplicate detection set from existing transactions
  const existingTxs = await dataService.getTransactions();
  const existingKeys = new Set();
  for (const tx of existingTxs) {
    const date = (tx.date || tx.createdAt || '').slice(0, 10);
    const key = `${date}|${tx.amount}|${tx.categoryId}|${tx.type}`;
    existingKeys.add(key);
  }

  // Resolve account names to IDs
  const accounts = await dataService.getAccounts();
  const accountMap = {}; // name (lower) → id
  accounts.forEach(a => { accountMap[a.name.toLowerCase()] = a.id; });

  // Collect unique account names that need to be created
  const newAccountNames = new Set();
  for (const tx of transactions) {
    if (tx._accountName && !accountMap[tx._accountName.toLowerCase()]) {
      newAccountNames.add(tx._accountName);
    }
  }

  // Collect account types from transactions
  const accountTypes = {};
  for (const tx of transactions) {
    if (tx._accountName && tx._accountType) {
      accountTypes[tx._accountName.toLowerCase()] = tx._accountType;
    }
  }

  // Create missing accounts
  if (newAccountNames.size > 0) {
    const updatedAccounts = [...accounts];
    for (const name of newAccountNames) {
      const type = accountTypes[name.toLowerCase()] || 'bank';
      const icon = type === 'cash' ? 'wallet-outline' : type === 'credit' ? 'credit-card' : 'bank';
      const id = 'imported_' + name.toLowerCase().replace(/[^a-zа-яё0-9]/g, '_').substring(0, 30) + '_' + Date.now();
      const newAcc = { id, name, type, icon, balance: 0, currency: '₪', isActive: true };
      updatedAccounts.push(newAcc);
      accountMap[name.toLowerCase()] = id;
    }
    await dataService.saveAccounts(updatedAccounts);
  }

  // Prepare all transactions first
  const toImport = [];
  for (const tx of transactions) {
    if (tx._accountName) {
      tx.account = accountMap[tx._accountName.toLowerCase()] || null;
      delete tx._accountName;
    }
    delete tx._accountType;

    const txDate = (tx.date || '').slice(0, 10);
    const txKey = `${txDate}|${tx.amount}|${tx.categoryId}|${tx.type}`;
    if (existingKeys.has(txKey)) {
      skippedDuplicates++;
      continue;
    }
    existingKeys.add(txKey);
    toImport.push({ ...tx, createdAt: tx.date || new Date().toISOString() });
  }

  // Batch import — write all at once to AsyncStorage, or in chunks to Firestore
  const BATCH_SIZE = 50;
  for (let i = 0; i < toImport.length; i += BATCH_SIZE) {
    const batch = toImport.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map(tx => dataService.addTransaction(tx)));
    imported += results.filter(r => r).length;
    failed += results.filter(r => !r).length;
  }
  return { imported, failed, skippedDuplicates };
}

// Test helpers — exposed for unit testing only
function resetDelimiter() { _delimiter = null; }
const _internal = { resolveCategory, detectDelimiter, parseCSVLine, detectFormat, parseDate, parseAmount, parseQaizoRow, parseBankRow, parseWalletRow, parseGenericRow, resetDelimiter };

export default { pickAndParseFile, importTransactions, parseWithMapping, _internal };
