import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import fr from './locales/fr.json';
import ar from './locales/ar.json';
import sw from './locales/sw.json';

const saved = (typeof window !== 'undefined' && localStorage.getItem('protekt_lang')) || undefined;
const browserLng = typeof navigator !== 'undefined' ? navigator.language.split('-')[0] : 'en';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    fr: { translation: fr },
    ar: { translation: ar },
    sw: { translation: sw },
  },
  lng: saved || browserLng || 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;