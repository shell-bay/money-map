import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Import translation files
import en from './locales/en.json';
import fr from './locales/fr.json';
import hi from './locales/hi.json';
import es from './locales/es.json';

const resources = {
  en: { translation: en },
  fr: { translation: fr },
  hi: { translation: hi },
  es: { translation: es }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    lng: localStorage.getItem('language') || 'en',
    interpolation: {
      escapeValue: false // React already does escaping
    }
  });

export default i18n;
