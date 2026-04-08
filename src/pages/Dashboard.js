import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../hooks/useSettings';
import { useTransactions } from '../hooks/useTransactions';
import { useToast } from '../components/Toast';
import { useConfirm } from '../hooks/useConfirm';
import TransactionList from '../components/TransactionList';
import BillsSummary from '../components/BillsSummary';
import BudgetCards from '../components/BudgetCards';
import SavingsProgress from '../components/SavingsProgress';
import SmartAlerts from '../components/SmartAlerts';

export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const { settings } = useSettings();
  const {
    transactions,
    loading,
    error,
    addTransaction,
    deleteTransaction,
    hasMore,
    loadingMore,
    loadMore
  } = useTransactions();
  const toast = useToast();
  const { confirm, Modal: ConfirmModal } = useConfirm();

  const [formData, setFormData] = useState({
    type: 'expense',
    amount: '',
    category: '',
    date: new Date().toISOString().split('T')[0]
  });
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [formError, setFormError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Constants
  const SUCCESS_MESSAGE_DURATION = 3000; // 3 seconds

  // Helper to format date with i18n
  const formatDate = useCallback((date) => {
    return date.toLocaleDateString(i18n.language, {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }, [i18n.language]);

  // Calculate date range of displayed transactions
  const dateRangeText = useMemo(() => {
    if (!transactions || transactions.length === 0) {
      return t('dashboard.noRecentData');
    }
    // Get valid dates from transactions
    const dates = transactions
      .map(tx => tx.date ? new Date(tx.date) : null)
      .filter(date => date && !isNaN(date.getTime()));
    if (dates.length === 0) {
      return t('dashboard.noRecentData');
    }
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));

    // If all transactions on same date, show that date
    if (maxDate.getTime() === minDate.getTime()) {
      return formatDate(maxDate);
    }

    // Show range: "5 Mar 2026 - 10 Mar 2026"
    return `${formatDate(minDate)} - ${formatDate(maxDate)}`;
  }, [transactions, t, formatDate]);

  // Calculate all-time totals (not filtered by date)
  const allTimeTotals = useMemo(() => {
    if (!transactions || transactions.length === 0) {
      return { totalIncome: 0, totalExpenses: 0, balance: 0 };
    }

    const totalInc = transactions
      .filter(tx => tx.type === 'income')
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

    const totalExp = transactions
      .filter(tx => tx.type === 'expense')
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

    return {
      totalIncome: totalInc,
      totalExpenses: totalExp,
      balance: totalInc - totalExp
    };
  }, [transactions]);

  // Format currency
  const formatCurrency = (amount) => {
    const currencyCode = settings.currency || 'INR';
    const currencySymbols = {
      INR: '₹',
      USD: '$',
      EUR: '€',
      GBP: '£',
      JPY: '¥',
      AUD: 'A$',
      CAD: 'C$'
    };
    const symbol = currencySymbols[currencyCode] || currencyCode;

    return symbol + Number(amount).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Add new transaction
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.amount || !formData.category) {
      setFormError(t('dashboard.fillAmountAndCategory'));
      return;
    }

    setSubmitting(true);
    try {
      await addTransaction({
        type: formData.type,
        amount: parseFloat(formData.amount),
        category: formData.category.trim(),
        date: formData.date
      });

      setFormData({
        type: 'expense',
        amount: '',
        category: '',
        date: new Date().toISOString().split('T')[0]
      });
      setShowForm(false);
      setSuccessMessage(t('dashboard.transactionAdded'));
      setTimeout(() => setSuccessMessage(''), SUCCESS_MESSAGE_DURATION);
    } catch (err) {
      setFormError(t('dashboard.failedToAdd', { message: err.message }));
    } finally {
      setSubmitting(false);
    }
  };

  // Delete transaction
  const handleDelete = async (id) => {
    const confirmed = await confirm({
      title: t('dashboard.deleteTransaction'),
      message: t('dashboard.confirmDelete'),
      confirmLabel: t('common.delete'),
      cancelLabel: t('common.cancel'),
      variant: 'danger'
    });

    if (!confirmed) return;

    setDeletingId(id);
    setDeleteError('');
    try {
      await deleteTransaction(id);
      toast.addToast(t('dashboard.transactionDeleted'), 'success');
    } catch (err) {
      setDeleteError(t('dashboard.failedToDelete') + ': ' + err.message);
      toast.addToast(t('dashboard.failedToDelete'), 'error');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Loading state */}
        {loading && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-center">
            {t('dashboard.loadingTransactions')}
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-center">
            {t('dashboard.errorLoading', { error })}
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {/* Income */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100" data-tour="total-income-card">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500">{t('dashboard.totalIncome')}</h3>
              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5 5 5M12 4v7" />
              </svg>
            </div>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(allTimeTotals.totalIncome)}
            </p>
            <p className="text-xs text-gray-400 mt-1">{t('dashboard.allTime')}</p>
          </div>

          {/* Expenses */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100" data-tour="total-expenses-card">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500">{t('dashboard.totalExpenses')}</h3>
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5-5-5m5-8V2a1 1 0 00-1-1H4a1 1 0 00-1 1v6a1 1 0 001 1h12a1 1 0 001-1v-3z" />
              </svg>
            </div>
            <p className="text-2xl font-bold text-red-600">
              {formatCurrency(allTimeTotals.totalExpenses)}
            </p>
            <p className="text-xs text-gray-400 mt-1">{t('dashboard.allTime')}</p>
          </div>

          {/* Balance */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100" data-tour="balance-card">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500">{t('dashboard.balance')}</h3>
              <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-3v3m0 3V5" />
              </svg>
            </div>
            <p className={`text-2xl font-bold ${allTimeTotals.balance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
              {formatCurrency(allTimeTotals.balance)}
            </p>
            <p className="text-xs text-gray-400 mt-1">{t('dashboard.incomeMinusExpenses')}</p>
          </div>
        </div>

        {/* New Dashboard Widgets Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
          <BillsSummary />
          <BudgetCards />
        </div>

        {/* New Dashboard Widgets Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
          <SavingsProgress />
          <SmartAlerts />
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-center">
            {successMessage}
          </div>
        )}

        {/* Form Error */}
        {formError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-center">
            {formError}
          </div>
        )}

        {/* Add Transaction Button */}
        <div className="mb-6">
          <button
            onClick={() => setShowForm(!showForm)}
            className="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition flex items-center justify-center gap-2"
            data-tour="add-transaction-btn"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            {showForm ? t('dashboard.cancel') : t('dashboard.addTransaction')}
          </button>
        </div>

        {/* Add Transaction Form */}
        {showForm && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-8 border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('dashboard.newTransaction')}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('dashboard.type')}</label>
                  <select
                    name="type"
                    value={formData.type}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                  >
                    <option value="income">{t('dashboard.incomeOption')}</option>
                    <option value="expense">{t('dashboard.expenseOption')}</option>
                  </select>
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('dashboard.amount')}</label>
                  <input
                    type="number"
                    name="amount"
                    value={formData.amount}
                    onChange={handleInputChange}
                    required
                    step="0.01"
                    min="0"
                    placeholder={t('common.amountPlaceholder')}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('dashboard.category')}</label>
                  <input
                    type="text"
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    required
                    placeholder={t('dashboard.placeholderCategory')}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                  />
                </div>

                {/* Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('dashboard.date')}</label>
                  <input
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                  />
                </div>
              </div>

              {/* Submit */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? t('dashboard.adding') : t('dashboard.addTransaction')}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Delete Error */}
        {deleteError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-center">
            {deleteError}
          </div>
        )}

        {/* Transactions List */}
        <TransactionList
          transactions={transactions}
          onDelete={handleDelete}
          deletingId={deletingId}
          formatCurrency={formatCurrency}
        />

        {/* Load More Button */}
        {hasMore && (
          <div className="mt-4 text-center">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingMore ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {t('common.loading')}
                </span>
              ) : (
                t('dashboard.loadMore')
              )}
            </button>
            <p className="text-xs text-gray-500 mt-2">
              {dateRangeText}
            </p>
          </div>
        )}
      </main>
      {/* Confirm Modal */}
      <ConfirmModal />
    </div>
  );
}
