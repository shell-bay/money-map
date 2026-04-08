import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { sendEmailVerification } from 'firebase/auth';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { useSettings } from './hooks/useSettings'; // Use Firebase settings globally
import { ToastProvider } from './components/Toast';
import { useClickSound } from './hooks/useClickSound';
import LoginPage from './pages/LoginPage';
import OnboardingPage from './pages/OnboardingPage';
import Dashboard from './pages/Dashboard';
import Analytics from './pages/Analytics';
import ChatAdvisor from './pages/ChatAdvisor';
import Settings from './pages/Settings';
import './App.css';

// Bottom Navigation Icons (SVG components)
function HomeIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}

function AnalyticsIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function SparkIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  );
}

function SettingsIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

// Layout wrapper for authenticated pages
function Layout({ children }) {
  const { user, logout } = useAuth();
  const { settings } = useSettings(); // Use Firebase settings
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // Navigation items configuration
  const navItems = [
    { to: '/dashboard', icon: HomeIcon, labelKey: 'nav.home' },
    { to: '/analytics', icon: AnalyticsIcon, labelKey: 'nav.analytics' },
    { to: '/ai-advisor', icon: SparkIcon, labelKey: 'nav.ai' },
    { to: '/settings', icon: SettingsIcon, labelKey: 'nav.settings' }
  ];

  // Get display name from either Firebase profile or settings
  const displayName = user?.displayName || settings?.displayName || user?.email?.split('@')[0] || 'User';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-800 flex flex-col">
      {/* Top Header - Simplified */}
      <header className="bg-white dark:bg-slate-900 shadow-sm border-b border-gray-200 dark:border-slate-700 sticky top-0 z-10" data-tour="app-header">
        <div className="flex items-center justify-between h-14 px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <svg className="w-7 h-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-bold text-lg text-gray-900 dark:text-slate-100">Money Map</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600 dark:text-slate-300 truncate max-w-[120px]">
              {t('app.hiUser', { name: displayName })}
            </span>
            <button onClick={handleLogout} className="p-2 text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition" aria-label={t('common.logout', { default: 'Sign out' })}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content - with bottom padding for nav */}
      <main className="flex-1 pb-20 overflow-y-auto">
        {children}
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-700 z-20 shadow-lg" aria-label="Main navigation">
        <div className="flex justify-around items-center h-16 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {navItems.map(({ to, icon: Icon, labelKey }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center w-full h-full px-2 transition relative ${
                  isActive
                    ? 'text-emerald-600'
                    : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300'
                }`
              }
              aria-label={t(labelKey)}
              data-tour={
                labelKey === 'nav.analytics' ? 'analytics-tab' :
                labelKey === 'nav.ai' ? 'ai-advisor-tab' :
                labelKey === 'nav.settings' ? 'settings-tab' : undefined
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={`w-6 h-6 ${isActive ? 'stroke-2' : 'stroke-[1.5]'}`} />
                  <span className={`text-xs mt-1 font-medium ${isActive ? 'opacity-100' : 'opacity-70'}`}>
                    {t(labelKey)}
                  </span>
                  {isActive && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-emerald-600 rounded-full" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

// Protected Route wrapper
function ProtectedRoute({ children }) {
  const { user, loading: authLoading } = useAuth();
  const { loading: settingsLoading } = useSettings();
  const { t } = useTranslation();
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState(''); // 'success' | 'error' | ''

  if (authLoading || (user && settingsLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{t('app.loading')}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Require email verification
  if (!user.emailVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-800 px-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-lg text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-full mb-4">
            <svg className="w-8 h-8 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-4">{t('app.verifyEmailTitle')}</h1>
          <p className="text-gray-600 dark:text-slate-300 mb-6">
            {t('app.verifyEmailMessage', { email: <strong>{user.email}</strong> })}
          </p>
          <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
            {t('app.verificationPrompt', { defaultValue: "Didn't receive the email? Check your spam folder or " })}
            <button
              onClick={async () => {
                setResending(true);
                setResendStatus('');
                try {
                  await sendEmailVerification(user);
                  setResendStatus('success');
                } catch {
                  setResendStatus('error');
                } finally {
                  setResending(false);
                }
              }}
              disabled={resending}
              className={`text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-semibold ${resending ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {resending ? t('app.resending') : t('app.resendVerification')}
            </button>
          </p>
          {resendStatus === 'success' && (
            <p className="text-green-600 dark:text-green-400 text-sm mb-4">{t('app.verificationEmailSent')}</p>
          )}
          {resendStatus === 'error' && (
            <p className="text-red-600 dark:text-red-400 text-sm mb-4">{t('app.verificationFailed')}</p>
          )}
          <p className="text-xs text-gray-500 dark:text-slate-500">
            {t('app.verificationNote')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <Layout>
      {children}
    </Layout>
  );
}

// Public Route (redirect to dashboard if already logged in)
function PublicRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  // Check onboarding completion
  if (typeof window !== 'undefined' && !localStorage.getItem('onboardingComplete')) {
    return <Navigate to="/onboarding" replace />;
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function App() {
  // Initialize click sound system (global button sounds)
  useClickSound();

  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route
            path="/login"
            element={
              <PublicRoute>
                <LoginPage />
              </PublicRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <ProtectedRoute>
                <Analytics />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ai-advisor"
            element={
              <ProtectedRoute>
                <ChatAdvisor />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
