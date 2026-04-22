// src/services/aiService.js
// AI-движок: Gemini API + локальный фоллбэк для парсинга, налогов, прогнозов
import i18n from '../i18n';
import { fmt, sym, code as curCode } from '../utils/currency';

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const GEMINI_MODEL_PRIMARY = 'gemini-2.5-flash';
const GEMINI_MODEL_FALLBACK = 'gemini-flash-latest';
const geminiUrl = (model) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
const GEMINI_URL = geminiUrl(GEMINI_MODEL_PRIMARY);

// ─── МААМ и налоговые ставки (Израиль) ──────────────────
const MAAM_RATE = 0.17;
const ESTIMATED_INCOME_TAX = 0.10; // упрощённо для осека
const BITUACH_LEUMI = 0.07;

// ─── Категории — ключевые слова (HE / RU / EN) ─────────
const CATEGORY_KEYWORDS = {
  food: ['супермаркет', 'магазин', 'продукты', 'еда', 'שופרסל', 'רמי לוי', 'מזון', 'אוכל', 'קניות', 'סופר', 'מכולת', 'חנות', 'שוק', 'supermarket', 'grocery', 'groceries', 'food', 'market', 'store', 'рами леви', 'шуферсаль', 'shufersal', 'mega', 'מגה', 'יוחננוף', 'victory', 'ויקטורי', 'lidl', 'aldi', 'walmart', 'whole foods', 'lebensmittel', 'einkauf', 'comida', 'supermercado', 'épicerie', 'courses', 'spesa'],
  restaurant: ['ресторан', 'кафе', 'кофе', 'מסעדה', 'קפה', 'בית קפה', 'restaurant', 'cafe', 'coffee', 'starbucks', 'пицца', 'pizza', 'פיצה', 'обед', 'lunch', 'dinner', 'ארוחה', 'ужин', 'завтрак', 'breakfast', 'бар', 'bar', 'паб', 'pub', 'суши', 'sushi', 'סושי', 'фастфуд', 'fast food', 'מסעדה', 'kaffee', 'restaurante', 'café'],
  transport: ['такси', 'uber', 'gett', 'bolt', 'מונית', 'taxi', 'cab', 'автобус', 'אוטובוס', 'bus', 'поезд', 'רכבת', 'train', 'metro', 'метро', 'מטרו', 'трамвай', 'tram', 'самокат', 'scooter', 'קורקינט', 'wolt', 'וולט'],
  fuel: ['бензин', 'заправка', 'דלק', 'דור אלון', 'פז', 'סונול', 'fuel', 'gas', 'petrol', 'gasoline', 'топливо', 'paz', 'sonol', 'delek', 'tankstelle', 'gasolina', 'essence', 'benzin'],
  health: ['аптека', 'врач', 'доктор', 'רופא', 'מרקחת', 'pharmacy', 'doctor', 'больница', 'בית חולים', 'hospital', 'клалит', 'כללית', 'маккаби', 'מכבי', 'леумит', 'לאומית', 'лекарств', 'תרופ', 'medicine', 'dentist', 'стоматолог', 'רופא שיניים', 'arzt', 'apotheke', 'médecin', 'pharmacie'],
  phone: ['связь', 'сим', 'телефон', 'סלולר', 'פלאפון', 'הוט', 'פרטנר', 'cellcom', 'סלקום', 'phone', 'mobile', 'cellular', 'интернет', 'internet', 'אינטרנט'],
  utilities: ['электричество', 'вода', 'газ', 'חשמל', 'מים', 'גז', 'electricity', 'water', 'חברת חשמל', 'коммуналка', 'свет', 'strom', 'wasser', 'electricité', 'eau'],
  clothing: ['одежда', 'обувь', 'ביגוד', 'נעליים', 'בגדים', 'clothes', 'shoes', 'clothing', 'zara', 'h&m', 'castro', 'קסטרו', 'fox', 'פוקס', 'kleidung', 'ropa', 'vêtements'],
  household: ['дом', 'мебель', 'בית', 'רהיטים', 'ikea', 'איקאה', 'home', 'furniture', 'уборка', 'ניקיון', 'cleaning', 'ремонт', 'תיקון', 'repair'],
  kids: ['дети', 'школа', 'садик', 'ילדים', 'בית ספר', 'גן', 'kids', 'children', 'school', 'kindergarten', 'игрушки', 'צעצועים', 'toys', 'подгузники', 'חיתולים', 'diapers'],
  entertainment: ['кино', 'netflix', 'spotify', 'подписка', 'קולנוע', 'נטפליקס', 'cinema', 'movie', 'film', 'subscription', 'театр', 'תיאטרון', 'theater', 'концерт', 'הופעה', 'concert', 'youtube', 'gaming', 'игра', 'משחק'],
  education: ['курс', 'учёба', 'книга', 'קורס', 'לימודים', 'ספר', 'course', 'book', 'study', 'university', 'университет', 'אוניברסיטה', 'college', 'lesson', 'урок', 'שיעור'],
  cosmetics: ['стрижка', 'парикмахер', 'маникюр', 'תספורת', 'מספרה', 'haircut', 'salon', 'салон', 'beauty', 'יופי', 'краска', 'крем', 'קרם', 'косметика', 'קוסמטיקה', 'spa', 'ספא', 'friseur', 'peluquería', 'coiffeur'],
  electronics: ['компьютер', 'мחשב', 'computer', 'laptop', 'ноутбук', 'техника', 'אלקטרוניקה', 'гаджет', 'gadget', 'наушники', 'אוזניות', 'headphones', 'зарядка', 'מטען', 'charger'],
  insurance: ['страховка', 'ביטוח', 'insurance', 'полис', 'פוליסה', 'versicherung', 'seguro', 'assurance'],
  rent: ['аренда', 'квартира', 'שכירות', 'דירה', 'rent', 'apartment', 'miete', 'alquiler', 'loyer'],
  arnona: ['арнона', 'ארנונה', 'arnona', 'municipal', 'муниципалитет', 'עירייה'],
  vaad: ['ваад', 'ועד בית', 'vaad', 'building committee', 'управление домом'],
  salary_me: ['зарплата', 'משכורת', 'salary', 'доход', 'הכנסה', 'оплата за работу', 'получил зп', 'wage', 'gehalt', 'salario', 'salaire'],
  salary_spouse: ['зп жены', 'зп мужа', 'משכורת בן זוג'],
  handyman: ['подработ', 'халтур', 'фриланс', 'гонорар', 'עבודה נוספת', 'freelance', 'side job', 'side gig', 'чаевые', 'tip', 'טיפ'],
  rental_income: ['аренда доход', 'הכנסה משכירות', 'rental income'],
  other_income: ['возврат', 'החזר', 'refund', 'cashback', 'кэшбэк', 'выиграл', 'выигрыш', 'приз', 'бонус', 'prize', 'won', 'bonus', 'בונוס', 'זיכוי', 'дивиденд', 'dividend', 'profit', 'прибыль'],
};

// ─── Парсинг текста ─────────────────────────────────────
function parseTransaction(text) {
  if (!text || !text.trim()) return null;

  const input = text.trim().toLowerCase();

  // Ищем сумму: число (возможно с запятой/точкой)
  const amountMatch = input.match(/(\d[\d,.']*(?:\.\d+)?)\s*(?:₪|шекел|שקל|שקלים|шек|ш|ils|nis)?/i)
    || input.match(/(?:₪|шекел|שקל|שקלים|шек|ш|ils|nis)\s*(\d[\d,.']*(?:\.\d+)?)/i);

  let amount = 0;
  if (amountMatch) {
    amount = parseFloat(amountMatch[1].replace(/[,'\s]/g, ''));
  }
  if (!amount || isNaN(amount)) return null;

  // Определяем тип: доход или расход
  const incomeWords = ['зарплата', 'доход', 'получил', 'заработал', 'возврат', 'подработ', 'выиграл', 'выигрыш', 'перевод от', 'перевели', 'вернули', 'кэшбэк', 'бонус', 'приз', 'гонорар', 'фриланс', 'халтур', 'чаевые', 'прибыль', 'дивиденд', 'משכורת', 'הכנסה', 'קיבלתי', 'הרווחתי', 'זיכוי', 'בונוס', 'טיפ', 'salary', 'income', 'received', 'earned', 'refund', 'cashback', 'bonus', 'won', 'prize', 'tip', 'freelance', 'profit', 'dividend', 'payout'];
  const isIncome = incomeWords.some(w => input.includes(w));
  const type = isIncome ? 'income' : 'expense';

  // Определяем категорию
  let categoryId = isIncome ? 'other_income' : 'other';
  let maxScore = 0;

  Object.entries(CATEGORY_KEYWORDS).forEach(([cat, keywords]) => {
    let score = 0;
    keywords.forEach(kw => {
      if (input.includes(kw.toLowerCase())) {
        score += kw.length; // длинные совпадения весят больше
      }
    });
    if (score > maxScore) {
      maxScore = score;
      categoryId = cat;
    }
  });

  // Если категория — доходная, ставим тип income
  if (['salary_me', 'salary_spouse', 'rental_income', 'other_income'].includes(categoryId)) {
    return { amount, type: 'income', categoryId, recipient: extractPayee(input), note: text.trim() };
  }

  // Извлекаем получателя/магазин
  const recipient = extractPayee(input);

  return { amount, type, categoryId, recipient, note: text.trim() };
}

function extractPayee(input) {
  // Известные магазины/бренды
  const knownPayees = [
    'рами леви', 'רמי לוי', 'rami levy',
    'шуферсаль', 'שופרסל', 'shufersal',
    'מגה', 'mega',
    'ויקטורי', 'victory',
    'יוחננוף',
    'ikea', 'איקאה', 'икея',
    'zara', 'h&m', 'castro', 'קסטרו', 'fox', 'פוקס',
    'netflix', 'spotify', 'apple',
    'paz', 'פז', 'sonol', 'סונול', 'דור אלון', 'delek', 'דלק',
    'uber', 'gett', 'bolt', 'wolt', 'וולט',
  ];

  for (const payee of knownPayees) {
    if (input.includes(payee)) {
      return payee.charAt(0).toUpperCase() + payee.slice(1);
    }
  }
  return '';
}

// ─── Налоговый резерв (для самозанятых) ─────────────────
function calculateTaxReserve(grossIncome) {
  const maam = Math.round(grossIncome * MAAM_RATE / (1 + MAAM_RATE)); // МААМ уже включён
  const incomeTax = Math.round(grossIncome * ESTIMATED_INCOME_TAX);
  const bituach = Math.round(grossIncome * BITUACH_LEUMI);
  const total = maam + incomeTax + bituach;
  const net = grossIncome - total;

  return { grossIncome, maam, incomeTax, bituach, totalReserve: total, netIncome: net };
}

// ─── Прогноз кассового разрыва ──────────────────────────
function predictCashFlow(accounts, recurring, transactions) {
  const now = new Date();
  const currentBalance = accounts.reduce((s, a) => s + (a.balance || 0), 0);

  // Предстоящие обязательные платежи в этом месяце
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const upcoming = [];
  let totalUpcoming = 0;

  recurring.filter(r => r.isActive && r.nextDate).forEach(r => {
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
    upcoming: upcoming.sort((a, b) => a.date - b.date),
  };
}

// ─── Динамический дневной бюджет ────────────────────────
function calculateDailyBudget(transactions, budgets) {
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const daysLeft = daysInMonth - dayOfMonth;
  if (daysLeft <= 0) return null;

  const thisMonth = transactions.filter(t => {
    const d = new Date(t.date || t.createdAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const income = thisMonth.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = thisMonth.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const remaining = income - expense;

  if (remaining <= 0 || income <= 0) return null;

  const dailyBudget = Math.round(remaining / daysLeft);

  // Вчерашние расходы
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = yesterday.toISOString().split('T')[0];
  const yesterdayExpense = thisMonth
    .filter(t => t.type === 'expense' && (t.date || t.createdAt || '').startsWith(yStr))
    .reduce((s, t) => s + t.amount, 0);

  const prevDailyBudget = daysLeft > 0 ? Math.round((remaining + yesterdayExpense) / (daysLeft + 1)) : dailyBudget;
  const savedYesterday = prevDailyBudget - yesterdayExpense;

  return { dailyBudget, daysLeft, remaining, savedYesterday };
}

// ─── Генерация инсайтов ─────────────────────────────────
function generateInsights(transactions, budgets, accounts, recurring) {
  const now = new Date();
  const insights = [];

  const thisMonth = transactions.filter(t => {
    const d = new Date(t.date || t.createdAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const lastMonth = transactions.filter(t => {
    const d = new Date(t.date || t.createdAt);
    const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear();
  });

  const income = thisMonth.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = thisMonth.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance = income - expense;
  const savingsRate = income > 0 ? Math.round((balance / income) * 100) : 0;

  // Категории этого месяца
  const catTotals = {};
  thisMonth.filter(t => t.type === 'expense').forEach(t => {
    catTotals[t.categoryId] = (catTotals[t.categoryId] || 0) + t.amount;
  });
  // Категории прошлого месяца
  const lastCatTotals = {};
  lastMonth.filter(t => t.type === 'expense').forEach(t => {
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
      text: i18n.t('aiSavingsRateText').replace('{rate}', savingsRate).replace('{amount}', fmt(Math.abs(balance))),
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
          .replace('{cat}', i18n.t(cat))
          .replace('{pct}', pct)
          .replace('{amount}', fmt(amount))
          .replace('{lastAmount}', fmt(lastAmount)),
      });
    }
  });

  // 3. Бюджеты под угрозой
  Object.entries(budgets).forEach(([cat, limit]) => {
    const spent = catTotals[cat] || 0;
    const pct = Math.round((spent / limit) * 100);
    if (pct >= 100) {
      insights.push({
        type: 'negative',
        icon: 'x-circle',
        title: i18n.t('aiBudgetExceeded'),
        text: i18n.t('aiBudgetExceededText').replace('{cat}', i18n.t(cat)).replace('{amount}', fmt(spent - limit)),
      });
    } else if (pct > monthProgress * 100 + 15) {
      insights.push({
        type: 'warning',
        icon: 'alert-triangle',
        title: i18n.t('aiBudgetWarning'),
        text: i18n.t('aiBudgetWarningText')
          .replace('{cat}', i18n.t(cat)).replace('{pct}', pct).replace('{days}', daysInMonth - dayOfMonth),
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
  const subscriptions = recurring.filter(r => r.isActive && r.categoryId === 'entertainment');
  if (subscriptions.length > 0) {
    const total = subscriptions.reduce((s, r) => s + r.amount, 0);
    if (total > 50) {
      insights.push({
        type: 'info',
        icon: 'tv',
        title: i18n.t('aiSubscriptions'),
        text: i18n.t('aiSubscriptionsText')
          .replace('{count}', subscriptions.length)
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

// ─── Gemini API ─────────────────────────────────────────
// Last AI failure reason — exposed so screens can show a specific message
// ("rate limit" / "no api key" / "network") instead of a generic fallback.
let _lastAIError = null;
function getLastAIError() { return _lastAIError; }

async function callGeminiOnce(model, prompt, { maxTokens, temperature }) {
  const res = await fetch(`${geminiUrl(model)}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature, maxOutputTokens: maxTokens },
    }),
  });
  return res;
}

async function callGemini(prompt, { maxTokens = 1024, temperature = 0.3 } = {}) {
  if (!GEMINI_API_KEY) {
    _lastAIError = { code: 'no_api_key', message: 'Gemini API key is not configured' };
    if (__DEV__) console.warn('[ai] no GEMINI_API_KEY set');
    return null;
  }
  const tryModel = async (model) => {
    try {
      const res = await callGeminiOnce(model, prompt, { maxTokens, temperature });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        const code = res.status === 429 ? 'rate_limit'
                   : res.status === 401 || res.status === 403 ? 'auth'
                   : res.status >= 500 ? 'server'
                   : 'http_error';
        if (__DEV__) console.warn('[ai] gemini', model, 'error', res.status, errText.slice(0, 300));
        return { ok: false, code, status: res.status, message: errText.slice(0, 300) };
      }
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
      if (!text) return { ok: false, code: 'empty_response', message: 'Gemini returned no text' };
      return { ok: true, text };
    } catch (e) {
      if (__DEV__) console.warn('[ai] gemini', model, 'fetch failed', e);
      return { ok: false, code: 'network', message: String(e?.message || e) };
    }
  };

  // Primary model
  let r = await tryModel(GEMINI_MODEL_PRIMARY);
  // Retry on transient overload (503) or empty response with the fallback model
  if (!r.ok && (r.code === 'server' || r.code === 'empty_response')) {
    if (__DEV__) console.warn('[ai] retrying on fallback model', GEMINI_MODEL_FALLBACK);
    r = await tryModel(GEMINI_MODEL_FALLBACK);
  }
  if (r.ok) {
    _lastAIError = null;
    return r.text;
  }
  _lastAIError = { code: r.code, status: r.status, message: r.message };
  return null;
}

// Умный парсинг транзакции через Gemini
async function parseTransactionSmart(text) {
  const lang = i18n.getLanguage();
  const currency = curCode();
  const categories = Object.keys(CATEGORY_KEYWORDS).join(', ');

  const prompt = `You are a financial transaction parser. Parse this text into a transaction.
Input: "${text}"
User language: ${lang}, Currency: ${currency}

Available expense categories: food, restaurant, transport, fuel, health, phone, utilities, clothing, household, kids, entertainment, education, cosmetics, electronics, insurance, rent, arnona, vaad, other
Available income categories: salary_me, salary_spouse, handyman, rental_income, other_income

Respond ONLY with valid JSON, no markdown, no explanation:
{"amount": number, "type": "expense" or "income", "categoryId": "one of the categories above", "recipient": "store/payee name or empty string", "note": "original text"}

Rules:
- Extract the numeric amount from the text
- IMPORTANT: Determine if income or expense from context clues:
  - Income words (RU): зарплата, получил, заработал, подработал, выиграл, возврат, бонус, фриланс, чаевые, прибыль
  - Income words (EN): salary, earned, received, won, bonus, freelance, tip, profit, refund, cashback
  - Income words (HE): משכורת, הכנסה, קיבלתי, הרווחתי, בונוס, טיפ, זיכוי
  - If income → use income categories (salary_me, handyman, other_income, etc.)
  - If expense → use expense categories (food, transport, etc.)
- Pick the BEST matching categoryId, avoid "other" when possible
- recipient = store/payee name if mentioned, otherwise empty string`;

  const result = await callGemini(prompt);
  if (result) {
    try {
      // Извлекаем JSON из ответа (может быть обёрнут в ```)
      const jsonStr = result.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(jsonStr);
      if (parsed.amount && parsed.type && parsed.categoryId) {
        return parsed;
      }
    } catch (e) {}
  }

  // Фоллбэк на локальный парсер
  return parseTransaction(text);
}

// Персональные советы от Gemini
async function getPersonalAdvice(transactions, budgets, lang) {
  const now = new Date();
  const thisMonth = transactions.filter(t => {
    const d = new Date(t.date || t.createdAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const income = thisMonth.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = thisMonth.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  const catTotals = {};
  thisMonth.filter(t => t.type === 'expense').forEach(t => {
    catTotals[t.categoryId] = (catTotals[t.categoryId] || 0) + t.amount;
  });

  const topCats = Object.entries(catTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([cat, amount]) => `${cat}: ${amount}`)
    .join(', ');

  const budgetInfo = Object.entries(budgets)
    .map(([cat, limit]) => `${cat}: spent ${catTotals[cat] || 0}/${limit}`)
    .join(', ');

  const langMap = { ru: 'Russian', he: 'Hebrew', en: 'English' };

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
        return tips.map(t => ({
          ...t,
          icon: t.type === 'positive' ? 'star' : t.type === 'warning' ? 'alert-circle' : 'info',
        }));
      }
    } catch (e) {}
  }
  return null;
}

// ─── Receipt Scanner ────────────────────────────────────
async function scanReceipt(imageInput, lang, _retryCount = 0) {
  if (!GEMINI_API_KEY) {
    if (__DEV__) console.error('scanReceipt: no API key');
    return null;
  }
  try {
    // Support single string or array of base64 strings
    const imageList = Array.isArray(imageInput) ? imageInput : [imageInput];

    const detectMime = (b64) => {
      if (b64.startsWith('/9j/')) return 'image/jpeg';
      if (b64.startsWith('iVBOR')) return 'image/png';
      if (b64.startsWith('JVBER')) return 'application/pdf';
      if (b64.startsWith('UklGR')) return 'image/webp';
      return 'image/jpeg';
    };

    const imageParts = imageList.map(b64 => ({
      inlineData: { mimeType: detectMime(b64), data: b64 }
    }));

    if (__DEV__) console.log('scanReceipt:', imageList.length, 'images, sizes:', imageList.map(b => b.length), 'attempt:', _retryCount + 1);

    const multiImageHint = imageList.length > 1
      ? `These ${imageList.length} images are parts of the SAME receipt. Combine all items and find the total from the last image.`
      : '';

    const res = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: `You are an expert receipt scanner. The receipt may be in ANY language (Hebrew, Russian, English, Arabic, etc.). The image may be slightly blurry, rotated, or have low contrast — do your best to extract data.
${multiImageHint}
Extract:
- total: the TOTAL amount (number). Look for the LAST/LARGEST bold number, or words in any language: Total, סה"כ, סהכ, Итого, Всего, לתשלום, סך הכל, المجموع. If multiple totals, pick the final one.
- store: business name, usually at the top. Return the name as written on the receipt.
- date: look for date on receipt, return as YYYY-MM-DD. Common formats: DD/MM/YYYY, DD.MM.YYYY, MM/DD/YYYY, YYYY-MM-DD.
- category: classify the business. Supermarket/grocery = "food". Restaurant/cafe = "restaurant". Gas station = "fuel". Pharmacy = "health". Use: food,restaurant,fuel,transport,health,phone,utilities,clothing,household,kids,entertainment,education,cosmetics,electronics,insurance,rent,other
Return ONLY short JSON, no items: {"total":0,"store":"","date":"2026-01-01","category":"food"}` },
            ...imageParts,
          ],
        }],
        generationConfig: { temperature: 0.15, maxOutputTokens: 1024 },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      if (__DEV__) console.error('scanReceipt API error:', res.status, errText);
      return null;
    }

    const data = await res.json();
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

    let parsed;
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
      return null;
    }

    return parsed;
  } catch (e) {
    if (__DEV__) console.error('scanReceipt error:', e);
    // Retry once on failure
    if (_retryCount < 1) {
      if (__DEV__) console.log('scanReceipt: retrying after error...');
      await new Promise(r => setTimeout(r, 1000));
      return scanReceipt(imageInput, lang, _retryCount + 1);
    }
    return null;
  }
}

// ─── Receipt Items (separate request for long receipts) ──
async function scanReceiptItems(imageInput) {
  if (!GEMINI_API_KEY) return [];
  try {
    const imageList = Array.isArray(imageInput) ? imageInput : [imageInput];
    const detectMime = (b64) => {
      if (b64.startsWith('/9j/')) return 'image/jpeg';
      if (b64.startsWith('iVBOR')) return 'image/png';
      if (b64.startsWith('JVBER')) return 'application/pdf';
      return 'image/jpeg';
    };
    const imageParts = imageList.map(b64 => ({
      inlineData: { mimeType: detectMime(b64), data: b64 }
    }));

    const res = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: `List ALL purchased items from this receipt with their prices.
The receipt may be wrinkled or slightly blurry — do your best to read each item.
Each item: name = product name as printed on receipt (keep original language).
Price = number only, no currency.
Return ONLY JSON array: [{"name":"product name","price":12.90}]` },
            ...imageParts,
          ],
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
      }),
    });

    if (!res.ok) return [];
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    let jsonStr = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();

    // Fix truncated array
    if (jsonStr.startsWith('[') && !jsonStr.endsWith(']')) {
      const lastBrace = jsonStr.lastIndexOf('}');
      if (lastBrace > 0) jsonStr = jsonStr.substring(0, lastBrace + 1) + ']';
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (parseErr) {
      if (__DEV__) console.error('scanReceiptItems JSON parse error:', parseErr, 'raw:', jsonStr.slice(0, 200));
      return [];
    }
    return Array.isArray(parsed) ? parsed.filter(i => i.name && i.price) : [];
  } catch (e) {
    if (__DEV__) console.error('scanReceiptItems error:', e);
    return [];
  }
}

// ─── AI Chat ────────────────────────────────────────────
// ─── Интерпретация запроса для графика ──────────────────
async function interpretChartQuery(question, transactions, lang) {
  const langMap = { ru: 'Russian', he: 'Hebrew', en: 'English' };

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
function buildChartData(chartParams, transactions) {
  const { chartType, days, filter } = chartParams;
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - days);

  const filtered = transactions.filter(t => {
    const d = new Date(t.date || t.createdAt);
    return d >= start && d <= now;
  });

  if (chartType === 'pie') {
    // Category breakdown
    const typeFilter = filter === 'income' ? 'income' : 'expense';
    const catTotals = {};
    filtered.filter(t => t.type === typeFilter).forEach(t => {
      catTotals[t.categoryId] = (catTotals[t.categoryId] || 0) + t.amount;
    });
    return {
      type: 'pie',
      data: Object.entries(catTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([name, amount]) => ({ name, amount })),
    };
  }

  if (chartType === 'cashflow') {
    // Daily income vs expense
    const data = [];
    for (let i = 0; i <= days; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const dayTxs = filtered.filter(tx => {
        const td = new Date(tx.date || tx.createdAt);
        return td.getFullYear() === d.getFullYear() && td.getMonth() === d.getMonth() && td.getDate() === d.getDate();
      });
      const income = dayTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const expense = dayTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      data.push({ day: d.getDate(), date: `${d.getMonth() + 1}/${d.getDate()}`, income, expense });
    }
    return { type: 'cashflow', data, totalIncome: data.reduce((s, d) => s + d.income, 0), totalExpense: data.reduce((s, d) => s + d.expense, 0) };
  }

  // Default: bar chart (daily amounts)
  const typeFilter = filter === 'income' ? 'income' : 'expense';
  const data = [];
  for (let i = 0; i <= days; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const dayTotal = filtered.filter(tx => {
      const td = new Date(tx.date || tx.createdAt);
      return td.getFullYear() === d.getFullYear() && td.getMonth() === d.getMonth() && td.getDate() === d.getDate() && tx.type === typeFilter;
    }).reduce((s, t) => s + t.amount, 0);
    data.push({ day: d.getDate(), date: `${d.getMonth() + 1}/${d.getDate()}`, amount: dayTotal });
  }
  const total = data.reduce((s, d) => s + d.amount, 0);
  return { type: 'bar', data, total, avg: days > 0 ? total / days : 0 };
}

async function chatWithAI(question, transactions, budgets, lang) {
  const now = new Date();
  const last90 = transactions.filter(t => {
    const d = new Date(t.date || t.createdAt);
    return (now - d) < 90 * 24 * 60 * 60 * 1000;
  });

  const thisMonth = last90.filter(t => {
    const d = new Date(t.date || t.createdAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const income = thisMonth.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = thisMonth.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  const catTotals = {};
  last90.filter(t => t.type === 'expense').forEach(t => {
    catTotals[t.categoryId] = (catTotals[t.categoryId] || 0) + t.amount;
  });

  const topCats = Object.entries(catTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([cat, amount]) => `${cat}: ${Math.round(amount)} ${curCode()}`)
    .join(', ');

  const monthlyIncomes = {};
  const monthlyExpenses = {};
  last90.forEach(t => {
    const d = new Date(t.date || t.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (t.type === 'income') monthlyIncomes[key] = (monthlyIncomes[key] || 0) + t.amount;
    else monthlyExpenses[key] = (monthlyExpenses[key] || 0) + t.amount;
  });

  const monthSummary = Object.keys({ ...monthlyIncomes, ...monthlyExpenses })
    .sort()
    .map(k => `${k}: income ${Math.round(monthlyIncomes[k] || 0)}, expense ${Math.round(monthlyExpenses[k] || 0)}`)
    .join('; ');

  const budgetInfo = Object.entries(budgets || {})
    .map(([cat, limit]) => `${cat}: spent ${Math.round(catTotals[cat] || 0)} of ${limit}`)
    .join(', ');

  // Top payees
  const payeeTotals = {};
  last90.filter(t => t.type === 'expense' && t.recipient).forEach(t => {
    payeeTotals[t.recipient] = (payeeTotals[t.recipient] || 0) + t.amount;
  });
  const topPayees = Object.entries(payeeTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, amount]) => `${name}: ${Math.round(amount)}`)
    .join(', ');

  // This month categories
  const thisMonthCats = {};
  thisMonth.filter(t => t.type === 'expense').forEach(t => {
    thisMonthCats[t.categoryId] = (thisMonthCats[t.categoryId] || 0) + t.amount;
  });
  const thisMonthTopCats = Object.entries(thisMonthCats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([cat, amount]) => `${cat}: ${Math.round(amount)}`)
    .join(', ');

  // Today's transactions
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const todayTxs = transactions.filter(t => (t.date || t.createdAt || '').slice(0, 10) === todayStr);
  const todayExpense = todayTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const todayIncome = todayTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const todayDetail = todayTxs.map(t => `${t.type === 'income' ? '+' : '-'}${Math.round(t.amount)} ${t.categoryId}${t.recipient ? ' (' + t.recipient + ')' : ''}`).join(', ');

  const langMap = { ru: 'Russian', he: 'Hebrew', en: 'English' };
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
  const err = _lastAIError;
  const reason = err?.code === 'rate_limit' ? (lang === 'he' ? 'חרגת ממכסת הבקשות היומית. נסה שוב מאוחר יותר.' : lang === 'ru' ? 'Превышен дневной лимит запросов. Попробуйте позже.' : 'Daily rate limit reached. Please try again later.')
               : err?.code === 'network' ? (lang === 'he' ? 'אין חיבור לאינטרנט. בדוק את החיבור ונסה שוב.' : lang === 'ru' ? 'Нет интернета. Проверьте соединение и попробуйте снова.' : 'No internet connection. Please check and try again.')
               : err?.code === 'auth' || err?.code === 'no_api_key' ? (lang === 'he' ? 'שירות ה-AI אינו זמין כרגע (בעיית תצורה).' : lang === 'ru' ? 'AI временно недоступен (ошибка конфигурации).' : 'AI is temporarily unavailable (configuration issue).')
               : (lang === 'he' ? 'לא הצלחתי לענות כרגע. נסה שוב.' : lang === 'ru' ? 'Не удалось ответить. Попробуйте ещё раз.' : 'Could not answer right now. Please try again.');
  return reason;
}

// ─── Перевод названия категории на все языки ────────────
async function translateCategoryName(name, sourceLang) {
  const fallback = { ru: name, en: name, he: name };
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

export default {
  parseTransaction,
  parseTransactionSmart,
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
  translateCategoryName,
  callGemini,
  getLastAIError,
  MAAM_RATE,
  ESTIMATED_INCOME_TAX,
  BITUACH_LEUMI,
};
