import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
  const { t } = useTranslation();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [validationError, setValidationError] = useState('');

  const { login, signup, loginWithGoogle, resetPassword, error } = useAuth();
  const navigate = useNavigate();

  // Clear reset success message when user types
  useEffect(() => {
    if (resetEmailSent) {
      setResetEmailSent(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  // Helper: validate email format
  const isValidEmail = (emailStr) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(emailStr.trim());
  };

  const validateForm = () => {
    setValidationError('');

    if (!email.trim()) {
      setValidationError(t('login.validationEmailRequired'));
      return false;
    }

    if (!isValidEmail(email)) {
      setValidationError(t('login.validationValidEmail'));
      return false;
    }

    if (password.length < 6) {
      setValidationError(t('login.validationPasswordLength'));
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await signup(email, password);
      }
      navigate('/dashboard');
    } catch {
      // Error is handled in context
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      await loginWithGoogle();
      // Note: Navigation is handled by the ProtectedRoute after auth state change
      // We don't navigate immediately to avoid race conditions
    } catch (err) {
      console.error('Google login failed in UI:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setValidationError('');

    if (!email.trim()) {
      setValidationError(t('login.validationEmailRequired'));
      return;
    }

    if (!isValidEmail(email)) {
      setValidationError(t('login.validationValidEmail'));
      return;
    }

    setLoading(true);
    try {
      await resetPassword(email);
      setResetEmailSent(true);
    } catch {
      // Error is handled in context
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-100 px-4">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-lg">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 rounded-full mb-4">
            <svg
              className="w-8 h-8 text-emerald-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">{t('login.title')}</h1>
          <p className="mt-2 text-sm text-gray-600">
            {isLogin ? t('login.signInAccount') : t('login.createAccount')}
          </p>
        </div>

        {/* Error Message (validation or Firebase) */}
        {(validationError || error) && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {validationError || error}
          </div>
        )}

        {/* Reset Password Success */}
        {resetEmailSent && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
            {t('login.passwordResetSent')}
          </div>
        )}

        {/* Google Sign In */}
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 border-2 border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          <span className="text-gray-700 font-medium">
            {t('login.continueGoogle')}
          </span>
        </button>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-white text-gray-500">{t('login.or')}</span>
          </div>
        </div>

        {/* Email/Password Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              {t('login.email')}
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                {t('login.password')}
              </label>
              {isLogin && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    handlePasswordReset(e);
                  }}
                  className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                >
                  {t('login.forgotPassword')}
                </button>
              )}
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {t('common.loading')}
              </span>
            ) : isLogin ? (
              t('login.signIn')
            ) : (
              t('login.createAccountBtn')
            )}
          </button>
        </form>

        {/* Toggle Login/Signup */}
        <div className="text-center text-sm text-gray-600">
          {isLogin ? (
            <p>
              {t('login.dontHaveAccount')}{' '}
              <button
                type="button"
                onClick={() => {
                  setIsLogin(false);
                  setResetEmailSent(false);
                  setValidationError('');
                }}
                className="text-emerald-600 hover:text-emerald-700 font-semibold"
              >
                {t('login.signUp')}
              </button>
            </p>
          ) : (
            <p>
              {t('login.alreadyHaveAccount')}{' '}
              <button
                type="button"
                onClick={() => {
                  setIsLogin(true);
                  setResetEmailSent(false);
                  setValidationError('');
                }}
                className="text-emerald-600 hover:text-emerald-700 font-semibold"
              >
                {t('login.signInLink')}
              </button>
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-gray-400 pt-4 border-t">
          <p>{t('login.footer', { year: new Date().getFullYear() })}</p>
        </div>
      </div>
    </div>
  );
}
