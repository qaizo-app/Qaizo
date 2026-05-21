// src/i18n/index.ts
import { I18nManager } from 'react-native';
import ru from './ru';
import he from './he';
import en from './en';
import es from './es';
import fr from './fr';
import de from './de';
import pt from './pt';
import ar from './ar';
import zh from './zh';
import hi from './hi';
import ja from './ja';

export type LanguageCode = 'ru' | 'he' | 'en' | 'es' | 'fr' | 'de' | 'pt' | 'ar' | 'zh' | 'hi' | 'ja';

// Language packs are plain string dictionaries. `t()` falls back to en
// then to the raw key, so dynamic keys (e.g. categoryId) are intentionally
// accepted — that's why the value type is loose Record<string, string>.
type Dictionary = Record<string, string>;

const languages: Record<LanguageCode, Dictionary> = {
  ru: ru as Dictionary,
  he: he as Dictionary,
  en: en as Dictionary,
  es: es as Dictionary,
  fr: fr as Dictionary,
  de: de as Dictionary,
  pt: pt as Dictionary,
  ar: ar as Dictionary,
  zh: zh as Dictionary,
  hi: hi as Dictionary,
  ja: ja as Dictionary,
};

let currentLang: LanguageCode = 'ru';

type LanguageChangeListener = (lang: LanguageCode, rtlChanged: boolean) => void;
const listeners = new Set<LanguageChangeListener>();

const i18n = {
  t(key: string): string {
    return languages[currentLang]?.[key] || languages.en?.[key] || key;
  },

  setLanguage(lang: LanguageCode): boolean {
    if (languages[lang]) {
      const needsRTL = lang === 'he' || lang === 'ar';
      const rtlChanged = I18nManager.isRTL !== needsRTL;
      currentLang = lang;
      if (rtlChanged) {
        I18nManager.allowRTL(needsRTL);
        I18nManager.forceRTL(needsRTL);
      }
      listeners.forEach(fn => fn(lang, rtlChanged));
      return rtlChanged;
    }
    return false;
  },

  onLanguageChange(fn: LanguageChangeListener): () => void {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  },

  getLanguage(): LanguageCode {
    return currentLang;
  },

  getAvailableLanguages(): Array<{ code: LanguageCode; label: string; name: string }> {
    return [
      { code: 'en', label: 'EN', name: 'English' },
      { code: 'ru', label: 'RU', name: 'Русский' },
      { code: 'he', label: 'HE', name: 'עברית' },
      { code: 'ar', label: 'AR', name: 'العربية' },
      { code: 'es', label: 'ES', name: 'Español' },
      { code: 'fr', label: 'FR', name: 'Français' },
      { code: 'de', label: 'DE', name: 'Deutsch' },
      { code: 'pt', label: 'PT', name: 'Português' },
      { code: 'zh', label: 'ZH', name: '中文' },
      { code: 'hi', label: 'HI', name: 'हिन्दी' },
      { code: 'ja', label: 'JA', name: '日本語' },
    ];
  },

  isRTL(): boolean {
    return currentLang === 'he' || currentLang === 'ar';
  },

  // I18nManager.forceRTL persists across sessions and requires a full native
  // restart to change. JS reloads (Fast Refresh) reset currentLang but keep
  // I18nManager.isRTL. Two cases:
  //
  //   system=RTL  → always 'row': the OS already mirrors the layout,
  //                 'row-reverse' would double-flip and produce LTR.
  //   system=LTR  → 'row-reverse' only when lang is RTL (compensates for
  //                 missing restart so Hebrew looks right during testing).
  row(): 'row' | 'row-reverse' {
    if (I18nManager.isRTL) return 'row';
    return (currentLang === 'he' || currentLang === 'ar') ? 'row-reverse' : 'row';
  },
  textAlign(): 'right' | 'left' { return (currentLang === 'he' || currentLang === 'ar') ? 'right' : 'left'; },
  backIcon(): string { return (currentLang === 'he' || currentLang === 'ar') ? 'arrow-right' : 'arrow-left'; },
  chevronLeft(): string { return (currentLang === 'he' || currentLang === 'ar') ? 'chevron-right' : 'chevron-left'; },
  chevronRight(): string { return (currentLang === 'he' || currentLang === 'ar') ? 'chevron-left' : 'chevron-right'; },
};

export default i18n;
