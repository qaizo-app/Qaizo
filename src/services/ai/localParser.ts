// src/services/ai/localParser.ts
// Local keyword-based transaction parser — the offline fallback used by
// parseTransactionSmart when Gemini is unavailable, and the engine behind
// the repeat-dictionary quick-match path (extractAmount). Moved verbatim
// from aiService.ts (Task 2 of the Smart Input v2 split): pure move, plus
// the amount regex factored out into its own export; no behavior change.

export interface ParsedTransaction {
  amount: number;
  type: 'income' | 'expense';
  categoryId: string;
  recipient: string;
  note: string;
}

// ─── Категории — ключевые слова (HE / RU / EN) ─────────
export const CATEGORY_KEYWORDS: Record<string, string[]> = {
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

// Shared amount extractor: first number in the text, tolerant of ₪/шек/שח
// suffixes and prefixes and of thousands separators (1,250 / 1'250).
export function extractAmount(text: string): number | null {
  if (!text) return null;
  const input = String(text).trim().toLowerCase();

  // Ищем сумму: число (возможно с запятой/точкой)
  const amountMatch = input.match(/(\d[\d,.']*(?:\.\d+)?)\s*(?:₪|шекел|שקל|שקלים|шек|ш|ils|nis)?/i)
    || input.match(/(?:₪|шекел|שקל|שקלים|шек|ш|ils|nis)\s*(\d[\d,.']*(?:\.\d+)?)/i);

  let amount = 0;
  if (amountMatch) {
    amount = parseFloat(amountMatch[1].replace(/[,'\s]/g, ''));
  }
  if (!amount || isNaN(amount)) return null;

  return amount;
}

// ─── Парсинг текста ─────────────────────────────────────
export function parseTransaction(text: any): ParsedTransaction | null {
  if (!text || !text.trim()) return null;

  const input = text.trim().toLowerCase();

  // Ищем сумму: число (возможно с запятой/точкой)
  const amount = extractAmount(input);
  if (amount === null) return null;

  // Определяем тип: доход или расход
  const incomeWords = ['зарплата', 'доход', 'получил', 'поступил', 'поступление', 'начислено', 'заработал', 'возврат', 'подработ', 'выиграл', 'выигрыш', 'перевод от', 'перевели', 'вернули', 'кэшбэк', 'бонус', 'приз', 'гонорар', 'фриланс', 'халтур', 'чаевые', 'прибыль', 'дивиденд', 'משכורת', 'הכנסה', 'קיבלתי', 'הרווחתי', 'זיכוי', 'בונוס', 'טיפ', 'נכנס', 'הופקד', 'התקבל', 'זוכה', 'salary', 'income', 'received', 'incoming', 'deposit', 'earned', 'refund', 'cashback', 'bonus', 'won', 'prize', 'tip', 'freelance', 'profit', 'dividend', 'payout'];
  const isIncome = incomeWords.some(w => input.includes(w));
  const type: 'income' | 'expense' = isIncome ? 'income' : 'expense';

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
    return { amount, type: 'income' as const, categoryId, recipient: extractPayee(input), note: text.trim() };
  }

  // Извлекаем получателя/магазин
  const recipient = extractPayee(input);

  return { amount, type, categoryId, recipient, note: text.trim() };
}

function extractPayee(input: string) {
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
