// src/i18n/index.js
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

const languages = { ru, he, en, es, fr, de, pt, ar, zh, hi, ja };

let currentLang = 'ru';
const listeners = new Set();

const i18n = {
  t(key) {
    return languages[currentLang]?.[key] || languages.en?.[key] || key;
  },

  setLanguage(lang) {
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

  onLanguageChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  getLanguage() {
    return currentLang;
  },

  getAvailableLanguages() {
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

  isRTL() {
    return currentLang === 'he' || currentLang === 'ar';
  },

  // RTL handled by I18nManager — always return 'row'
  row() { return 'row'; },
  textAlign() { return (currentLang === 'he' || currentLang === 'ar') ? 'right' : 'left'; },
  // Back arrow icon — depends on SYSTEM RTL (I18nManager flips layout but not icons)
  backIcon() { return I18nManager.isRTL ? 'arrow-right' : 'arrow-left'; },
  chevronLeft() { return I18nManager.isRTL ? 'chevron-right' : 'chevron-left'; },
  chevronRight() { return I18nManager.isRTL ? 'chevron-left' : 'chevron-right'; },
};

export default i18n;
