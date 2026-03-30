// src/i18n/index.js
import { I18nManager } from 'react-native';
import ru from './ru';
import he from './he';
import en from './en';

const languages = { ru, he, en };

let currentLang = 'ru';
const listeners = new Set();

const i18n = {
  t(key) {
    return languages[currentLang]?.[key] || languages.en?.[key] || key;
  },

  setLanguage(lang) {
    if (languages[lang]) {
      const needsRTL = lang === 'he';
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
      { code: 'ru', label: 'RU', name: 'Русский' },
      { code: 'he', label: 'HE', name: 'עברית' },
      { code: 'en', label: 'EN', name: 'English' },
    ];
  },

  isRTL() {
    return currentLang === 'he';
  },

  // RTL handled by I18nManager — always return 'row'
  row() { return 'row'; },
  textAlign() { return currentLang === 'he' ? 'right' : 'left'; },
  // Back arrow icon — depends on SYSTEM RTL (I18nManager flips layout but not icons)
  backIcon() { return I18nManager.isRTL ? 'arrow-right' : 'arrow-left'; },
};

export default i18n;
