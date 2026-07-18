// src/services/ai/smartParse.ts
// Smart Input pipeline: repeat dictionary → personalized Gemini prompt →
// local keyword fallback. See docs/superpowers/specs/2026-07-15-smart-input-v2-design.md
import i18n from '../../i18n';
import { code as curCode } from '../../utils/currency';
import { getCachedGroups } from '../../utils/categoryCache';
import { callGemini } from './client';
import { buildSmartPrompt, PromptCategory, PromptExample } from './promptBuilder';
import { buildDictionary, lookupRepeat } from './localDictionary';
import { resolveAccount, detectCardBrand } from './accountResolver';
import { parseTransaction, extractAmount } from './localParser';
import dataService from '../dataService';

// Word-number amounts («12 тысяч», «חמש אלף», '12k') are multiplier forms the
// local extractor doesn't expand — a dictionary hit would save a 1000×-wrong
// amount with a confident badge. Send those to the AI, which handles them.
const WORD_NUMBER_RE = /(тыс|thousand|אלף|אלפים|\d\s*[kк](\s|$))/i;

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
function normalizeWord(s: string): string {
  if (!s) return '';
  let n = s.toLowerCase().trim();
  // Strip common Hebrew preposition/article prefixes
  n = n.replace(/^[להבכמש]/, '');
  return n;
}

function matchProjectInText(text: string, projectsList: any[]) {
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
    const projTokens = projName.split(/\s+/).map((t: string) => t.length >= 3 ? t : null).filter(Boolean) as string[];
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
      const projInGroup = syns.some((s: string) => projName.includes(s));
      if (!projInGroup) continue;
      const textInGroup = syns.some((s: string) => {
        if (lc.includes(s)) return true;
        return lcWordsNormalized.some((w: string) => w.includes(s) || s.includes(w));
      });
      if (textInGroup) return p.id;
    }
  }
  return null;
}

// User categories that are NOT built-ins: walk cached groups, collect
// custom groups and subs as {id, name, kind}. Built-in ids resolve через
// the static prompt lists, so they are excluded here.
function collectCustomCategories(builtinsIds: Set<string>): PromptCategory[] {
  const out: PromptCategory[] = [];
  const nameOf = (n: any) => typeof n === 'string' ? n : (n?.[i18n.getLanguage()] || n?.en || n?.ru || n?.he || '');
  for (const g of getCachedGroups() || []) {
    const kind = g.id === 'income_group' || /income/i.test(g.id) ? 'income' : 'expense';
    if (g.id && !builtinsIds.has(g.id) && nameOf(g.name)) out.push({ id: g.id, name: nameOf(g.name), kind });
    for (const s of g.subs || []) {
      if (s.id && !builtinsIds.has(s.id) && nameOf(s.name)) out.push({ id: s.id, name: nameOf(s.name), kind });
    }
  }
  return out;
}

function collectExamples(transactions: any[]): PromptExample[] {
  // frequency+recency: newest first, dedupe by normalized text via Map insert order
  const seen = new Map<string, PromptExample>();
  const sorted = [...(transactions || [])].sort((a, b) =>
    new Date(b.date || b.createdAt || 0).getTime() - new Date(a.date || a.createdAt || 0).getTime());
  for (const t of sorted) {
    const text = String(t.note || t.recipient || '').trim();
    if (!text || !t.categoryId) continue;
    const key = text.toLowerCase();
    if (!seen.has(key)) seen.set(key, { text, categoryId: t.categoryId });
    if (seen.size >= 30) break;
  }
  return [...seen.values()];
}

export async function parseTransactionSmart(text: string, accounts: any[] = [], projects: any[] = [], preloadedTransactions: any[] | null = null) {
  const activeAccounts = (accounts || []).filter((a: any) => a.isActive !== false);
  const transactions = preloadedTransactions ?? await dataService.getTransactions().catch(() => []);
  const detectedBrand = detectCardBrand(text);

  // ── Layer 1: exact repeat of the user's own phrasing ──
  const dict = buildDictionary(transactions);
  const hit = lookupRepeat(text, dict);
  const amount = extractAmount(text);
  if (hit && amount && !WORD_NUMBER_RE.test(text)) {
    const { account, reason } = resolveAccount({
      text, categoryId: hit.categoryId, txType: hit.type,
      accounts: activeAccounts, transactions,
    });
    return {
      amount, type: hit.type, categoryId: hit.categoryId,
      recipient: '', note: text,
      account, accountReason: reason, source: 'history',
      projectId: matchProjectInText(text, projects || []),
      detectedBrand,
    };
  }

  // ── Layer 2: Gemini with the personalized prompt ──
  const BUILTIN_PROMPT_IDS = new Set(['food','restaurant','transport','fuel','health','phone','utilities','clothing','household','kids','entertainment','education','cosmetics','electronics','insurance','pension','rent','arnona','vaad','other','salary_me','salary_spouse','handyman','rental_income','other_income','home','income_group','personal','travel']);
  const customCategories = collectCustomCategories(BUILTIN_PROMPT_IDS);
  const prompt = buildSmartPrompt({
    text, lang: i18n.getLanguage(), currency: curCode(),
    customCategories, examples: collectExamples(transactions),
    accounts: activeAccounts, projects: projects || [],
  });
  const raw = await callGemini(prompt);

  let parsed: any = null;
  if (raw) {
    try { parsed = JSON.parse(raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim()); }
    catch (e) {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch (e2) { /* fallthrough */ } }
    }
  }

  if (parsed && parsed.amount && parsed.type && parsed.categoryId) {
    // Category id must exist: built-in prompt ids OR the user's custom ones.
    const validIds = new Set([...BUILTIN_PROMPT_IDS, ...customCategories.map(c => c.id)]);
    if (!validIds.has(parsed.categoryId)) parsed.categoryId = 'other';

    // Hard guarantee: income categories must have type=income, regardless of what AI returned
    const incomeCategories = ['salary_me', 'salary_spouse', 'rental_income', 'other_income', 'handyman'];
    if (incomeCategories.includes(parsed.categoryId)) {
      parsed.type = 'income';
    }

    // Validate projectId — only accept ids that actually exist
    if (parsed.projectId && !(projects || []).find((p: any) => p.id === parsed.projectId)) {
      parsed.projectId = null;
    }
    // Fallback: if AI didn't pick a project, try JS substring + cross-lang match
    if (!parsed.projectId) {
      const matched = matchProjectInText(text, projects || []);
      if (__DEV__) console.log('[Smart] project fallback match:', matched, '| projects available:', (projects || []).length, (projects || []).map((p: any) => p.name).join('|'));
      if (matched) parsed.projectId = matched;
    }
    // Category auto-suggest from project history: if user mentioned a project but
    // gave no category clue, pick the most common category from that project's
    // existing transactions (only if 2+ tx use the same category).
    if (parsed.projectId && parsed.categoryId === 'other') {
      try {
        const projTxs = transactions.filter((t: any) => t.projectId === parsed.projectId && t.type === parsed.type);
        if (projTxs.length >= 2) {
          const catCounts: Record<string, number> = {};
          projTxs.forEach((t: any) => { catCounts[t.categoryId] = (catCounts[t.categoryId] || 0) + 1; });
          const sorted = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);
          if (sorted.length > 0 && sorted[0][1] >= 2 && sorted[0][0] !== 'other') {
            parsed.categoryId = sorted[0][0];
            if (__DEV__) console.log('[Smart] category auto-suggested from project history:', parsed.categoryId);
          }
        }
      } catch (e) { /* noop */ }
    }
    // Project auto-suggest from category history: reverse — if AI determined a
    // category but no project, see if this category typically belongs to a
    // specific project (e.g. "household" → "Renovation"). Need 2+ matching
    // historical txs to be confident.
    if (!parsed.projectId && parsed.categoryId && parsed.categoryId !== 'other' && (projects || []).length > 0) {
      try {
        const sameCatTxs = transactions.filter((t: any) =>
          t.categoryId === parsed.categoryId &&
          t.type === parsed.type &&
          t.projectId &&
          (projects || []).find((p: any) => p.id === t.projectId) // project still exists
        );
        if (sameCatTxs.length >= 2) {
          const projCounts: Record<string, number> = {};
          sameCatTxs.forEach((t: any) => { projCounts[t.projectId] = (projCounts[t.projectId] || 0) + 1; });
          const sorted = Object.entries(projCounts).sort((a, b) => b[1] - a[1]);
          if (sorted.length > 0 && sorted[0][1] >= 2) {
            parsed.projectId = sorted[0][0];
            if (__DEV__) console.log('[Smart] project auto-suggested from category history:', parsed.projectId);
          }
        }
      } catch (e) { /* noop */ }
    }

    const { account, reason } = resolveAccount({
      text, aiAccountId: parsed.accountId, aiAccountType: parsed.accountType,
      categoryId: parsed.categoryId, txType: parsed.type,
      accounts: activeAccounts, transactions,
    });
    parsed.account = account;
    parsed.accountReason = reason;
    parsed.source = 'ai';
    parsed.detectedBrand = detectedBrand;
    if (__DEV__) console.log('[Smart] final result:', JSON.stringify(parsed));
    return parsed;
  }

  // ── Layer 3: local keyword fallback ──
  const fallback: any = parseTransaction(text);
  if (fallback) {
    const { account, reason } = resolveAccount({
      text, categoryId: fallback.categoryId, txType: fallback.type,
      accounts: activeAccounts, transactions,
    });
    fallback.account = account;
    fallback.accountReason = reason;
    fallback.source = 'fallback';
    fallback.detectedBrand = detectedBrand;
  }
  return fallback;
}
