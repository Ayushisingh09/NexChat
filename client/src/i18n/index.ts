import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';

const STORAGE_KEY = 'nexchat_lang';

const stored = (() => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
})();

/**
 * App-wide i18n. English is the only bundled locale today; the structure is
 * ready for additional catalogs (drop a `locales/<lng>.json` and register it in
 * `resources`). Language preference persists to localStorage.
 */
i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
  },
  lng: stored || 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false }, // React already escapes
});

/** Locales available in the language switcher. */
export const SUPPORTED_LANGUAGES: { code: string; label: string }[] = [
  { code: 'en', label: 'English' },
];

export const setLanguage = (lng: string) => {
  try {
    localStorage.setItem(STORAGE_KEY, lng);
  } catch {
    /* ignore persistence errors */
  }
  i18n.changeLanguage(lng);
};

export default i18n;
