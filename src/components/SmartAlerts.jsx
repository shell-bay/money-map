import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useTransactions } from '../hooks/useTransactions';
import { useBills } from '../hooks/useBills';
import { useSettings } from '../hooks/useSettings';

function SmartAlerts() {
  const { t } = useTranslation();
  const { transactions } = useTransactions();
  const { getUpcomingBills } = useBills();
  const { settings } = useSettings();

  const currencyCode = settings?.currency || 'INR';

  const alerts = useMemo(() => {
    const result = [];
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const currentMonthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

    // Format currency for display
    const formatCurrency = (amount) => {
      const symbols = {
        INR: '₹',
        USD: '$',
        EUR: '€',
        GBP: '£',
        JPY: '¥',
        AUD: 'A$',
        CAD: 'C$'
      };
      const symbol = symbols[currencyCode] || currencyCode;
      return symbol + Number(amount).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    };

    // 1. Unusual spending spikes (category > 2x average)
    const currentMonthExpenses = transactions
      .filter(tx => tx.type === 'expense' &&
            tx.date && tx.date.startsWith(currentMonthPrefix));

    const categoryTotals = {};
    currentMonthExpenses.forEach(tx => {
      const cat = tx.category || 'Uncategorized';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + Number(tx.amount);
    });

    // Calculate historical average per category (last 3 months excluding current)
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const historicalCategoryTotals = {};
    transactions
      .filter(tx => {
        const date = new Date(tx.date);
        return tx.type === 'expense' &&
               date > threeMonthsAgo &&
               !(date.getMonth() === currentMonth && date.getFullYear() === currentYear);
      })
      .forEach(tx => {
        const cat = tx.category || 'Uncategorized';
        if (!historicalCategoryTotals[cat]) historicalCategoryTotals[cat] = [];
        historicalCategoryTotals[cat].push(Number(tx.amount));
      });

    const historicalAvg = {};
    Object.entries(historicalCategoryTotals).forEach(([cat, amounts]) => {
      historicalAvg[cat] = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    });

    // Find categories spiking > 2x average
    Object.entries(categoryTotals).forEach(([cat, current]) => {
      const avg = historicalAvg[cat];
      if (avg && current > avg * 2) {
        const percentIncrease = ((current - avg) / avg * 100).toFixed(0);
        result.push({
          type: 'spike',
          severity: 'high',
          messageKey: 'smartAlerts.spikeMessage',
          messageParams: {
            category: cat,
            percentIncrease,
            avg: formatCurrency(Math.round(avg)),
            current: formatCurrency(Math.round(current))
          }
        });
      }
    });

    // 2. Large single transactions (over 50% of monthly income)
    const currentMonthIncome = transactions
      .filter(tx => tx.type === 'income' &&
            tx.date && tx.date.startsWith(currentMonthPrefix))
      .reduce((sum, tx) => sum + Number(tx.amount), 0);

    const largeTransactions = currentMonthExpenses.filter(tx => {
      return currentMonthIncome > 0 && tx.amount > currentMonthIncome * 0.5;
    });

    if (largeTransactions.length > 0) {
      largeTransactions.forEach(tx => {
        result.push({
          type: 'large_transaction',
          severity: 'medium',
          messageKey: 'smartAlerts.largeExpense',
          messageParams: {
            category: tx.category,
            amount: formatCurrency(tx.amount),
            percent: (tx.amount / currentMonthIncome * 100).toFixed(0)
          }
        });
      });
    }

    // 3. Upcoming bills (due in 3 days)
    const upcomingBills = getUpcomingBills(3);
    if (upcomingBills.length > 0) {
      const totalDue = upcomingBills.reduce((sum, bill) => sum + Number(bill.amount), 0);
      result.push({
        type: 'bills_due',
        severity: 'high',
        count: upcomingBills.length,
        totalDue,
        messageKey: 'smartAlerts.billsDue',
        messageParams: {
          count: upcomingBills.length,
          amount: formatCurrency(totalDue)
        }
      });
    }

    // 4. No income this month
    if (currentMonthIncome === 0 && transactions.length > 0) {
      result.push({
        type: 'no_income',
        severity: 'medium',
        messageKey: 'smartAlerts.noIncome'
      });
    }

    // 5. Negative savings
    const currentSavings = currentMonthIncome - currentMonthExpenses.reduce((sum, tx) => sum + Number(tx.amount), 0);
    if (currentSavings < 0) {
      result.push({
        type: 'negative_savings',
        severity: 'high',
        messageKey: 'smartAlerts.negativeSavings',
        messageParams: {
          amount: formatCurrency(Math.abs(currentSavings))
        }
      });
    }

    // Sort by severity
    const severityOrder = { high: 0, medium: 1, low: 2 };
    result.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return result;
  }, [transactions, getUpcomingBills, currencyCode]);

  const getAlertStyles = (severity) => {
    switch (severity) {
      case 'high':
        return {
          bg: 'bg-red-50 dark:bg-red-900/30',
          border: 'border-red-200 dark:border-red-700',
          icon: 'bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400',
          text: 'text-red-800 dark:text-red-200'
        };
      case 'medium':
        return {
          bg: 'bg-amber-50 dark:bg-amber-900/30',
          border: 'border-amber-200 dark:border-amber-700',
          icon: 'bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400',
          text: 'text-amber-800 dark:text-amber-200'
        };
      default:
        return {
          bg: 'bg-blue-50 dark:bg-blue-900/30',
          border: 'border-blue-200 dark:border-blue-700',
          icon: 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400',
          text: 'text-blue-800 dark:text-blue-200'
        };
    }
  };

  const getAlertIcon = (type) => {
    switch (type) {
      case 'spike':
      case 'large_transaction':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        );
      case 'bills_due':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'negative_savings':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  if (alerts.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-slate-700">
        <div className="flex items-center gap-2 mb-4">
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">{t('smartAlerts.title')}</h3>
        </div>
        <p className="text-gray-500 dark:text-slate-400 text-sm">{t('smartAlerts.noAlerts')}</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-slate-700">
      <div className="flex items-center gap-2 mb-4">
        <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">{t('smartAlerts.title')}</h3>
        <span className="ml-auto bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200 text-xs font-medium px-2 py-1 rounded-full">
          {t('smartAlerts.alertCount', { count: alerts.length })}
        </span>
      </div>

      <div className="space-y-3">
        {alerts.map((alert, index) => {
          const styles = getAlertStyles(alert.severity);
          return (
            <div
              key={index}
              className={`flex items-start gap-3 p-3 rounded-lg border ${styles.bg} ${styles.border}`}
            >
              <div className={`flex-shrink-0 p-1 rounded-full ${styles.icon}`}>
                {getAlertIcon(alert.type)}
              </div>
              <div className="flex-1">
                <p className={`text-sm font-medium ${styles.text}`}>
                  {t(alert.messageKey, alert.messageParams)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-700">
        <p className="text-xs text-gray-500 dark:text-slate-400">
          {t('smartAlerts.basedOn')}
        </p>
      </div>
    </div>
  );
}

export default memo(SmartAlerts);
