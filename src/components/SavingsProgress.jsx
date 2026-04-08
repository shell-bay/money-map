import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useTransactions } from '../hooks/useTransactions';
import { useSettings } from '../hooks/useSettings';

function SavingsProgress() {
  const { t, i18n } = useTranslation();
  const { transactions } = useTransactions();
  const { settings } = useSettings();

  const { currentMonthData, previousMonthData, savingsRate } = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const previousYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    const currentIncome = transactions
      .filter(tx => {
        const date = new Date(tx.date);
        return tx.type === 'income' &&
               date.getMonth() === currentMonth &&
               date.getFullYear() === currentYear;
      })
      .reduce((sum, tx) => sum + Number(tx.amount), 0);

    const currentExpenses = transactions
      .filter(tx => {
        const date = new Date(tx.date);
        return tx.type === 'expense' &&
               date.getMonth() === currentMonth &&
               date.getFullYear() === currentYear;
      })
      .reduce((sum, tx) => sum + Number(tx.amount), 0);

    const previousIncome = transactions
      .filter(tx => {
        const date = new Date(tx.date);
        return tx.type === 'income' &&
               date.getMonth() === previousMonth &&
               date.getFullYear() === previousYear;
      })
      .reduce((sum, tx) => sum + Number(tx.amount), 0);

    const previousExpenses = transactions
      .filter(tx => {
        const date = new Date(tx.date);
        return tx.type === 'expense' &&
               date.getMonth() === previousMonth &&
               date.getFullYear() === previousYear;
      })
      .reduce((sum, tx) => sum + Number(tx.amount), 0);

    const currentSavings = currentIncome - currentExpenses;
    const previousSavings = previousIncome - previousExpenses;

    // Savings rate as percentage of income
    const savingsRate = currentIncome > 0 ? ((currentSavings / currentIncome) * 100) : 0;

    return {
      currentMonthData: { income: currentIncome, expenses: currentExpenses, savings: currentSavings },
      previousMonthData: { income: previousIncome, expenses: previousExpenses, savings: previousSavings },
      savingsRate
    };
  }, [transactions]);

  // Determine trend
  const trend = useMemo(() => {
    if (!previousMonthData.savings || !currentMonthData.savings) return 'neutral';
    const change = currentMonthData.savings - previousMonthData.savings;
    const percentChange = (change / Math.abs(previousMonthData.savings)) * 100;
    if (percentChange > 5) return 'up';
    if (percentChange < -5) return 'down';
    return 'neutral';
  }, [currentMonthData, previousMonthData]);

  const symbol = settings?.currency === 'USD' ? '$' :
                 settings?.currency === 'EUR' ? '€' :
                 settings?.currency === 'GBP' ? '£' :
                 settings?.currency === 'JPY' ? '¥' :
                 settings?.currency === 'AUD' ? 'A$' :
                 settings?.currency === 'CAD' ? 'C$' : '₹';

  const formatCurrency = (amount) => {
    return symbol + Number(amount).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const getProgressColor = () => {
    if (savingsRate >= 20) return 'text-green-600';
    if (savingsRate >= 10) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getProgressBarColor = () => {
    if (savingsRate >= 20) return 'bg-green-500';
    if (savingsRate >= 10) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getTrendIcon = () => {
    switch (trend) {
      case 'up': return <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>;
      case 'down': return <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>;
      default: return <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>;
    }
  };

  const currentMonthName = new Date().toLocaleDateString(i18n.language, { month: 'long', year: 'numeric' });

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {t('savingsProgress.monthlySavings')}
        </h3>
        {getTrendIcon()}
      </div>

      <div className="text-center mb-4">
        <div className={`text-3xl font-bold ${getProgressColor()}`}>
          {savingsRate.toFixed(1)}%
        </div>
        <div className="text-sm text-gray-600 mt-1">
          {currentMonthData.savings >= 0 ? t('savingsProgress.savingsRate') : t('savingsProgress.spendingOverIncome')}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all duration-300 ${getProgressBarColor()}`}
            style={{ width: `${Math.min(savingsRate, 100)}%` }}
          ></div>
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>0%</span>
          <span>20% Target</span>
          <span>100%</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-gray-500 mb-1">{t('savingsProgress.income')}</div>
          <div className="font-semibold text-green-600">{formatCurrency(currentMonthData.income)}</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-gray-500 mb-1">{t('savingsProgress.expenses')}</div>
          <div className="font-semibold text-red-600">{formatCurrency(currentMonthData.expenses)}</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-gray-500 mb-1">{t('savingsProgress.savings')}</div>
          <div className={`font-semibold ${currentMonthData.savings >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
            {formatCurrency(currentMonthData.savings)}
          </div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-gray-500 mb-1">{t('savingsProgress.vsLastMonth')}</div>
          <div className={`font-semibold ${trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-600'}`}>
            {trend === 'up' ? '+' : trend === 'down' ? '-' : '±'}
            {Math.abs((trend === 'neutral' ? 0 : (currentMonthData.savings - previousMonthData.savings) / Math.abs(previousMonthData.savings || 1) * 100)).toFixed(0)}%
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-gray-100">
        <p className="text-xs text-gray-500 text-center">
          {currentMonthName} • {t('savingsProgress.target')}
        </p>
      </div>
    </div>
  );
}

export default memo(SavingsProgress);
