import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LANGUAGES } from '../constants/languages';

export default function OnboardingPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const [language, setLanguage] = useState(localStorage.getItem('language') || 'en');
  const [notifications, setNotifications] = useState(true);
  const [username, setUsername] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  // Check if already completed
  useEffect(() => {
    const done = localStorage.getItem('onboardingComplete');
    if (done) {
      navigate('/login');
    }
  }, [navigate]);

  const handleComplete = () => {
    if (!username.trim()) {
      alert(t('onboarding.usernameRequired'));
      return;
    }

    // Save preferences
    localStorage.setItem('onboardingComplete', 'true');
    localStorage.setItem('language', language);
    localStorage.setItem('username', username);
    localStorage.setItem('notifications', notifications);

    // Apply language immediately
    i18n.changeLanguage(language);

    setIsComplete(true);
    // Navigate to login after brief moment
    setTimeout(() => {
      navigate('/login');
    }, 500);
  };

  if (isComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-100 px-4">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-lg text-center">
          <div className="text-emerald-600 text-5xl mb-4">✓</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('onboarding.title')}</h2>
          <p className="text-gray-600">{t('onboarding.complete')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-100 px-4">
      <div className="max-w-md w-full space-y-6 bg-white p-8 rounded-2xl shadow-lg">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 rounded-full mb-4">
            <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">{t('onboarding.title')}</h1>
          <p className="mt-2 text-sm text-gray-600">{t('onboarding.subtitle')}</p>
        </div>

        {/* Language Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('onboarding.language')}
          </label>
          <div className="grid grid-cols-2 gap-2">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={() => setLanguage(lang.code)}
                className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border ${
                  language === lang.code
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span>{lang.flag}</span>
                <span>{lang.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Notifications */}
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-gray-700">{t('onboarding.notifications')}</label>
            <p className="text-xs text-gray-500">{t('onboarding.notificationsDesc')}</p>
          </div>
          <button
            type="button"
            onClick={() => setNotifications(!notifications)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              notifications ? 'bg-emerald-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                notifications ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Username */}
        <div>
          <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
            {t('onboarding.username')}
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={t('onboarding.usernamePlaceholder')}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
          />
        </div>

        {/* Continue Button */}
        <button
          type="button"
          onClick={handleComplete}
          className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition-colors"
        >
          {t('onboarding.continue')}
        </button>
      </div>
    </div>
  );
}
