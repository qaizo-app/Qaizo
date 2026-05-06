// src/i18n/index.js
import { I18nManager, Platform } from 'react-native';
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

  // I18nManager.forceRTL persists across sessions and requires a full native
  // restart to change. JS reloads (Fast Refresh) reset currentLang but keep
  // I18nManager.isRTL.
  //
  // Behaviour split by platform:
  //   - Android: when isRTL=true, the OS auto-mirrors flexDirection:'row'
  //     so we MUST return 'row' (otherwise we'd double-flip back to LTR).
  //   - iOS: native auto-flip is unreliable for our card/menu layouts —
  //     icons stayed on the left of Hebrew rows in TestFlight builds.
  //     Always return 'row-reverse' for RTL langs so the flip is manual
  //     and predictable.
  row() {
    const isRTLLang = currentLang === 'he' || currentLang === 'ar';
    if (Platform.OS === 'ios') {
      return isRTLLang ? 'row-reverse' : 'row';
    }
    // Android
    if (I18nManager.isRTL) return 'row';
    return isRTLLang ? 'row-reverse' : 'row';
  },
  textAlign() { return (currentLang === 'he' || currentLang === 'ar') ? 'right' : 'left'; },
  backIcon() { return (currentLang === 'he' || currentLang === 'ar') ? 'arrow-right' : 'arrow-left'; },
  chevronLeft() { return (currentLang === 'he' || currentLang === 'ar') ? 'chevron-right' : 'chevron-left'; },
  chevronRight() { return (currentLang === 'he' || currentLang === 'ar') ? 'chevron-left' : 'chevron-right'; },
};

export default i18n;
