import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../hooks/useSettings';

const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' }
];

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const { updateSetting } = useSettings();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const currentLanguage = LANGUAGES.find(lang => lang.code === i18n.language) ||
                          LANGUAGES.find(lang => lang.code === 'en');

  const changeLanguage = (langCode) => {
    i18n.changeLanguage(langCode);
    localStorage.setItem('language', langCode);
    updateSetting('language', langCode); // Sync with Firestore
    setIsOpen(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg transition"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span>{currentLanguage.flag}</span>
        <span className="hidden sm:inline">{currentLanguage.name}</span>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-slate-900 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700 z-50 overflow-hidden">
          {LANGUAGES.map(({ code, name, flag }) => (
            <button
              key={code}
              onClick={() => changeLanguage(code)}
              className={`w-full px-4 py-3 text-left text-sm flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-slate-800 transition ${
                i18n.language === code
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                  : 'text-gray-700 dark:text-slate-300'
              }`}
            >
              <span>{flag}</span>
              <span>{name}</span>
              {i18n.language === code && (
                <svg className="w-4 h-4 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
