// src/i18n/index.js
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
      currentLang = lang;
      listeners.forEach(fn => fn(lang));
    }
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

  // RTL helpers for styles
  row() { return currentLang === 'he' ? 'row-reverse' : 'row'; },
  textAlign() { return currentLang === 'he' ? 'right' : 'left'; },
};

export default i18n;
