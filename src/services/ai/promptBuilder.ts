// src/services/ai/promptBuilder.ts
// Pure Smart Input prompt template. No i18n / currency lookups here — the
// caller (aiService) resolves lang/currency and passes them in as args, so
// this module can be unit-tested without any app runtime.

export interface PromptCategory { id: string; name: string; kind: 'expense' | 'income'; }
export interface PromptExample { text: string; categoryId: string; }

export function buildSmartPrompt(args: {
  text: string;
  lang: string;
  currency: string;
  customCategories: PromptCategory[];   // user categories NOT in the built-in lists
  examples: PromptExample[];            // capped at 30 by the builder
  accounts: any[];                      // active only
  projects: any[];
}): string {
  const { text, lang, currency, customCategories, examples, accounts, projects } = args;

  // Build accounts section for prompt (only active accounts)
  const activeAccounts = (accounts || []).filter((a: any) => a.isActive !== false);
  const accountsSection = activeAccounts.length > 0
    ? `\nUSER ACCOUNTS (id → name (type)):\n${activeAccounts.map((a: any) => `  ${a.id} → "${a.name}" (${a.type || 'other'})`).join('\n')}\n\nACCOUNT MATCHING RULES:\n  - If user mentions a SPECIFIC account name/brand ("Visa Hapoalim", "Mastercard", "Cash wallet") → return "accountId": "<that exact id>"\n  - If user mentions only a generic TYPE (кредитка, наличка, банк, מזומן, אשראי, חשבון בנק, credit card, cash) → return "accountType": "credit" | "cash" | "bank" | "savings" | "investment"\n  - If user says nothing about payment method → return both as null\n`
    : '';

  // Build projects section — only if user has any projects
  const projectsList: any[] = (projects || []);
  const projectsSection = projectsList.length > 0
    ? `\nUSER PROJECTS (id → name):\n${projectsList.map((p: any) => `  ${p.id} → "${p.name}"`).join('\n')}\n\nPROJECT MATCHING RULES (very tolerant):\n  - Match the project name even with prefixes/suffixes/declensions:\n      Hebrew: "לחתונה"/"בחתונה"/"מהחתונה"/"החתונה" all match project "חתונה"/"Wedding"/"Свадьба" (strip ל/ב/מ/ה prefixes).\n      Russian: "на свадьбу"/"для свадьбы"/"свадебный" → project "Свадьба"/"Wedding".\n      English: "for the wedding"/"wedding stuff" → project "Wedding"/"Свадьба"/"חתונה".\n  - Match SEMANTICALLY across languages: a Hebrew word can match a Russian/English project name and vice versa. E.g. "לחתונה" (HE) matches a project named "Свадьба" (RU) or "Wedding" (EN).\n  - Same for: שיפוץ/ремонт/renovation, טיול/поездка/trip, רכב/машина/car, מתנה/подарок/gift, תינוק/малыш/baby.\n  - If user mentioned the project (any form), return "projectId": "<that exact id from the list>".\n  - Otherwise return "projectId": null. DO NOT guess a project that wasn't mentioned.\n`
    : '';

  // User's own custom categories — PREFER these over built-ins when they match.
  const customSection = customCategories.length > 0
    ? `\nUSER CUSTOM CATEGORIES (id → name; PREFER these when the input matches the name or its meaning; they are valid categoryId values):\n${customCategories.map(c => `  ${c.id} → "${c.name}" (${c.kind})`).join('\n')}\n`
    : '';

  // User history few-shot — this user's own past phrasing → category they
  // chose. Privacy: strip all digits (amounts) before they ever reach the
  // prompt; cap at 30 examples.
  const strip = (s: string) => String(s || '').replace(/[0-9]+([.,'][0-9]+)*/g, '').replace(/\s+/g, ' ').trim();
  const exampleLines = (examples || [])
    .map(e => ({ text: strip(e.text), categoryId: e.categoryId }))
    .filter(e => e.text)
    .slice(0, 30);
  const historySection = exampleLines.length > 0
    ? `\nUSER HISTORY EXAMPLES (this user's own past phrasings → the category THEY chose; follow their personal convention when the input resembles one of these):\n${exampleLines.map(e => `  "${e.text}" → ${e.categoryId}`).join('\n')}\n`
    : '';

  // OUTPUT FORMAT account/project hints only make sense when there's a list
  // to reference — with no accounts/projects the value is always null anyway.
  const accountIdField = activeAccounts.length > 0 ? 'null | "<id from USER ACCOUNTS>"' : 'null';
  const projectIdField = projectsList.length > 0 ? 'null | "<id from USER PROJECTS>"' : 'null';

  return `You are a financial transaction parser for an Israeli personal finance app. Parse the user's free-text into a transaction JSON.

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
${customSection}
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
${historySection}
${accountsSection}${projectsSection}
OUTPUT FORMAT — respond with raw JSON only, no markdown fences, no explanation:
{"amount": number, "type": "expense" | "income", "categoryId": "id from the category lists above (built-in OR user custom)", "recipient": "store/payee name or empty string", "note": "<original input text exactly>", "accountId": ${accountIdField}, "accountType": null | "credit" | "cash" | "bank" | "savings" | "investment", "projectId": ${projectIdField}}

RULES:
- Extract numeric amount from input. Handle digit forms (1,234 / 1.234 / 28.50 / 1500₪ / 180 שח / 200 nis) AND word forms (see WORD-FORM NUMBERS section above — voice input often returns "12 אלף" instead of "12000").
- "type" defaults to "expense"; switch to "income" only if a clear income trigger word is present.
- Pick the BEST matching categoryId. If confidence is low (<70%) or nothing fits clearly, use "other" — DO NOT guess.
- "recipient" = store/payee/brand name if mentioned, otherwise empty string. Capitalize known brands ("Shufersal","Paz","Ikea","Netflix","Castro","Uber","Bolt").
- "note" = preserve user's original input verbatim, do not paraphrase.
- "accountId" / "accountType" — see ACCOUNT MATCHING RULES above. Both null if user said nothing about payment.
- "projectId" — see PROJECT MATCHING RULES above. null if user did not mention a project name.`;
}
