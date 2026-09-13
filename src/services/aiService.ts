// src/services/aiService.ts
// AI-движок: Gemini API + локальный фоллбэк для парсинга, налогов, прогнозов
import i18n from '../i18n';
import { withTimeout } from '../utils/withTimeout';
import { catName } from '../utils/categoryName';
import { fmt, sym, code as curCode } from '../utils/currency';
import type { ExtractedTx } from '../utils/statementReconcile';
import {
  callGemini, getLastAIError, setLastAIError,
  GEMINI_MODEL_FALLBACK, GEMINI_MODEL_STATEMENT, geminiUrl,
  GEMINI_API_KEY,
} from './ai/client';
import type { GeminiResponse } from './ai/client';
import { parseTransaction } from './ai/localParser';
import { CARD_BRAND_KEYWORDS, detectCardBrand } from './ai/accountResolver';
import { parseTransactionSmart } from './ai/smartParse';
export type { AIError } from './ai/client';
export type { ParsedTransaction } from './ai/localParser';

// Public return-type shapes — kept narrow so callers can rely on them.
// Heterogeneous Gemini-shaped methods (parseTransactionSmart, scanReceipt, …)
// remain loosely typed because the model's JSON varies by prompt.
export interface TaxReserveResult {
  grossIncome: number;
  maam: number;
  incomeTax: number;
  bituach: number;
  totalReserve: number;
  netIncome: number;
}

export interface TranslatedCategoryName {
  ru: string;
  en: string;
  he: string;
}

// ─── МААМ и налоговые ставки (Израиль) ──────────────────
const MAAM_RATE = 0.17;
const ESTIMATED_INCOME_TAX = 0.10; // упрощённо для осека
const BITUACH_LEUMI = 0.07;

// ─── Налоговый резерв (для самозанятых) ─────────────────
function calculateTaxReserve(grossIncome: number): TaxReserveResult {
  const maam = Math.round(grossIncome * MAAM_RATE / (1 + MAAM_RATE)); // МААМ уже включён
  const incomeTax = Math.round(grossIncome * ESTIMATED_INCOME_TAX);
  const bituach = Math.round(grossIncome * BITUACH_LEUMI);
  const total = maam + incomeTax + bituach;
  const net = grossIncome - total;

  return { grossIncome, maam, incomeTax, bituach, totalReserve: total, netIncome: net };
}

// ─── Прогноз кассового разрыва ──────────────────────────
function predictCashFlow(accounts: any[], recurring: any[], transactions: any[]) {
  const now = new Date();
  const currentBalance = accounts.reduce((s: number, a: any) => s + (a.balance || 0), 0);

  // Предстоящие обязательные платежи в этом месяце
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const upcoming: any[] = [];
  let totalUpcoming = 0;

  recurring.filter((r: any) => r.isActive && r.nextDate).forEach((r: any) => {
    const next = new Date(r.nextDate);
    if (next.getMonth() === now.getMonth() && next.getFullYear() === now.getFullYear() && next.getDate() > now.getDate()) {
      upcoming.push({ name: r.recipient || r.categoryId, amount: r.amount, date: next.getDate(), type: r.type });
      if (r.type === 'expense') totalUpcoming += r.amount;
    }
  });

  const projectedBalance = currentBalance - totalUpcoming;
  const isAtRisk = projectedBalance < 0;

  return {
    currentBalance,
    totalUpcoming,
    projectedBalance,
    isAtRisk,
    upcoming: upcoming.sort((a: any, b: any) => a.date - b.date),
  };
}

// ─── Динамический дневной бюджет ────────────────────────
function calculateDailyBudget(transactions: any[], budgets: any) {
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const daysLeft = daysInMonth - dayOfMonth;
  if (daysLeft <= 0) return null;

  const thisMonth = transactions.filter((t: any) => {
    const d = new Date(t.date || t.createdAt || '');
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const income = thisMonth.filter((t: any) => t.type === 'income' && !t.isTransfer).reduce((s: number, t: any) => s + t.amount, 0);
  const expense = thisMonth.filter((t: any) => t.type === 'expense' && !t.isTransfer).reduce((s: number, t: any) => s + t.amount, 0);
  const remaining = income - expense;

  if (remaining <= 0 || income <= 0) return null;

  const dailyBudget = Math.round(remaining / daysLeft);

  // Вчерашние расходы
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = yesterday.toISOString().split('T')[0];
  const yesterdayExpense = thisMonth
    .filter((t: any) => t.type === 'expense' && !t.isTransfer && (t.date || t.createdAt || '').startsWith(yStr))
    .reduce((s: number, t: any) => s + t.amount, 0);

  const prevDailyBudget = daysLeft > 0 ? Math.round((remaining + yesterdayExpense) / (daysLeft + 1)) : dailyBudget;
  const savedYesterday = prevDailyBudget - yesterdayExpense;

  return { dailyBudget, daysLeft, remaining, savedYesterday };
}

// ─── Генерация инсайтов ─────────────────────────────────
function generateInsights(transactions: any[], budgets: any, accounts: any[], recurring: any[]) {
  const now = new Date();
  const insights: any[] = [];

  const thisMonth = transactions.filter((t: any) => {
    const d = new Date(t.date || t.createdAt || '');
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const lastMonth = transactions.filter((t: any) => {
    const d = new Date(t.date || t.createdAt || '');
    const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear();
  });

  const income = thisMonth.filter((t: any) => t.type === 'income' && !t.isTransfer).reduce((s: number, t: any) => s + t.amount, 0);
  const expense = thisMonth.filter((t: any) => t.type === 'expense' && !t.isTransfer).reduce((s: number, t: any) => s + t.amount, 0);
  const balance = income - expense;
  const savingsRate = income > 0 ? Math.round((balance / income) * 100) : 0;

  // Категории этого месяца
  const catTotals: Record<string, number> = {};
  thisMonth.filter((t: any) => t.type === 'expense' && !t.isTransfer).forEach((t: any) => {
    catTotals[t.categoryId] = (catTotals[t.categoryId] || 0) + t.amount;
  });
  // Категории прошлого месяца
  const lastCatTotals: Record<string, number> = {};
  lastMonth.filter((t: any) => t.type === 'expense' && !t.isTransfer).forEach((t: any) => {
    lastCatTotals[t.categoryId] = (lastCatTotals[t.categoryId] || 0) + t.amount;
  });

  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const monthProgress = dayOfMonth / daysInMonth;

  // 1. Норма сбережений
  if (income > 0) {
    insights.push({
      type: savingsRate >= 20 ? 'positive' : savingsRate >= 0 ? 'warning' : 'negative',
      icon: savingsRate >= 20 ? 'trending-up' : savingsRate >= 0 ? 'alert-circle' : 'trending-down',
      title: i18n.t('aiSavingsRate'),
      text: i18n.t('aiSavingsRateText').replace('{rate}', String(savingsRate)).replace('{amount}', fmt(Math.abs(balance))),
    });
  }

  // 2. Аномалии по категориям (рост > 30% vs прошлый месяц)
  Object.entries(catTotals).forEach(([cat, amount]) => {
    const lastAmount = lastCatTotals[cat] || 0;
    if (lastAmount > 0 && amount > lastAmount * 1.3 && amount > 100) {
      const pct = Math.round(((amount - lastAmount) / lastAmount) * 100);
      insights.push({
        type: 'warning',
        icon: 'alert-triangle',
        title: i18n.t('aiCategorySpike'),
        text: i18n.t('aiCategorySpikeText')
          .replace('{cat}', catName(cat))
          .replace('{pct}', String(pct))
          .replace('{amount}', fmt(amount))
          .replace('{lastAmount}', fmt(lastAmount)),
      });
    }
  });

  // 3. Бюджеты под угрозой
  Object.entries(budgets as Record<string, number>).forEach(([cat, limit]) => {
    const spent = catTotals[cat] || 0;
    const pct = Math.round((spent / limit) * 100);
    if (pct >= 100) {
      insights.push({
        type: 'negative',
        icon: 'x-circle',
        title: i18n.t('aiBudgetExceeded'),
        text: i18n.t('aiBudgetExceededText').replace('{cat}', catName(cat)).replace('{amount}', fmt(spent - limit)),
      });
    } else if (pct > monthProgress * 100 + 15) {
      insights.push({
        type: 'warning',
        icon: 'alert-triangle',
        title: i18n.t('aiBudgetWarning'),
        text: i18n.t('aiBudgetWarningText')
          .replace('{cat}', catName(cat)).replace('{pct}', String(pct)).replace('{days}', String(daysInMonth - dayOfMonth)),
      });
    }
  });

  // 4. Прогноз кассового разрыва
  const cashFlow = predictCashFlow(accounts, recurring, transactions);
  if (cashFlow.isAtRisk) {
    insights.push({
      type: 'negative',
      icon: 'alert-octagon',
      title: i18n.t('aiCashFlowRisk'),
      text: i18n.t('aiCashFlowRiskText')
        .replace('{balance}', fmt(cashFlow.currentBalance))
        .replace('{upcoming}', fmt(cashFlow.totalUpcoming))
        .replace('{projected}', fmt(Math.abs(cashFlow.projectedBalance))),
    });
  }

  // 5. Повторяющиеся подписки (entertainment)
  const subscriptions = recurring.filter((r: any) => r.isActive && r.categoryId === 'entertainment');
  if (subscriptions.length > 0) {
    const total = subscriptions.reduce((s: number, r: any) => s + r.amount, 0);
    if (total > 50) {
      insights.push({
        type: 'info',
        icon: 'tv',
        title: i18n.t('aiSubscriptions'),
        text: i18n.t('aiSubscriptionsText')
          .replace('{count}', String(subscriptions.length))
          .replace('{amount}', fmt(total)),
      });
    }
  }

  // 6. Нет данных
  if (transactions.length === 0) {
    insights.push({
      type: 'info',
      icon: 'edit-3',
      title: i18n.t('aiNoData'),
      text: i18n.t('aiNoDataText'),
    });
  }

  return { insights, income, expense, balance, savingsRate, cashFlow };
}

// Build an id → human-readable category-name resolver. Custom categories have
// ids like "cat_mpqmr6qzivvo" that aren't i18n keys, so the LLM (and any UI)
// must be fed the real name. The name stored on the user's own transactions
// (categoryName) is the most reliable source; fall back to catName for
// built-ins, and finally the raw id.
function buildCatNamer(txs: any[]): (id: string) => string {
  const map: Record<string, string> = {};
  for (const t of txs || []) {
    const id = t?.categoryId;
    if (id && !map[id]) {
      const n = catName(id, t.categoryName);
      if (n && n !== id) map[id] = n;
    }
  }
  return (id: string) => map[id] || catName(id) || id;
}

// Персональные советы от Gemini
async function getPersonalAdvice(transactions: any[], budgets: any, lang: string) {
  const now = new Date();
  const thisMonth = transactions.filter((t: any) => {
    const d = new Date(t.date || t.createdAt || '');
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const income = thisMonth.filter((t: any) => t.type === 'income' && !t.isTransfer).reduce((s: number, t: any) => s + t.amount, 0);
  const expense = thisMonth.filter((t: any) => t.type === 'expense' && !t.isTransfer).reduce((s: number, t: any) => s + t.amount, 0);

  const catTotals: Record<string, number> = {};
  thisMonth.filter((t: any) => t.type === 'expense' && !t.isTransfer).forEach((t: any) => {
    catTotals[t.categoryId] = (catTotals[t.categoryId] || 0) + t.amount;
  });

  const catLabel = buildCatNamer(transactions);
  const topCats = Object.entries(catTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([cat, amount]) => `${catLabel(cat)}: ${amount}`)
    .join(', ');

  const budgetInfo = Object.entries(budgets as Record<string, number>)
    .map(([cat, limit]) => `${catLabel(cat)}: spent ${catTotals[cat] || 0}/${limit}`)
    .join(', ');

  const langMap: Record<string, string> = { ru: 'Russian', he: 'Hebrew', en: 'English' };

  const prompt = `You are a smart financial advisor for an Israeli user. Analyze their data and give 2-3 short, specific, actionable tips.

Monthly data:
- Income: ${income} ${curCode()}
- Expenses: ${expense} ${curCode()}
- Savings: ${income - expense} ${curCode()}
- Top categories: ${topCats || 'no data'}
- Budgets: ${budgetInfo || 'none set'}
- Day of month: ${now.getDate()}/${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()}

Respond in ${langMap[lang] || 'English'}. Keep each tip to 1-2 sentences. Be specific with numbers. Format as JSON array:
[{"title": "short title", "text": "advice text", "type": "positive|warning|info"}]

No markdown, no explanation, only the JSON array.`;

  const result = await callGemini(prompt);
  if (result) {
    try {
      const jsonStr = result.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      const tips = JSON.parse(jsonStr);
      if (Array.isArray(tips) && tips.length > 0) {
        return tips.map((t: any) => ({
          ...t,
          icon: t.type === 'positive' ? 'star' : t.type === 'warning' ? 'alert-circle' : 'info',
        }));
      }
    } catch (e) {}
  }
  return null;
}

// ─── Receipt Scanner ────────────────────────────────────
async function scanReceipt(imageInput: any, lang: string, _retryCount = 0): Promise<any> {
  if (!GEMINI_API_KEY) {
    if (__DEV__) console.error('scanReceipt: no API key');
    setLastAIError({ code: 'no_api_key', message: 'Gemini API key is not configured' });
    return null;
  }
  try {
    // Support single string or array of base64 strings
    const imageList: string[] = Array.isArray(imageInput) ? imageInput : [imageInput];

    const detectMime = (b64: string) => {
      if (b64.startsWith('/9j/')) return 'image/jpeg';
      if (b64.startsWith('iVBOR')) return 'image/png';
      if (b64.startsWith('JVBER')) return 'application/pdf';
      if (b64.startsWith('UklGR')) return 'image/webp';
      return 'image/jpeg';
    };

    const mimes = imageList.map(detectMime);
    const imageParts = imageList.map((b64, i) => ({
      inlineData: { mimeType: mimes[i], data: b64 }
    }));

    if (__DEV__) console.log('scanReceipt:', imageList.length, 'images, mimes:', mimes, 'b64 prefixes:', imageList.map(b => (b || '').slice(0, 8)), 'attempt:', _retryCount + 1);

    const multiImageHint = imageList.length > 1
      ? `These ${imageList.length} images are parts of the SAME receipt. Combine all items and find the total from the last image.`
      : '';

    const requestBody = JSON.stringify({
      contents: [{
        parts: [
          { text: `You are an expert receipt scanner. The receipt may be in ANY language (Hebrew, Russian, English, Arabic, etc.). The image may be slightly blurry, rotated, or have low contrast — do your best to extract data.
Hebrew OCR care: Hebrew letters are visually similar — do NOT confuse ד/ר, ה/ח/ת, ב/כ/נ, ו/ז/ן, ל/ר, ם/ס, ע/צ. Prefer real, meaningful Hebrew words and product/store names over letter-by-letter guesses.
${multiImageHint}
Extract:
- total: the TOTAL amount (number). Look for the LAST/LARGEST bold number, or words in any language: Total, סה"כ, סהכ, Итого, Всего, לתשלום, סך הכל, المجموع. If multiple totals, pick the final one.
- store: business name, usually at the top. Return the name as written on the receipt.
- date: look for date on receipt, return as YYYY-MM-DD. Common formats: DD/MM/YYYY, DD.MM.YYYY, MM/DD/YYYY, YYYY-MM-DD.
- category: classify the business. Supermarket/grocery = "food". Restaurant/cafe = "restaurant". Gas station = "fuel". Pharmacy = "health". Use: food,restaurant,fuel,transport,health,phone,utilities,clothing,household,kids,entertainment,education,cosmetics,electronics,insurance,rent,other
- accountType: detect payment method. Use ONE of: "cash" | "credit" | "bank" | null.
    Hebrew clues: "מזומן" → cash. "אשראי" / "כרטיס אשראי" / Visa/Mastercard/Amex/Isracard/Diners → credit. "העברה" / "חשבון" / wire → bank.
    Russian clues: "наличные" → cash. "карта" / "Visa"/"Master"/"Amex" → credit.
    English clues: "cash" → cash. "credit"/"Visa"/"Master"/"Amex" → credit. Wire/transfer → bank.
    If unclear or not printed, return null.
- cardBrand: if a credit card was used, identify the BRAND. Use ONE of: "visa" | "mastercard" | "amex" | "isracard" | "diners" | null.
    Look for the literal brand name OR the last 4 digits' card range ("4xxx" → visa, "5xxx" → mastercard, "3xxx" → amex/diners, "9xxx" → Isracard).
    Return null if cash, bank transfer, or brand is not visible.
- last4: if a credit card was used and the LAST 4 DIGITS are visible (e.g. "Visa ****1234" or "**** **** **** 1234"), extract them as a string. Otherwise null.
Return ONLY short JSON, no items: {"total":0,"store":"","date":"2026-01-01","category":"food","accountType":null,"cardBrand":null,"last4":null}` },
          ...imageParts,
        ],
      }],
      generationConfig: { temperature: 0.15, maxOutputTokens: 1024 },
    });

    const fetchOpts = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: requestBody };
    // 2.5-pro reads Hebrew far better than flash (fewer confused look-alike
    // letters); fall back to flash-latest on overload/rate-limit below.
    let res = await withTimeout(fetch(`${geminiUrl(GEMINI_MODEL_STATEMENT)}?key=${GEMINI_API_KEY}`, fetchOpts), 90000, 'gemini-scan');
    // Fallback to gemini-flash-latest on transient overload (503) or rate limit (429)
    if (!res.ok && (res.status >= 500 || res.status === 429)) {
      if (__DEV__) console.warn('scanReceipt: primary', res.status, '— retrying on fallback model', GEMINI_MODEL_FALLBACK);
      res = await withTimeout(fetch(`${geminiUrl(GEMINI_MODEL_FALLBACK)}?key=${GEMINI_API_KEY}`, fetchOpts), 90000, 'gemini-scan-fallback');
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      if (__DEV__) console.error('scanReceipt API error:', res.status, errText);
      setLastAIError({
        code: res.status === 429 ? 'rate_limit' : res.status === 401 || res.status === 403 ? 'auth' : res.status >= 500 ? 'server' : 'http_error',
        status: res.status,
        message: `${errText.slice(0, 200)} [mimes: ${mimes.join(',')}]`,
      });
      return null;
    }

    const data = await res.json() as GeminiResponse;
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (__DEV__) console.log('scanReceipt response:', text);

    let jsonStr = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();

    // Fix truncated JSON
    if (jsonStr && !jsonStr.endsWith('}')) {
      if (__DEV__) console.log('scanReceipt: fixing truncated JSON');
      // Try to extract what we can before items array
      const itemsIdx = jsonStr.indexOf('"items"');
      if (itemsIdx > 0) {
        // Cut off items and close JSON
        const beforeItems = jsonStr.substring(0, itemsIdx).replace(/,\s*$/, '');
        jsonStr = beforeItems + '}';
      } else {
        // Remove incomplete last field
        const lastComma = jsonStr.lastIndexOf(',');
        const lastBrace = jsonStr.lastIndexOf('}');
        if (lastComma > lastBrace) jsonStr = jsonStr.substring(0, lastComma);
        // Close open brackets
        const opens = (jsonStr.match(/\[/g) || []).length;
        const closes = (jsonStr.match(/\]/g) || []).length;
        for (let i = 0; i < opens - closes; i++) jsonStr += ']';
        if (!jsonStr.endsWith('}')) jsonStr += '}';
      }
    }

    let parsed: any;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (parseErr) {
      if (__DEV__) console.error('scanReceipt: JSON parse failed, trying regex extraction');
      // Last resort — extract total/store/category with regex
      const totalMatch = jsonStr.match(/"total"\s*:\s*([\d.]+)/);
      const storeMatch = jsonStr.match(/"store"\s*:\s*"([^"]+)"/);
      const catMatch = jsonStr.match(/"category"\s*:\s*"([^"]+)"/);
      const dateMatch = jsonStr.match(/"date"\s*:\s*"([^"]+)"/);
      if (totalMatch) {
        parsed = {
          total: parseFloat(totalMatch[1]),
          store: storeMatch ? storeMatch[1] : '',
          category: catMatch ? catMatch[1] : 'other',
          date: dateMatch ? dateMatch[1] : null,
        };
      } else {
        return null;
      }
    }

    // Validate — need at least total or store
    if (!parsed.total && !parsed.store) {
      if (__DEV__) console.error('scanReceipt: no total or store found');
      // Retry once if validation failed
      if (_retryCount < 1) {
        if (__DEV__) console.log('scanReceipt: retrying after validation failure...');
        await new Promise(r => setTimeout(r, 1000));
        return scanReceipt(imageInput, lang, _retryCount + 1);
      }
      setLastAIError({ code: 'empty_response', message: 'No total or store recognized on the receipt' });
      return null;
    }

    setLastAIError(null);
    return parsed;
  } catch (e: any) {
    if (__DEV__) console.error('scanReceipt error:', e);
    // Retry once on failure
    if (_retryCount < 1) {
      if (__DEV__) console.log('scanReceipt: retrying after error...');
      await new Promise(r => setTimeout(r, 1000));
      return scanReceipt(imageInput, lang, _retryCount + 1);
    }
    setLastAIError({ code: 'network', message: String(e?.message || e) });
    return null;
  }
}

// ─── Receipt Items (separate request for long receipts) ──
async function scanReceiptItems(imageInput: any): Promise<any[]> {
  if (!GEMINI_API_KEY) return [];
  try {
    const imageList: string[] = Array.isArray(imageInput) ? imageInput : [imageInput];
    const detectMime = (b64: string) => {
      if (b64.startsWith('/9j/')) return 'image/jpeg';
      if (b64.startsWith('iVBOR')) return 'image/png';
      if (b64.startsWith('JVBER')) return 'application/pdf';
      return 'image/jpeg';
    };
    const imageParts = imageList.map(b64 => ({
      inlineData: { mimeType: detectMime(b64), data: b64 }
    }));

    const multiHint = imageList.length > 1
      ? `\nThese ${imageList.length} images are pages of the SAME receipt — combine items from all of them.`
      : '';

    const prompt = `You are an expert receipt reader. Extract EVERY purchased item from this receipt with its price.${multiHint}
Hebrew OCR care: Hebrew letters are visually similar — do NOT confuse ד/ר, ה/ח/ת, ב/כ/נ, ו/ז/ן, ל/ר, ם/ס, ע/צ. Prefer real, meaningful Hebrew product names over letter-by-letter guesses.

WHAT TO INCLUDE — line items the customer paid for:
  - Product names exactly as printed (keep original language: Hebrew/Russian/English/Arabic — do NOT translate)
  - Each separate line is a separate item, even if same product appears twice
  - Quantity-priced items (e.g. "1.5 kg × 12.90 = 19.35") → use the LINE TOTAL (19.35), not the unit price
  - Discounts that apply to a SPECIFIC line item should reduce that line's price (final paid price)

WHAT TO SKIP — these are NOT items:
  - Subtotal / Total / סה"כ / לתשלום / Итого / Всего
  - Tax / VAT / МААМ / מע"מ / מעמ
  - Change / עודף / сдача
  - Store header, address, phone, cashier, receipt number, date
  - Payment method lines (Visa/cash/credit/אשראי/מזומן)
  - Loyalty card / Club discount summary lines (unless they are line-items)
  - Round-up / round-down adjustments
  - Empty separators / dashes

PRICE RULES:
  - Number only. No currency symbol.
  - Decimal point can be "." or "," in original — always output as ".".
  - Negative prices for refunds/returns are OK.
  - If a line shows quantity × unit_price → output the line total, NOT the unit price.

CATEGORY for each item (this is important — supermarket receipts mix categories):
  Pick ONE per item from this list:
    food         → groceries: dairy, meat, fish, bread, vegetables, fruit, snacks, beverages
    restaurant   → prepared meals, ready-to-eat, hot food bar, deli sandwiches
    household    → cleaning supplies, paper goods, kitchen utensils, batteries, light bulbs
    cosmetics    → shampoo, soap, toothpaste, makeup, deodorant, hair care, skin care
    health       → medicine, vitamins, bandages, first aid, dental floss
    kids         → diapers, baby food, kids' toys, school supplies, baby formula
    clothing     → clothes, shoes, socks (uncommon at supermarket)
    electronics  → cables, headphones, chargers (uncommon at supermarket)
    other        → unclear or doesn't fit any above

EXAMPLES (Israeli supermarket receipt — note categories vary across items):
  "חלב תנובה 3% 1L      6.90"        → {"name":"חלב תנובה 3% 1L","price":6.90,"category":"food"}
  "לחם אחיד    7.50"                  → {"name":"לחם אחיד","price":7.50,"category":"food"}
  "עגבניות  1.250 ק\"ג × 8.90  11.13" → {"name":"עגבניות","price":11.13,"category":"food"}
  "שמפו הד אנד שולדרס   24.90"        → {"name":"שמפו הד אנד שולדרס","price":24.90,"category":"cosmetics"}
  "אבקת כביסה אריאל     34.90"        → {"name":"אבקת כביסה אריאל","price":34.90,"category":"household"}
  "חיתולים האגיס        59.90"        → {"name":"חיתולים האגיס","price":59.90,"category":"kids"}
  "אקמול כפיות 100      28.50"        → {"name":"אקמול כפיות 100","price":28.50,"category":"health"}
  "הנחה מועדון              -5.00"   → SKIP (club discount summary)
  "סה\"כ                    187.45"  → SKIP (total)
  "מע\"מ 17%                  27.20"  → SKIP (tax)

OUTPUT FORMAT — return ONLY a raw JSON array, no markdown, no commentary:
[{"name":"item 1","price":12.90,"category":"food"},{"name":"item 2","price":3.50,"category":"cosmetics"}]`;

    const requestBody = JSON.stringify({
      contents: [{
        parts: [{ text: prompt }, ...imageParts],
      }],
      generationConfig: { temperature: 0.05, maxOutputTokens: 8192 },
    });

    const fetchOpts = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: requestBody };
    // 2.5-pro for sharper Hebrew item-name OCR; flash-latest fallback below.
    let res = await withTimeout(fetch(`${geminiUrl(GEMINI_MODEL_STATEMENT)}?key=${GEMINI_API_KEY}`, fetchOpts), 90000, 'gemini-scan');
    // Fallback to gemini-flash-latest on transient overload (503) or rate limit (429)
    if (!res.ok && (res.status >= 500 || res.status === 429)) {
      if (__DEV__) console.warn('scanReceiptItems: primary', res.status, '— retrying on fallback model', GEMINI_MODEL_FALLBACK);
      res = await withTimeout(fetch(`${geminiUrl(GEMINI_MODEL_FALLBACK)}?key=${GEMINI_API_KEY}`, fetchOpts), 90000, 'gemini-scan-fallback');
    }

    if (!res.ok) {
      if (__DEV__) console.error('scanReceiptItems API error:', res.status);
      return [];
    }
    const data = await res.json() as GeminiResponse;
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (__DEV__) console.log('[scanReceiptItems] raw length:', text.length);
    let jsonStr = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();

    // Fix truncated array
    if (jsonStr.startsWith('[') && !jsonStr.endsWith(']')) {
      const lastBrace = jsonStr.lastIndexOf('}');
      if (lastBrace > 0) jsonStr = jsonStr.substring(0, lastBrace + 1) + ']';
    }

    let parsed: any;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (parseErr) {
      // Last-resort: extract the [...] block
      const m = jsonStr.match(/\[[\s\S]*\]/);
      if (m) {
        try { parsed = JSON.parse(m[0]); }
        catch (e2) {
          if (__DEV__) console.error('scanReceiptItems JSON parse error:', parseErr, 'raw:', jsonStr.slice(0, 200));
          return [];
        }
      } else {
        if (__DEV__) console.error('scanReceiptItems JSON parse error:', parseErr, 'raw:', jsonStr.slice(0, 200));
        return [];
      }
    }
    if (!Array.isArray(parsed)) return [];
    // Filter and normalize. Category is optional — fall back to 'other'.
    const VALID_CATS = ['food','restaurant','household','cosmetics','health','kids','clothing','electronics','other'];
    const items = parsed
      .filter((i: any) => i && i.name && typeof i.price === 'number' && !isNaN(i.price))
      .map((i: any) => ({
        name: String(i.name).trim(),
        price: i.price,
        category: VALID_CATS.includes(i.category) ? i.category : 'other',
      }));
    if (__DEV__) console.log('[scanReceiptItems] items:', items.length);
    return items;
  } catch (e) {
    if (__DEV__) console.error('scanReceiptItems error:', e);
    return [];
  }
}

// Self-consistency check for a statement row: the extracted `amount` must
// actually appear in that row's own `raw` text. If it doesn't, the model has
// almost certainly paired this payee with an amount from an ADJACENT row — a
// confident mis-alignment that the `confidence` field won't catch on its own.
// Returns true when the amount is found in raw (or raw is missing → can't
// verify, so we don't penalise).
export function amountAppearsInRaw(amount: number, raw?: string): boolean {
  if (!raw || typeof raw !== 'string') return true;
  const target = Math.abs(amount);
  const tokens = raw.match(/-?\d[\d.,]*\d|\d/g) || [];
  for (const tok of tokens) {
    let t = tok;
    if (t.includes(',') && !t.includes('.')) {
      // comma-as-decimal ("123,45") vs thousands ("1,234"): trailing ,dd → decimal
      t = t.replace(/,(\d{1,2})$/, '.$1').replace(/,/g, '');
    } else {
      t = t.replace(/,/g, ''); // drop thousands separators
    }
    const n = parseFloat(t);
    if (!isNaN(n) && Math.abs(Math.abs(n) - target) < 0.01) return true;
  }
  return false;
}

// ─── Statement scanner (bank / credit-card statements) ────────────────────
async function scanStatement(imageInput: any, accountCurrency?: string): Promise<ExtractedTx[]> {
  if (!GEMINI_API_KEY) {
    if (__DEV__) console.error('scanStatement: no API key');
    setLastAIError({ code: 'no_api_key', message: 'Gemini API key is not configured' });
    return [];
  }
  try {
    const imageList: string[] = Array.isArray(imageInput) ? imageInput : [imageInput];

    const detectMime = (b64: string) => {
      if (b64.startsWith('/9j/')) return 'image/jpeg';
      if (b64.startsWith('iVBOR')) return 'image/png';
      if (b64.startsWith('JVBER')) return 'application/pdf';
      if (b64.startsWith('UklGR')) return 'image/webp';
      return 'image/jpeg';
    };

    const mimes = imageList.map(detectMime);
    const imageParts = imageList.map((b64, i) => ({
      inlineData: { mimeType: mimes[i], data: b64 },
    }));

    if (__DEV__) console.log('scanStatement:', imageList.length, 'images, mimes:', mimes);

    const currencyHint = accountCurrency ? `Account currency: ${accountCurrency}.` : '';

    const prompt = `You are reading a credit-card or bank account statement image.
${currencyHint}
Extract EVERY individual transaction line as a JSON ARRAY (no prose, no markdown):
[{
  "date": "YYYY-MM-DD",
  "amount": <signed number, negative = charge/debit, positive = refund/credit/income>,
  "payee": "<original merchant text, do NOT translate>",
  "raw": "<the ENTIRE physical row, verbatim: the payee text AND the amount (and date) exactly as printed on that single line>",
  "notes": "<optional: installment X/Y, foreign amount with currency, standing-order tag>",
  "confidence": "high" | "medium" | "low"
}]

ORIENTATION & LAYOUT — READ THIS FIRST:
- The image may be rotated 90°, 180° or 270°. Mentally rotate it so the table text reads naturally before you start.
- Each transaction is ONE horizontal row. The date, payee text and amount belong to the SAME row — they share a visual baseline.
- For multi-column tables: pick a row, then read date+payee+amount across that single row. Never pair a payee from row N with an amount from row N±1.
- If a row is hard to align (rotated photo, faint print, smudge), set confidence: "low" rather than guessing. We can fix low-confidence rows by hand; a wrong-amount/wrong-name pairing silently corrupts the user's data.
- Use the printed amount that sits on the SAME row as the payee. If a foreign-purchase row prints both the foreign amount AND the local-currency charged amount, take the local-currency one and put the foreign amount in notes.
- "raw": transcribe the WHOLE physical row verbatim (payee text + amount, in their printed order). The "amount" and "payee" you output MUST both be taken from this exact "raw" line. This is a self-check that keeps every row aligned — if you cannot put the amount and payee in the same "raw" line, the row is misaligned: lower its confidence.

EXTRACT FROM:
- Domestic transaction list (any list of dated rows with amounts)
- Foreign-purchase section — use the converted local-currency amount, NOT the foreign one

DO NOT EXTRACT:
- Running balance lines ("יתרה ליום", "balance after", "remaining balance")
- Total / sum / subtotal lines ("סך הכל", "סך עסקאות", "סך חיובים", "Total", "Subtotal", "סה\\"כ")
- Section or column headers / titles printed in distinct rows above the lists
- Payment-source breakdown sections ("פירוט תשלומים לפי מקור חיוב", account routing summaries)
- Card / account numbers, addresses, phone numbers, customer name
- Marketing or promotional content, advertisements, page footers
- QR codes, barcodes

SPECIAL CASES:
- INSTALLMENTS ("תשלום X מתוך Y", "X/Y", monthly installment): amount = per-installment value as printed (NOT the total). Put "תשלום X/Y" or equivalent in notes.
- REPEATED LINES with identical payee+date+amount: each line is a SEPARATE transaction. Do NOT deduplicate.
- FOREIGN purchases: use the converted ${accountCurrency || 'local'}-currency amount. Put the foreign amount with its currency in notes (e.g. "$23.90 USD").
- Standing-order markers ("הוראת קבע", "standing order"): copy the marker to notes.

Date: normalise any format (DD/MM/YYYY, YYYY-MM-DD, "Dublin 28/02/26") to YYYY-MM-DD. If only DD/MM is shown, assume the current year.
Payee: keep the original language and characters. No translation, no transliteration.
Confidence: "low" when the text is unclear / partially obscured / ambiguous / hard to align to a row; "high" otherwise. Default to "medium" when the row alignment is reasonable but the photo is rotated or skewed.

Return ONLY the JSON array. No surrounding text, no markdown fences.`;

    const requestBody = JSON.stringify({
      contents: [{ parts: [{ text: prompt }, ...imageParts] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
    });

    const fetchOpts = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: requestBody };
    let res = await withTimeout(fetch(`${geminiUrl(GEMINI_MODEL_STATEMENT)}?key=${GEMINI_API_KEY}`, fetchOpts), 90000, 'gemini-scan');
    if (!res.ok && (res.status >= 500 || res.status === 429)) {
      if (__DEV__) console.warn('scanStatement: pro model', res.status, '— retrying on fallback model');
      res = await withTimeout(fetch(`${geminiUrl(GEMINI_MODEL_FALLBACK)}?key=${GEMINI_API_KEY}`, fetchOpts), 90000, 'gemini-scan-fallback');
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      if (__DEV__) console.error('scanStatement API error:', res.status, errText);
      setLastAIError({
        code: res.status === 429 ? 'rate_limit' : res.status === 401 || res.status === 403 ? 'auth' : res.status >= 500 ? 'server' : 'http_error',
        status: res.status,
        message: errText.slice(0, 200),
      });
      return [];
    }

    const data = await res.json() as GeminiResponse;
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (__DEV__) console.log('scanStatement raw text length:', text.length);

    // Strip markdown fences and isolate the JSON array.
    let jsonStr = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    const start = jsonStr.indexOf('[');
    const end = jsonStr.lastIndexOf(']');
    if (start >= 0 && end > start) jsonStr = jsonStr.slice(start, end + 1);

    let parsed: any;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      if (__DEV__) console.error('scanStatement JSON parse failed:', e);
      setLastAIError({ code: 'empty_response', message: 'Could not parse statement JSON' });
      return [];
    }

    if (!Array.isArray(parsed)) {
      setLastAIError({ code: 'empty_response', message: 'Response was not an array' });
      return [];
    }

    setLastAIError(null);
    return parsed
      .filter((row: any) =>
        row && typeof row.amount === 'number' && typeof row.date === 'string' && typeof row.payee === 'string'
      )
      .map((row: any) => {
        const raw = typeof row.raw === 'string' ? row.raw : '';
        // If the amount isn't present in its own row text, the model paired
        // this payee with a neighbouring row's amount → force 'low' so the
        // review screen leaves it unchecked for manual verification.
        const aligned = amountAppearsInRaw(row.amount, raw);
        return {
          date: row.date,
          amount: row.amount,
          payee: row.payee,
          notes: typeof row.notes === 'string' ? row.notes : undefined,
          confidence: aligned ? (row.confidence || 'medium') : 'low',
          raw: raw || undefined,
        } as ExtractedTx;
      });
  } catch (e: any) {
    if (__DEV__) console.error('scanStatement error:', e);
    setLastAIError({ code: 'network', message: String(e?.message || e) });
    return [];
  }
}

// ─── AI Chat ────────────────────────────────────────────
// ─── Интерпретация запроса для графика ──────────────────
async function interpretChartQuery(question: string, transactions: any[], lang: string) {
  const langMap: Record<string, string> = { ru: 'Russian', he: 'Hebrew', en: 'English' };

  const prompt = `You are a financial data query interpreter. Analyze the user's question and determine if they want to SEE/VISUALIZE data (chart needed) or just get a text answer.

User's question: "${question}"
Language: ${langMap[lang] || 'English'}

If the user asks to SHOW, DISPLAY, VISUALIZE, or asks "how much" with a time range — they want a chart.
Examples that need charts: "show expenses last 3 days", "כמה הוצאות ב3 ימים", "покажи расходы за неделю", "compare income vs expenses this month"
Examples that DON'T need charts: "how can I save?", "what's my biggest expense?", "give me advice"

Respond ONLY with valid JSON, no markdown:
{"needsChart": true/false, "chartType": "bar"|"pie"|"cashflow", "days": number, "filter": "expense"|"income"|"both", "categoryFilter": "category_id or null", "title": "short chart title in user's language"}

Rules:
- "bar" for daily amounts over time
- "pie" for category breakdown
- "cashflow" for income vs expense comparison
- days: extract from question (3 days=3, week=7, month=30, 2 weeks=14)
- If no time specified, default to 7
- title should be concise (3-5 words) in ${langMap[lang] || 'English'}
- If needsChart is false, other fields can be null`;

  try {
    const result = await callGemini(prompt);
    if (!result) return null;
    const clean = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(clean);
    if (!parsed.needsChart) return null;
    return parsed;
  } catch {
    return null;
  }
}

// ─── Подготовка данных для графика ──────────────────────
function buildChartData(chartParams: any, transactions: any[]) {
  const { chartType, days, filter } = chartParams;
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - days);

  const filtered = transactions.filter((t: any) => {
    const d = new Date(t.date || t.createdAt || '');
    return d >= start && d <= now;
  });

  if (chartType === 'pie') {
    // Category breakdown — exclude inter-account transfers, they shouldn't
    // appear as a "spending" category.
    const typeFilter = filter === 'income' ? 'income' : 'expense';
    const catTotals: Record<string, number> = {};
    filtered.filter((t: any) => t.type === typeFilter && !t.isTransfer).forEach((t: any) => {
      catTotals[t.categoryId] = (catTotals[t.categoryId] || 0) + t.amount;
    });
    const catLabel = buildCatNamer(filtered);
    return {
      type: 'pie',
      // `name` stays the id (legend colour lookup keys on it); `label` carries
      // the human-readable category name so custom "cat_…" ids aren't shown raw.
      data: Object.entries(catTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([id, amount]) => ({ name: id, amount, label: catLabel(id) })),
    };
  }

  if (chartType === 'cashflow') {
    // Daily income vs expense
    const data: Array<{ day: number; date: string; income: number; expense: number }> = [];
    for (let i = 0; i <= days; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const dayTxs = filtered.filter((tx: any) => {
        const td = new Date(tx.date || tx.createdAt || '');
        return td.getFullYear() === d.getFullYear() && td.getMonth() === d.getMonth() && td.getDate() === d.getDate();
      });
      const income = dayTxs.filter((t: any) => t.type === 'income' && !t.isTransfer).reduce((s: number, t: any) => s + t.amount, 0);
      const expense = dayTxs.filter((t: any) => t.type === 'expense' && !t.isTransfer).reduce((s: number, t: any) => s + t.amount, 0);
      data.push({ day: d.getDate(), date: `${d.getMonth() + 1}/${d.getDate()}`, income, expense });
    }
    return { type: 'cashflow', data, totalIncome: data.reduce((s, d) => s + d.income, 0), totalExpense: data.reduce((s, d) => s + d.expense, 0) };
  }

  // Default: bar chart (daily amounts) — exclude inter-account transfers
  const typeFilter = filter === 'income' ? 'income' : 'expense';
  const data: Array<{ day: number; date: string; amount: number }> = [];
  for (let i = 0; i <= days; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const dayTotal = filtered.filter((tx: any) => {
      const td = new Date(tx.date || tx.createdAt || '');
      return td.getFullYear() === d.getFullYear() && td.getMonth() === d.getMonth() && td.getDate() === d.getDate() && tx.type === typeFilter && !tx.isTransfer;
    }).reduce((s: number, t: any) => s + t.amount, 0);
    data.push({ day: d.getDate(), date: `${d.getMonth() + 1}/${d.getDate()}`, amount: dayTotal });
  }
  const total = data.reduce((s: number, d) => s + d.amount, 0);
  return { type: 'bar', data, total, avg: days > 0 ? total / days : 0 };
}

async function chatWithAI(question: string, transactions: any[], budgets: any, lang: string) {
  const now = new Date();
  const last90 = transactions.filter((t: any) => {
    const d = new Date(t.date || t.createdAt || '');
    return (now.getTime() - d.getTime()) < 90 * 24 * 60 * 60 * 1000;
  });

  const thisMonth = last90.filter((t: any) => {
    const d = new Date(t.date || t.createdAt || '');
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const income = thisMonth.filter((t: any) => t.type === 'income' && !t.isTransfer).reduce((s: number, t: any) => s + t.amount, 0);
  const expense = thisMonth.filter((t: any) => t.type === 'expense' && !t.isTransfer).reduce((s: number, t: any) => s + t.amount, 0);

  const catTotals: Record<string, number> = {};
  last90.filter((t: any) => t.type === 'expense' && !t.isTransfer).forEach((t: any) => {
    catTotals[t.categoryId] = (catTotals[t.categoryId] || 0) + t.amount;
  });

  const catLabel = buildCatNamer(transactions);
  const topCats = Object.entries(catTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([cat, amount]) => `${catLabel(cat)}: ${Math.round(amount)} ${curCode()}`)
    .join(', ');

  const monthlyIncomes: Record<string, number> = {};
  const monthlyExpenses: Record<string, number> = {};
  last90.forEach((t: any) => {
    if (t.isTransfer) return; // transfers between accounts aren't real income/expense
    const d = new Date(t.date || t.createdAt || '');
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (t.type === 'income') monthlyIncomes[key] = (monthlyIncomes[key] || 0) + t.amount;
    else monthlyExpenses[key] = (monthlyExpenses[key] || 0) + t.amount;
  });

  const monthSummary = Object.keys({ ...monthlyIncomes, ...monthlyExpenses })
    .sort()
    .map(k => `${k}: income ${Math.round(monthlyIncomes[k] || 0)}, expense ${Math.round(monthlyExpenses[k] || 0)}`)
    .join('; ');

  const budgetInfo = Object.entries((budgets || {}) as Record<string, number>)
    .map(([cat, limit]) => `${catLabel(cat)}: spent ${Math.round(catTotals[cat] || 0)} of ${limit}`)
    .join(', ');

  // Top payees
  const payeeTotals: Record<string, number> = {};
  last90.filter((t: any) => t.type === 'expense' && !t.isTransfer && t.recipient).forEach((t: any) => {
    payeeTotals[t.recipient] = (payeeTotals[t.recipient] || 0) + t.amount;
  });
  const topPayees = Object.entries(payeeTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, amount]) => `${name}: ${Math.round(amount)}`)
    .join(', ');

  // This month categories
  const thisMonthCats: Record<string, number> = {};
  thisMonth.filter((t: any) => t.type === 'expense' && !t.isTransfer).forEach((t: any) => {
    thisMonthCats[t.categoryId] = (thisMonthCats[t.categoryId] || 0) + t.amount;
  });
  const thisMonthTopCats = Object.entries(thisMonthCats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([cat, amount]) => `${catLabel(cat)}: ${Math.round(amount)}`)
    .join(', ');

  // Today's transactions
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const todayTxs = transactions.filter((t: any) => (t.date || t.createdAt || '').slice(0, 10) === todayStr);
  const todayExpense = todayTxs.filter((t: any) => t.type === 'expense' && !t.isTransfer).reduce((s: number, t: any) => s + t.amount, 0);
  const todayIncome = todayTxs.filter((t: any) => t.type === 'income' && !t.isTransfer).reduce((s: number, t: any) => s + t.amount, 0);
  const todayDetail = todayTxs.map((t: any) => `${t.type === 'income' && !t.isTransfer ? '+' : '-'}${Math.round(t.amount)} ${catLabel(t.categoryId)}${t.recipient ? ' (' + t.recipient + ')' : ''}`).join(', ');

  const langMap: Record<string, string> = { ru: 'Russian', he: 'Hebrew', en: 'English' };
  const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();

  const prompt = `You are Qaizo AI — a personal finance advisor. Answer the user's question using ONLY their real data below. Always include specific numbers.

=== USER DATA (${curCode()}) ===
TODAY (${todayStr}):
  Transactions: ${todayTxs.length} (expense: ${Math.round(todayExpense)}, income: ${Math.round(todayIncome)})
  Details: ${todayDetail || 'no transactions today'}

THIS MONTH (${now.getMonth() + 1}/${now.getFullYear()}):
  Income: ${Math.round(income)}
  Expenses: ${Math.round(expense)}
  Balance: ${Math.round(income - expense)}
  Days left: ${daysLeft}
  Daily average spend: ${Math.round(expense / Math.max(now.getDate(), 1))}
  Categories: ${thisMonthTopCats || 'no data'}

LAST 3 MONTHS:
  ${monthSummary || 'no data'}
  Top categories (total): ${topCats || 'no data'}
  Top payees: ${topPayees || 'no data'}

BUDGETS: ${budgetInfo || 'none set'}
Total transactions (90 days): ${last90.length}
=== END DATA ===

User's question: "${question}"

RULES:
- Respond ONLY in ${langMap[lang] || 'English'}
- ALWAYS use real numbers from the data above
- Be specific: "You spent 4,611 on food" not "your food spending is high"
- Compare months when relevant
- Give 1-2 actionable tips
- 3-5 sentences max
- Plain text only, no markdown`;

  const result = await callGemini(prompt, { maxTokens: 2048 });
  if (result) return result;
  // Build a fallback that reflects the actual failure reason
  const err = getLastAIError();
  const reason = err?.code === 'rate_limit' ? (lang === 'he' ? 'חרגת ממכסת הבקשות היומית. נסה שוב מאוחר יותר.' : lang === 'ru' ? 'Превышен дневной лимит запросов. Попробуйте позже.' : 'Daily rate limit reached. Please try again later.')
               : err?.code === 'network' ? (lang === 'he' ? 'אין חיבור לאינטרנט. בדוק את החיבור ונסה שוב.' : lang === 'ru' ? 'Нет интернета. Проверьте соединение и попробуйте снова.' : 'No internet connection. Please check and try again.')
               : err?.code === 'auth' || err?.code === 'no_api_key' ? (lang === 'he' ? 'שירות ה-AI אינו זמין כרגע (בעיית תצורה).' : lang === 'ru' ? 'AI временно недоступен (ошибка конфигурации).' : 'AI is temporarily unavailable (configuration issue).')
               : (lang === 'he' ? 'לא הצלחתי לענות כרגע. נסה שוב.' : lang === 'ru' ? 'Не удалось ответить. Попробуйте ещё раз.' : 'Could not answer right now. Please try again.');
  return reason;
}

// ─── Перевод названия категории на все языки ────────────
async function translateCategoryName(name: string, sourceLang: string): Promise<TranslatedCategoryName> {
  const fallback: TranslatedCategoryName = { ru: name, en: name, he: name };
  if (!name || !GEMINI_API_KEY) return fallback;
  try {
    const prompt = `Translate this expense category name to Russian, English, and Hebrew.
Input: "${name}" (language: ${sourceLang})
Reply ONLY with valid JSON, no explanation:
{"ru":"...","en":"...","he":"..."}`;
    const raw = await callGemini(prompt, { maxTokens: 100, temperature: 0.1 });
    if (!raw) return fallback;
    const match = raw.match(/\{[^}]+\}/);
    if (!match) return fallback;
    const parsed = JSON.parse(match[0]);
    if (parsed.ru && parsed.en && parsed.he) return parsed;
    return fallback;
  } catch (e) {
    return fallback;
  }
}

export { detectCardBrand, CARD_BRAND_KEYWORDS };
export default {
  parseTransaction,
  parseTransactionSmart,
  detectCardBrand,
  CARD_BRAND_KEYWORDS,
  calculateTaxReserve,
  predictCashFlow,
  calculateDailyBudget,
  generateInsights,
  getPersonalAdvice,
  chatWithAI,
  interpretChartQuery,
  buildChartData,
  scanReceipt,
  scanReceiptItems,
  scanStatement,
  translateCategoryName,
  callGemini,
  getLastAIError,
  MAAM_RATE,
  ESTIMATED_INCOME_TAX,
  BITUACH_LEUMI,
};
