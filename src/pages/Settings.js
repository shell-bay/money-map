import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { useAuth } from '../hooks/useAuth';
import { useSettings } from '../hooks/useSettings'; // Firebase settings
import { useTransactions } from '../hooks/useTransactions';
import { useBills } from '../hooks/useBills';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast';
import { useConfirm } from '../hooks/useConfirm';
import CustomSelect from '../components/CustomSelect';

const CURRENCIES = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
];

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'हिन्दी (Hindi)' },
  { value: 'es', label: 'Español (Spanish)' },
  { value: 'fr', label: 'Français (French)' },
];

export default function Settings() {
  const { t } = useTranslation();
  const { user, resetPassword, deleteUser, updateUserProfile } = useAuth();
  const { settings, updateSetting, loading: settingsLoading, syncStatus } = useSettings();
  const { transactions, loading: txLoading, clearAllTransactions, addTransaction } = useTransactions();
  const { bills, addBill } = useBills();
  const navigate = useNavigate();
  const toast = useToast();
  const { confirm, Modal: ConfirmModal } = useConfirm();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [isLoading, setIsLoading] = useState(false);

  // Local state for deleting progress
  const [clearing, setClearing] = useState(false);
  // Local input state for display name (not from settings)
  const [inputDisplayName, setInputDisplayName] = useState(user?.displayName || '');

  // Handlers using context
  const handleSaveName = async () => {
    const newName = inputDisplayName.trim();
    if (!newName) {
      showMessage('error', 'Please enter a name');
      return;
    }

    try {
      // Save to Firebase profile
      await updateUserProfile({ displayName: newName });
      showMessage('success', 'Display name saved to profile');
    } catch (err) {
      showMessage('error', 'Failed to save display name: ' + err.message);
    }
  };

  // Update input when user changes
  useEffect(() => {
    setInputDisplayName(user?.displayName || '');
  }, [user?.displayName]);

  const handleThemeChange = (newTheme) => {
    updateSetting('theme', newTheme);
    showMessage('success', t('settings.themeChanged', { theme: newTheme }));
  };

  const handleCurrencyChange = (newCurrency) => {
    updateSetting('currency', newCurrency);
    showMessage('success', t('settings.currencyChanged', { currency: newCurrency }));
  };

  const handleLanguageChange = (newLang) => {
    updateSetting('language', newLang);
    i18n.changeLanguage(newLang);
    localStorage.setItem('language', newLang); // Sync with i18n init
    const languageName = LANGUAGES.find(lang => lang.value === newLang)?.label || newLang;
    showMessage('success', t('settings.languageChanged', { language: languageName }));
  };

  // Get currency symbol
  // Format currency
  const formatCurrency = (amount) => {
    const currencyCode = settings.currency || 'INR';
    const curr = CURRENCIES.find(c => c.code === currencyCode);
    const symbol = curr?.symbol || currencyCode;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount).replace(currencyCode, symbol);
  };

  // Calculate totals
  const { totalIncome, totalExpenses } = useMemo(() => {
    const income = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
    const expenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
    return { totalIncome: income, totalExpenses: expenses };
  }, [transactions]);

  // Show temporary message
  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 3000);
  };

  // Handle password reset
  const handlePasswordReset = async () => {
    if (!user?.email) return;
    setIsLoading(true);
    try {
      await resetPassword(user.email);
      showMessage('success', 'Password reset email sent!');
    } catch (error) {
      showMessage('error', 'Failed to send reset email');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle account deletion
  const handleDeleteAccount = async () => {
    setIsLoading(true);
    try {
      await deleteUser();
      showMessage('success', 'Account deleted successfully');
      navigate('/login');
    } catch (error) {
      showMessage('error', 'Failed to delete account');
      setShowDeleteConfirm(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle clear all data
  const handleClearData = async () => {
    setClearing(true);
    try {
      await clearAllTransactions();
      showMessage('success', 'All transaction data cleared');
      setShowClearConfirm(false);
    } catch (err) {
      showMessage('error', 'Failed to clear transactions: ' + err.message);
    } finally {
      setClearing(false);
    }
  };

  // Handle app reset
  const handleResetApp = async () => {
    const confirmed = await confirm({
      title: 'Reset App',
      message: 'This will clear all settings and data. This action cannot be undone. Continue?',
      confirmLabel: 'Reset',
      cancelLabel: 'Cancel',
      variant: 'danger'
    });

    if (!confirmed) return;

    localStorage.clear();
    toast.addToast('App reset. Refreshing...', 'success');
    setTimeout(() => window.location.reload(), 1500);
  };


  // Loading state
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Success/Error Message */}
        {message.text && (
          <div className={`mb-6 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
            {message.text}
          </div>
        )}

        {/* Settings Loading & Sync Status */}
        {(settingsLoading || syncStatus) && (
          <div className="mb-6 flex items-center justify-between">
            {settingsLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-600"></div>
                <span>{t('settings.loading')}</span>
              </div>
            ) : (
              <div></div>
            )}
            {syncStatus && syncStatus !== 'idle' && (
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${
                syncStatus === 'saved' ? 'bg-green-100 text-green-700' :
                syncStatus === 'syncing' ? 'bg-blue-100 text-blue-700' :
                syncStatus === 'offline' ? 'bg-yellow-100 text-yellow-700' :
                'bg-red-100 text-red-700'
              }`}>
                {syncStatus === 'saved' && t('settings.syncStatus.saved')}
                {syncStatus === 'syncing' && (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-700"></div>
                    {t('settings.syncStatus.syncing')}
                  </>
                )}
                {syncStatus === 'offline' && t('settings.syncStatus.offline')}
                {syncStatus === 'error' && t('settings.syncStatus.error')}
              </div>
            )}
          </div>
        )}

        <div className="space-y-6">
          {/* Personalization Section */}
          <section className="bg-white rounded-xl shadow-sm p-6 border border-gray-100" data-tour="settings-personalization-section">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
              </svg>
              {t('settings.personalInfo')}
            </h2>
            <div className="space-y-4">
              {/* Display Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.displayName')}</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputDisplayName}
                    onChange={(e) => setInputDisplayName(e.target.value)}
                    placeholder={user?.email?.split('@')[0] || 'Your name'}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                  />
                  <button
                    onClick={handleSaveName}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition"
                  >
                    {t('settings.saveName')}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {t('settings.thisNameHeader')}
                </p>
              </div>

              {/* Theme */}
              <div data-tour="settings-theme-toggle">
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.theme')}</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleThemeChange('light')}
                    className={`flex-1 px-4 py-2 rounded-lg border transition ${settings.theme === 'light' ? 'bg-emerald-50 border-emerald-600 text-emerald-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                  >
                    {t('settings.light')}
                  </button>
                  <button
                    onClick={() => handleThemeChange('dark')}
                    className={`flex-1 px-4 py-2 rounded-lg border transition ${settings.theme === 'dark' ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                  >
                    {t('settings.dark')}
                  </button>
                </div>
              </div>

              {/* Currency */}
              <div data-tour="settings-currency-select">
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.currency')}</label>
                <CustomSelect
                  options={CURRENCIES.map(curr => ({ value: curr.code, label: `${curr.symbol} - ${curr.name}` }))}
                  value={settings.currency}
                  onChange={handleCurrencyChange}
                  placeholder="Select currency"
                />
              </div>

              {/* Notifications - now managed in separate section below */}
              {/* Placeholder: moved to Notifications section */}

              {/* Language (Placeholder) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.language')}</label>
                <CustomSelect
                  options={LANGUAGES}
                  value={settings.language}
                  onChange={handleLanguageChange}
                  placeholder="Select language"
                />
                <p className="text-xs text-gray-500 mt-1">{t('settings.moreLanguagesSoon')}</p>
              </div>
            </div>
          </section>



          {/* Notification Preferences Section */}
          <section className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {t('settings.notificationPreferences')}
            </h2>
            <div className="space-y-4">
              {Object.entries({
                billReminders: {
                  label: t('settings.billReminders'),
                  desc: t('settings.billRemindersDesc')
                },
                overspendingAlerts: {
                  label: t('settings.overspendingAlerts'),
                  desc: t('settings.overspendingAlertsDesc')
                },
                savingsMilestones: {
                  label: t('settings.savingsMilestones'),
                  desc: t('settings.savingsMilestonesDesc')
                },
                weeklySummary: {
                  label: t('settings.weeklySummary'),
                  desc: t('settings.weeklySummaryDesc')
                }
              }).map(([key, { label, desc }]) => (
                <div key={key} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{label}</p>
                    <p className="text-sm text-gray-500">{desc}</p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      const current = settings.notificationPreferences?.[key] ?? true;
                      const newPrefs = {
                        ...settings.notificationPreferences,
                        [key]: !current
                      };
                      await updateSetting('notificationPreferences', newPrefs);
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.notificationPreferences?.[key] ? 'bg-emerald-600' : 'bg-gray-200'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.notificationPreferences?.[key] ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Account Section */}
          <section className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              {t('settings.account')}
            </h2>
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-500 mb-1">{t('settings.loggedInAs')}</p>
                <p className="font-medium text-gray-900">{user?.email}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {user?.emailVerified ? (
                    <span className="text-green-600">{t('settings.verified')}</span>
                  ) : (
                    <span className="text-yellow-600">{t('settings.notVerified')}</span>
                  )}
                </p>
              </div>

              <button
                onClick={handlePasswordReset}
                disabled={isLoading}
                className="w-full px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg transition disabled:opacity-50"
              >
                {t('settings.resetPassword')}
              </button>

              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full px-4 py-2 border border-red-300 text-red-700 hover:bg-red-50 rounded-lg transition"
              >
                {t('settings.deleteAccount')}
              </button>
            </div>
          </section>

          {/* Data Management Section */}
          <section className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
              </svg>
              {t('settings.dataManagement')}
            </h2>
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex justify-between items-center mb-2">
                  <div>
                    <p className="font-medium text-gray-900">{t('settings.transactionData')}</p>
                    <p className="text-sm text-gray-500">
                      {txLoading ? t('settings.loading') : t('settings.transactionsStored', { count: transactions.length })}
                    </p>
                  </div>
                  <span className="text-lg font-bold text-emerald-600">
                    {formatCurrency(totalIncome + totalExpenses)}
                  </span>
                </div>
              </div>

              {/* Backup & Restore */}
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-medium text-gray-900 mb-2">{t('settings.backupRestore')}</h3>
                <p className="text-xs text-gray-500 mb-3">
                  {t('settings.backupDesc')}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={async () => {
                      try {
                        const backup = {
                          version: '1.0',
                          timestamp: new Date().toISOString(),
                          transactions,
                          settings: { ...settings, _id: undefined },
                          bills
                        };
                        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `money-map-backup-${new Date().toISOString().split('T')[0]}.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                        toast.addToast(t('settings.backupDownloaded'), 'success');
                      } catch (err) {
                        toast.addToast(t('settings.failedCreateBackup', { error: err.message }), 'error');
                      }
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg transition text-sm"
                  >
                    {t('settings.exportJSON')}
                  </button>
                  <label className="flex-1">
                    <span className="flex items-center justify-center px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg transition text-sm cursor-pointer">
                      {t('settings.importJSON')}
                    </span>
                    <input
                      type="file"
                      accept=".json"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files[0];
                        if (!file) return;
                        try {
                          const text = await file.text();
                          const data = JSON.parse(text);
                          if (!data.transactions || !Array.isArray(data.transactions)) {
                            throw new Error('Invalid backup format: missing transactions array');
                          }
                          const confirmed = await confirm({
                            title: 'Restore Data',
                            message: `This will REPLACE all current transactions and settings with the backup:\n\n• ${data.transactions.length} transactions\n• ${Object.keys(data.settings?.categoryBudgets || {}).length} category budgets\n• ${data.bills?.length || 0} recurring bills\n\nAre you sure? This cannot be undone.`,
                            confirmLabel: 'Restore',
                            cancelLabel: 'Cancel',
                            variant: 'danger'
                          });
                          if (!confirmed) return;

                          toast.addToast(t('settings.importingData'), 'info');

                          // 1. Add imported transactions (append to existing)
                          for (const tx of data.transactions) {
                            await addTransaction({
                              type: tx.type,
                              amount: Number(tx.amount),
                              category: tx.category,
                              date: tx.date
                            });
                          }

                          // 2. Restore settings (except internal fields)
                          const settingsToRestore = { ...data.settings };
                          delete settingsToRestore._id;
                          for (const [key, value] of Object.entries(settingsToRestore)) {
                            await updateSetting(key, value);
                          }

                          // 3. Restore bills: append only (do not delete existing)
                          if (data.bills && Array.isArray(data.bills)) {
                            for (const bill of data.bills) {
                              const { id: _, createdAt, updatedAt, ...billData } = bill;
                              await addBill(billData);
                            }
                          }

                          toast.addToast(t('settings.importSuccess'), 'success');
                          // Navigate to AI Advisor for automatic analysis
                          navigate('/chat-advisor');
                        } catch (err) {
                          console.error('Import error:', err);
                          toast.addToast(t('settings.failedImport', { error: err.message }), 'error');
                        }
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>
              </div>

              <button
                onClick={() => setShowClearConfirm(true)}
                disabled={clearing || txLoading || transactions.length === 0}
                className="w-full px-4 py-2 border border-yellow-300 text-yellow-700 hover:bg-yellow-50 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {clearing ? t('settings.clearing') : t('settings.clearAllTransactions')}
              </button>

              <button
                onClick={handleResetApp}
                className="w-full px-4 py-2 border border-red-300 text-red-700 hover:bg-red-50 rounded-lg transition"
              >
                {t('settings.resetApp')}
              </button>
            </div>
          </section>

        </div>
        {/* Delete Account Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-2">{t('confirm.deleteAccount.title')}</h3>
              <p className="text-gray-600 mb-6 whitespace-pre-line">
                {t('confirm.deleteAccount.message')}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg transition"
                >
                  {t('confirm.deleteAccount.cancelLabel')}
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition disabled:opacity-50"
                >
                  {isLoading ? t('settings.deleting') : t('confirm.deleteAccount.confirmLabel')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Clear Data Confirmation Modal */}
        {showClearConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-2">{t('confirm.clearData.title')}</h3>
              <p className="text-gray-600 mb-6 whitespace-pre-line">
                {t('confirm.clearData.message')}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg transition"
                >
                  {t('confirm.clearData.cancelLabel')}
                </button>
                <button
                  onClick={handleClearData}
                  disabled={clearing}
                  className="flex-1 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white font-semibold rounded-lg transition disabled:opacity-50"
                >
                  {clearing ? t('settings.clearing') : t('confirm.clearData.confirmLabel')}
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Confirm Modal */}
        <ConfirmModal />
      </main>
    </div>
  );
}
