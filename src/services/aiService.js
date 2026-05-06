// src/services/aiService.js
// AI-движок: Gemini API + локальный фоллбэк для парсинга, налогов, прогнозов
import i18n from '../i18n';
import { catName } from '../utils/categoryName';
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
  pension: ['пенсия', 'пенсионный', 'קרן פנסיה', 'פנסיה', 'גמל', 'קופת גמל', 'השתלמות', 'קרן השתלמות', 'pension', 'retirement', 'pension fund'],
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
  const incomeWords = ['зарплата', 'доход', 'получил', 'поступил', 'поступление', 'начислено', 'заработал', 'возврат', 'подработ', 'выиграл', 'выигрыш', 'перевод от', 'перевели', 'вернули', 'кэшбэк', 'бонус', 'приз', 'гонорар', 'фриланс', 'халтур', 'чаевые', 'прибыль', 'дивиденд', 'משכורת', 'הכנסה', 'קיבלתי', 'הרווחתי', 'זיכוי', 'בונוס', 'טיפ', 'נכנס', 'הופקד', 'התקבל', 'זוכה', 'salary', 'income', 'received', 'incoming', 'deposit', 'earned', 'refund', 'cashback', 'bonus', 'won', 'prize', 'tip', 'freelance', 'profit', 'dividend', 'payout'];
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
  if (['salary_me', 'salary_spouse', 'rental_income', 'other_income', 'handyman'].includes(categoryId)) {
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

  const income = thisMonth.filter(t => t.type === 'income' && !t.isTransfer).reduce((s, t) => s + t.amount, 0);
  const expense = thisMonth.filter(t => t.type === 'expense' && !t.isTransfer).reduce((s, t) => s + t.amount, 0);
  const remaining = income - expense;

  if (remaining <= 0 || income <= 0) return null;

  const dailyBudget = Math.round(remaining / daysLeft);

  // Вчерашние расходы
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = yesterday.toISOString().split('T')[0];
  const yesterdayExpense = thisMonth
    .filter(t => t.type === 'expense' && !t.isTransfer && (t.date || t.createdAt || '').startsWith(yStr))
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

  const income = thisMonth.filter(t => t.type === 'income' && !t.isTransfer).reduce((s, t) => s + t.amount, 0);
  const expense = thisMonth.filter(t => t.type === 'expense' && !t.isTransfer).reduce((s, t) => s + t.amount, 0);
  const balance = income - expense;
  const savingsRate = income > 0 ? Math.round((balance / income) * 100) : 0;

  // Категории этого месяца
  const catTotals = {};
  thisMonth.filter(t => t.type === 'expense' && !t.isTransfer).forEach(t => {
    catTotals[t.categoryId] = (catTotals[t.categoryId] || 0) + t.amount;
  });
  // Категории прошлого месяца
  const lastCatTotals = {};
  lastMonth.filter(t => t.type === 'expense' && !t.isTransfer).forEach(t => {
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
          .replace('{cat}', catName(cat))
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
        text: i18n.t('aiBudgetExceededText').replace('{cat}', catName(cat)).replace('{amount}', fmt(spent - limit)),
      });
    } else if (pct > monthProgress * 100 + 15) {
      insights.push({
        type: 'warning',
        icon: 'alert-triangle',
        title: i18n.t('aiBudgetWarning'),
        text: i18n.t('aiBudgetWarningText')
          .replace('{cat}', catName(cat)).replace('{pct}', pct).replace('{days}', daysInMonth - dayOfMonth),
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

// Cross-language semantic synonyms for project name matching.
// If a project is named in one language and the user types in another,
// these synonym groups bridge them.
const PROJECT_SYNONYMS = [
  ['свадьба', 'свадеб', 'свадебн', 'wedding', 'חתונה', 'חתונת'],
  ['ремонт', 'renovation', 'remodel', 'שיפוץ', 'שיפוצים'],
  ['поездка', 'путешеств', 'отпуск', 'trip', 'travel', 'vacation', 'טיול', 'נסיעה', 'חופש'],
  ['машин', 'авто', 'car', 'auto', 'vehicle', 'רכב', 'מכונית', 'אוטו'],
  ['подарок', 'подарк', 'gift', 'present', 'מתנה', 'מתנות'],
  ['малыш', 'ребен', 'детск', 'baby', 'newborn', 'תינוק', 'תינוקת'],
  ['дом', 'home', 'house', 'בית', 'דירה'],
];

// Strip Hebrew prefixes (ל, ב, מ, כ, ה) and lowercase
function normalizeWord(s) {
  if (!s) return '';
  let n = s.toLowerCase().trim();
  // Strip common Hebrew preposition/article prefixes
  n = n.replace(/^[להבכמש]/, '');
  return n;
}

function matchProjectInText(text, projectsList) {
  if (!projectsList || projectsList.length === 0 || !text) return null;
  const lc = text.toLowerCase();
  const lcWords = lc.split(/[\s,.;:!?()\-—–"'`]+/).filter(Boolean);
  const lcWordsNormalized = lcWords.map(normalizeWord);

  for (const p of projectsList) {
    const projName = (p.name || '').toLowerCase().trim();
    if (!projName) continue;

    // 1. Direct substring match (e.g. "בחתונה" contains "חתונה")
    if (lc.includes(projName)) return p.id;

    // 2. Word-by-word match against project name tokens
    const projTokens = projName.split(/\s+/).map(t => t.length >= 3 ? t : null).filter(Boolean);
    for (const projTok of projTokens) {
      const projTokNorm = normalizeWord(projTok);
      if (projTokNorm.length < 3) continue;
      for (const w of lcWordsNormalized) {
        if (w.length < 3) continue;
        if (w.includes(projTokNorm) || projTokNorm.includes(w)) return p.id;
      }
    }

    // 3. Cross-language synonym match
    for (const syns of PROJECT_SYNONYMS) {
      const projInGroup = syns.some(s => projName.includes(s));
      if (!projInGroup) continue;
      const textInGroup = syns.some(s => {
        if (lc.includes(s)) return true;
        return lcWordsNormalized.some(w => w.includes(s) || s.includes(w));
      });
      if (textInGroup) return p.id;
    }
  }
  return null;
}

// Brand keywords for credit card brand detection (used for both AI selection and UI chip filtering)
const CARD_BRAND_KEYWORDS = {
  visa: ['visa', 'ויזה', 'виза'],
  mastercard: ['mastercard', 'master card', 'מאסטרקארד', 'מסטרקארד', 'мастеркард', 'мастер кард'],
  amex: ['amex', 'american express', 'אמקס', 'американ экспресс'],
};

function detectCardBrand(text) {
  const lc = (text || '').toLowerCase();
  for (const [brand, kws] of Object.entries(CARD_BRAND_KEYWORDS)) {
    if (kws.some(kw => lc.includes(kw))) return brand;
  }
  return null;
}

// Умный парсинг транзакции через Gemini
async function parseTransactionSmart(text, accounts = [], projects = []) {
  const lang = i18n.getLanguage();
  const currency = curCode();
  const categories = Object.keys(CATEGORY_KEYWORDS).join(', ');

  // Build accounts section for prompt (only active accounts)
  const activeAccounts = (accounts || []).filter(a => a.isActive !== false);
  console.log('[Smart] accounts in prompt:', activeAccounts.length, activeAccounts.map(a => `${a.id}=${a.name}(${a.type})`).join(' | '));
  const accountsSection = activeAccounts.length > 0
    ? `\nUSER ACCOUNTS (id → name (type)):\n${activeAccounts.map(a => `  ${a.id} → "${a.name}" (${a.type || 'other'})`).join('\n')}\n\nACCOUNT MATCHING RULES:\n  - If user mentions a SPECIFIC account name/brand ("Visa Hapoalim", "Mastercard", "Cash wallet") → return "accountId": "<that exact id>"\n  - If user mentions only a generic TYPE (кредитка, наличка, банк, מזומן, אשראי, חשבון בנק, credit card, cash) → return "accountType": "credit" | "cash" | "bank" | "savings" | "investment"\n  - If user says nothing about payment method → return both as null\n`
    : '';

  // Build projects section — only if user has any projects
  const projectsList = (projects || []);
  const projectsSection = projectsList.length > 0
    ? `\nUSER PROJECTS (id → name):\n${projectsList.map(p => `  ${p.id} → "${p.name}"`).join('\n')}\n\nPROJECT MATCHING RULES (very tolerant):\n  - Match the project name even with prefixes/suffixes/declensions:\n      Hebrew: "לחתונה"/"בחתונה"/"מהחתונה"/"החתונה" all match project "חתונה"/"Wedding"/"Свадьба" (strip ל/ב/מ/ה prefixes).\n      Russian: "на свадьбу"/"для свадьбы"/"свадебный" → project "Свадьба"/"Wedding".\n      English: "for the wedding"/"wedding stuff" → project "Wedding"/"Свадьба"/"חתונה".\n  - Match SEMANTICALLY across languages: a Hebrew word can match a Russian/English project name and vice versa. E.g. "לחתונה" (HE) matches a project named "Свадьба" (RU) or "Wedding" (EN).\n  - Same for: שיפוץ/ремонт/renovation, טיול/поездка/trip, רכב/машина/car, מתנה/подарок/gift, תינוק/малыш/baby.\n  - If user mentioned the project (any form), return "projectId": "<that exact id from the list>".\n  - Otherwise return "projectId": null. DO NOT guess a project that wasn't mentioned.\n`
    : '';

  const prompt = `You are a financial transaction parser for an Israeli personal finance app. Parse the user's free-text into a transaction JSON.

Input: "${text}"
User language: ${lang}
Currency: ${currency}

EXPENSE CATEGORIES (id → meaning / typical keywords across RU/HE/EN):
  food         → groceries, продукты, supermarket, שופרסל, רמי לוי, יוחננוף, victory, מכולת, мясо, овощи, молочка
  restaurant   → кафе, ресторан, кофе, обед/ужин в заведении, מסעדה, בית קפה, бар, паб, fastfood, sushi, pizza
  transport    → такси, автобус, поезд, метро, uber, gett, bolt, מונית, אוטובוס, רכבת (NOT fuel)
  fuel         → бензин, заправка, дизель, דלק, paz, sonol, delek, dor alon
  health       → аптека, врач, доктор, רופא, מרקחת, hospital, клалит/маккаби/леумит, лекарства, стоматолог
  phone        → связь, телефон, интернет, סלולר, פלאפון, partner, cellcom, hot, פרטנר, hotmobile
  utilities    → электричество, вода, газ, חשמל, מים, חברת חשמל, коммуналка
  clothing     → одежда, обувь, ביגוד, נעליים, zara, h&m, castro, fox (включая детскую одежду)
  household    → мебель, ремонт, ikea, איקאה, רהיטים, уборка дома, бытовая техника, товары для дома
  kids         → детсад, школа, бит сефер, ган, игрушки, подгузники, школьные принадлежности (NOT детская одежда=clothing)
  entertainment → кино, netflix, spotify, концерт, театр, gaming, подписка на стриминг
  education    → курс, учёба взрослого, книга, university, lesson, урок (для взрослых)
  cosmetics    → парикмахер, маникюр, salon, spa, מספרה, косметика, крем
  electronics  → компьютер, ноутбук, гаджет, наушники, зарядка, אלקטרוניקה
  insurance    → страховка, ביטוח, полис, медстраховка, autoinsurance
  pension      → пенсия, пенсионный фонд, קרן פנסיה, פנסיה, גמל, השתלמות, pension fund, retirement
  rent         → аренда квартиры, שכירות
  arnona       → арнона, ארנונה, муниципальный налог
  vaad         → ваад байт, ועד בית, плата управляющей компании
  other        → используй когда совпадение слабое или категория не подходит ни к одной из выше

INCOME CATEGORIES:
  salary_me      → моя зарплата, salary, משכורת, получил зп (regular paid employment)
  salary_spouse  → зарплата супруга/мужа/жены
  handyman       → подработка, фриланс, гонорар, чаевые, side job, עבודה נוספת, freelance
  rental_income  → доход от сдачи квартиры/недвижимости, השכרה
  other_income   → возврат налога / החזר מס / החזר ממס הכנסה / tax refund / возврат от налоговой / кэшбэк, бонус, приз, выигрыш, дивиденд, прибыль, cashback, refund, prize, lottery
  IMPORTANT: tax refund (החזר מס / החזר ממס הכנסה / возврат налога) is OTHER_INCOME, NOT salary_me — a refund is not a salary even though the word "מס הכנסה" contains "הכנסה".

INCOME vs EXPENSE — defaults to EXPENSE unless income trigger is clear:
  Income triggers (RU): зарплата, получил, поступил, поступило, поступление, пришёл/пришло, заработал, подработал, выиграл, возврат, бонус, фриланс, чаевые, прибыль, кэшбэк, дивиденд, начислено
  Income triggers (EN): salary, earned, received, incoming, deposit, deposited, won, bonus, freelance, tip, profit, refund, cashback, payout, dividend
  Income triggers (HE): משכורת, הכנסה, קיבלתי, הרווחתי, בונוס, טיפ, זיכוי, החזר, נכנס, נכנסה, הופקד, הופקדה, התקבל, התקבלה, זוכה
  IMPORTANT: "נכנס תשלום" / "поступил платёж" / "incoming payment" → INCOME (money came IN to the user's account, even if going to pension/savings).

EXAMPLES (input → output):
  "кофе с круассаном 28" → {"amount":28,"type":"expense","categoryId":"restaurant","recipient":"","note":"кофе с круассаном 28"}
  "продукты в шуферсаль 380" → {"amount":380,"type":"expense","categoryId":"food","recipient":"Shufersal","note":"продукты в шуферсаль 380"}
  "залил полный бак 250" → {"amount":250,"type":"expense","categoryId":"fuel","recipient":"","note":"залил полный бак 250"}
  "такси домой 45" → {"amount":45,"type":"expense","categoryId":"transport","recipient":"","note":"такси домой 45"}
  "купил детям одежду 220" → {"amount":220,"type":"expense","categoryId":"clothing","recipient":"","note":"купил детям одежду 220"}
  "садик за май 1450" → {"amount":1450,"type":"expense","categoryId":"kids","recipient":"","note":"садик за май 1450"}
  "арнона 480" → {"amount":480,"type":"expense","categoryId":"arnona","recipient":"","note":"арнона 480"}
  "חברת חשמל 320" → {"amount":320,"type":"expense","categoryId":"utilities","recipient":"חברת חשמל","note":"חברת חשמל 320"}
  "уборщица 280" → {"amount":280,"type":"expense","categoryId":"household","recipient":"","note":"уборщица 280"}
  "стрижка 90" → {"amount":90,"type":"expense","categoryId":"cosmetics","recipient":"","note":"стрижка 90"}
  "зарплата 12500" → {"amount":12500,"type":"income","categoryId":"salary_me","recipient":"","note":"зарплата 12500"}
  "возврат налогов 800" → {"amount":800,"type":"income","categoryId":"other_income","recipient":"","note":"возврат налогов 800"}
  "фриланс гонорар 1500" → {"amount":1500,"type":"income","categoryId":"handyman","recipient":"","note":"фриланс гонорар 1500"}
  "ארוחת ערב 180" → {"amount":180,"type":"expense","categoryId":"restaurant","recipient":"","note":"ארוחת ערב 180"}
  "דלק פז 280" → {"amount":280,"type":"expense","categoryId":"fuel","recipient":"Paz","note":"דלק פז 280"}

WORD-FORM NUMBERS (voice input often produces these — you MUST convert to numeric value):
  CRITICAL: voice-to-text in Hebrew often returns informal forms like "12 אלף" or "חמש אלף" instead of digits. Always interpret as multiplication.
  "12 אלף" / "12 thousand" / "12 тысяч" / "12k" / "12 K" → 12000
  "חמש אלף" / "חמשת אלפים" / "חמש אלפים" → 5000
  "שש אלף" / "ששת אלפים" → 6000
  "שבע אלף" / "שבעת אלפים" → 7000
  "שמונה אלף" / "שמונת אלפים" → 8000
  "תשע אלף" / "תשעת אלפים" → 9000
  "עשר אלף" / "עשרת אלפים" → 10000
  "אחד עשר אלף" / "11 אלף" → 11000
  "fifteen hundred" / "1.5k" → 1500
  "пять тысяч" → 5000
  "десять тысяч" → 10000
  Hebrew number words: אחד/אחת=1, שניים/שני/שתיים=2, שלוש/שלושה=3, ארבע/ארבעה=4, חמש/חמישה=5, שש/שישה=6, שבע/שבעה=7, שמונה=8, תשע/תשעה=9, עשר/עשרה=10, אחד עשר=11, שתים עשרה=12, עשרים=20, חמישים=50, מאה=100, אלף=1000
  Russian number words: один=1, два=2, три=3, четыре=4, пять=5, шесть=6, семь=7, восемь=8, девять=9, десять=10, сто=100, тысяча=1000
  Rule: ANY Hebrew/Russian/English number word + "אלף"/"אלפים"/"thousand"/"тысяч"/"k" → multiply word by 1000.
    "חמש אלף" = 5 × 1000 = 5000 (NOT 5)
    "שמונה אלפים" = 8 × 1000 = 8000 (NOT 8)
    "две тысячи" = 2 × 1000 = 2000 (NOT 2)
    "twenty thousand" = 20 × 1000 = 20000 (NOT 20)

WORD-NUMBER EXAMPLES:
  "משכורת 12 אלף" → {"amount":12000,"type":"income","categoryId":"salary_me","recipient":"","note":"משכורת 12 אלף"}
  "החזר מס הכנסה חמש אלף" → {"amount":5000,"type":"income","categoryId":"other_income","recipient":"","note":"החזר מס הכנסה חמש אלף"}
  "получил зарплату 12 тысяч" → {"amount":12000,"type":"income","categoryId":"salary_me","recipient":"","note":"получил зарплату 12 тысяч"}
  "ремонт пять тысяч" → {"amount":5000,"type":"expense","categoryId":"household","recipient":"","note":"ремонт пять тысяч"}
  "salary fifteen thousand" → {"amount":15000,"type":"income","categoryId":"salary_me","recipient":"","note":"salary fifteen thousand"}

${accountsSection}${projectsSection}
OUTPUT FORMAT — respond with raw JSON only, no markdown fences, no explanation:
{"amount": number, "type": "expense" | "income", "categoryId": "id from list above", "recipient": "store/payee name or empty string", "note": "<original input text exactly>", "accountId": null | "<id from USER ACCOUNTS>", "accountType": null | "credit" | "cash" | "bank" | "savings" | "investment", "projectId": null | "<id from USER PROJECTS>"}

RULES:
- Extract numeric amount from input. Handle digit forms (1,234 / 1.234 / 28.50 / 1500₪ / 180 שח / 200 nis) AND word forms (see WORD-FORM NUMBERS section above — voice input often returns "12 אלף" instead of "12000").
- "type" defaults to "expense"; switch to "income" only if a clear income trigger word is present.
- Pick the BEST matching categoryId. If confidence is low (<70%) or nothing fits clearly, use "other" — DO NOT guess.
- "recipient" = store/payee/brand name if mentioned, otherwise empty string. Capitalize known brands ("Shufersal","Paz","Ikea","Netflix","Castro","Uber","Bolt").
- "note" = preserve user's original input verbatim, do not paraphrase.
- "accountId" / "accountType" — see ACCOUNT MATCHING RULES above. Both null if user said nothing about payment.
- "projectId" — see PROJECT MATCHING RULES above. null if user did not mention a project name.`;

  console.log('[Smart] input text:', JSON.stringify(text));
  const result = await callGemini(prompt);
  console.log('[Smart] AI raw response:', JSON.stringify(result));

  let parsed = null;
  if (result) {
    // Try direct JSON parse first
    try {
      const jsonStr = result.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      // Fallback: regex-extract first {...} block (some models wrap JSON in prose)
      const match = result.match(/\{[\s\S]*\}/);
      if (match) {
        try { parsed = JSON.parse(match[0]); }
        catch (e2) { console.log('[Smart] FAIL: regex JSON extract also failed:', e2.message); }
      } else {
        console.log('[Smart] FAIL: no JSON found in AI response:', e.message);
      }
    }
  } else {
    console.log('[Smart] FAIL: no AI response, falling back to local parser');
  }

  if (parsed) {
    try {
      console.log('[Smart] parsed:', JSON.stringify(parsed));
      if (parsed.amount && parsed.type && parsed.categoryId) {
        // Hard guarantee: income categories must have type=income, regardless of what AI returned
        const incomeCategories = ['salary_me', 'salary_spouse', 'rental_income', 'other_income', 'handyman'];
        if (incomeCategories.includes(parsed.categoryId)) {
          parsed.type = 'income';
        }
        // Smart account selection
        parsed.account = null;
        const activeAccs = (accounts || []).filter(a => a.isActive !== false);

        // Brand-based selection has priority (e.g. user said "Visa" but has 3 Visa cards)
        const detectedBrand = detectCardBrand(text);
        if (detectedBrand) {
          parsed.detectedBrand = detectedBrand;
          const brandKws = CARD_BRAND_KEYWORDS[detectedBrand];
          const brandMatches = activeAccs.filter(a => brandKws.some(kw => (a.name || '').toLowerCase().includes(kw)));
          if (brandMatches.length === 1) {
            parsed.account = brandMatches[0].id;
          } else if (brandMatches.length > 1) {
            const dataService = require('./dataService').default;
            const allTxs = await dataService.getTransactions();
            const brandIds = new Set(brandMatches.map(a => a.id));
            const sorted = [...allTxs].sort((a, b) => new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0));
            for (const tx of sorted) {
              if (tx.account && brandIds.has(tx.account)) { parsed.account = tx.account; break; }
            }
            if (!parsed.account) parsed.account = brandMatches[0].id;
          }
        }

        // Validate projectId — only accept ids that actually exist
        if (parsed.projectId && !projectsList.find(p => p.id === parsed.projectId)) {
          parsed.projectId = null;
        }
        // Fallback: if AI didn't pick a project, try JS substring + cross-lang match
        if (!parsed.projectId) {
          const matched = matchProjectInText(text, projectsList);
          console.log('[Smart] project fallback match:', matched, '| projects available:', projectsList.length, projectsList.map(p => p.name).join('|'));
          if (matched) parsed.projectId = matched;
        }
        // Category auto-suggest from project history: if user mentioned a project but
        // gave no category clue, pick the most common category from that project's
        // existing transactions (only if 2+ tx use the same category).
        if (parsed.projectId && parsed.categoryId === 'other') {
          try {
            const ds = require('./dataService').default;
            const allTxs = await ds.getTransactions();
            const projTxs = allTxs.filter(t => t.projectId === parsed.projectId && t.type === parsed.type);
            if (projTxs.length >= 2) {
              const catCounts = {};
              projTxs.forEach(t => { catCounts[t.categoryId] = (catCounts[t.categoryId] || 0) + 1; });
              const sorted = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);
              if (sorted.length > 0 && sorted[0][1] >= 2 && sorted[0][0] !== 'other') {
                parsed.categoryId = sorted[0][0];
                console.log('[Smart] category auto-suggested from project history:', parsed.categoryId);
              }
            }
          } catch (e) { /* noop */ }
        }
        // Project auto-suggest from category history: reverse — if AI determined a
        // category but no project, see if this category typically belongs to a
        // specific project (e.g. "household" → "Renovation"). Need 2+ matching
        // historical txs to be confident.
        if (!parsed.projectId && parsed.categoryId && parsed.categoryId !== 'other' && projectsList.length > 0) {
          try {
            const ds = require('./dataService').default;
            const allTxs = await ds.getTransactions();
            const sameCatTxs = allTxs.filter(t =>
              t.categoryId === parsed.categoryId &&
              t.type === parsed.type &&
              t.projectId &&
              projectsList.find(p => p.id === t.projectId) // project still exists
            );
            if (sameCatTxs.length >= 2) {
              const projCounts = {};
              sameCatTxs.forEach(t => { projCounts[t.projectId] = (projCounts[t.projectId] || 0) + 1; });
              const sorted = Object.entries(projCounts).sort((a, b) => b[1] - a[1]);
              if (sorted.length > 0 && sorted[0][1] >= 2) {
                parsed.projectId = sorted[0][0];
                console.log('[Smart] project auto-suggested from category history:', parsed.projectId);
              }
            }
          } catch (e) { /* noop */ }
        }

        // Fallback: AI gave specific accountId, or only generic type
        if (!parsed.account) {
          if (parsed.accountId && activeAccs.find(a => a.id === parsed.accountId)) {
            parsed.account = parsed.accountId;
          } else if (parsed.accountType) {
            const matching = activeAccs.filter(a => a.type === parsed.accountType);
            if (matching.length === 1) {
              parsed.account = matching[0].id;
            } else if (matching.length > 1) {
              const dataService = require('./dataService').default;
              parsed.account = await dataService.getLastUsedAccountByType(parsed.accountType);
            }
          }
        }
        console.log('[Smart] final result:', JSON.stringify(parsed));
        return parsed;
      }
      console.log('[Smart] FAIL: parsed missing required fields, falling back to local parser');
    } catch (e) {
      console.log('[Smart] FAIL: error processing parsed result:', e.message);
    }
  }

  // Фоллбэк на локальный парсер
  const fallback = parseTransaction(text);
  console.log('[Smart] FALLBACK local parser result:', JSON.stringify(fallback));
  return fallback;
}

// Персональные советы от Gemini
async function getPersonalAdvice(transactions, budgets, lang) {
  const now = new Date();
  const thisMonth = transactions.filter(t => {
    const d = new Date(t.date || t.createdAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const income = thisMonth.filter(t => t.type === 'income' && !t.isTransfer).reduce((s, t) => s + t.amount, 0);
  const expense = thisMonth.filter(t => t.type === 'expense' && !t.isTransfer).reduce((s, t) => s + t.amount, 0);

  const catTotals = {};
  thisMonth.filter(t => t.type === 'expense' && !t.isTransfer).forEach(t => {
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

    const multiHint = imageList.length > 1
      ? `\nThese ${imageList.length} images are pages of the SAME receipt — combine items from all of them.`
      : '';

    const prompt = `You are an expert receipt reader. Extract EVERY purchased item from this receipt with its price.${multiHint}

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

    const res = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }, ...imageParts],
        }],
        generationConfig: { temperature: 0.05, maxOutputTokens: 4096 },
      }),
    });

    if (!res.ok) {
      if (__DEV__) console.error('scanReceiptItems API error:', res.status);
      return [];
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (__DEV__) console.log('[scanReceiptItems] raw length:', text.length);
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
      .filter(i => i && i.name && typeof i.price === 'number' && !isNaN(i.price))
      .map(i => ({
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
    // Category breakdown — exclude inter-account transfers, they shouldn't
    // appear as a "spending" category.
    const typeFilter = filter === 'income' ? 'income' : 'expense';
    const catTotals = {};
    filtered.filter(t => t.type === typeFilter && !t.isTransfer).forEach(t => {
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
      const income = dayTxs.filter(t => t.type === 'income' && !t.isTransfer).reduce((s, t) => s + t.amount, 0);
      const expense = dayTxs.filter(t => t.type === 'expense' && !t.isTransfer).reduce((s, t) => s + t.amount, 0);
      data.push({ day: d.getDate(), date: `${d.getMonth() + 1}/${d.getDate()}`, income, expense });
    }
    return { type: 'cashflow', data, totalIncome: data.reduce((s, d) => s + d.income, 0), totalExpense: data.reduce((s, d) => s + d.expense, 0) };
  }

  // Default: bar chart (daily amounts) — exclude inter-account transfers
  const typeFilter = filter === 'income' ? 'income' : 'expense';
  const data = [];
  for (let i = 0; i <= days; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const dayTotal = filtered.filter(tx => {
      const td = new Date(tx.date || tx.createdAt);
      return td.getFullYear() === d.getFullYear() && td.getMonth() === d.getMonth() && td.getDate() === d.getDate() && tx.type === typeFilter && !tx.isTransfer;
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

  const income = thisMonth.filter(t => t.type === 'income' && !t.isTransfer).reduce((s, t) => s + t.amount, 0);
  const expense = thisMonth.filter(t => t.type === 'expense' && !t.isTransfer).reduce((s, t) => s + t.amount, 0);

  const catTotals = {};
  last90.filter(t => t.type === 'expense' && !t.isTransfer).forEach(t => {
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
    if (t.isTransfer) return; // transfers between accounts aren't real income/expense
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
  last90.filter(t => t.type === 'expense' && !t.isTransfer && t.recipient).forEach(t => {
    payeeTotals[t.recipient] = (payeeTotals[t.recipient] || 0) + t.amount;
  });
  const topPayees = Object.entries(payeeTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, amount]) => `${name}: ${Math.round(amount)}`)
    .join(', ');

  // This month categories
  const thisMonthCats = {};
  thisMonth.filter(t => t.type === 'expense' && !t.isTransfer).forEach(t => {
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
  const todayExpense = todayTxs.filter(t => t.type === 'expense' && !t.isTransfer).reduce((s, t) => s + t.amount, 0);
  const todayIncome = todayTxs.filter(t => t.type === 'income' && !t.isTransfer).reduce((s, t) => s + t.amount, 0);
  const todayDetail = todayTxs.map(t => `${t.type === 'income' && !t.isTransfer ? '+' : '-'}${Math.round(t.amount)} ${t.categoryId}${t.recipient ? ' (' + t.recipient + ')' : ''}`).join(', ');

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
  translateCategoryName,
  callGemini,
  getLastAIError,
  MAAM_RATE,
  ESTIMATED_INCOME_TAX,
  BITUACH_LEUMI,
};
