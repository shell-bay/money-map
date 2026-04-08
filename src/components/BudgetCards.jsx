import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../hooks/useSettings';
import { useTransactions } from '../hooks/useTransactions';

function BudgetCards() {
  const { t, i18n } = useTranslation();
  const { settings } = useSettings();
  const { transactions } = useTransactions();

  // Format currency based on settings
  const formatCurrency = (amount) => {
    const currencyCode = settings?.currency || 'INR';
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
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
  };

  // Get current month expenses by category
  const currentMonthSpending = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthlyExpenses = {};
    transactions
      .filter(tx => {
        const txDate = new Date(tx.date);
        return tx.type === 'expense' &&
               txDate.getMonth() === currentMonth &&
               txDate.getFullYear() === currentYear;
      })
      .forEach(tx => {
        const category = tx.category || 'Uncategorized';
        monthlyExpenses[category] = (monthlyExpenses[category] || 0) + Number(tx.amount);
      });

    return monthlyExpenses;
  }, [transactions]);

  // Get category budgets from settings
  const categoryBudgets = useMemo(() => settings?.categoryBudgets || {}, [settings]);
  const monthlyBudget = settings?.monthlyBudget || 0;

  // Calculate total spent this month
  const totalSpent = useMemo(() => {
    return Object.values(currentMonthSpending).reduce((sum, amount) => sum + amount, 0);
  }, [currentMonthSpending]);

  // Prepare top categories for display (limit to 4)
  const topCategories = useMemo(() => {
    const categories = Object.entries(currentMonthSpending)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
    return categories.map(([category, spent]) => ({
      category,
      spent,
      budget: categoryBudgets[category] || 0,
      percentage: categoryBudgets[category] > 0 ? (spent / categoryBudgets[category]) * 100 : 0
    }));
  }, [currentMonthSpending, categoryBudgets]);

  // If no budget set, show empty state
  if (!monthlyBudget || Object.keys(categoryBudgets).length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3v2m1.333 1.666c.39.39 1.053.391 1.444 0 .39-.39.391-1.053 0-1.444L10.109 8.667M21 13.333v-2m-1.333-1.666c-.39-.39-1.053-.391-1.444 0-.39.39-.391 1.053 0 1.444L13.891 15.333M3 13.333v2m1.333-1.666c-.39-.39-1.053-.391-1.444 0-.39.39-.391 1.053 0 1.444l2.221 2.221M21 10.667h-2" />
            </svg>
            {t('budgetCards.title')}
          </h3>
        </div>
        <div className="text-center py-6">
          <p className="text-gray-500 dark:text-slate-400 mb-3">{t('budgetCards.setBudget')}</p>
          <p className="text-sm text-gray-400 dark:text-slate-500">{t('budgetCards.goToSettings')}</p>
        </div>
      </div>
    );
  }

  // Calculate overall budget percentage
  const overallPercentage = (totalSpent / monthlyBudget) * 100;
  const overallStatus = overallPercentage >= 100 ? 'bg-red-500' : overallPercentage >= 80 ? 'bg-yellow-500' : 'bg-green-500';

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3v2m1.333 1.666c.39.39 1.053.391 1.444 0 .39-.39.391-1.053 0-1.444L10.109 8.667M21 13.333v-2m-1.333-1.666c-.39-.39-1.053-.391-1.444 0-.39.39-.391 1.053 0 1.444L13.891 15.333M3 13.333v2m1.333-1.666c-.39-.39-1.053-.391-1.444 0-.39.39-.391 1.053 0 1.444l2.221 2.221M21 10.667h-2" />
          </svg>
          {t('budgetCards.title')}
        </h3>
        <div className="text-right">
          <div className={`text-sm font-medium ${overallPercentage >= 100 ? 'text-red-600 dark:text-red-400' : overallPercentage >= 80 ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'}`}>
            {t('budgetCards.percentUsed', { percent: overallPercentage.toFixed(0) })}
          </div>
          <div className="text-xs text-gray-500 dark:text-slate-400">
            {formatCurrency(totalSpent)} / {formatCurrency(monthlyBudget)}
          </div>
        </div>
      </div>

      {/* Overall progress bar */}
      <div className="mb-4">
        <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2.5">
          <div
            className={`h-2.5 rounded-full transition-all duration-300 ${overallStatus}`}
            style={{ width: `${Math.min(overallPercentage, 100)}%` }}
          ></div>
        </div>
      </div>

      {/* Category breakdown */}
      {topCategories.length > 0 ? (
        <div className="space-y-3">
          {topCategories.map(({ category, spent, budget, percentage }) => (
            <div key={category} className="flex items-center justify-between text-sm">
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-gray-700 dark:text-slate-300 truncate">{category}</span>
                  <span className="text-gray-600 dark:text-slate-400 ml-2">
                    {formatCurrency(spent)} / {formatCurrency(budget)}
                  </span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-1.5 mt-1">
                  <div
                    className={`h-1.5 rounded-full ${percentage >= 100 ? 'bg-red-500' : percentage >= 80 ? 'bg-yellow-500' : 'bg-green-500'}`}
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-2">{t('budgetCards.noSpending')}</p>
      )}

      <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-700">
        <p className="text-xs text-gray-400 dark:text-slate-500">
          {t('budgetCards.basedOn', { month: new Date().toLocaleDateString(i18n.language, { month: 'long', year: 'numeric' }) })}
        </p>
      </div>
    </div>
  );
}

export default memo(BudgetCards);
