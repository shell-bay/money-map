import { memo, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

function TransactionList({ transactions, onDelete, deletingId, formatCurrency }) {
  const { t, i18n } = useTranslation();

  // Format date helper with i18n support
  const formatDate = useCallback((date) => {
    return date.toLocaleDateString(i18n.language, {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }, [i18n.language]);

  // Calculate actual date range from transactions
  const dateRangeText = useMemo(() => {
    if (!transactions || transactions.length === 0) return t('dashboard.noRecentData');

    const dates = transactions
      .map(tx => tx.date ? new Date(tx.date) : null)
      .filter(date => date && !isNaN(date.getTime()));

    if (dates.length === 0) return t('dashboard.noRecentData');

    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));

    // If all transactions on same date, show that date
    if (maxDate.getTime() === minDate.getTime()) {
      return formatDate(maxDate);
    }

    // Show range: "5 Mar 2026 - 10 Mar 2026"
    return `${formatDate(minDate)} - ${formatDate(maxDate)}`;
  }, [transactions, t, formatDate]);

  if (!transactions || transactions.length === 0) {
    return (
      <div className="text-center py-12 px-6 bg-white rounded-xl shadow-sm border border-gray-100">
        <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h4 className="text-lg font-medium text-gray-900 mb-2">{t('transactionList.noTransactions')}</h4>
        <p className="text-gray-500 mb-4">{t('transactionList.startTracking')}</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
      <div className="px-6 py-4 border-b bg-gray-50 dark:bg-slate-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">{t('transactionList.recentTransactions')}</h3>
        <p className="text-sm text-gray-500 dark:text-slate-400">{dateRangeText}</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">{t('transactionList.type')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">{t('transactionList.category')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">{t('transactionList.date')}</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">{t('transactionList.amount')}</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">{t('transactionList.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
            {transactions.map((transaction) => {
              const isDeleting = deletingId === transaction.id;
              return (
                <tr key={transaction.id} className="hover:bg-gray-50 dark:hover:bg-slate-800">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${
                      transaction.type === 'income'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200'
                        : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
                    }`}>
                      {transaction.type === 'income' ? t('transactionList.incomeLabel') : t('transactionList.expenseLabel')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-900 dark:text-slate-100">
                    {transaction.category || t('transactionList.uncategorized')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500 dark:text-slate-400 text-sm">
                    {transaction.date ? formatDate(new Date(transaction.date)) : t('transactionList.notAvailable')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <span className={`font-semibold ${transaction.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {transaction.type === 'income' ? '+' : '-'} {formatCurrency(transaction.amount)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <button
                      onClick={() => onDelete(transaction.id)}
                      disabled={isDeleting}
                      className="text-gray-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-500 transition disabled:opacity-50 p-1"
                      title={t('transactionList.delete')}
                    >
                      {isDeleting ? (
                        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Load More indicator */}
      {transactions.length > 0 && (
        <div className="px-6 py-3 bg-gray-50 dark:bg-slate-800 border-t border-gray-100 dark:border-slate-700 text-center text-sm text-gray-500 dark:text-slate-400">
          {t('common.showing', { count: transactions.length })}
        </div>
      )}
    </div>
  );
}

export default memo(TransactionList);
