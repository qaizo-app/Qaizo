// src/i18n/index.js
import ru from './ru';
import he from './he';
import en from './en';

const languages = { ru, he, en };

let currentLang = 'ru';

const i18n = {
  t(key) {
    return languages[currentLang]?.[key] || languages.en?.[key] || key;
  },

  setLanguage(lang) {
    if (languages[lang]) {
      currentLang = lang;
    }
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
};

export default i18n;
