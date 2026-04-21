// __tests__/importService.test.js
// Тесты для парсинга CSV/Excel импорта — внутренние функции

jest.mock('../src/config/firebase', () => ({ db: {}, auth: {} }));
jest.mock('../src/services/authService', () => ({ default: { getUid: () => null }, getUid: () => null }));
jest.mock('../src/utils/currency', () => ({ __esModule: true, sym: () => '₪' }));

const importService = require('../src/services/importService').default;
const { resolveCategory, detectDelimiter, parseCSVLine, detectFormat, parseDate, parseAmount,
  parseQaizoRow, parseBankRow, parseWalletRow, parseGenericRow, resetDelimiter } = importService._internal;

beforeEach(() => {
  resetDelimiter();
});

describe('resolveCategory', () => {
  test('maps English categories', () => {
    expect(resolveCategory('food')).toBe('food');
    expect(resolveCategory('Supermarket')).toBe('food');
    expect(resolveCategory('TAXI')).toBe('transport');
    expect(resolveCategory('salary')).toBe('salary_me');
  });

  test('maps Russian categories', () => {
    expect(resolveCategory('еда')).toBe('food');
    expect(resolveCategory('транспорт')).toBe('transport');
    expect(resolveCategory('зарплата')).toBe('salary_me');
    expect(resolveCategory('аренда')).toBe('rent');
  });

  test('maps Hebrew categories', () => {
    expect(resolveCategory('אוכל')).toBe('food');
    expect(resolveCategory('דלק')).toBe('fuel');
    expect(resolveCategory('משכורת')).toBe('salary_me');
  });

  test('returns other for unknown', () => {
    expect(resolveCategory('unknown')).toBe('other');
    expect(resolveCategory('')).toBe('other');
    expect(resolveCategory(null)).toBe('other');
  });
});

describe('detectDelimiter', () => {
  test('detects semicolons', () => {
    expect(detectDelimiter('a;b;c;d')).toBe(';');
  });

  test('detects tabs', () => {
    expect(detectDelimiter('a\tb\tc\td')).toBe('\t');
  });

  test('detects commas', () => {
    expect(detectDelimiter('a,b,c,d')).toBe(',');
  });

  test('prefers semicolons over commas', () => {
    expect(detectDelimiter('a;b;c;d,e')).toBe(';');
  });

  test('ignores delimiters inside quotes', () => {
    expect(detectDelimiter('"a,b",c,d,e')).toBe(',');
  });
});

describe('parseCSVLine', () => {
  test('simple comma separated', () => {
    expect(parseCSVLine('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  test('handles quoted fields with commas', () => {
    expect(parseCSVLine('"hello, world",b,c')).toEqual(['hello, world', 'b', 'c']);
  });

  test('handles escaped quotes', () => {
    expect(parseCSVLine('"he said ""hi""",b')).toEqual(['he said "hi"', 'b']);
  });

  test('trims whitespace', () => {
    expect(parseCSVLine(' a , b , c ')).toEqual(['a', 'b', 'c']);
  });
});

describe('detectFormat', () => {
  test('detects wallet format', () => {
    expect(detectFormat(['account', 'category', 'currency', 'amount', 'payment_type'])).toBe('wallet');
  });

  test('detects qaizo format', () => {
    expect(detectFormat(['Date', 'Type', 'Amount', 'Category', 'Note'])).toBe('qaizo');
  });

  test('detects bank format', () => {
    expect(detectFormat(['Date', 'Description', 'Amount'])).toBe('bank');
  });

  test('detects generic when unrecognized', () => {
    expect(detectFormat(['col1', 'col2', 'col3'])).toBe('generic');
  });

  test('detects Hebrew qaizo format', () => {
    expect(detectFormat(['תאריך', 'סוג', 'סכום'])).toBe('qaizo');
  });

  test('detects Russian bank format', () => {
    expect(detectFormat(['дата', 'описание', 'сумма'])).toBe('bank');
  });
});

describe('parseDate', () => {
  test('parses ISO format', () => {
    expect(parseDate('2026-03-28')).toContain('2026-03-28');
  });

  test('parses ISO with time', () => {
    expect(parseDate('2026-03-28 14:30:00')).toContain('2026-03-28');
  });

  test('parses DD/MM/YYYY', () => {
    const result = parseDate('28/03/2026');
    const d = new Date(result);
    expect(d.getDate()).toBe(28);
    expect(d.getMonth()).toBe(2); // March = 2
    expect(d.getFullYear()).toBe(2026);
  });

  test('parses DD.MM.YYYY', () => {
    const result = parseDate('15.01.2026');
    const d = new Date(result);
    expect(d.getDate()).toBe(15);
    expect(d.getMonth()).toBe(0);
  });

  test('returns current date for invalid input', () => {
    const result = parseDate('not-a-date');
    const d = new Date(result);
    expect(d.getFullYear()).toBeGreaterThanOrEqual(2026);
  });

  test('returns current date for empty input', () => {
    const result = parseDate('');
    expect(new Date(result).getFullYear()).toBeGreaterThanOrEqual(2026);
  });
});

describe('parseAmount', () => {
  test('simple number', () => {
    expect(parseAmount('100')).toBe(100);
    expect(parseAmount('42.50')).toBe(42.50);
  });

  test('removes currency symbols', () => {
    expect(parseAmount('₪100')).toBe(100);
    expect(parseAmount('$50.00')).toBe(50);
    expect(parseAmount('€75')).toBe(75);
  });

  test('handles negative (returns absolute)', () => {
    expect(parseAmount('-150')).toBe(150);
    expect(parseAmount('(200)')).toBe(200);
  });

  test('handles comma as decimal separator', () => {
    expect(parseAmount('231,80')).toBe(231.80);
  });

  test('handles thousands comma', () => {
    expect(parseAmount('1,234.56')).toBe(1234.56);
  });

  test('returns 0 for invalid', () => {
    expect(parseAmount('')).toBe(0);
    expect(parseAmount(null)).toBe(0);
    expect(parseAmount('abc')).toBe(0);
  });

  test('handles spaces', () => {
    expect(parseAmount(' 500 ')).toBe(500);
    expect(parseAmount('1 234')).toBe(1234);
  });
});

describe('parseQaizoRow', () => {
  const headerMap = { date: 0, type: 1, amount: 2, category: 3, payee: 4, note: 5, tags: 6 };

  test('parses expense row', () => {
    const cols = ['2026-03-28', 'expense', '150', 'food', 'Shufersal', 'Groceries', 'weekly'];
    const result = parseQaizoRow(cols, headerMap);
    expect(result.type).toBe('expense');
    expect(result.amount).toBe(150);
    expect(result.categoryId).toBe('food');
    expect(result.recipient).toBe('Shufersal');
    expect(result.tags).toEqual(['weekly']);
  });

  test('parses income row', () => {
    const cols = ['2026-03-28', 'income', '10000', 'salary', '', '', ''];
    const result = parseQaizoRow(cols, headerMap);
    expect(result.type).toBe('income');
    expect(result.amount).toBe(10000);
  });

  test('returns null for zero amount', () => {
    const cols = ['2026-03-28', 'expense', '0', 'food', '', '', ''];
    expect(parseQaizoRow(cols, headerMap)).toBeNull();
  });

  test('handles Hebrew income type', () => {
    const cols = ['2026-03-28', 'הכנסה', '5000', 'salary', '', '', ''];
    const result = parseQaizoRow(cols, headerMap);
    expect(result.type).toBe('income');
  });
});

describe('parseBankRow', () => {
  const headerMap = { date: 0, description: 1, amount: 2 };

  test('parses negative as expense', () => {
    const cols = ['2026-03-28', 'Supermarket', '-150'];
    const result = parseBankRow(cols, headerMap);
    expect(result.type).toBe('expense');
    expect(result.amount).toBe(150);
    expect(result.categoryId).toBe('food');
  });

  test('parses positive as income', () => {
    const cols = ['2026-03-28', 'Salary transfer', '10000'];
    const result = parseBankRow(cols, headerMap);
    expect(result.type).toBe('income');
    expect(result.amount).toBe(10000);
  });

  test('uses debit/credit columns when amount is 0', () => {
    const hm = { date: 0, description: 1, amount: 2, debit: 3, credit: 4 };
    const cols = ['2026-03-28', 'Purchase', '', '500', ''];
    const result = parseBankRow(cols, hm);
    expect(result.type).toBe('expense');
    expect(result.amount).toBe(500);
  });

  test('returns null when no amount found', () => {
    const cols = ['no-date', 'Description only', ''];
    expect(parseBankRow(cols, headerMap)).toBeNull();
  });
});

describe('parseWalletRow', () => {
  const headerMap = { account: 0, category: 1, amount: 2, type: 3, payment_type: 4, date: 5, payee: 6, note: 7, transfer: 8, custom_category: 9, labels: 10 };

  test('parses expense row', () => {
    const cols = ['Bank Account', 'еда', '150', 'Расходы', 'cash', '2026-03-28', 'Supermarket', '', 'false', '', ''];
    const result = parseWalletRow(cols, headerMap);
    expect(result.type).toBe('expense');
    expect(result.amount).toBe(150);
    expect(result.categoryId).toBe('food');
  });

  test('parses income row', () => {
    const cols = ['Bank Account', 'зарплата', '10000', 'Доходы', 'bank', '2026-03-28', '', '', 'false', '', ''];
    const result = parseWalletRow(cols, headerMap);
    expect(result.type).toBe('income');
    expect(result.categoryId).toBe('salary_me');
  });

  test('skips non-investment transfers', () => {
    const cols = ['Bank Account', 'TRANSFER', '1000', 'transfer', '', '2026-03-28', '', '', 'true', '', ''];
    expect(parseWalletRow(cols, headerMap)).toBeNull();
  });

  test('keeps investment transfers', () => {
    const cols = ['קרן השתלמות', 'TRANSFER', '1000', 'transfer', '', '2026-03-28', '', '', 'true', '', ''];
    const result = parseWalletRow(cols, headerMap);
    expect(result).not.toBeNull();
  });

  test('forces income type for income categories', () => {
    const cols = ['Bank', 'зарплата алекс', '8000', 'Расходы', '', '2026-03-28', '', '', 'false', '', ''];
    const result = parseWalletRow(cols, headerMap);
    expect(result.type).toBe('income');
    expect(result.categoryId).toBe('salary_me');
  });

  test('detects credit card account type', () => {
    const cols = ['Visa 1234', 'еда', '100', 'Расходы', 'credit', '2026-03-28', '', '', 'false', '', ''];
    const result = parseWalletRow(cols, headerMap);
    expect(result._accountType).toBe('credit');
  });

  test('detects cash account type', () => {
    const cols = ['Cash Wallet', 'еда', '50', 'Расходы', 'cash', '2026-03-28', '', '', 'false', '', ''];
    const result = parseWalletRow(cols, headerMap);
    expect(result._accountType).toBe('cash');
  });
});

describe('parseGenericRow', () => {
  test('finds date and amount', () => {
    // parseGenericRow takes first numeric as amount, so put description first, then amount, then date
    const cols = ['Some description', '150', '2026-03-28'];
    const result = parseGenericRow(cols);
    expect(result.amount).toBe(150);
    expect(result.type).toBe('expense');
    expect(result.recipient).toBe('Some description');
  });

  test('returns null when no numeric value', () => {
    expect(parseGenericRow(['no-date', 'text', 'more text'])).toBeNull();
  });

  test('handles amount first', () => {
    const cols = ['200', '2026-01-15', 'Description'];
    const result = parseGenericRow(cols);
    expect(result.amount).toBe(200);
  });
});

describe('analyzeImportData', () => {
  test('groups accounts and counts occurrences', () => {
    const txs = [
      { amount: 10, categoryId: 'food', _accountName: 'Hapoalim', _accountType: 'bank' },
      { amount: 20, categoryId: 'food', _accountName: 'Hapoalim', _accountType: 'bank' },
      { amount: 30, categoryId: 'food', _accountName: 'Cash Wallet', _accountType: 'cash' },
    ];
    const result = importService.analyzeImportData(txs, []);
    expect(result.accounts).toHaveLength(2);
    expect(result.accounts[0].name).toBe('Hapoalim');
    expect(result.accounts[0].count).toBe(2);
    expect(result.accounts[0].suggestedType).toBe('bank');
    expect(result.accounts[1].name).toBe('Cash Wallet');
    expect(result.accounts[1].suggestedType).toBe('cash');
  });

  test('fuzzy matches existing accounts', () => {
    const txs = [{ amount: 10, categoryId: 'food', _accountName: 'Bank Hapoalim' }];
    const existing = [{ id: 'acc_1', name: 'hapoalim' }];
    const result = importService.analyzeImportData(txs, existing);
    expect(result.accounts[0].match.id).toBe('acc_1');
    expect(result.accounts[0].match.confidence).toBe('medium');
  });

  test('collects other-fallback categories with samples', () => {
    const txs = [
      { amount: 10, categoryId: 'other', _rawCategory: 'Pet shop', recipient: 'PetCo' },
      { amount: 20, categoryId: 'other', _rawCategory: 'Pet shop', recipient: 'Chewy' },
      { amount: 30, categoryId: 'food', _rawCategory: 'grocery' }, // not 'other' — skipped
    ];
    const result = importService.analyzeImportData(txs, []);
    expect(result.otherCategories).toHaveLength(1);
    expect(result.otherCategories[0].rawName).toBe('Pet shop');
    expect(result.otherCategories[0].count).toBe(2);
    expect(result.otherCategories[0].samples).toEqual(['PetCo', 'Chewy']);
  });

  test('returns empty arrays for transactions without raw metadata', () => {
    const txs = [{ amount: 10, categoryId: 'food' }];
    const result = importService.analyzeImportData(txs, []);
    expect(result.accounts).toEqual([]);
    expect(result.otherCategories).toEqual([]);
  });

  test('exact name match gets high confidence', () => {
    const txs = [{ amount: 10, categoryId: 'food', _accountName: 'Hapoalim' }];
    const existing = [{ id: 'acc_1', name: 'Hapoalim' }];
    const result = importService.analyzeImportData(txs, existing);
    expect(result.accounts[0].match.confidence).toBe('high');
  });
});
